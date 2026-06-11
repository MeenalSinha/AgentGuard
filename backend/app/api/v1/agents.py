from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.core.database import get_db
from app.core.cache import cache_get, cache_set
from app.models.models import Agent, AgentMetric
from app.schemas.schemas import AgentCreate, AgentUpdate, AgentResponse, MetricPoint

router = APIRouter()


@router.get("/", response_model=List[AgentResponse])
async def list_agents(
    status: Optional[str] = None,
    agent_type: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"agents:list:{status}:{agent_type}:{limit}:{offset}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    query = select(Agent).where(Agent.is_active == True)
    if status:
        query = query.where(Agent.status == status)
    if agent_type:
        query = query.where(Agent.agent_type == agent_type)
    query = query.order_by(desc(Agent.trust_score)).limit(limit).offset(offset)

    result = await db.execute(query)
    agents = result.scalars().all()
    data = [AgentResponse.model_validate(a).model_dump(mode="json") for a in agents]
    await cache_set(cache_key, data, ttl=60)
    return agents


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.post("/", response_model=AgentResponse, status_code=201)
async def create_agent(payload: AgentCreate, db: AsyncSession = Depends(get_db)):
    agent = Agent(**payload.model_dump())
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(agent_id: UUID, payload: AgentUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(agent, field, value)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.delete("/{agent_id}", status_code=204)
async def delete_agent(agent_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent.is_active = False
    await db.commit()


@router.get("/{agent_id}/metrics", response_model=List[MetricPoint])
async def get_agent_metrics(
    agent_id: UUID,
    period: str = Query("7d", regex="^(24h|7d|30d)$"),
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"metrics:{agent_id}:{period}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    period_map = {"24h": 1, "7d": 7, "30d": 30}
    since = datetime.utcnow() - timedelta(days=period_map[period])

    result = await db.execute(
        select(AgentMetric)
        .where(AgentMetric.agent_id == agent_id, AgentMetric.timestamp >= since)
        .order_by(AgentMetric.timestamp)
    )
    metrics = result.scalars().all()
    data = [MetricPoint.model_validate(m).model_dump(mode="json") for m in metrics]
    await cache_set(cache_key, data, ttl=120)
    return metrics


# ── SDK Telemetry Ingest ──────────────────────────────────────────────────────
class IngestPayload(BaseModel):
    query: str
    response: str
    latency_ms: float
    timestamp: str
    model: Optional[str] = None
    query_category: Optional[str] = None
    accuracy: Optional[float] = None
    hallucination_flag: Optional[bool] = None


@router.post("/{agent_id}/ingest", status_code=202)
async def ingest_telemetry(
    agent_id: UUID,
    payload: IngestPayload,
    db: AsyncSession = Depends(get_db),
):
    """
    SDK endpoint — receives real-time telemetry from instrumented agents.
    Creates AgentMetric records and sends OTEL spans to Phoenix.
    """
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Write metric snapshot
    metric = AgentMetric(
        agent_id=agent_id,
        timestamp=datetime.utcnow(),
        accuracy=payload.accuracy or agent.accuracy,
        latency_ms=payload.latency_ms,
        hallucination_rate=agent.hallucination_rate + (0.01 if payload.hallucination_flag else 0),
        drift_score=agent.drift_score,
        trust_score=agent.trust_score,
        conversation_count=1,
    )
    db.add(metric)

    # Update rolling averages with EMA
    alpha = 0.05
    agent.avg_latency_ms = agent.avg_latency_ms * (1 - alpha) + payload.latency_ms * alpha
    agent.total_conversations += 1
    agent.updated_at = datetime.utcnow()

    await db.commit()

    # Send OTEL span to Phoenix
    try:
        from app.observability.phoenix import trace_agent_invocation
        trace_agent_invocation(
            agent_name=agent.name,
            query=payload.query,
            response=payload.response,
            metadata={"latency_ms": payload.latency_ms, "agent_id": str(agent_id)},
        )
    except Exception:
        pass  # Never fail the ingest due to tracing

    return {"status": "accepted", "agent_id": str(agent_id)}
