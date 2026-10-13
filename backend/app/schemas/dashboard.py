from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID

class WidgetCreate(BaseModel):
    chart_type: str
    title: str
    config: Dict[str, Any]
    query_config: Dict[str, Any]
    position: Dict[str, Any]

class WidgetResponse(BaseModel):
    id: UUID
    chart_type: str
    title: str
    config: Dict[str, Any]
    position: Dict[str, Any]
    
    model_config = ConfigDict(from_attributes=True)

class DashboardCreate(BaseModel):
    title: str
    description: Optional[str] = None

class DashboardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    layout: Optional[Dict[str, Any]] = None
    theme: Optional[Dict[str, Any]] = None
    is_public: Optional[bool] = None

class DashboardResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str]
    is_public: bool
    widgets: Optional[List[WidgetResponse]] = None
    
    model_config = ConfigDict(from_attributes=True)
