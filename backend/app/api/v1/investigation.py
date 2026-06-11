"""
Investigation API — trigger LangGraph graph on-demand or view graph structure.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from uuid import UUID

from app.core.database import get_db
from app.models.models import Agent

router = APIRouter()


class InvestigationRequest(BaseModel):
    agent_id: UUID
    trigger_type: str = "manual"
    trigger_severity: str = "high"
    trigger_description: str = "Manual investigation triggered via API"


@router.post("/trigger")
async def trigger_investigation(
    payload: InvestigationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Trigger a full LangGraph investigation for any agent."""
    res = await db.execute(select(Agent).where(Agent.id == payload.agent_id))
    agent = res.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Run investigation in background to avoid HTTP timeout
    async def run():
        from app.agents.investigation_graph import run_investigation
        await run_investigation(
            agent_id=str(agent.id),
            agent_name=agent.name,
            agent_type=agent.agent_type.value,
            trigger_type=payload.trigger_type,
            trigger_severity=payload.trigger_severity,
            trigger_description=payload.trigger_description,
        )

    background_tasks.add_task(run)
    return {
        "status": "investigation_started",
        "agent_id": str(payload.agent_id),
        "agent_name": agent.name,
        "message": "LangGraph investigation graph triggered — check /incidents for results in ~30s",
    }


@router.post("/trigger-sync")
async def trigger_investigation_sync(
    payload: InvestigationRequest,
    db: AsyncSession = Depends(get_db),
):
    """Synchronous investigation — waits for full result (use for demos)."""
    res = await db.execute(select(Agent).where(Agent.id == payload.agent_id))
    agent = res.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    from app.agents.investigation_graph import run_investigation
    result = await run_investigation(
        agent_id=str(agent.id),
        agent_name=agent.name,
        agent_type=agent.agent_type.value,
        trigger_type=payload.trigger_type,
        trigger_severity=payload.trigger_severity,
        trigger_description=payload.trigger_description,
    )

    return {
        "status": "complete",
        "incident_created": result.get("incident_created"),
        "incident_id": result.get("incident_id"),
        "root_cause": result.get("root_cause"),
        "root_cause_category": result.get("root_cause_category"),
        "confidence_score": result.get("confidence_score"),
        "severity": result.get("severity"),
        "recommended_actions": result.get("recommended_actions"),
        "estimated_improvements": result.get("estimated_improvements"),
        "notification_sent": result.get("notification_sent"),
        "phoenix_traces_analyzed": len(result.get("phoenix_traces", [])),
        "metrics_analyzed": len(result.get("recent_metrics", [])),
        "error": result.get("error"),
    }


@router.get("/graph-structure")
async def get_graph_structure():
    """Return the LangGraph investigation graph structure for visualization."""
    return {
        "nodes": [
            {"id": "gather_evidence",      "label": "Gather Evidence",       "description": "Pull last-48h metrics, drift events, hallucinations from PostgreSQL"},
            {"id": "fetch_phoenix_traces", "label": "Fetch Phoenix Traces",  "description": "Pull LLM traces from Arize Phoenix OTEL endpoint"},
            {"id": "analyze_with_gemini",  "label": "Gemini RCA",            "description": "Structured root cause analysis with Gemini 2.0 Flash"},
            {"id": "create_incident",      "label": "Create Incident",       "description": "Autonomously persist incident record with timeline"},
            {"id": "notify_operator",      "label": "Notify Operator",       "description": "Send Slack notification for critical/high incidents"},
        ],
        "edges": [
            {"from": "gather_evidence",      "to": "fetch_phoenix_traces", "condition": None},
            {"from": "fetch_phoenix_traces", "to": "analyze_with_gemini",  "condition": None},
            {"from": "analyze_with_gemini",  "to": "create_incident",      "condition": None},
            {"from": "create_incident",      "to": "notify_operator",      "condition": "severity in [critical, high] AND slack_enabled"},
            {"from": "create_incident",      "to": "END",                  "condition": "severity in [medium, low] OR slack_disabled"},
            {"from": "notify_operator",      "to": "END",                  "condition": None},
        ],
        "entry_point": "gather_evidence",
        "description": "Autonomous 5-node LangGraph investigation graph. Triggers automatically when drift score exceeds threshold.",
    }
