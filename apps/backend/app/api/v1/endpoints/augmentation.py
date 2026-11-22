from pathlib import Path
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.dataset_version import DatasetVersion
from app.schemas.augmentation import (
    AugmentationApplyRequest,
    AugmentationApplyResponse,
    AugmentationComparisonRequest,
    AugmentationComparisonResponse,
    AugmentationPreviewRequest,
    AugmentationPreviewResponse,
)
from app.services.augmentation_service import augmentation_service

router = APIRouter()


@router.post("/preview", response_model=AugmentationPreviewResponse)
def preview_augmentation(
    payload: AugmentationPreviewRequest,
    db: Session = Depends(get_db),
):
    """Simulates step 03 Augmentation without persisting any file or modifying the database.
    Checks constraints, computes splits, generates synthetic data, applies balancing, and validates guardrails.
    """
    version = db.query(DatasetVersion).filter(DatasetVersion.version_hash == payload.source_version_hash).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source version '{payload.source_version_hash}' not found.",
        )

    file_path = Path(version.storage_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source Parquet file not found on disk.",
        )

    try:
        preview_res = augmentation_service.preview_augmentation(
            parquet_path=file_path,
            request=payload,
        )
        return preview_res
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error previewing augmentation: {str(exc)}",
        )


@router.post("/apply", response_model=AugmentationApplyResponse, status_code=status.HTTP_201_CREATED)
def apply_augmentation(
    payload: AugmentationApplyRequest,
    db: Session = Depends(get_db),
):
    """Applies data augmentation server-side: stratified split, SMOTE-NC rows generation, guardrail validation, atomic Parquet write, and new immutable DatasetVersion creation.
    """
    version = db.query(DatasetVersion).filter(DatasetVersion.version_hash == payload.source_version_hash).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source version '{payload.source_version_hash}' not found.",
        )

    file_path = Path(version.storage_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source Parquet file not found on disk.",
        )

    try:
        res = augmentation_service.apply_augmentation_and_create_version(
            db=db,
            source_version=version,
            request=payload,
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error applying augmentation: {str(exc)}",
        )

    new_version = res["new_version"]
    transformation = res["transformation"]
    pipe_res = res["pipeline_result"]
    before_prof = res["before_profile"]
    after_prof = res["after_profile"]

    return AugmentationApplyResponse(
        new_version_hash=new_version.version_hash,
        new_version_id=str(new_version.id),
        parent_version_hash=version.version_hash,
        total_rows=new_version.row_count,
        rows_in_train=pipe_res["rows_in_train_after"],
        rows_generated=pipe_res["rows_generated"],
        rows_undersampled=pipe_res["rows_undersampled"],
        transformation_name=transformation.name,
        parameters=transformation.parameters,
        recipe=res["recipe"],
        before_profile=before_prof,
        after_profile=after_prof,
        balance_score_delta=res["balance_score_delta"],
        guardrails=pipe_res["guardrails"],
    )


@router.post("/compare", response_model=AugmentationComparisonResponse)
def compare_augmentation(
    payload: AugmentationComparisonRequest,
    db: Session = Depends(get_db),
):
    """Phase 3 - Trains and compares a model on v2 (real train only) vs v3 (augmented train) evaluated on the same real test set. Repeats over 5 seeds to provide mean and std for Recall, Precision and F1 on the rare class.
    """
    version = db.query(DatasetVersion).filter(DatasetVersion.version_hash == payload.source_version_hash).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source version '{payload.source_version_hash}' not found.",
        )

    file_path = Path(version.storage_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source Parquet file not found on disk.",
        )

    try:
        import pyarrow.parquet as pq
        table = pq.read_table(file_path)
        df = table.to_pandas()

        comparison_res = augmentation_service.run_model_comparison(
            df=df,
            target_column=payload.target_column,
            split_config=payload.split_config,
            balance_config=payload.balance_config,
            techniques=payload.techniques,
            model_type=payload.model_type,
            seeds=payload.seeds,
        )
        return comparison_res
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error comparing models: {str(exc)}",
        )


