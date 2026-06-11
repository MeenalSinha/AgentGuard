from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional
from uuid import UUID
from app.core.database import get_db
from app.models.models import Prediction, Agent
from app.schemas.schemas import PredictionResponse

router = APIRouter()


@router.get("/", response_model=list[PredictionResponse])
async def list_predictions(
    agent_id: Optional[UUID] = None,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Prediction, Agent.name.label("agent_name"))
        .join(Agent, Prediction.agent_id == Agent.id, isouter=True)
    )
    if agent_id:
        query = query.where(Prediction.agent_id == agent_id)
    query = query.order_by(desc(Prediction.created_at)).limit(limit)
    result = await db.execute(query)
    rows = result.all()
    out = []
    for pred, agent_name in rows:
        item = PredictionResponse.model_validate(pred)
        item_dict = item.model_dump()
        item_dict["agent_name"] = agent_name
        out.append(item_dict)
    return out
