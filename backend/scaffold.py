import os

base_dir = r"c:\new_drive\GYANS_CODES\GYANS_ANALYTICS\backend"

files = {
    "pyproject.toml": """[project]
name = "gyans-analytics"
version = "0.1.0"
description = "GYANS Analytics open-source BI/analytics platform"
authors = [{ name = "GYANS", email = "info@gyans.com" }]
requires-python = ">=3.12"

[tool.pytest.ini_options]
asyncio_mode = "auto"
""",
    "requirements.txt": """fastapi[standard]
uvicorn[standard]
sqlalchemy[asyncio]
asyncpg
alembic
pydantic[email]
pydantic-settings
python-jose[cryptography]
passlib[bcrypt]
python-multipart
redis
celery
pandas
openpyxl
python-dateutil
httpx
aiofiles
""",
    "app/__init__.py": "",
    "app/main.py": """from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine
from app.api import auth, workspaces, datasets, dashboards, queries

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan
)

if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth.router, prefix="/api/v1/auth")
app.include_router(workspaces.router, prefix="/api/v1/workspaces")
app.include_router(datasets.router, prefix="/api/v1/datasets")
app.include_router(dashboards.router, prefix="/api/v1/dashboards")
app.include_router(queries.router, prefix="/api/v1/queries")

@app.get("/health")
async def health_check():
    return {"status": "ok", "version": settings.VERSION}
""",
    "app/core/__init__.py": "",
    "app/core/config.py": """from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "GYANS Analytics"
    VERSION: str = "0.1.0"
    DEBUG: bool = False
    
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/gyans"
    REDIS_URL: str = "redis://localhost:6379/0"
    
    SECRET_KEY: str = "SUPER_SECRET_KEY"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    CORS_ORIGINS: List[str] = ["*"]
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
""",
    "app/core/database.py": """from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base

from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
""",
    "app/core/security.py": """from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import jwt

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(subject: str, expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_refresh_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode = {"exp": expire, "sub": str(subject)}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
""",
    "app/core/deps.py": """from typing import Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_user(
    db: AsyncSession = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def require_role(role: str) -> Callable:
    def role_dependency(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role != role:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return current_user
    return role_dependency
""",
    "app/models/__init__.py": """from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.models.dataset import Dataset, ColumnMetadata
from app.models.dashboard import Dashboard, Widget
from app.models.query import SavedQuery
""",
    "app/models/user.py": """import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String)
    role = Column(String, default="viewer")
    is_active = Column(Boolean, default=True)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
""",
    "app/models/workspace.py": """import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

class Workspace(Base):
    __tablename__ = "workspaces"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    description = Column(String)
    settings = Column(JSON, default={})
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class WorkspaceMember(Base):
    __tablename__ = "workspace_members"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, default="viewer")
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
""",
    "app/models/dataset.py": """import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

class Dataset(Base):
    __tablename__ = "datasets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String)
    source_type = Column(String, nullable=False)
    connection_config = Column(JSON)
    file_path = Column(String)
    row_count = Column(Integer, default=0)
    refresh_schedule = Column(String)
    last_refreshed_at = Column(DateTime(timezone=True))
    status = Column(String, default="ready")
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class ColumnMetadata(Base):
    __tablename__ = "column_metadata"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    data_type = Column(String, nullable=False)
    is_nullable = Column(Boolean, default=True)
    sample_values = Column(JSON)
    stats = Column(JSON)
""",
    "app/models/dashboard.py": """import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

class Dashboard(Base):
    __tablename__ = "dashboards"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String)
    layout = Column(JSON, default={})
    theme = Column(JSON, default={})
    is_public = Column(Boolean, default=False)
    public_slug = Column(String, unique=True, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class Widget(Base):
    __tablename__ = "widgets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dashboard_id = Column(UUID(as_uuid=True), ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False)
    chart_type = Column(String, nullable=False)
    title = Column(String)
    config = Column(JSON, default={})
    query_config = Column(JSON, default={})
    position = Column(JSON, default={"x": 0, "y": 0, "w": 4, "h": 4})
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
""",
    "app/models/query.py": """import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

class SavedQuery(Base):
    __tablename__ = "saved_queries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    raw_sql = Column(String, nullable=False)
    visual_config = Column(JSON, default={})
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
""",
    "app/schemas/__init__.py": "",
    "app/schemas/auth.py": """from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    avatar_url: Optional[str]
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
""",
    "app/schemas/workspace.py": """from pydantic import BaseModel, ConfigDict
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
""",
    "app/schemas/dataset.py": """from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID

class ColumnMetadataResponse(BaseModel):
    name: str
    data_type: str
    is_nullable: bool
    stats: Optional[Dict[str, Any]]
    
    model_config = ConfigDict(from_attributes=True)

class DatasetCreate(BaseModel):
    name: str
    source_type: str
    connection_config: Optional[Dict[str, Any]] = None
    description: Optional[str] = None

class DatasetResponse(BaseModel):
    id: UUID
    name: str
    source_type: str
    row_count: int
    status: str
    columns: Optional[List[ColumnMetadataResponse]] = None
    
    model_config = ConfigDict(from_attributes=True)
""",
    "app/schemas/dashboard.py": """from pydantic import BaseModel, ConfigDict
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
""",
    "app/api/__init__.py": "",
    "app/api/auth.py": """from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse, UserResponse
from app.services.auth_service import authenticate_user, create_user, generate_tokens
from app.models.user import User

router = APIRouter()

@router.post("/signup", response_model=TokenResponse)
async def signup(data: SignupRequest, db: AsyncSession = Depends(get_db)):
    user = await create_user(db, data)
    return await generate_tokens(user)

@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, data.email, data.password)
    return await generate_tokens(user)

@router.post("/refresh", response_model=TokenResponse)
async def refresh():
    pass

@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user

@router.put("/me", response_model=UserResponse)
async def update_me(user: User = Depends(get_current_user)):
    return user
""",
    "app/api/workspaces.py": """from fastapi import APIRouter, Depends
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
""",
    "app/api/datasets.py": """from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def list_datasets():
    pass

@router.post("/upload")
async def upload_file():
    pass

@router.post("/connect")
async def connect_db():
    pass

@router.get("/{id}")
async def get_dataset(id: str):
    pass

@router.get("/{id}/preview")
async def preview_dataset(id: str):
    pass

@router.delete("/{id}")
async def delete_dataset(id: str):
    pass

@router.post("/{id}/refresh")
async def refresh_dataset(id: str):
    pass
""",
    "app/api/dashboards.py": """from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def list_dashboards():
    pass

@router.post("/")
async def create_dashboard():
    pass

@router.get("/{id}")
async def get_dashboard(id: str):
    pass

@router.put("/{id}")
async def update_dashboard(id: str):
    pass

@router.delete("/{id}")
async def delete_dashboard(id: str):
    pass

@router.post("/{id}/widgets")
async def add_widget(id: str):
    pass

@router.put("/{id}/widgets/{widget_id}")
async def update_widget(id: str, widget_id: str):
    pass

@router.delete("/{id}/widgets/{widget_id}")
async def delete_widget(id: str, widget_id: str):
    pass

@router.post("/{id}/duplicate")
async def duplicate_dashboard(id: str):
    pass
""",
    "app/api/queries.py": """from fastapi import APIRouter

router = APIRouter()

@router.post("/execute")
async def execute_query():
    pass

@router.post("/preview")
async def preview_query():
    pass

@router.get("/")
async def list_queries():
    pass

@router.post("/")
async def save_query():
    pass

@router.delete("/{id}")
async def delete_query(id: str):
    pass
""",
    "app/services/__init__.py": "",
    "app/services/auth_service.py": """from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.schemas.auth import SignupRequest, TokenResponse
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token

async def create_user(db: AsyncSession, data: SignupRequest) -> User:
    result = await db.execute(select(User).filter(User.email == data.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")
        
    user = User(
        email=data.email,
        password_hash=get_password_hash(data.password),
        full_name=data.full_name
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    result = await db.execute(select(User).filter(User.email == email))
    user = result.scalars().first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    return user

async def generate_tokens(user: User) -> TokenResponse:
    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)
""",
    "app/services/workspace_service.py": """import re
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
""",
    "alembic.ini": """[alembic]
script_location = alembic
prepend_sys_path = .
version_path_separator = os

sqlalchemy.url = postgresql+asyncpg://postgres:postgres@localhost:5432/gyans

[post_write_hooks]

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
""",
    "alembic/env.py": """import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

from app.core.config import settings
from app.core.database import Base
from app.models import *

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
""",
    "alembic/script.py.mako": '\"\"\"${message}\n\nRevision ID: ${up_revision}\nRevises: ${down_revision | comma,n}\nCreate Date: ${create_date}\n\n\"\"\"\nfrom typing import Sequence, Union\n\nfrom alembic import op\nimport sqlalchemy as sa\n${imports if imports else ""}\n\n# revision identifiers, used by Alembic.\nrevision: str = ${repr(up_revision)}\ndown_revision: Union[str, None] = ${repr(down_revision)}\nbranch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}\ndepends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}\n\n\ndef upgrade() -> None:\n    ${upgrades if upgrades else "pass"}\n\n\ndef downgrade() -> None:\n    ${downgrades if downgrades else "pass"}\n',
    "alembic/versions/.gitkeep": ""
}

for rel_path, content in files.items():
    full_path = os.path.join(base_dir, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Created {rel_path}")

print("All files scaffolded successfully.")
