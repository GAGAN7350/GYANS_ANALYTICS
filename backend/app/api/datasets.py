import os
from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.dataset import Dataset, ColumnMetadata
from app.models.workspace import Workspace, WorkspaceMember
from app.schemas.dataset import (
    DatasetResponse,
    DatasetPreviewResponse,
    ColumnMetadataResponse
)
from app.services.dataset_service import DatasetService

router = APIRouter()


async def _get_or_create_default_workspace(db: AsyncSession, user: User) -> str:
    """Helper to ensure user has at least one active workspace for dataset uploads."""
    stmt = (
        select(Workspace)
        .join(WorkspaceMember, Workspace.id == WorkspaceMember.workspace_id)
        .where(WorkspaceMember.user_id == user.id)
    )
    res = await db.execute(stmt)
    workspace = res.scalars().first()
    
    if not workspace:
        # Create a default Personal Workspace for user
        import uuid
        workspace = Workspace(
            id=str(uuid.uuid4()),
            name="Personal Workspace",
            slug=f"personal-{user.id[:8]}",
            description="Default personal workspace",
            created_by=user.id
        )
        db.add(workspace)
        member = WorkspaceMember(
            id=str(uuid.uuid4()),
            workspace_id=workspace.id,
            user_id=user.id,
            role="owner"
        )
        db.add(member)
        await db.commit()
        await db.refresh(workspace)
    
    return workspace.id


def _sanitize(obj):
    """Recursively replace NaN / Inf floats with None so json.dumps doesn't crash."""
    import math
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    return obj


def _serialize_dataset(dataset) -> dict:
    """Serialize a Dataset ORM object to camelCase dict safely without triggering async lazy-load."""
    cols = None
    if "columns" in dataset.__dict__ and dataset.__dict__["columns"]:
        try:
            cols = [
                ColumnMetadataResponse.model_validate(c).model_dump(by_alias=True, mode="json")
                for c in dataset.__dict__["columns"]
            ]
        except Exception:
            cols = None

    raw = {
        "id": str(dataset.id),
        "workspaceId": str(dataset.workspace_id),
        "name": dataset.name,
        "description": dataset.description,
        "sourceType": dataset.source_type,
        "rowCount": int(dataset.row_count or 0),
        "status": dataset.status or "ready",
        "connectionConfig": dataset.connection_config or {},
        "createdAt": dataset.created_at.isoformat() if dataset.created_at else None,
        "updatedAt": dataset.updated_at.isoformat() if dataset.updated_at else None,
        "columns": cols,
    }
    return _sanitize(raw)


