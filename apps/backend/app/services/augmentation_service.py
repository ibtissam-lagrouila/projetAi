import datetime
import hashlib
import json
import logging
import math
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, precision_score, recall_score
from sklearn.neighbors import NearestNeighbors
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.utils.class_weight import compute_class_weight
from sqlalchemy.orm import Session

from app.models.dataset_version import DatasetVersion
from app.models.transformation import Transformation
from app.schemas.augmentation import (
    AugmentationApplyRequest,
    AugmentationApplyResponse,
    AugmentationComparisonRequest,
    AugmentationComparisonResponse,
    AugmentationPreviewRequest,
    AugmentationPreviewResponse,
    ComparisonMetricResult,
    GuardrailResult,
    ModelComparisonMetrics,
    SplitConfig,
    TargetBalanceConfig,
    TechniquesConfig,
)
from app.services.lineage_service import lineage_service
from app.services.parquet_service import parquet_service
from app.services.profiling_service import profiling_service
from app.services.storage_service import storage_service

logger = logging.getLogger(__name__)

AUGMENTATION_METADATA_COLS = ["split", "is_synthetic", "origin", "parent_ids"]


class AugmentationService:
    """Data Augmentation service for step 03:
    - Stratified / grouped Train / Val / Test split (only Train is augmented).
    - Target balancing with a 50% cap on synthetic data per class.
    - Deterministic SMOTE-NC with full parent traceability (parent_ids).
    - Explicit and robust date handling.
    - Reproducible random undersampling of the majority class.
    - Light Gaussian noise on numeric columns of generated rows with strict bounding.
    - Class weight computation for the Training step.
    - Exhaustive validation of all 6 real guardrails before saving.
    - Immutable versioning with deterministic logical hash.
    """

    def calculate_logical_data_hash(self, df: pd.DataFrame) -> str:
        """Computes a deterministic SHA-256 hash based on the logical data content
        (values, types and fixed column order), independent of Parquet file metadata.
        """
        sorted_cols = sorted(df.columns.tolist())
        df_sorted_cols = df[sorted_cols].copy()

        def make_sort_key(row):
            parts = []
            for val in row:
                if pd.isna(val):
                    parts.append("__DATALIFT_NULL__")
                elif isinstance(val, (int, float, np.number)):
                    parts.append(f"num:{val:.6f}")
                else:
                    parts.append(f"str:{str(val)}")
            return "||".join(parts)

        keys = df_sorted_cols.apply(make_sort_key, axis=1)
        sort_order = np.argsort(keys.values)
        df_canonical = df_sorted_cols.iloc[sort_order].reset_index(drop=True)

        hasher = hashlib.sha256()
        for col in sorted_cols:
            col_series = df_canonical[col]
            hasher.update(f"col:{col}:{col_series.dtype}".encode("utf-8"))
            for val in col_series:
                if pd.isna(val):
                    hasher.update(b"__NULL__")
                elif isinstance(val, (int, np.integer)):
                    hasher.update(f"int:{int(val)}".encode("utf-8"))
                elif isinstance(val, (float, np.floating)):
                    hasher.update(f"flt:{float(val):.6f}".encode("utf-8"))
                elif isinstance(val, bool):
                    hasher.update(b"bool:1" if val else b"bool:0")
                else:
                    hasher.update(f"str:{str(val)}".encode("utf-8"))

        return hasher.hexdigest()

    @staticmethod
    def _is_integer_column(series: pd.Series) -> bool:
        """Determines if a numeric column is or should be integer (e.g. age, income)."""
        if pd.api.types.is_integer_dtype(series):
            return True
        col_name = str(series.name).lower() if series.name else ""
        if col_name in ["age", "income", "revenu", "anciennete", "tenure", "nb_commandes"]:
            return True
        clean = series.dropna()
        if len(clean) > 0 and pd.api.types.is_numeric_dtype(series):
            try:
                vals = clean.to_numpy(dtype=float)
                return bool(np.all(np.mod(vals, 1) == 0))
            except Exception:
                return False
        return False

    def detect_id_column(self, df: pd.DataFrame) -> Optional[str]:
        """Detects a potential identifier column (e.g. customer_id, id, user_id)."""
        candidates = ["customer_id", "id", "client_id", "user_id", "id_client", "customerid"]
        for c in candidates:
            if c in df.columns:
                return c
        for c in df.columns:
            if c.lower().endswith("_id") or c.lower().startswith("id_"):
                return c
        return None

    def detect_date_columns(self, df: pd.DataFrame) -> List[str]:
        """Detects date/datetime type columns."""
        date_cols = []
        for col in df.columns:
            if col in AUGMENTATION_METADATA_COLS:
                continue
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                date_cols.append(col)
            elif df[col].dtype == "object":
                # Check if non-null values are convertible to date
                sample = df[col].dropna().head(10)
                if len(sample) > 0:
                    try:
                        pd.to_datetime(sample, format="mixed", errors="raise")
                        date_cols.append(col)
                    except Exception:
                        pass
        return date_cols

    def perform_stratified_split(
        self,
        df: pd.DataFrame,
        split_config: SplitConfig,
        target_column: str,
    ) -> Tuple[pd.DataFrame, Dict[str, float]]:
        """Performs stratified Train / Val / Test split on the target column,
        with optional group_by support (e.g. customer_id).
        Adds the 'split' column ('train', 'val', 'test').
        """
        stratify_col = split_config.stratify_column or target_column
        if stratify_col not in df.columns:
            raise ValueError(f"Stratification column '{stratify_col}' not found.")

        train_r = split_config.train_ratio
        val_r = split_config.val_ratio
        test_r = split_config.test_ratio
        total_r = train_r + val_r + test_r
        train_r /= total_r
        val_r /= total_r
        test_r /= total_r

        rng = np.random.RandomState(split_config.random_seed)
        df_result = df.copy()

        # Identifier la classe rare
        vc = df[target_column].dropna().value_counts()
        if len(vc) < 2:
            raise ValueError(f"Target column '{target_column}' must have at least 2 classes.")
        minority_class = vc.index[-1]
        total_rare_in_dataset = int((df[target_column] == minority_class).sum())
        total_dataset_rows = len(df)

        group_by = split_config.group_by_column
        if group_by and group_by in df.columns:
            # If each group is a unique row (e.g. customer_id with 1 row per customer),
            # direct stratified split guarantees both strict uniqueness and perfect stratification.
            if df[group_by].nunique() == len(df):
                split_series = pd.Series(index=df.index, dtype="object")
                for cls_val in vc.index:
                    cls_indices = df[df[stratify_col] == cls_val].index.to_numpy()
                    rng.shuffle(cls_indices)
                    n_cls = len(cls_indices)
                    n_tr = int(round(n_cls * train_r))
                    n_v = int(round(n_cls * val_r))

                    tr_idx = cls_indices[:n_tr]
                    v_idx = cls_indices[n_tr : n_tr + n_v]
                    te_idx = cls_indices[n_tr + n_v :]

                    split_series[tr_idx] = "train"
                    split_series[v_idx] = "val"
                    split_series[te_idx] = "test"
                df_result["split"] = split_series
            else:
                # Real groups potentially with multiple rows per group
                groups = df.groupby(group_by)
                group_keys = list(groups.groups.keys())
                rng.shuffle(group_keys)

                groups_with_min = []
                groups_without_min = []
                total_min_samples = 0
                for gk in group_keys:
                    gdf = groups.get_group(gk)
                    g_size = len(gdf)
                    g_min = int((gdf[target_column] == minority_class).sum())
                    if g_min > 0:
                        groups_with_min.append((gk, g_size, g_min))
                        total_min_samples += g_min
                    else:
                        groups_without_min.append((gk, g_size, 0))

                rng.shuffle(groups_with_min)
                rng.shuffle(groups_without_min)

                target_min = {
                    "train": max(1.0, total_min_samples * train_r),
                    "val": max(1.0, total_min_samples * val_r),
                    "test": max(1.0, total_min_samples * test_r),
                }
                cur_min = {"train": 0, "val": 0, "test": 0}
                cur_tot = {"train": 0, "val": 0, "test": 0}
                assigned_groups: Dict[str, List[Any]] = {"train": [], "val": [], "test": []}

                # 1. Allouer d'abord les groupes contenant la classe rare proportionnellement
                for gk, g_len, m_cnt in groups_with_min:
                    best_p = min(
                        ["train", "val", "test"],
                        key=lambda p: (cur_min[p] / target_min[p], cur_tot[p]),
                    )
                    assigned_groups[best_p].append(gk)
                    cur_min[best_p] += m_cnt
                    cur_tot[best_p] += g_len

                # 2. Allocate majority groups to reach target split size
                target_tot = {
                    "train": len(df) * train_r,
                    "val": len(df) * val_r,
                    "test": len(df) * test_r,
                }
                for gk, g_len, _ in groups_without_min:
                    best_p = min(
                        ["train", "val", "test"],
                        key=lambda p: cur_tot[p] / target_tot[p],
                    )
                    assigned_groups[best_p].append(gk)
                    cur_tot[best_p] += g_len

                # Assignation du split
                split_series = pd.Series(index=df.index, dtype="object")
                split_series[df[group_by].isin(assigned_groups["train"])] = "train"
                split_series[df[group_by].isin(assigned_groups["val"])] = "val"
                split_series[df[group_by].isin(assigned_groups["test"])] = "test"
                df_result["split"] = split_series

            # Constraint verification: at least 3 rare class examples per split
            for s_name in ["train", "val", "test"]:
                sub = df_result[(df_result["split"] == s_name) & (df_result[target_column] == minority_class)]
                s_min_count = len(sub)
                if s_min_count < 3:
                    raise ValueError(
                        f"The entire dataset contains only {total_rare_in_dataset} example(s) of minority class '{minority_class}' "
                        f"(out of {total_dataset_rows} total rows). With group_by='{group_by}', the split produces a partition with fewer than 3 examples "
                        f"of the rare class in {s_name} ({s_min_count} found, minimum required: 3). "
                        f"What to do: (1) provide a dataset with more rare class examples, "
                        f"(2) remove group_by for a direct split, or "
                        f"(3) choose another target column with sufficient sample counts."
                    )
        else:
            # Simple Stratified Split with deterministic permutations per class
            split_series = pd.Series(index=df.index, dtype="object")

            for cls_val in vc.index:
                cls_indices = df[df[stratify_col] == cls_val].index.to_numpy()
                rng.shuffle(cls_indices)
                n_cls = len(cls_indices)
                n_tr = int(round(n_cls * train_r))
                n_v = int(round(n_cls * val_r))

                tr_idx = cls_indices[:n_tr]
                v_idx = cls_indices[n_tr : n_tr + n_v]
                te_idx = cls_indices[n_tr + n_v :]

                split_series[tr_idx] = "train"
                split_series[v_idx] = "val"
                split_series[te_idx] = "test"

            df_result["split"] = split_series

            # Check at least 3 examples in train, and at least 1 in val and test
            train_sub = df_result[(df_result["split"] == "train") & (df_result[target_column] == minority_class)]
            if len(train_sub) < 3:
                raise ValueError(
                    f"The entire dataset contains only {total_rare_in_dataset} example(s) of minority class '{minority_class}' "
                    f"(out of {total_dataset_rows} total rows). Stratified split produced fewer than 3 examples of minority class in train "
                    f"({len(train_sub)} found, minimum required: 3 for SMOTE-NC). "
                    f"What to do: (1) provide a dataset with more data for this class, "
                    f"(2) adjust split ratios (e.g. increase train ratio), or "
                    f"(3) choose another target column with sufficient sample counts."
                )
            for s_name in ["val", "test"]:
                sub = df_result[(df_result["split"] == s_name) & (df_result[target_column] == minority_class)]
                if len(sub) < 1:
                    raise ValueError(
                        f"The entire dataset contains only {total_rare_in_dataset} example(s) of minority class '{minority_class}' "
                        f"(out of {total_dataset_rows} total rows), leaving 0 examples in {s_name}. "
                        f"What to do: (1) provide more data for this class, "
                        f"(2) adjust split ratios, or "
                        f"(3) choose another target column with sufficient sample counts."
                    )

        # Calculate actual obtained ratios
        total_len = len(df_result)
        actual_ratios = {
            "train": round(float((df_result["split"] == "train").sum() / total_len), 3),
            "val": round(float((df_result["split"] == "val").sum() / total_len), 3),
            "test": round(float((df_result["split"] == "test").sum() / total_len), 3),
        }

        # Initialize lineage metadata for existing rows
        df_result["is_synthetic"] = False
        df_result["origin"] = "real"
        df_result["parent_ids"] = None

        return df_result, actual_ratios

    def calculate_target_balance_score(self, series: pd.Series) -> int:
        """Computes the target balance score on [0, 100] via normalized Shannon entropy,
        identical to the documented Profiling formula.
        """
        clean = series.dropna()
        if len(clean) == 0:
            return 0
        vc = clean.value_counts()
        num_classes = len(vc)
        if num_classes <= 1:
            return 0
        probs = vc / len(clean)
        entropy = -np.sum(probs * np.log(probs)) / np.log(num_classes)
        return int(round(float(entropy * 100.0)))

    def apply_augmentation_pipeline(
        self,
        df: pd.DataFrame,
        target_column: str,
        split_config: SplitConfig,
        balance_config: TargetBalanceConfig,
        techniques: TechniquesConfig,
    ) -> Dict[str, Any]:
        """Executes the complete augmentation pipeline (used identically by preview and apply).
        Returns the enriched DataFrame along with detailed metadata and guardrails.
        """
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found.")

        # 1. Initial stratified split (Val and Test remain 100% real and locked)
        df_split, actual_ratios = self.perform_stratified_split(df, split_config, target_column)

        train_mask = df_split["split"] == "train"
        val_mask = df_split["split"] == "val"
        test_mask = df_split["split"] == "test"

        df_train = df_split[train_mask].copy()
        df_val = df_split[val_mask].copy()
        df_test = df_split[test_mask].copy()

        initial_train_rows = len(df_train)
        vc_train = df_train[target_column].value_counts()
        if len(vc_train) < 2:
            raise ValueError(f"Training set must have at least 2 classes for target '{target_column}'.")

        majority_class = vc_train.index[0]
        minority_class = vc_train.index[-1]
        n_maj_real = int(vc_train.loc[majority_class])
        n_min_real = int(vc_train.loc[minority_class])

        balance_score_before = self.calculate_target_balance_score(df_train[target_column])
        minority_pct_before = round((n_min_real / initial_train_rows) * 100.0, 1)

        # Step execution
        if techniques.class_weights_enabled and (techniques.smote_nc_enabled or techniques.undersample_enabled):
            raise ValueError(
                "Guardrail violated (No double correction): "
                "You cannot simultaneously enable resampling (SMOTE/undersampling) "
                "and class weights. Choose one or the other technique."
            )

        # Step execution
        if techniques.smote_nc_enabled:
            # Step execution
            feature_cols = [c for c in df_train.columns if c not in AUGMENTATION_METADATA_COLS and c != target_column]
            missing_cols = {}
            for col in feature_cols:
                null_count = int(df_train[col].isna().sum())
                if df_train[col].dtype == "object":
                    null_count += int((df_train[col].astype(str).str.strip() == "").sum())
                if null_count > 0:
                    missing_cols[col] = null_count

            if missing_cols:
                cols_str = ", ".join(f"'{k}' ({v} missing)" for k, v in missing_cols.items())
                raise ValueError(
                    f"SMOTE-NC cannot be applied because the dataset contains missing values "
                    f"in the following columns: {cols_str}. "
                    "Please first clean these columns in step 02 Cleaning (/cleaning)."
                )

        # Step execution
        target_mode = balance_config.mode
        if target_mode == "keep":
            target_ratio = n_min_real / initial_train_rows
        elif target_mode == "20":
            target_ratio = 0.20
        elif target_mode == "30":
            target_ratio = 0.30
        elif target_mode == "50":
            target_ratio = 0.50
        else:
            target_ratio = balance_config.custom_target_ratio or (n_min_real / initial_train_rows)

        # Step execution
        # Plafond : n_synth_max = n_min_real (ainsi n_synth / (n_min_real + n_synth) <= 50%)
        id_col = self.detect_id_column(df_train)
        date_cols = self.detect_date_columns(df_train)

        n_synth_to_generate = 0
        n_maj_to_keep = n_maj_real

        if target_mode != "keep" and not techniques.class_weights_enabled:
            # Step execution
            # (n_min + S) / (n_maj + n_min + S) = r  =>  S = (r * n_maj - (1-r) * n_min) / (1-r)
            if (1.0 - target_ratio) > 0:
                raw_s = (target_ratio * n_maj_real - (1.0 - target_ratio) * n_min_real) / (1.0 - target_ratio)
                ideal_synth = max(0, int(round(raw_s)))
            else:
                ideal_synth = n_maj_real - n_min_real

            if techniques.smote_nc_enabled:
                # Step execution
                n_synth_to_generate = min(ideal_synth, n_min_real)
            else:
                n_synth_to_generate = 0

            final_minority_rows = n_min_real + n_synth_to_generate

            # Step execution
            if techniques.undersample_enabled and target_ratio > 0:
                # final_minority_rows / (n_maj_kept + final_minority_rows) = target_ratio
                # n_maj_kept = final_minority_rows * (1 - target_ratio) / target_ratio
                calculated_maj_keep = int(round(final_minority_rows * (1.0 - target_ratio) / target_ratio))
                n_maj_to_keep = min(n_maj_real, max(3, calculated_maj_keep))
            else:
                n_maj_to_keep = n_maj_real

        # Step execution
        df_generated = pd.DataFrame()
        parent_pairs_list: List[Tuple[Any, Any]] = []

        if n_synth_to_generate > 0 and techniques.smote_nc_enabled:
            df_minority_train = df_train[df_train[target_column] == minority_class].copy()
            k = techniques.smote_k_neighbors
            if len(df_minority_train) < k + 1:
                raise ValueError(
                    f"SMOTE-NC requires at least {k + 1} rare class examples in train (k={k}), "
                    f"but only {len(df_minority_train)} are available. Reduce k or adjust the split."
                )

            # Column type identification
            exclude_feature_cols = set(AUGMENTATION_METADATA_COLS + [target_column])
            if id_col:
                exclude_feature_cols.add(id_col)

            num_cols = []
            cat_cols = []
            for col in df_train.columns:
                if col in exclude_feature_cols or col in date_cols:
                    continue
                if pd.api.types.is_numeric_dtype(df_train[col]):
                    num_cols.append(col)
                else:
                    cat_cols.append(col)

            # Step execution
            scaler = StandardScaler()
            if num_cols:
                scaled_num = scaler.fit_transform(df_minority_train[num_cols])
            else:
                scaled_num = np.empty((len(df_minority_train), 0))

            if cat_cols:
                # Simple one-hot encoding for distance calculation
                encoded_cat = pd.get_dummies(df_minority_train[cat_cols], drop_first=False).to_numpy(dtype=float)
            else:
                encoded_cat = np.empty((len(df_minority_train), 0))

            if scaled_num.shape[1] + encoded_cat.shape[1] > 0:
                knn_features = np.hstack([scaled_num, encoded_cat])
            else:
                knn_features = np.zeros((len(df_minority_train), 1))

            nn_model = NearestNeighbors(n_neighbors=k + 1, metric="euclidean")
            nn_model.fit(knn_features)
            distances, indices = nn_model.kneighbors(knn_features)

            # Step execution
            gen_rng = np.random.RandomState(split_config.random_seed + 100)
            generated_rows = []

            # Step execution
            if id_col:
                parent_identifiers = df_minority_train[id_col].tolist()
            else:
                parent_identifiers = [f"IDX-{idx}" for idx in df_minority_train.index]

            n_min_avail = len(df_minority_train)
            for g_idx in range(n_synth_to_generate):
                # Choix d'un exemple minority et d'un de ses k voisins
                base_idx = g_idx % n_min_avail
                neighbor_choice = gen_rng.randint(1, k + 1)
                neighbor_idx = indices[base_idx, neighbor_choice]

                row_base = df_minority_train.iloc[base_idx]
                row_neighbor = df_minority_train.iloc[neighbor_idx]

                parent_1_id = parent_identifiers[base_idx]
                parent_2_id = parent_identifiers[neighbor_idx]
                parent_pairs_list.append((parent_1_id, parent_2_id))

                lambda_coef = gen_rng.uniform(0.0, 1.0)
                new_row: Dict[str, Any] = {}

                # Step execution
                for nc in num_cols:
                    val_1 = float(row_base[nc])
                    val_2 = float(row_neighbor[nc])
                    interp_val = val_1 + lambda_coef * (val_2 - val_1)

                    is_int = self._is_integer_column(df_train[nc])
                    if is_int:
                        interp_val = int(round(interp_val))
                    elif str(nc).lower() in ["monthly_charges", "charges", "price", "amount", "montant", "prix", "cout"]:
                        interp_val = round(float(interp_val), 2)
                    else:
                        interp_val = round(float(interp_val), 2)

                    # Step execution
                    min_obs = df_train[nc].min()
                    max_obs = df_train[nc].max()
                    if is_int:
                        interp_val = int(max(int(min_obs), min(int(max_obs), interp_val)))
                    else:
                        interp_val = max(min_obs, min(max_obs, interp_val))
                    new_row[nc] = interp_val

                # Step execution
                for cc in cat_cols:
                    new_row[cc] = row_base[cc] if lambda_coef < 0.5 else row_neighbor[cc]

                # 3. Dates : interpolation des timestamps et reconversion selon le type d'origine
                for dc in date_cols:
                    try:
                        t1 = pd.to_datetime(row_base[dc]).timestamp()
                        t2 = pd.to_datetime(row_neighbor[dc]).timestamp()
                        interp_ts = t1 + lambda_coef * (t2 - t1)
                        dt_interp = pd.to_datetime(interp_ts, unit="s")
                        
                        first_valid = df_train[dc].dropna().iloc[0] if len(df_train[dc].dropna()) > 0 else None
                        if pd.api.types.is_datetime64_any_dtype(df_train[dc]):
                            new_row[dc] = dt_interp
                        elif isinstance(first_valid, datetime.date) and not isinstance(first_valid, datetime.datetime):
                            new_row[dc] = dt_interp.date()
                        elif isinstance(first_valid, datetime.datetime):
                            new_row[dc] = dt_interp.to_pydatetime()
                        else:
                            new_row[dc] = dt_interp.strftime("%Y-%m-%d")
                    except Exception:
                        new_row[dc] = row_base[dc]

                # 4. Identifier column: new format SYN-XXXXXX
                if id_col:
                    new_row[id_col] = f"SYN-{g_idx + 1:06d}"

                # 5. Target: strictly minority class
                new_row[target_column] = minority_class

                # Step execution
                new_row["split"] = "train"
                new_row["is_synthetic"] = True
                new_row["origin"] = "smote"
                new_row["parent_ids"] = f"{parent_1_id} + {parent_2_id}"

                generated_rows.append(new_row)

            df_generated = pd.DataFrame(generated_rows)

            # Step execution
            if techniques.light_noise_enabled and num_cols:
                noise_rng = np.random.RandomState(split_config.random_seed + 200)
                strength = techniques.noise_strength_pct / 100.0
                for nc in num_cols:
                    std_val = float(df_train[nc].std())
                    if std_val > 0:
                        noise = noise_rng.normal(0, strength * std_val, size=len(df_generated))
                        noisy_vals = df_generated[nc].to_numpy(dtype=float) + noise
                        min_obs = df_train[nc].min()
                        max_obs = df_train[nc].max()
                        noisy_vals = np.clip(noisy_vals, min_obs, max_obs)
                        if self._is_integer_column(df_train[nc]):
                            noisy_vals = np.round(noisy_vals).astype(int)
                        else:
                            noisy_vals = np.round(noisy_vals, 2)
                        df_generated[nc] = noisy_vals

        # Step execution
        df_majority_train = df_train[df_train[target_column] == majority_class].copy()
        rows_undersampled = 0
        if n_maj_to_keep < n_maj_real and techniques.undersample_enabled:
            under_rng = np.random.RandomState(techniques.undersample_seed)
            keep_indices = under_rng.choice(df_majority_train.index, size=n_maj_to_keep, replace=False)
            df_majority_train_kept = df_majority_train.loc[keep_indices].copy()
            rows_undersampled = n_maj_real - n_maj_to_keep
        else:
            df_majority_train_kept = df_majority_train

        # Step execution
        df_minority_train = df_train[df_train[target_column] == minority_class].copy()
        if not df_generated.empty:
            df_train_final = pd.concat([df_majority_train_kept, df_minority_train, df_generated], ignore_index=True)
        else:
            df_train_final = pd.concat([df_majority_train_kept, df_minority_train], ignore_index=True)

        # Step execution
        class_weights_dict = None
        if techniques.class_weights_enabled:
            classes = np.unique(df_train[target_column])
            weights = compute_class_weight(class_weight="balanced", classes=classes, y=df_train[target_column])
            class_weights_dict = {str(c): round(float(w), 3) for c, w in zip(classes, weights)}

        # Step execution
        df_final = pd.concat([df_train_final, df_val, df_test], ignore_index=True)

        # Step execution
        for nc in num_cols:
            if self._is_integer_column(df_train[nc]):
                try:
                    df_final[nc] = df_final[nc].round().astype(int)
                except Exception:
                    pass
            elif str(nc).lower() in ["monthly_charges", "charges", "price", "amount", "montant", "prix", "cout"]:
                try:
                    df_final[nc] = df_final[nc].round(2)
                except Exception:
                    pass

        # Step execution
        final_train_rows = len(df_train_final)
        final_min_count = int((df_train_final[target_column] == minority_class).sum())
        minority_pct_after = round((final_min_count / max(1, final_train_rows)) * 100.0, 1)
        balance_score_after = self.calculate_target_balance_score(df_train_final[target_column])

        # ----------------------------------------------------
        # Step execution
        # ----------------------------------------------------
        guardrails: List[GuardrailResult] = []

        # Step execution
        val_test_size_ok = (len(df_val) == len(df_split[val_mask])) and (len(df_test) == len(df_split[test_mask]))
        val_test_no_synthetic = (df_val["is_synthetic"].sum() == 0) and (df_test["is_synthetic"].sum() == 0)
        # Step execution
        train_indices_set = set(df_train_final.index)
        g1_passed = bool(val_test_size_ok and val_test_no_synthetic)
        guardrails.append(
            GuardrailResult(
                key="test_and_val_never_augmented",
                label="Test and validation sets never augmented",
                passed=g1_passed,
                description=f"{len(df_test):,} test rows and {len(df_val):,} val rows remain 100% real",
                details={"test_rows": len(df_test), "val_rows": len(df_val)},
            )
        )

        # Step execution
        g2_passed = bool(len(df_generated) <= n_min_real)
        guardrails.append(
            GuardrailResult(
                key="max_50_pct_synthetic_per_class",
                label="Max 50% synthetic cap per class",
                passed=g2_passed,
                description=f"{len(df_generated):,} synthetic generated for {n_min_real:,} real (max 50% of class)",
                details={"synthetic_generated": len(df_generated), "real_minority": n_min_real},
            )
        )

        # Step execution
        if not df_generated.empty:
            g3_passed = bool(
                (df_generated["is_synthetic"] == True).all()
                and (df_generated["origin"] == "smote").all()
                and df_generated["parent_ids"].notna().all()
            )
        else:
            g3_passed = True
        guardrails.append(
            GuardrailResult(
                key="origin_tag_on_every_generated_row",
                label="Origin tag and parents on each generated row",
                passed=g3_passed,
                description="origin = smote · parent_ids = both real parent ids",
                details={"tagged_rows": len(df_generated)},
            )
        )

        # Step execution
        g4_passed = True
        if not df_generated.empty:
            for cc in cat_cols:
                obs_cats = set(df_train[cc].dropna().unique())
                gen_cats = set(df_generated[cc].dropna().unique())
                if not gen_cats.issubset(obs_cats):
                    g4_passed = False
                    break
        guardrails.append(
            GuardrailResult(
                key="categories_stay_valid",
                label="Category validity (invariants)",
                passed=g4_passed,
                description="SMOTE-NC invents no category absent from real data",
                details={"categories_checked": cat_cols},
            )
        )

        # Guardrail 5 : Voisins et parents issus exclusivement du Train
        g5_passed = True
        if not df_generated.empty and parent_pairs_list:
            if id_col:
                train_id_set = set(df_minority_train[id_col].tolist())
                for p1, p2 in parent_pairs_list:
                    if p1 not in train_id_set or p2 not in train_id_set:
                        g5_passed = False
                        break
        guardrails.append(
            GuardrailResult(
                key="parents_from_train_only",
                label="Parents de SMOTE-NC issus uniquement du Train",
                passed=g5_passed,
                description="All neighbors and parent_ids originate exclusively from Train subset",
                details={"parents_validated": len(parent_pairs_list)},
            )
        )

        # Guardrail 6 : Pas de double correction
        g6_passed = not (techniques.class_weights_enabled and (techniques.smote_nc_enabled or techniques.undersample_enabled))
        guardrails.append(
            GuardrailResult(
                key="no_double_correction",
                label="Pas de double correction",
                passed=g6_passed,
                description="Resampling or class weights, never both simultaneously",
                details={"class_weights": techniques.class_weights_enabled, "resampling": techniques.smote_nc_enabled},
            )
        )

        # Step execution
        for g in guardrails:
            if not g.passed:
                raise ValueError(f"Security check failed ({g.label}): {g.description}")

        def _format_cell_value(col: str, val: Any) -> Any:
            if pd.isna(val):
                return None
            if col in df_train.columns and self._is_integer_column(df_train[col]):
                try:
                    return int(round(float(val)))
                except Exception:
                    return val
            if str(col).lower() in ["monthly_charges", "charges", "price", "amount", "montant", "prix", "cout"] or (
                col in df_train.columns and pd.api.types.is_float_dtype(df_train[col])
            ):
                try:
                    return round(float(val), 2)
                except Exception:
                    return val
            return val

        # Step execution
        sample_preview: List[Dict[str, Any]] = []
        real_samples = df_minority_train.head(2).to_dict(orient="records")
        for r in real_samples:
            r_dict = {str(k): _format_cell_value(k, v) for k, v in r.items()}
            r_dict["origin_display"] = f"real · {r.get(id_col, 'ID')}"
            sample_preview.append(r_dict)

        if not df_generated.empty:
            synth_samples = df_generated.head(2).to_dict(orient="records")
            for s in synth_samples:
                s_dict = {str(k): _format_cell_value(k, v) for k, v in s.items()}
                s_dict["origin_display"] = f"smote · {s.get('parent_ids', '')}"
                sample_preview.append(s_dict)

        # Step execution
        recipe = {
            "version": "1.0",
            "stage": "03_AUGMENTATION",
            "target_column": target_column,
            "split": {
                "ratios_target": {"train": split_config.train_ratio, "val": split_config.val_ratio, "test": split_config.test_ratio},
                "ratios_actual": actual_ratios,
                "stratify_column": split_config.stratify_column or target_column,
                "group_by_column": split_config.group_by_column,
                "random_seed": split_config.random_seed,
            },
            "balance": {
                "mode": balance_config.mode,
                "target_minority_ratio": target_ratio,
                "minority_pct_before": minority_pct_before,
                "minority_pct_after": minority_pct_after,
                "balance_score_before": balance_score_before,
                "balance_score_after": balance_score_after,
            },
            "techniques": [
                {
                    "name": "SMOTE-NC",
                    "enabled": techniques.smote_nc_enabled,
                    "target_class": str(minority_class),
                    "k_neighbors": techniques.smote_k_neighbors,
                    "generated_rows": len(df_generated),
                },
                {
                    "name": "UNDERSAMPLE_MAJORITY",
                    "enabled": techniques.undersample_enabled,
                    "target_class": str(majority_class),
                    "seed": techniques.undersample_seed,
                    "rows_dropped": rows_undersampled,
                },
                {
                    "name": "LIGHT_NOISE",
                    "enabled": techniques.light_noise_enabled,
                    "strength_pct": techniques.noise_strength_pct,
                },
                {
                    "name": "CLASS_WEIGHTS",
                    "enabled": techniques.class_weights_enabled,
                    "weights": class_weights_dict,
                },
            ],
            "guardrails": [g.model_dump() for g in guardrails],
        }

        # Distribution for chart bars
        balance_distribution = {
            "majority": {
                "label": str(majority_class),
                "total_initial": n_maj_real,
                "kept": n_maj_to_keep,
                "undersampled": rows_undersampled,
            },
            "minority": {
                "label": str(minority_class),
                "total_initial": n_min_real,
                "real": n_min_real,
                "generated": len(df_generated),
            },
            "target_ratio": target_ratio,
            "cap_reached": len(df_generated) == n_min_real and len(df_generated) > 0,
        }

        return {
            "df_final": df_final,
            "rows_in_train_before": initial_train_rows,
            "rows_in_train_after": final_train_rows,
            "rows_generated": len(df_generated),
            "rows_undersampled": rows_undersampled,
            "test_set_size": len(df_test),
            "val_set_size": len(df_val),
            "actual_split_ratios": actual_ratios,
            "minority_class_raw": minority_class,
            "majority_class_raw": majority_class,
            "minority_class_label": str(minority_class),
            "majority_class_label": str(majority_class),
            "minority_pct_before": minority_pct_before,
            "minority_pct_after": minority_pct_after,
            "balance_score_before": balance_score_before,
            "balance_score_after": balance_score_after,
            "balance_distribution": balance_distribution,
            "guardrails": guardrails,
            "sample_preview": sample_preview,
            "recipe": recipe,
            "class_weights": class_weights_dict,
        }

    def preview_augmentation(
        self,
        parquet_path: Path,
        request: AugmentationPreviewRequest,
    ) -> AugmentationPreviewResponse:
        """Simulates augmentation on the Parquet file without saving anything."""
        table = pq.read_table(parquet_path)
        df = table.to_pandas()

        res = self.apply_augmentation_pipeline(
            df=df,
            target_column=request.target_column,
            split_config=request.split_config,
            balance_config=request.balance_config,
            techniques=request.techniques,
        )

        return AugmentationPreviewResponse(
            rows_in_train_before=res["rows_in_train_before"],
            rows_in_train_after=res["rows_in_train_after"],
            rows_generated=res["rows_generated"],
            rows_undersampled=res["rows_undersampled"],
            test_set_size=res["test_set_size"],
            val_set_size=res["val_set_size"],
            actual_split_ratios=res["actual_split_ratios"],
            minority_class_label=res["minority_class_label"],
            majority_class_label=res["majority_class_label"],
            minority_pct_before=res["minority_pct_before"],
            minority_pct_after=res["minority_pct_after"],
            balance_score_before=res["balance_score_before"],
            balance_score_after=res["balance_score_after"],
            balance_distribution=res["balance_distribution"],
            guardrails=res["guardrails"],
            sample_preview=res["sample_preview"],
            recipe=res["recipe"],
            class_weights=res["class_weights"],
        )

    def apply_augmentation_and_create_version(
        self,
        db: Session,
        source_version: DatasetVersion,
        request: AugmentationApplyRequest,
    ) -> Dict[str, Any]:
        """Applies augmentation, atomically saves the Parquet artifact,
        creates the immutable DatasetVersion (v3) + Transformation, and computes the profile.
        """
        source_path = Path(source_version.storage_path)
        if not source_path.exists():
            raise FileNotFoundError(f"Source Parquet file not found: {source_path}")

        table = pq.read_table(source_path)
        df = table.to_pandas()

        start_time = time.time()
        pipeline_res = self.apply_augmentation_pipeline(
            df=df,
            target_column=request.target_column,
            split_config=request.split_config,
            balance_config=request.balance_config,
            techniques=request.techniques,
        )

        df_augmented = pipeline_res["df_final"]
        rows_generated = pipeline_res["rows_generated"]
        rows_undersampled = pipeline_res["rows_undersampled"]
        recipe = pipeline_res["recipe"]

        # Step execution
        if rows_generated == 0 and rows_undersampled == 0 and not request.techniques.class_weights_enabled:
            # Step execution
            if request.balance_config.mode == "keep":
                raise ValueError("No data modified (0 rows generated, 0 undersampled). No new version created.")

        # Step execution
        data_hash = self.calculate_logical_data_hash(df_augmented)

        # Step execution
        new_version_hash = lineage_service.generate_version_hash(
            dataset_id=source_version.dataset_id,
            parent_version_hash=source_version.version_hash,
            transformation_name="AUGMENTATION_PIPELINE",
            parameters=recipe,
            data_hash=data_hash,
        )

        # Sauvegarde atomique du Parquet
        target_path = storage_service.get_version_parquet_path(source_version.dataset_id, new_version_hash)
        target_path.parent.mkdir(parents=True, exist_ok=True)

        # Step execution
        if source_version.schema_metadata and "columns" in source_version.schema_metadata:
            for c_info in source_version.schema_metadata["columns"]:
                c_name = c_info.get("name")
                c_type = c_info.get("type", "")
                if c_name in df_augmented.columns:
                    if "date" in c_type.lower():
                        try:
                            df_augmented[c_name] = pd.to_datetime(df_augmented[c_name]).dt.date
                        except Exception:
                            pass
                    elif "timestamp" in c_type.lower():
                        try:
                            df_augmented[c_name] = pd.to_datetime(df_augmented[c_name])
                        except Exception:
                            pass
        
        aug_table = pa.Table.from_pandas(df_augmented, preserve_index=False)
        metadata = parquet_service.extract_table_metadata(aug_table)
        pq.write_table(aug_table, target_path, compression="snappy")
        file_size = target_path.stat().st_size
        total_rows = len(df_augmented)

        # Step execution
        new_version = DatasetVersion(
            dataset_id=source_version.dataset_id,
            parent_version_id=source_version.id,
            version_hash=new_version_hash,
            storage_path=str(target_path),
            row_count=total_rows,
            size_bytes=file_size,
            schema_metadata=metadata,
        )
        db.add(new_version)
        db.flush()

        # Enregistrement de la transformation
        exec_duration_ms = (time.time() - start_time) * 1000.0
        transformation = Transformation(
            name="AUGMENTATION_PIPELINE",
            parameters=recipe,
            source_version_id=source_version.id,
            target_version_id=new_version.id,
            execution_time_ms=exec_duration_ms,
        )
        db.add(transformation)
        db.commit()
        db.refresh(new_version)

        # Step execution
        original_filename = None
        curr = source_version
        while curr:
            if curr.transformation_produced and curr.transformation_produced.parameters:
                original_filename = (
                    curr.transformation_produced.parameters.get("filename")
                    or curr.transformation_produced.parameters.get("original_filename")
                )
                if original_filename:
                    break
            if not curr.parent_version_id:
                break
            curr = curr.parent_version

        if not original_filename:
            original_filename = f"{source_version.dataset.name}.csv" if source_version.dataset else "dataset.csv"

        # Step execution
        before_profile = profiling_service.get_or_create_profile(
            dataset_id=str(source_version.dataset_id),
            version_hash=source_version.version_hash,
            parquet_path=source_path,
            target_column=request.target_column,
            original_filename=original_filename,
        )
        after_profile = profiling_service.get_or_create_profile(
            dataset_id=str(source_version.dataset_id),
            version_hash=new_version_hash,
            parquet_path=target_path,
            target_column=request.target_column,
            original_filename=original_filename,
            force_recompute=True,
        )

        b_score = pipeline_res["balance_score_before"]
        a_score = pipeline_res["balance_score_after"]
        balance_delta = int(a_score - b_score)

        return {
            "new_version": new_version,
            "transformation": transformation,
            "pipeline_result": pipeline_res,
            "before_profile": before_profile,
            "after_profile": after_profile,
            "balance_score_delta": balance_delta,
            "recipe": recipe,
        }

    def run_model_comparison(
        self,
        df: pd.DataFrame,
        target_column: str,
        split_config: SplitConfig,
        balance_config: TargetBalanceConfig,
        techniques: TechniquesConfig,
        model_type: str = "logistic_regression",
        seeds: Optional[List[int]] = None,
    ) -> AugmentationComparisonResponse:
        """Phase 3 - Model performance comparison "Does it help?":
        - Evaluates a model (Logistic Regression or Random Forest) over 5 random seeds.
        - Trains baseline model on real train rows of v3 (split = train, is_synthetic = false).
        - Trains augmented model on full train set of v3 (split = train).
        - Evaluates both models exclusively on the same real test set (split = test).
        - Scikit-learn preprocessor fitted strictly on train.
        - Rigorously excludes split, is_synthetic, origin, parent_ids, and IDs from features.
        - Returns mean and standard deviations for Recall, Precision and F1 on the rare class.
        """
        if seeds is None or len(seeds) == 0:
            seeds = [42, 43, 44, 45, 46]

        pipeline_res = self.apply_augmentation_pipeline(
            df=df,
            target_column=target_column,
            split_config=split_config,
            balance_config=balance_config,
            techniques=techniques,
        )

        df_final = pipeline_res["df_final"]
        minority_class = pipeline_res.get("minority_class_raw", pipeline_res.get("minority_class_label"))
        minority_label = pipeline_res.get("minority_class_label", str(minority_class))

        # Step execution
        # Step execution
        # Step execution
        # Step execution
        # Step execution
        df_base_train = df_final[(df_final["split"] == "train") & (~df_final["is_synthetic"])].copy()
        df_aug_train = df_final[df_final["split"] == "train"].copy()
        df_test = df_final[df_final["split"] == "test"].copy()

        # 2. Identification des variables explicatives
        exclude_cols = set([target_column] + AUGMENTATION_METADATA_COLS)

        # Step execution
        for c in df_final.columns:
            if c in exclude_cols:
                continue
            if c.lower() in ["id", "customer_id", "client_id"] or c.lower().endswith("_id"):
                exclude_cols.add(c)
            elif df_final[c].nunique() == len(df_final):
                exclude_cols.add(c)

        feature_cols = [c for c in df_final.columns if c not in exclude_cols]
        if not feature_cols:
            raise ValueError("No feature columns available to train comparison model.")

        # Step execution
        def _prepare_features(sub_df: pd.DataFrame) -> pd.DataFrame:
            feat_df = pd.DataFrame(index=sub_df.index)
            for c in feature_cols:
                col_s = sub_df[c]
                if pd.api.types.is_datetime64_any_dtype(col_s) or "date" in c.lower():
                    try:
                        feat_df[f"{c}_ts"] = pd.to_datetime(col_s).astype("int64") // 10**9
                    except Exception:
                        feat_df[c] = col_s.astype(str)
                elif pd.api.types.is_numeric_dtype(col_s) and not pd.api.types.is_bool_dtype(col_s):
                    feat_df[c] = pd.to_numeric(col_s, errors="coerce")
                elif pd.api.types.is_bool_dtype(col_s):
                    feat_df[c] = col_s.astype(int)
                else:
                    feat_df[c] = col_s.astype(str)
            return feat_df

        X_base_train_raw = _prepare_features(df_base_train)
        X_aug_train_raw = _prepare_features(df_aug_train)
        X_test_raw = _prepare_features(df_test)

        # Cible binaire (1 = classe rare, 0 = classe majoritaire)
        def _to_binary(series: pd.Series) -> np.ndarray:
            return ((series == minority_class) | (series.astype(str) == str(minority_class))).astype(int).to_numpy()

        y_base_train = _to_binary(df_base_train[target_column])
        y_aug_train = _to_binary(df_aug_train[target_column])
        y_test = _to_binary(df_test[target_column])

        test_total = len(y_test)
        test_positives = int((y_test == 1).sum())

        num_features = [c for c in X_base_train_raw.columns if pd.api.types.is_numeric_dtype(X_base_train_raw[c])]
        cat_features = [c for c in X_base_train_raw.columns if c not in num_features]

        transformers = []
        if num_features:
            transformers.append((
                "num",
                Pipeline([
                    ("imputer", SimpleImputer(strategy="median")),
                    ("scaler", StandardScaler()),
                ]),
                num_features,
            ))
        if cat_features:
            transformers.append((
                "cat",
                Pipeline([
                    ("imputer", SimpleImputer(strategy="constant", fill_value="missing")),
                    ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                ]),
                cat_features,
            ))

        preprocessor_base = ColumnTransformer(transformers=transformers)

        # 3. Loop over 5 seeds
        base_recalls: List[float] = []
        base_precisions: List[float] = []
        base_f1s: List[float] = []

        aug_recalls: List[float] = []
        aug_precisions: List[float] = []
        aug_f1s: List[float] = []

        cw = "balanced" if techniques.class_weights_enabled else None

        for s in seeds:
            # Step execution
            prep_b = clone(preprocessor_base)
            if model_type == "random_forest":
                clf_b = RandomForestClassifier(n_estimators=50, max_depth=6, random_state=s)
            else:
                clf_b = LogisticRegression(max_iter=1000, random_state=s)

            pipe_b = Pipeline([("prep", prep_b), ("clf", clf_b)])
            pipe_b.fit(X_base_train_raw, y_base_train)
            pred_b = pipe_b.predict(X_test_raw)

            base_recalls.append(float(recall_score(y_test, pred_b, pos_label=1, zero_division=0.0) * 100.0))
            base_precisions.append(float(precision_score(y_test, pred_b, pos_label=1, zero_division=0.0) * 100.0))
            base_f1s.append(float(f1_score(y_test, pred_b, pos_label=1, zero_division=0.0) * 100.0))

            # Step execution
            prep_a = clone(preprocessor_base)
            if model_type == "random_forest":
                clf_a = RandomForestClassifier(n_estimators=50, max_depth=6, random_state=s, class_weight=cw)
            else:
                clf_a = LogisticRegression(max_iter=1000, random_state=s, class_weight=cw)

            pipe_a = Pipeline([("prep", prep_a), ("clf", clf_a)])
            pipe_a.fit(X_aug_train_raw, y_aug_train)
            pred_a = pipe_a.predict(X_test_raw)

            aug_recalls.append(float(recall_score(y_test, pred_a, pos_label=1, zero_division=0.0) * 100.0))
            aug_precisions.append(float(precision_score(y_test, pred_a, pos_label=1, zero_division=0.0) * 100.0))
            aug_f1s.append(float(f1_score(y_test, pred_a, pos_label=1, zero_division=0.0) * 100.0))

        # Step execution
        baseline_metrics = ModelComparisonMetrics(
            recall=ComparisonMetricResult(
                mean=round(float(np.mean(base_recalls)), 1),
                std=round(float(np.std(base_recalls)), 1),
                seed_values=[round(v, 1) for v in base_recalls],
            ),
            precision=ComparisonMetricResult(
                mean=round(float(np.mean(base_precisions)), 1),
                std=round(float(np.std(base_precisions)), 1),
                seed_values=[round(v, 1) for v in base_precisions],
            ),
            f1_score=ComparisonMetricResult(
                mean=round(float(np.mean(base_f1s)), 1),
                std=round(float(np.std(base_f1s)), 1),
                seed_values=[round(v, 1) for v in base_f1s],
            ),
        )

        augmented_metrics = ModelComparisonMetrics(
            recall=ComparisonMetricResult(
                mean=round(float(np.mean(aug_recalls)), 1),
                std=round(float(np.std(aug_recalls)), 1),
                seed_values=[round(v, 1) for v in aug_recalls],
            ),
            precision=ComparisonMetricResult(
                mean=round(float(np.mean(aug_precisions)), 1),
                std=round(float(np.std(aug_precisions)), 1),
                seed_values=[round(v, 1) for v in aug_precisions],
            ),
            f1_score=ComparisonMetricResult(
                mean=round(float(np.mean(aug_f1s)), 1),
                std=round(float(np.std(aug_f1s)), 1),
                seed_values=[round(v, 1) for v in aug_f1s],
            ),
        )

        deltas = {
            "recall": round(augmented_metrics.recall.mean - baseline_metrics.recall.mean, 1),
            "precision": round(augmented_metrics.precision.mean - baseline_metrics.precision.mean, 1),
            "f1_score": round(augmented_metrics.f1_score.mean - baseline_metrics.f1_score.mean, 1),
        }

        # Avertissement / Signalement statistique si petit jeu de test
        if test_total < 60 or test_positives < 20:
            warning_disclaimer = (
                f"* On a small test set ({test_total} real examples including {test_positives} positives), "
                f"observed differences may be subject to statistical sampling variations."
            )
        else:
            warning_disclaimer = (
                f"* Evaluation conducted on real test set ({test_total} examples including {test_positives} positives), "
                f"repeated across {len(seeds)} random seeds."
            )

        model_label = "Logistic Regression" if model_type == "logistic_regression" else "Random Forest"

        return AugmentationComparisonResponse(
            model_type=model_type,
            model_label=model_label,
            test_total_count=test_total,
            test_positive_count=test_positives,
            minority_class_label=minority_label,
            baseline_metrics=baseline_metrics,
            augmented_metrics=augmented_metrics,
            deltas=deltas,
            seeds_used=seeds,
            warning_disclaimer=warning_disclaimer,
        )


augmentation_service = AugmentationService()