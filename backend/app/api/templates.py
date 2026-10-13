import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.template import ReportTemplate
from app.schemas.template import (
    ReportTemplateCreate,
    ReportTemplateUpdate,
    ReportTemplateResponse
)

router = APIRouter()

PRESETS = [
    # ── Beginner Presets ─────────────────────────────────────────────────
    {
        "id": "preset-beg-1",
        "name": "1-Minute Health & Action Brief",
        "description": "Traffic-light health score, plain-English risks, and 3 clear action steps.",
        "tier": "beginner",
        "domain": "auto",
        "is_preset": True,
        "config": {
            "intent": "summary",
            "traffic_lights": True,
            "action_items_count": 3,
            "plain_english": True
        }
    },
    {
        "id": "preset-beg-2",
        "name": "Growth & Opportunity Finder",
        "description": "Finds where your organization can grow without confusing math terms.",
        "tier": "beginner",
        "domain": "auto",
        "is_preset": True,
        "config": {
            "intent": "growth",
            "focus": "opportunities",
            "action_items_count": 3,
            "plain_english": True
        }
    },
    {
        "id": "preset-beg-3",
        "name": "Risk & Error Alert",
        "description": "Flags missing data, suspicious entries, and urgent issues in plain language.",
        "tier": "beginner",
        "domain": "auto",
        "is_preset": True,
        "config": {
            "intent": "risks",
            "focus": "anomalies",
            "action_items_count": 3,
            "plain_english": True
        }
    },

    # ── Pro Presets ──────────────────────────────────────────────────────
    {
        "id": "preset-pro-1",
        "name": "Executive Strategic Summary",
        "description": "C-Suite brief: KPI drivers, risk flags, root causes, and quarterly recommendations.",
        "tier": "pro",
        "domain": "auto",
        "is_preset": True,
        "config": {
            "audience": "executive",
            "tone": "action_oriented",
            "goal_direction": "maximize",
            "sections": ["summary", "anomalies", "root_causes", "forecast", "actions"]
        }
    },
    {
        "id": "preset-pro-2",
        "name": "Religious & Non-Profit Donation Audit",
        "description": "Festival spikes, donor tier segmentation, and retention growth strategy.",
        "tier": "pro",
        "domain": "religious",
        "is_preset": True,
        "config": {
            "target_kpi": "donation_amount",
            "goal_direction": "maximize",
            "domain": "religious",
            "audience": "trustee",
            "sections": ["summary", "anomalies", "segments", "root_causes", "actions"]
        }
    },
    {
        "id": "preset-pro-3",
        "name": "Revenue & Sales Deep-Dive",
        "description": "Revenue drivers, customer segment shifts, and churn mitigation plan.",
        "tier": "pro",
        "domain": "business",
        "is_preset": True,
        "config": {
            "target_kpi": "revenue",
            "goal_direction": "maximize",
            "domain": "business",
            "audience": "management",
            "sections": ["summary", "anomalies", "segments", "forecast", "actions"]
        }
    },

    # ── Ultra Pro Presets ────────────────────────────────────────────────
    {
        "id": "preset-ultra-1",
        "name": "Quant Risk & Anomaly Engine",
        "description": "Isolation Forest (ν=0.01), Spearman rank correlation (p<0.01), LaTeX formulas.",
        "tier": "ultra_pro",
        "domain": "auto",
        "is_preset": True,
        "config": {
            "anomaly_algorithm": "isolation_forest",
            "anomaly_contamination": 0.01,
            "correlation_method": "spearman",
            "correlation_threshold": 0.5,
            "cluster_algorithm": "kmeans_auto",
            "forecast_confidence": 0.95,
            "output_depth": "quant_audit",
            "latex_formulas": True
        }
    },
    {
        "id": "preset-ultra-2",
        "name": "Multi-Variate Cluster & Centroid Analysis",
        "description": "Unsupervised silhouette clustering (k=auto), PCA variance, and centroid distributions.",
        "tier": "ultra_pro",
        "domain": "auto",
        "is_preset": True,
        "config": {
            "anomaly_algorithm": "lof",
            "anomaly_contamination": 0.05,
            "correlation_method": "pearson",
            "correlation_threshold": 0.4,
            "cluster_algorithm": "kmeans_auto",
            "output_depth": "quant_audit",
            "feature_scaling": "standard_zscore"
        }
    }
]