@router.get("/")
async def list_datasets(
    workspace_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all datasets accessible to the current user."""
    try:
        query = select(Dataset).order_by(Dataset.created_at.desc())
        if workspace_id:
            query = query.where(Dataset.workspace_id == workspace_id)
        
        result = await db.execute(query)
        datasets = result.scalars().all()
        data = [_serialize_dataset(d) for d in datasets]
        return JSONResponse(content=data)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_dataset_file(
    file: UploadFile = File(...),
    dataset_name: Optional[str] = Form(None),
    workspace_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload CSV, Excel, or JSON data file.
    Automatically profiles schema, calculates data quality score,
    and runs ML pattern recognition (anomalies, clusters, correlations).
    """
    if not workspace_id:
        workspace_id = await _get_or_create_default_workspace(db, current_user)

    dataset = await DatasetService.create_from_upload(
        db=db,
        file=file,
        workspace_id=workspace_id,
        user_id=str(current_user.id),
        dataset_name=dataset_name
    )
    return JSONResponse(content=_serialize_dataset(dataset), status_code=201)


@router.get("/{id}")
async def get_dataset(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch dataset metadata including column types and diagnostics."""
    stmt = select(Dataset).where(Dataset.id == id)
    res = await db.execute(stmt)
    dataset = res.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    # Load columns
    col_stmt = select(ColumnMetadata).where(ColumnMetadata.dataset_id == id)
    col_res = await db.execute(col_stmt)
    dataset.columns = col_res.scalars().all()
    return JSONResponse(content=_serialize_dataset(dataset))


@router.get("/{id}/preview", response_model=DatasetPreviewResponse)
async def preview_dataset(
    id: str,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return the first N rows of the dataset for fast frontend exploration."""
    stmt = select(Dataset).where(Dataset.id == id)
    res = await db.execute(stmt)
    dataset = res.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return await DatasetService.get_preview(dataset, limit=limit)


@router.get("/{id}/patterns")
async def get_dataset_patterns(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns pre-computed ML pattern recognition analysis:
    - Anomalies and outliers
    - Unsupervised customer / data clusters
    - Correlation matrix & key drivers
    - Data health score
    """
    stmt = select(Dataset).where(Dataset.id == id)
    res = await db.execute(stmt)
    dataset = res.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    cfg = dataset.connection_config or {}
    return {
        "dataset_id": dataset.id,
        "dataset_name": dataset.name,
        "data_health": cfg.get("health"),
        "patterns": cfg.get("ml_patterns")
    }


@router.get("/{id}/chart-data")
async def get_chart_data(
    id: str,
    x_col: Optional[str] = None,
    y_col: Optional[str] = None,
    chart_type: Optional[str] = None,
    limit: int = 500,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns processed data for chart rendering.
    Auto-recommends chart type based on column types if not specified.
    Supported chart types: bar, line, pie, scatter, histogram
    """
    import pandas as pd
    import numpy as np

    stmt = select(Dataset).where(Dataset.id == id)
    res = await db.execute(stmt)
    dataset = res.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not dataset.file_path or not os.path.exists(dataset.file_path):
        raise HTTPException(status_code=404, detail="Dataset file not found on disk.")

    df = DatasetService._read_file_to_df(dataset.file_path, dataset.file_path)
    df = df.head(limit)

    numeric_cols   = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    datetime_cols  = df.select_dtypes(include=["datetime64"]).columns.tolist()

    # Auto-detect column defaults based on chart type requirements
    if chart_type == "scatter":
        if not numeric_cols:
            raise HTTPException(
                status_code=400,
                detail="Scatter plots require numeric columns, but this dataset has no numeric data."
            )
        # Ensure x_col is numeric
        if not x_col or x_col not in numeric_cols:
            x_col = numeric_cols[0]
        # Ensure y_col is numeric
        if not y_col or y_col not in numeric_cols or (y_col == x_col and len(numeric_cols) > 1):
            y_col = numeric_cols[1] if len(numeric_cols) > 1 else numeric_cols[0]

    elif chart_type == "histogram":
        if not numeric_cols:
            raise HTTPException(
                status_code=400,
                detail="Histograms require numeric columns, but this dataset has no numeric data."
            )
        if not x_col or x_col not in numeric_cols:
            x_col = y_col if (y_col and y_col in numeric_cols) else numeric_cols[0]
        y_col = None

    else:
        # Auto-detect x column if not provided
        if not x_col or x_col not in df.columns:
            if categorical_cols:
                x_col = categorical_cols[0]
            elif datetime_cols:
                x_col = datetime_cols[0]
            elif numeric_cols:
                x_col = numeric_cols[0]
            else:
                x_col = df.columns[0]

        # Auto-detect y column if not provided
        if not y_col or y_col not in df.columns:
            candidates = [c for c in numeric_cols if c != x_col]
            y_col = candidates[0] if candidates else (numeric_cols[0] if numeric_cols else None)

    # Auto-recommend chart type if not provided
    if not chart_type:
        if x_col in datetime_cols:
            chart_type = "line"
        elif x_col in categorical_cols:
            n_unique = df[x_col].nunique() if x_col else 0
            chart_type = "pie" if n_unique <= 8 else "bar"
        elif x_col in numeric_cols and y_col in numeric_cols:
            chart_type = "scatter"
        else:
            chart_type = "bar"

    chart_data: dict = {}
    try:
        if chart_type == "pie":
            counts = df[x_col].astype(str).value_counts().head(10)
            chart_data = {
                "labels": counts.index.tolist(),
                "values": [int(v) for v in counts.values.tolist()]
            }
        elif chart_type == "histogram":
            series = pd.to_numeric(df[x_col], errors='coerce').dropna()
            if series.empty:
                raise ValueError(f"Column '{x_col}' does not contain valid numeric data for a histogram.")
            counts_hist, edges = np.histogram(series, bins=20)
            chart_data = {
                "bins":   [round(float(e), 2) for e in edges[:-1]],
                "counts": [int(c) for c in counts_hist.tolist()]
            }
        elif chart_type == "scatter":
            # Safely cast both x and y to numeric
            valid = pd.DataFrame({
                "x": pd.to_numeric(df[x_col], errors='coerce'),
                "y": pd.to_numeric(df[y_col], errors='coerce')
            }).dropna().head(limit)

            points = []
            for _, r in valid.iterrows():
                vx, vy = float(r["x"]), float(r["y"])
                if not (np.isnan(vx) or np.isinf(vx) or np.isnan(vy) or np.isinf(vy)):
                    points.append({"x": round(vx, 4), "y": round(vy, 4)})

            chart_data = {"points": points}

        else:  # bar / line
            if y_col and y_col in numeric_cols:
                # Group by x and take mean of numeric y
                sub = df[[x_col, y_col]].copy()
                sub[y_col] = pd.to_numeric(sub[y_col], errors='coerce')
                sub = sub.dropna(subset=[y_col])
                grouped = sub.groupby(x_col)[y_col].mean().head(25).reset_index()
                x_vals = [str(x) for x in grouped[x_col].tolist()]
                y_vals = [round(float(v), 2) for v in grouped[y_col].tolist()]
            else:
                # Frequency count fallback if no numeric y column
                counts = df[x_col].astype(str).value_counts().head(25)
                x_vals = counts.index.tolist()
                y_vals = [int(v) for v in counts.values.tolist()]

            chart_data = {"x": x_vals, "y": y_vals}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to build chart data: {str(e)}")

    return JSONResponse(content=_sanitize({
        "datasetId":       id,
        "chartType":       chart_type,
        "xCol":            x_col,
        "yCol":            y_col,
        "numericCols":     numeric_cols,
        "categoricalCols": categorical_cols,
        "datetimeCols":    datetime_cols,
        "allCols":         df.columns.tolist(),
        "data":            chart_data
    }))


@router.delete("/{id}")
async def delete_dataset(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a dataset and removes its file from disk."""
    stmt = select(Dataset).where(Dataset.id == id)
    res = await db.execute(stmt)
    dataset = res.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Remove physical file if exists
    if dataset.file_path and os.path.exists(dataset.file_path):
        try:
            os.remove(dataset.file_path)
        except Exception:
            pass

    await db.delete(dataset)
    await db.commit()
    return {"message": "Dataset successfully deleted"}
