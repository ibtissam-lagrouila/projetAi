from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


CleaningOperationType = Literal[
    "TEXT_NORMALIZE",
    "CATEGORY_MERGE",
    "HANDLE_MISSING",
    "HANDLE_OUTLIERS",
    "DROP_DUPLICATES",
]


class CleaningOperationSchema(BaseModel):
    type: CleaningOperationType = Field(..., description="Cleaning operation type")
    column: Optional[str] = Field(None, description="Target column of operation")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Operation-specific parameters")


class CleaningPreviewRequest(BaseModel):
    source_version_hash: str = Field(..., description="Hash de la version source")
    operations: List[CleaningOperationSchema] = Field(..., description="Ordered list of operations to apply")
    target_column: Optional[str] = Field(None, description="Dataset target column (for impact validation)")


class CleaningPreviewResponse(BaseModel):
    rows_before: int
    rows_after: int
    rows_affected: int
    cells_changed: int = 0
    cells_changed_percentage: float = 0.0
    predicted_health_score: Optional[int] = None
    predicted_sub_scores: Optional[Dict[str, Optional[float]]] = None
    is_noop: bool
    target_affected: bool
    target_warning: Optional[str] = None
    columns_affected: List[str]
    operations_executed: List[Dict[str, Any]]
    sample_before: List[Dict[str, Any]]
    sample_after: List[Dict[str, Any]]
    step_diffs: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict)
    uncertain_mappings: List[Dict[str, Any]] = Field(default_factory=list)


class CleaningApplyRequest(BaseModel):
    source_version_hash: str = Field(..., description="Hash de la version source")
    operations: List[CleaningOperationSchema] = Field(..., description="List of cleaning operations")
    target_column: Optional[str] = Field(None, description="Dataset target column")
    confirm_target_modification: bool = Field(False, description="Explicit confirmation if target is modified")


class CleaningApplyResponse(BaseModel):
    new_version_hash: str
    new_version_id: str
    parent_version_hash: str
    rows_before: int
    rows_after: int
    rows_affected: int
    transformation_name: str
    parameters: Dict[str, Any]
    before_profile: Dict[str, Any]
    after_profile: Dict[str, Any]
    health_score_delta: int
    sub_scores_delta: Dict[str, Optional[float]]

