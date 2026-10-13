from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.core.database import get_db
from app.core.deps import get_current_user
from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse
from app.services.workspace_service import create_workspace, list_user_workspaces
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=List[WorkspaceResponse])
async def list_workspaces(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await list_user_workspaces(db, user.id)

@router.post("/", response_model=WorkspaceResponse)
async def create_workspace_api(data: WorkspaceCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await create_workspace(db, data.name, user.id)

@router.get("/{id}")
async def get_workspace(id: str):
    pass

@router.put("/{id}")
async def update_workspace(id: str):
    pass

@router.delete("/{id}")
async def delete_workspace(id: str):
    pass

@router.post("/{id}/members")
async def add_member(id: str):
    pass

@router.delete("/{id}/members/{user_id}")
async def remove_member(id: str, user_id: str):
    pass
