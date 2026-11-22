from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.labeling import (
    BulkFixRequest,
    DecisionRequest,
    LabelChecksResponse,
    LabelingStatusResponse,
    QueueItemResponse,
    SaveVersionRequest,
    SaveVersionResponse,
)
from app.services.labeling_service import labeling_service

router = APIRouter()


@router.get("/{dataset_id}/status", response_model=LabelingStatusResponse)
def get_labeling_status(
    dataset_id: str,
    target_column: Optional[str] = Query(None, description="Selected target column"),
    threshold: float = Query(0.90, ge=0.5, le=0.99, description="Model confidence threshold"),
    db: Session = Depends(get_db),
):
    """Returns the global labeling summary: queue counters, label confidence score, active target, and header metrics.
    """
    return labeling_service.get_labeling_status(
        dataset_id=dataset_id,
        target_column_override=target_column,
        threshold=threshold,
        db=db,
    )


@router.get("/{dataset_id}/candidate", response_model=QueueItemResponse)
def get_queue_candidate(
    dataset_id: str,
    queue: str = Query("suspected_errors", description="Queue identifier"),
    index: int = Query(0, ge=0, description="Index of item in queue"),
    target_column: Optional[str] = Query(None, description="Target column"),
    threshold: float = Query(0.90, ge=0.5, le=0.99, description="Certainty threshold"),
    db: Session = Depends(get_db),
):
    """Returns the candidate from the specified queue with all its features, semantic highlights, history, and nearest neighbors.
    """
    return labeling_service.get_candidate_for_queue(
        dataset_id=dataset_id,
        queue_id=queue,
        item_index=index,
        target_column_override=target_column,
        threshold=threshold,
        db=db,
    )


@router.post("/{dataset_id}/decision", status_code=status.HTTP_200_OK)
def apply_label_decision(
    dataset_id: str,
    req: DecisionRequest,
    db: Session = Depends(get_db),
):
    """Records a human decision (Keep, Change, Unknown, Uncertain) with full traceability and mandatory reason.
    """
    change = labeling_service.apply_decision(
        dataset_id=dataset_id,
        row_index=req.row_index,
        customer_id=req.customer_id,
        decision=req.decision,
        new_label=req.new_label,
        reason=req.reason,
        queue_id=req.queue_id,
        db=db,
    )
    return {
        "success": True,
        "message": f"Decision '{req.decision}' recorded for row {req.customer_id}.",
        "change_id": str(change.id),
        "new_label": change.new_label,
    }


@router.post("/{dataset_id}/bulk-fix", status_code=status.HTTP_200_OK)
def apply_bulk_fix(
    dataset_id: str,
    req: BulkFixRequest,
    db: Session = Depends(get_db),
):
    """Applies a bulk correction to a group of rows matching a business pattern."""
    count = labeling_service.apply_bulk_fix(
        dataset_id=dataset_id,
        row_indices=req.row_indices,
        new_label=req.new_label,
        reason=req.reason,
        pattern_description=req.pattern_description,
        db=db,
    )
    return {
        "success": True,
        "message": f"{count} rows corrected in bulk successfully.",
        "modified_count": count,
    }


@router.get("/{dataset_id}/checks", response_model=LabelChecksResponse)
def get_checks_and_guardrails(
    dataset_id: str,
    db: Session = Depends(get_db),
):
    """Returns the list of automated checks run, the change log for today, and the guardrail validation status.
    """
    return labeling_service.get_checks_and_guardrails(dataset_id=dataset_id, db=db)


@router.post("/{dataset_id}/save-version", response_model=SaveVersionResponse)
def save_labeling_version(
    dataset_id: str,
    req: SaveVersionRequest,
    db: Session = Depends(get_db),
):
    """Generates and saves a new immutable version (e.g. v4) with the corrected labels, attached change log, and lineage preservation.
    """
    return labeling_service.save_labeling_version(
        dataset_id=dataset_id,
        rerun_augmentation=req.rerun_augmentation,
        version_label_override=req.version_label,
        description=req.description,
        db=db,
    )

