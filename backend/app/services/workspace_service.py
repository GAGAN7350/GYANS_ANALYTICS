import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.workspace import Workspace, WorkspaceMember

def slugify(text: str) -> str:
    return re.sub(r'[\W_]+', '-', text.lower()).strip('-')

async def create_workspace(db: AsyncSession, name: str, user_id: str) -> Workspace:
    base_slug = slugify(name)
    slug = base_slug
    counter = 1
    
    while True:
        result = await db.execute(select(Workspace).filter(Workspace.slug == slug))
        if not result.scalars().first():
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    workspace = Workspace(name=name, slug=slug, created_by=user_id)
    db.add(workspace)
    await db.commit()
    await db.refresh(workspace)
    
    member = WorkspaceMember(workspace_id=workspace.id, user_id=user_id, role="owner")
    db.add(member)
    await db.commit()
    
    return workspace

async def list_user_workspaces(db: AsyncSession, user_id: str):
    result = await db.execute(select(Workspace).join(WorkspaceMember).filter(WorkspaceMember.user_id == user_id))
    return result.scalars().all()

async def add_member(db: AsyncSession, workspace_id: str, user_id: str, role: str):
    pass
