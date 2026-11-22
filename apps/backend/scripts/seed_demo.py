"""Demonstration and initialization script for Datalift.
Creates synthetic datasets, generates initial Parquet versions,
and applies successive transformations to demonstrate immutable lineage.
"""

import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal, init_db
from app.models.dataset import Dataset
from app.models.dataset_version import DatasetVersion
from app.models.transformation import Transformation
from app.services.parquet_service import parquet_service
from app.services.storage_service import storage_service
from app.services.lineage_service import lineage_service

SAMPLE_CHURN_CSV = """customer_id,age,tenure_months,monthly_charges,total_charges,contract,churn
101,29,12,65.5,786.0,Month-to-month,1
102,45,36,89.2,3211.2,One-year,0
103,52,48,105.0,5040.0,Two-year,0
104,33,6,45.0,270.0,Month-to-month,1
105,61,60,110.5,6630.0,Two-year,0
106,24,3,30.0,90.0,Month-to-month,1
107,38,24,75.0,1800.0,One-year,0
108,41,18,80.0,1440.0,Month-to-month,0
109,56,40,95.0,3800.0,Two-year,0
110,30,8,55.0,440.0,Month-to-month,1
"""


def seed():
    print("Initializing database tables...")
    init_db()
    db = SessionLocal()

    try:
        ds_name = "customer_churn_prediction"
        existing = db.query(Dataset).filter(Dataset.name == ds_name).first()
        if existing:
            print(f"Dataset '{ds_name}' already exists.")
            return

        print(f"Creating dataset: {ds_name}...")
        dataset = Dataset(
            name=ds_name,
            description="Tabular dataset for customer churn classification (Telco Churn).",
        )
        db.add(dataset)
        db.commit()
        db.refresh(dataset)

        # 1. Root Version (V1) : CSV Ingestion -> Parquet
        print("V1: Ingesting raw CSV and Parquet conversion...")
        csv_bytes = SAMPLE_CHURN_CSV.encode("utf-8")
        parquet_bytes, metadata, row_count = parquet_service.convert_csv_to_parquet_bytes(csv_bytes)
        data_hash_v1 = parquet_service.calculate_bytes_hash(parquet_bytes)

        v1_hash = lineage_service.generate_version_hash(
            dataset_id=dataset.id,
            parent_version_hash=None,
            transformation_name="CSV_INGESTION",
            parameters={"filename": "customer_churn.csv", "compression": "snappy"},
            data_hash=data_hash_v1,
        )

        target_path_v1 = storage_service.get_version_parquet_path(dataset.id, v1_hash)
        size_v1 = parquet_service.save_parquet(parquet_bytes, target_path_v1)

        v1 = DatasetVersion(
            dataset_id=dataset.id,
            version_hash=v1_hash,
            parent_version_id=None,
            storage_path=str(target_path_v1),
            row_count=row_count,
            size_bytes=size_v1,
            schema_metadata=metadata,
        )
        db.add(v1)
        db.flush()

        t1 = Transformation(
            name="CSV_INGESTION",
            parameters={"filename": "customer_churn.csv", "compression": "snappy"},
            source_version_id=None,
            target_version_id=v1.id,
            execution_time_ms=12.5,
        )
        db.add(t1)
        db.commit()
        print(f"-> V1 created: Hash = {v1_hash[:12]}... ({v1.row_count} rows)")

        # 2. Child Version (V2) : STANDARDIZE transformation on numeric columns
        print("V2: Applying STANDARDIZE transformation (monthly_charges, total_charges)...")
        v2_params = {"columns": ["monthly_charges", "total_charges"]}
        v2_parquet, v2_meta, v2_rows = parquet_service.apply_transformation_to_parquet(
            source_parquet_path=target_path_v1,
            transformation_name="STANDARDIZE",
            parameters=v2_params,
        )
        data_hash_v2 = parquet_service.calculate_bytes_hash(v2_parquet)

        v2_hash = lineage_service.generate_version_hash(
            dataset_id=dataset.id,
            parent_version_hash=v1_hash,
            transformation_name="STANDARDIZE",
            parameters=v2_params,
            data_hash=data_hash_v2,
        )
        target_path_v2 = storage_service.get_version_parquet_path(dataset.id, v2_hash)
        size_v2 = parquet_service.save_parquet(v2_parquet, target_path_v2)

        v2 = DatasetVersion(
            dataset_id=dataset.id,
            version_hash=v2_hash,
            parent_version_id=v1.id,
            storage_path=str(target_path_v2),
            row_count=v2_rows,
            size_bytes=size_v2,
            schema_metadata=v2_meta,
        )
        db.add(v2)
        db.flush()

        t2 = Transformation(
            name="STANDARDIZE",
            parameters=v2_params,
            source_version_id=v1.id,
            target_version_id=v2.id,
            execution_time_ms=8.4,
        )
        db.add(t2)
        db.commit()
        print(f"-> V2 created: Hash = {v2_hash[:12]}... (Parent: {v1_hash[:8]})")

        # 3. Grandchild Version (V3) : Filtering on churned customers (churn == 1)
        print("V3: Applying FILTER_QUERY transformation (churn == 1)...")
        v3_params = {"query": "churn == 1"}
        v3_parquet, v3_meta, v3_rows = parquet_service.apply_transformation_to_parquet(
            source_parquet_path=target_path_v2,
            transformation_name="FILTER_QUERY",
            parameters=v3_params,
        )
        data_hash_v3 = parquet_service.calculate_bytes_hash(v3_parquet)

        v3_hash = lineage_service.generate_version_hash(
            dataset_id=dataset.id,
            parent_version_hash=v2_hash,
            transformation_name="FILTER_QUERY",
            parameters=v3_params,
            data_hash=data_hash_v3,
        )
        target_path_v3 = storage_service.get_version_parquet_path(dataset.id, v3_hash)
        size_v3 = parquet_service.save_parquet(v3_parquet, target_path_v3)

        v3 = DatasetVersion(
            dataset_id=dataset.id,
            version_hash=v3_hash,
            parent_version_id=v2.id,
            storage_path=str(target_path_v3),
            row_count=v3_rows,
            size_bytes=size_v3,
            schema_metadata=v3_meta,
        )
        db.add(v3)
        db.flush()

        t3 = Transformation(
            name="FILTER_QUERY",
            parameters=v3_params,
            source_version_id=v2.id,
            target_version_id=v3.id,
            execution_time_ms=6.1,
        )
        db.add(t3)
        db.commit()
        print(f"-> V3 created: Hash = {v3_hash[:12]}... ({v3.row_count} rows, Parent: {v2_hash[:8]})")

        print("\nSeed completed successfully! Full lineage tree stored in Datalift.")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