async def _ensure_presets_seeded(db: AsyncSession):
    """Seed system presets if they don't exist yet."""
    for p in PRESETS:
        stmt = select(ReportTemplate).where(ReportTemplate.id == p["id"])
        res = await db.execute(stmt)
        if not res.scalars().first():
            tmpl = ReportTemplate(
                id=p["id"],
                user_id=None,
                workspace_id=None,
                name=p["name"],
                description=p["description"],
                tier=p["tier"],
                domain=p["domain"],
                is_preset=True,
                config=p["config"],
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(tmpl)
    await db.commit()


def _serialize_template(t: ReportTemplate) -> dict:
    return {
        "id": t.id,
        "userId": t.user_id,
        "workspaceId": t.workspace_id,
        "name": t.name,
        "description": t.description,
        "tier": t.tier,
        "domain": t.domain,
        "isPreset": t.is_preset,
        "config": t.config or {},
        "createdAt": t.created_at.isoformat() if t.created_at else None,
        "updatedAt": t.updated_at.isoformat() if t.updated_at else None,
    }


@router.get("/")
@router.get("")
async def list_templates(
    tier: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all presets plus user-created templates."""
    await _ensure_presets_seeded(db)

    query = select(ReportTemplate).where(
        or_(
            ReportTemplate.is_preset.is_(True),
            ReportTemplate.user_id == current_user.id
        )
    ).order_by(ReportTemplate.is_preset.desc(), ReportTemplate.created_at.desc())

    if tier:
        query = query.where(ReportTemplate.tier == tier)

    result = await db.execute(query)
    templates = result.scalars().all()
    return JSONResponse(content=[_serialize_template(t) for t in templates])


@router.post("/", status_code=status.HTTP_201_CREATED)
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: ReportTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save a new custom template (Beginner, Pro, or Ultra Pro)."""
    template = ReportTemplate(
        id=str(uuid.uuid4()),
        user_id=str(current_user.id),
        workspace_id=payload.workspace_id,
        name=payload.name,
        description=payload.description,
        tier=payload.tier,
        domain=payload.domain or "auto",
        is_preset=False,
        config=payload.config,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return JSONResponse(content=_serialize_template(template), status_code=201)


@router.get("/{id}")
async def get_template(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get template details by ID."""
    stmt = select(ReportTemplate).where(ReportTemplate.id == id)
    res = await db.execute(stmt)
    tmpl = res.scalars().first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return JSONResponse(content=_serialize_template(tmpl))


@router.put("/{id}")
async def update_template(
    id: str,
    payload: ReportTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a custom user template (presets cannot be edited)."""
    stmt = select(ReportTemplate).where(ReportTemplate.id == id)
    res = await db.execute(stmt)
    tmpl = res.scalars().first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    if tmpl.is_preset:
        raise HTTPException(status_code=403, detail="System presets cannot be modified.")

    if tmpl.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to edit this template.")

    if payload.name is not None:
        tmpl.name = payload.name
    if payload.description is not None:
        tmpl.description = payload.description
    if payload.tier is not None:
        tmpl.tier = payload.tier
    if payload.domain is not None:
        tmpl.domain = payload.domain
    if payload.config is not None:
        tmpl.config = payload.config

    tmpl.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(tmpl)
    return JSONResponse(content=_serialize_template(tmpl))


@router.delete("/{id}")
async def delete_template(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a custom template (presets cannot be deleted)."""
    stmt = select(ReportTemplate).where(ReportTemplate.id == id)
    res = await db.execute(stmt)
    tmpl = res.scalars().first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    if tmpl.is_preset:
        raise HTTPException(status_code=403, detail="System presets cannot be deleted.")

    if tmpl.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to delete this template.")

    await db.delete(tmpl)
    await db.commit()
    return {"message": "Template successfully deleted"}
