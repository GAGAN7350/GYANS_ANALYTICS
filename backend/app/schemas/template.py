from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class ReportTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tier: str = "pro"  # 'beginner' | 'pro' | 'ultra_pro'
    domain: Optional[str] = "auto"
    config: Dict[str, Any] = Field(default_factory=dict)
    workspace_id: Optional[str] = Field(None, alias="workspaceId")


class ReportTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tier: Optional[str] = None
    domain: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class ReportTemplateResponse(BaseModel):
    id: str
    user_id: Optional[str] = Field(None, serialization_alias="userId")
    workspace_id: Optional[str] = Field(None, serialization_alias="workspaceId")
    name: str
    description: Optional[str] = None
    tier: str
    domain: Optional[str] = "auto"
    is_preset: bool = Field(False, serialization_alias="isPreset")
    config: Dict[str, Any]
    created_at: Optional[datetime] = Field(None, serialization_alias="createdAt")
    updated_at: Optional[datetime] = Field(None, serialization_alias="updatedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
