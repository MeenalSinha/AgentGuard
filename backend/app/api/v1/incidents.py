from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional
from uuid import UUID
from app.core.database import get_db
from app.models.models import Incident, Agent
from app.schemas.schemas import IncidentResponse

router = APIRouter()


@router.get("/", response_model=list[IncidentResponse])
async def list_incidents(
    agent_id: Optional[UUID] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(Incident, Agent.name.label("agent_name")).join(Agent, Incident.agent_id == Agent.id, isouter=True)
    if agent_id:
        query = query.where(Incident.agent_id == agent_id)
    if status:
        query = query.where(Incident.status == status)
    if severity:
        query = query.where(Incident.severity == severity)
    query = query.order_by(desc(Incident.created_at)).limit(limit)
    result = await db.execute(query)
    rows = result.all()
    out = []
    for inc, agent_name in rows:
        item = IncidentResponse.model_validate(inc)
        item_dict = item.model_dump()
        item_dict["agent_name"] = agent_name
        out.append(item_dict)
    return out


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(incident_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Incident, Agent.name.label("agent_name"))
        .join(Agent, Incident.agent_id == Agent.id, isouter=True)
        .where(Incident.id == incident_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    inc, agent_name = row
    item = IncidentResponse.model_validate(inc)
    item_dict = item.model_dump()
    item_dict["agent_name"] = agent_name
    return item_dict
