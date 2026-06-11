"""
Server-Sent Events endpoint for real-time live feed.
Replaces 30-second polling with push-based event streaming.
"""
import asyncio
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models.models import DriftEvent, HallucinationEvent, Incident, Agent

router = APIRouter()


@router.get("/feed")
async def live_feed_sse(db: AsyncSession = Depends(get_db)):
    """
    Server-Sent Events stream — push new events to the frontend in real time.
    The frontend connects once and receives events as they happen.
    """
    async def event_generator():
        last_seen_drift = datetime.utcnow() - timedelta(minutes=5)
        last_seen_halluc = datetime.utcnow() - timedelta(minutes=5)

        yield "retry: 3000\n\n"  # Tell client to reconnect after 3s if disconnected

        while True:
            try:
                events = []

                # New drift events
                drift_res = await db.execute(
                    select(DriftEvent, Agent.name.label("agent_name"))
                    .join(Agent, DriftEvent.agent_id == Agent.id)
                    .where(DriftEvent.created_at > last_seen_drift)
                    .order_by(desc(DriftEvent.created_at))
                    .limit(5)
                )
                for de, aname in drift_res:
                    events.append({
                        "id": str(de.id), "type": "drift",
                        "severity": de.severity.value, "agent": aname,
                        "message": de.description or f"{de.drift_type.value} drift detected",
                        "timestamp": de.created_at.isoformat(),
                    })
                    if de.created_at > last_seen_drift:
                        last_seen_drift = de.created_at

                # New hallucination events
                halluc_res = await db.execute(
                    select(HallucinationEvent, Agent.name.label("agent_name"))
                    .join(Agent, HallucinationEvent.agent_id == Agent.id)
                    .where(HallucinationEvent.created_at > last_seen_halluc)
                    .order_by(desc(HallucinationEvent.created_at))
                    .limit(5)
                )
                for he, aname in halluc_res:
                    events.append({
                        "id": str(he.id), "type": "hallucination",
                        "severity": he.severity.value, "agent": aname,
                        "message": f"Hallucination detected — risk {he.risk_level:.0%}",
                        "timestamp": he.created_at.isoformat(),
                    })
                    if he.created_at > last_seen_halluc:
                        last_seen_halluc = he.created_at

                if events:
                    yield f"data: {json.dumps(events)}\n\n"

                await asyncio.sleep(5)  # Poll DB every 5 seconds

            except asyncio.CancelledError:
                break
            except Exception as e:
                yield f"data: {json.dumps([{'type': 'error', 'message': str(e)}])}\n\n"
                await asyncio.sleep(10)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
