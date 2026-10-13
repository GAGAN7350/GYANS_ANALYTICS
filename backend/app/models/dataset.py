import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Integer, Boolean
from sqlalchemy.orm import relationship

from app.core.database import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String)
    source_type = Column(String, nullable=False)
    connection_config = Column(JSON)
    file_path = Column(String)
    row_count = Column(Integer, default=0)
    refresh_schedule = Column(String)
    last_refreshed_at = Column(DateTime)
    status = Column(String, default="ready")
    created_by = Column(String(36), ForeignKey("users.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    columns = relationship("ColumnMetadata", back_populates="dataset", cascade="all, delete-orphan", lazy="selectin")


class ColumnMetadata(Base):
    __tablename__ = "column_metadata"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    data_type = Column(String, nullable=False)
    is_nullable = Column(Boolean, default=True)
    sample_values = Column(JSON)
    stats = Column(JSON)

    dataset = relationship("Dataset", back_populates="columns")

