from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class ColumnMetadataResponse(BaseModel):
    id: Optional[str] = None
    name: str
    data_type: str = Field(..., serialization_alias="dataType")
    is_nullable: bool = Field(True, serialization_alias="isNullable")
    sample_values: Optional[List[str]] = Field(None, serialization_alias="sampleValues")
    stats: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class DatasetCreate(BaseModel):
    name: str
    source_type: str = "file_upload"
    connection_config: Optional[Dict[str, Any]] = None
    description: Optional[str] = None


class DatasetResponse(BaseModel):
    id: str
    workspace_id: str = Field(..., serialization_alias="workspaceId")
    name: str
    description: Optional[str] = None
    source_type: str = Field(..., serialization_alias="sourceType")
    row_count: int = Field(0, serialization_alias="rowCount")
    status: str = "ready"
    connection_config: Optional[Dict[str, Any]] = Field(None, serialization_alias="connectionConfig")
    created_at: Optional[datetime] = Field(None, serialization_alias="createdAt")
    updated_at: Optional[datetime] = Field(None, serialization_alias="updatedAt")
    columns: Optional[List[ColumnMetadataResponse]] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class DatasetPreviewResponse(BaseModel):
    columns: List[Dict[str, str]]
    rows: List[Dict[str, Any]]
    total_rows: int
    preview_count: int


class ChartRecommendationRequest(BaseModel):
    columns: List[Dict[str, str]]


class ChartRecommendationResponse(BaseModel):
    recommended_chart: str
    sub_type: Optional[str] = None
    confidence: float
    reason: str
