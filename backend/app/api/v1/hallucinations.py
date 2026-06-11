from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional
from uuid import UUID
from app.core.database import get_db
from app.models.models import HallucinationEvent, Agent
from app.schemas.schemas import HallucinationEventResponse

router = APIRouter()


@router.get("/", response_model=list[HallucinationEventResponse])
async def list_hallucinations(
    agent_id: Optional[UUID] = None,
    severity: Optional[str] = None,
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
):
    query = select(HallucinationEvent, Agent.name.label("agent_name")).join(Agent, HallucinationEvent.agent_id == Agent.id, isouter=True)
    if agent_id:
        query = query.where(HallucinationEvent.agent_id == agent_id)
    if severity:
        query = query.where(HallucinationEvent.severity == severity)
    query = query.order_by(desc(HallucinationEvent.created_at)).limit(limit)
    result = await db.execute(query)
    rows = result.all()
    out = []
    for he, agent_name in rows:
        item = HallucinationEventResponse.model_validate(he)
        item_dict = item.model_dump()
        item_dict["agent_name"] = agent_name
        out.append(item_dict)
    return out
