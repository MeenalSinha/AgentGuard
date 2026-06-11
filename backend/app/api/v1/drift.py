from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from typing import Optional
from uuid import UUID
from app.core.database import get_db
from app.models.models import DriftEvent, Agent
from app.schemas.schemas import DriftEventResponse

router = APIRouter()


@router.get("/", response_model=list[DriftEventResponse])
async def list_drift_events(
    agent_id: Optional[UUID] = None,
    drift_type: Optional[str] = None,
    severity: Optional[str] = None,
    resolved: Optional[bool] = None,
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
):
    query = select(DriftEvent, Agent.name.label("agent_name")).join(Agent, DriftEvent.agent_id == Agent.id, isouter=True)
    if agent_id:
        query = query.where(DriftEvent.agent_id == agent_id)
    if drift_type:
        query = query.where(DriftEvent.drift_type == drift_type)
    if severity:
        query = query.where(DriftEvent.severity == severity)
    if resolved is not None:
        query = query.where(DriftEvent.resolved == resolved)
    query = query.order_by(desc(DriftEvent.created_at)).limit(limit)
    result = await db.execute(query)
    rows = result.all()
    out = []
    for de, agent_name in rows:
        item = DriftEventResponse.model_validate(de)
        item_dict = item.model_dump()
        item_dict["agent_name"] = agent_name
        out.append(item_dict)
    return out


@router.get("/summary")
async def drift_summary(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DriftEvent.drift_type, DriftEvent.severity, func.count().label("count"))
        .group_by(DriftEvent.drift_type, DriftEvent.severity)
    )
    rows = result.all()
    return [{"drift_type": r.drift_type.value, "severity": r.severity.value, "count": r.count} for r in rows]
