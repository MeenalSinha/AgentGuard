from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional
from uuid import UUID
from app.core.database import get_db
from app.models.models import Recommendation, Agent
from app.schemas.schemas import RecommendationResponse

router = APIRouter()


@router.get("/", response_model=list[RecommendationResponse])
async def list_recommendations(
    agent_id: Optional[UUID] = None,
    status: Optional[str] = None,
    limit: int = Query(30, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Recommendation, Agent.name.label("agent_name"))
        .join(Agent, Recommendation.agent_id == Agent.id, isouter=True)
    )
    if agent_id:
        query = query.where(Recommendation.agent_id == agent_id)
    if status:
        query = query.where(Recommendation.status == status)
    query = query.order_by(desc(Recommendation.created_at)).limit(limit)
    result = await db.execute(query)
    rows = result.all()
    out = []
    for rec, agent_name in rows:
        item = RecommendationResponse.model_validate(rec)
        item_dict = item.model_dump()
        item_dict["agent_name"] = agent_name
        out.append(item_dict)
    return out


@router.patch("/{rec_id}/apply")
async def apply_recommendation(rec_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Recommendation).where(Recommendation.id == rec_id))
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    rec.status = "applied"
    await db.commit()
    return {"status": "applied", "id": str(rec_id)}


@router.patch("/{rec_id}/dismiss")
async def dismiss_recommendation(rec_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Recommendation).where(Recommendation.id == rec_id))
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    rec.status = "dismissed"
    await db.commit()
    return {"status": "dismissed", "id": str(rec_id)}
