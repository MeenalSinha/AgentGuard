from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.cache import cache_get, cache_set
from app.models.models import Agent, AgentMetric, DriftEvent, HallucinationEvent, Incident, AgentStatus
from app.schemas.schemas import DashboardKPIs

router = APIRouter()


@router.get("/kpis", response_model=DashboardKPIs)
async def get_kpis(db: AsyncSession = Depends(get_db)):
    cached = await cache_get("dashboard:kpis")
    if cached:
        return cached

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    active_agents    = await db.scalar(select(func.count()).where(Agent.is_active == True)) or 0
    avg_health       = await db.scalar(select(func.avg(Agent.trust_score)).where(Agent.is_active == True)) or 0
    drift_today      = await db.scalar(select(func.count()).where(DriftEvent.created_at >= today)) or 0
    halluc_today     = await db.scalar(select(func.count()).where(HallucinationEvent.created_at >= today)) or 0
    total_cost       = await db.scalar(select(func.sum(Agent.total_cost_month)).where(Agent.is_active == True)) or 0
    avg_quality      = await db.scalar(select(func.avg(Agent.accuracy)).where(Agent.is_active == True)) or 0
    critical_open    = await db.scalar(
        select(func.count()).where(and_(Incident.status != "resolved", Incident.severity == "critical"))
    ) or 0
    agents_at_risk   = await db.scalar(
        select(func.count()).where(Agent.status.in_(["warning", "critical"]))
    ) or 0

    result = DashboardKPIs(
        active_agents=active_agents,
        avg_health_score=round(float(avg_health), 1),
        drift_events_today=drift_today,
        hallucination_alerts_today=halluc_today,
        total_monthly_cost=round(float(total_cost), 2),
        avg_response_quality=round(float(avg_quality) * 100, 1),
        critical_incidents=critical_open,
        agents_at_risk=agents_at_risk,
    )
    await cache_set("dashboard:kpis", result.model_dump(), ttl=30)
    return result


@router.get("/rankings")
async def get_agent_rankings(db: AsyncSession = Depends(get_db)):
    cached = await cache_get("dashboard:rankings")
    if cached:
        return cached

    result = await db.execute(
        select(Agent)
        .where(Agent.is_active == True)
        .order_by(desc(Agent.trust_score))
        .limit(12)
    )
    agents = result.scalars().all()
    rankings = [
        {
            "agent_id": str(a.id),
            "name": a.name,
            "agent_type": a.agent_type.value,
            "trust_score": round(a.trust_score, 1),
            "status": a.status.value,
            "accuracy": round(a.accuracy * 100, 1),
            "hallucination_rate": round(a.hallucination_rate * 100, 2),
        }
        for a in agents
    ]
    await cache_set("dashboard:rankings", rankings, ttl=60)
    return rankings


@router.get("/live-feed")
async def get_live_feed(db: AsyncSession = Depends(get_db)):
    since = datetime.utcnow() - timedelta(hours=48)

    drift_result = await db.execute(
        select(DriftEvent, Agent.name.label("agent_name"))
        .join(Agent, DriftEvent.agent_id == Agent.id)
        .where(DriftEvent.created_at >= since)
        .order_by(desc(DriftEvent.created_at))
        .limit(15)
    )
    halluc_result = await db.execute(
        select(HallucinationEvent, Agent.name.label("agent_name"))
        .join(Agent, HallucinationEvent.agent_id == Agent.id)
        .where(HallucinationEvent.created_at >= since)
        .order_by(desc(HallucinationEvent.created_at))
        .limit(15)
    )

    events = []
    for row in drift_result:
        de, agent_name = row
        events.append({
            "id": str(de.id),
            "type": "drift",
            "severity": de.severity.value,
            "agent": agent_name,
            "message": de.description or f"{de.drift_type.value} drift detected",
            "timestamp": de.created_at.isoformat(),
        })
    for row in halluc_result:
        he, agent_name = row
        events.append({
            "id": str(he.id),
            "type": "hallucination",
            "severity": he.severity.value,
            "agent": agent_name,
            "message": f"Hallucination detected — risk level {he.risk_level:.0%}",
            "timestamp": he.created_at.isoformat(),
        })

    events.sort(key=lambda x: x["timestamp"], reverse=True)
    return events[:20]


@router.get("/health-overview")
async def get_health_overview(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Agent.status, func.count().label("count"))
        .where(Agent.is_active == True)
        .group_by(Agent.status)
    )
    rows = result.all()
    return {row.status.value: row.count for row in rows}
