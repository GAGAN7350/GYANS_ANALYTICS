import os
import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.dataset import Dataset
from app.services.dataset_service import DatasetService
from app.services.ml_engine.pattern_detector import PatternRecognitionEngine
from app.services.ml_engine.decision_engine import DecisionEngine
from app.services.ml_engine import llm_inference

router = APIRouter()


class GenerateReportRequest(BaseModel):
    dataset_id: str
    tier: str = "pro"  # 'beginner' | 'pro' | 'ultra_pro'
    template_name: Optional[str] = "Standard Analysis"
    config: Dict[str, Any] = {}


def _safe_float(val, default=0.0):
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return round(f, 4)
    except:
        return default


@router.post("/generate-report")
async def generate_report(
    req: GenerateReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates tailored, multi-level analytical reports according to the template tier:
    - Beginner: 100% plain English, status indicators, and 3 plain action items.
    - Pro: Executive brief, target KPI impact, root causes, and strategic forecast.
    - Ultra Pro: Quant audit, isolation forest stats, Spearman/Pearson p-values, and LaTeX equations.
    """
    stmt = select(Dataset).where(Dataset.id == req.dataset_id)
    res = await db.execute(stmt)
    dataset = res.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not dataset.file_path or not os.path.exists(dataset.file_path):
        raise HTTPException(status_code=404, detail="Dataset file not found on disk")

    # Load dataframe
    df = DatasetService._read_file_to_df(dataset.file_path, dataset.file_path)
    tier = req.tier.lower()
    cfg = req.config or {}

    # Strict file format validation guardrail
    source_format = cfg.get("source_format")
    if source_format:
        ext = os.path.splitext(dataset.file_path or "")[1].lower()
        if ext and source_format.lower() != ext:
            raise HTTPException(
                status_code=400,
                detail=f"Template format mismatch: this template requires '{source_format.upper()}' files, but this dataset is '{ext.upper()}'."
            )

    # Strict required columns validation guardrail
    req_cols = list(cfg.get("required_columns") or [])
    if cfg.get("target_kpi") and cfg.get("target_kpi") not in req_cols:
        req_cols.append(cfg.get("target_kpi"))

    missing_cols = [c for c in req_cols if c and c not in df.columns]
    if missing_cols:
        raise HTTPException(
            status_code=400,
            detail=f"Template column mismatch: this template requires column(s) {missing_cols}, which do not exist in this dataset."
        )

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    total_rows = len(df)
    total_cols = len(df.columns)

    # 1. Base ML Computations
    contamination = float(cfg.get("anomaly_contamination", 0.05 if tier != "ultra_pro" else 0.02))
    anomaly_result = PatternRecognitionEngine.detect_anomalies(df, contamination=contamination)
    correlation_result = PatternRecognitionEngine.evaluate_correlations(df)
    cluster_result = PatternRecognitionEngine.discover_clusters(df, max_clusters=3 if tier == "beginner" else 4)
    health = DecisionEngine.calculate_data_health(df)

    health_score = health.get("health_score", 85)
    anom_count = anomaly_result.get("anomaly_count", 0)
    anom_pct = anomaly_result.get("anomaly_percentage", 0.0)

    # Traffic light determination
    if health_score >= 80 and anom_pct < 5.0:
        traffic_light = "green"
        traffic_status = "Healthy / Low Risk"
    elif health_score >= 60 or anom_pct < 10.0:
        traffic_light = "yellow"
        traffic_status = "Needs Attention / Moderate Risk"
    else:
        traffic_light = "red"
        traffic_status = "Critical Risk / Discrepancies Flagged"

    target_kpi = cfg.get("target_kpi") or (numeric_cols[0] if numeric_cols else "Total Rows")
    
    # Auto-detect domain from dataset columns, name, and user config
    from app.services.ml_engine.rag_service import DomainRAGService
    detected_domain = DomainRAGService.get_instance().infer_domain(
        columns=df.columns.tolist(),
        dataset_name=dataset.name,
        raw_domain=cfg.get("domain", "")
    )
    cfg["domain"] = detected_domain
    domain = detected_domain.replace("_", " ").title()

    # ── LLM Inference ────────────────────────────────────────────────────
    # Pass all computed statistics to the inference service.
    # Backend selection (Ollama / HuggingFace) is controlled by GYAN_LLM_BACKEND env var.
    # generate_report() returns a structured fallback if the backend is unavailable.
    report_markdown = llm_inference.generate_report(
        df=df,
        cfg=cfg,
        tier=tier,
        dataset_meta={"name": dataset.name, "id": dataset.id},
        anomaly_result=anomaly_result,
        correlation_result=correlation_result,
        cluster_result=cluster_result,
        health=health,
    )

    return JSONResponse(content={
        "datasetId": dataset.id,
        "datasetName": dataset.name,
        "reportTitle": req.template_name or f"{tier.title()} Analysis Report",
        "tier": tier,
        "domain": domain,
        "trafficLight": traffic_light,
        "trafficStatus": traffic_status,
        "healthScore": health_score,
        "targetKpi": target_kpi,
        "anomalyCount": anom_count,
        "anomalyPercentage": anom_pct,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "markdown": report_markdown
    })
