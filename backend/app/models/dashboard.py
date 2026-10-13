import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Boolean

from app.core.database import Base


class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String)
    layout = Column(JSON, default={})
    theme = Column(JSON, default={})
    is_public = Column(Boolean, default=False)
    public_slug = Column(String, unique=True, index=True)
    created_by = Column(String(36), ForeignKey("users.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Widget(Base):
    __tablename__ = "widgets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dashboard_id = Column(String(36), ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False)
    chart_type = Column(String, nullable=False)
    title = Column(String)
    config = Column(JSON, default={})
    query_config = Column(JSON, default={})
    position = Column(JSON, default={"x": 0, "y": 0, "w": 4, "h": 4})
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
