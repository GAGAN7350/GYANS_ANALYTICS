import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship

from app.core.database import Base


class ReportTemplate(Base):
    __tablename__ = "report_templates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    tier = Column(String, nullable=False, default="pro")  # 'beginner' | 'pro' | 'ultra_pro'
    domain = Column(String, nullable=True, default="auto")
    is_preset = Column(Boolean, default=False)
    config = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
