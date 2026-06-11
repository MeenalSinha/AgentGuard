from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
import google.generativeai as genai
import json, asyncio

from app.core.config import settings
from app.core.database import get_db
from app.models.models import Agent, DriftEvent, HallucinationEvent, Incident, Prediction
from app.schemas.schemas import CopilotRequest, CopilotResponse
from app.observability.phoenix import trace_agent_invocation

router = APIRouter()
genai.configure(api_key=settings.GOOGLE_API_KEY)


async def build_system_context(db: AsyncSession, agent_id=None) -> str:
    """Build rich real-time context for Gemini from live DB data."""
    # Fleet summary
    agents_res = await db.execute(
        select(Agent).where(Agent.is_active == True)
        .order_by(Agent.trust_score).limit(20)
    )
    agents = agents_res.scalars().all()
    fleet_summary = "\n".join([
        f"- {a.name} ({a.agent_type.value}): trust={a.trust_score:.1f}, "
        f"status={a.status.value}, drift={a.drift_score:.3f}, "
        f"halluc={a.hallucination_rate:.2%}, latency={a.avg_latency_ms:.0f}ms"
        for a in agents
    ])

    # Active incidents
    inc_res = await db.execute(
        select(Incident, Agent.name.label("aname"))
        .join(Agent, Incident.agent_id == Agent.id)
        .where(Incident.status != "resolved")
        .order_by(desc(Incident.created_at)).limit(5)
    )
    incidents_text = "\n".join([
        f"- [{inc.severity.value.upper()}] {aname}: {inc.title} (status: {inc.status}, conf: {inc.investigation_confidence:.0%})"
        for inc, aname in inc_res
    ]) or "No active incidents"

    # Recent drift events
    drift_res = await db.execute(
        select(DriftEvent, Agent.name.label("aname"))
        .join(Agent, DriftEvent.agent_id == Agent.id)
        .where(DriftEvent.resolved == False)
        .order_by(desc(DriftEvent.created_at)).limit(5)
    )
    drift_text = "\n".join([
        f"- {aname}: {de.drift_type.value} drift ({de.severity.value}), delta={de.delta:.3f}"
        for de, aname in drift_res
    ]) or "No active drift events"

    # Active predictions
    pred_res = await db.execute(
        select(Prediction, Agent.name.label("aname"))
        .join(Agent, Prediction.agent_id == Agent.id)
        .order_by(desc(Prediction.probability)).limit(5)
    )
    pred_text = "\n".join([
        f"- {aname}: {p.prediction_type} {p.probability:.0%} probability within {p.time_horizon_hours}h (conf: {p.confidence:.0%})"
        for p, aname in pred_res
    ]) or "No active predictions"

    return f"""You are AgentGuard Copilot, an expert autonomous AI reliability engineer embedded in a production observability platform.

You have REAL-TIME access to live telemetry from this enterprise AI agent fleet.

CURRENT FLEET ({len(agents)} agents):
{fleet_summary}

ACTIVE INCIDENTS:
{incidents_text}

ACTIVE DRIFT EVENTS:
{drift_text}

ML FAILURE PREDICTIONS (scikit-learn):
{pred_text}

Your capabilities:
- Explain failures with root cause specificity referencing actual metric values
- Identify cross-agent patterns and correlations
- Recommend specific, prioritized corrective actions
- Predict which agents need immediate attention
- Compare agent performance across the fleet
- Explain what the LangGraph investigation found

Always reference specific agents, exact metric values, and timestamps.
Format complex answers with clear sections.
Be direct, precise, and technically authoritative."""


@router.post("/chat", response_model=CopilotResponse)
async def chat(request: CopilotRequest, db: AsyncSession = Depends(get_db)):
    system_ctx = await build_system_context(db, request.agent_id)
    user_query = request.messages[-1].content if request.messages else ""

    try:
        model = genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL,
            system_instruction=system_ctx,
        )
        history = [
            {"role": m.role, "parts": [m.content]}
            for m in request.messages[:-1]
        ]
        chat_session = model.start_chat(history=history)
        response = chat_session.send_message(user_query)
        answer = response.text

        # Send trace to Phoenix
        trace_agent_invocation(
            agent_name="AgentGuard Copilot",
            query=user_query,
            response=answer[:500],
            metadata={"model": settings.GEMINI_MODEL, "agent_id": str(request.agent_id) if request.agent_id else "fleet"},
        )

        return CopilotResponse(
            message=answer,
            confidence=0.93,
            sources=["Live agent metrics DB", "Active incident records", "Drift event log", "ML predictions", "Arize Phoenix traces"],
        )

    except Exception as e:
        # Graceful fallback with real fleet data
        agents_res = await db.execute(
            select(Agent).where(Agent.is_active == True).order_by(Agent.trust_score).limit(5)
        )
        agents = agents_res.scalars().all()
        lowest = agents[0] if agents else None

        fallback = (
            f"AgentGuard Copilot is monitoring {await db.scalar(select(func.count()).where(Agent.is_active==True)) or 0} active agents. "
        )
        if lowest:
            fallback += (
                f"The agent requiring most attention is {lowest.name} "
                f"(trust: {lowest.trust_score:.1f}, drift: {lowest.drift_score:.3f}). "
            )
        fallback += f"Configure GOOGLE_API_KEY for full Gemini-powered analysis. Error: {str(e)[:100]}"

        return CopilotResponse(message=fallback, confidence=0.5, sources=[])


@router.post("/stream")
async def stream_chat(request: CopilotRequest, db: AsyncSession = Depends(get_db)):
    system_ctx = await build_system_context(db, request.agent_id)
    user_query = request.messages[-1].content if request.messages else ""

    async def generate():
        try:
            model = genai.GenerativeModel(
                model_name=settings.GEMINI_MODEL,
                system_instruction=system_ctx,
            )
            history = [{"role": m.role, "parts": [m.content]} for m in request.messages[:-1]]
            chat_session = model.start_chat(history=history)
            response = chat_session.send_message(user_query, stream=True)
            full_response = ""
            for chunk in response:
                if chunk.text:
                    full_response += chunk.text
                    yield f"data: {json.dumps({'text': chunk.text})}\n\n"
                    await asyncio.sleep(0)
            # Trace to Phoenix after streaming
            trace_agent_invocation("AgentGuard Copilot", user_query, full_response[:500])
        except Exception as e:
            yield f"data: {json.dumps({'text': f'Copilot unavailable — configure GOOGLE_API_KEY. Error: {str(e)[:80]}'})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
