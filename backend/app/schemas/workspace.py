from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from app.schemas.auth import UserResponse

class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None

class WorkspaceResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str]
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class WorkspaceMemberResponse(BaseModel):
    id: UUID
    user: UserResponse
    role: str
    joined_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
