"""
Drift Injection Simulator — Judge Demo Mode
Allows injecting realistic failure scenarios into agents for live demonstrations.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
import random

from app.core.database import get_db
from app.core.cache import cache_delete_pattern
from app.models.models import (
    Agent, DriftEvent, HallucinationEvent, Incident,
    DriftType, SeverityLevel, AgentStatus
)

router = APIRouter()

SCENARIO_CONFIG = {
    "prompt_drift": {
        "drift_type": DriftType.PROMPT,
        "severity": SeverityLevel.HIGH,
        "trust_delta": -0.18,
        "drift_delta": +0.35,
        "halluc_delta": +0.042,
        "latency_mult": 1.3,
        "description": "System prompt token budget exceeded — response format instructions truncated causing inconsistent output structure across 67% of queries.",
        "incident_title": "Critical prompt drift — instruction following accuracy degraded 33%",
        "root_cause": "System prompt token budget exceeded. Response format instructions truncated at 89% of max context window.",
        "impact": "Approximately 340 user interactions returned malformed responses. Instruction-following accuracy dropped from 94% to 61%.",
    },
    "retrieval_drift": {
        "drift_type": DriftType.RETRIEVAL,
        "severity": SeverityLevel.CRITICAL,
        "trust_delta": -0.30,
        "drift_delta": +0.48,
        "halluc_delta": +0.12,
        "latency_mult": 2.1,
        "description": "Vector embeddings 23 model versions behind current encoder. Semantic similarity degraded 41% — queries returning stale, mismatched documents.",
        "incident_title": "Critical retrieval drift — embedding model mismatch causing 41% precision loss",
        "root_cause": "Vector index built with outdated embedding model. Semantic similarity scores degraded from 0.89 to 0.52.",
        "impact": "28% of responses contain information outdated by 6+ months. Retrieval precision fell from 0.89 to 0.52.",
    },
    "hallucination_surge": {
        "drift_type": DriftType.MODEL,
        "severity": SeverityLevel.CRITICAL,
        "trust_delta": -0.35,
        "drift_delta": +0.28,
        "halluc_delta": +0.142,
        "latency_mult": 1.1,
        "description": "Confidence calibration failure — model generating high-certainty (>0.85) outputs with no supporting evidence. Hallucination rate surged from 1.8% to 14.2%.",
        "incident_title": "Hallucination surge — fabrication rate exceeded critical threshold (14.2%)",
        "root_cause": "Retrieval failures triggered model to generate plausible ungrounded responses. Confidence calibration misaligned after upstream model update.",
        "impact": "6 external-facing responses containing fabricated data identified. Potential compliance exposure.",
    },
    "latency_spike": {
        "drift_type": DriftType.MODEL,
        "severity": SeverityLevel.HIGH,
        "trust_delta": -0.10,
        "drift_delta": +0.14,
        "halluc_delta": +0.021,
        "latency_mult": 13.7,
        "description": "LLM provider rate limiting at 89 req/min. Missing timeout configuration causing unbounded queue growth. P99 reached 11.2 seconds.",
        "incident_title": "Latency spike — P99 exceeded 11s SLA breach",
        "root_cause": "Provider rate limiting triggered during peak load. No request timeout configured — queue grew unbounded.",
        "impact": "35% of users experienced >5 second response times for 2.5 hours. Session completion rate dropped 23%.",
    },
    "safety_violation": {
        "drift_type": DriftType.PROMPT,
        "severity": SeverityLevel.CRITICAL,
        "trust_delta": -0.42,
        "drift_delta": +0.44,
        "halluc_delta": +0.186,
        "latency_mult": 1.2,
        "description": "Adversarial prompt injection bypass — 8 successful jailbreaks confirmed. Content safety filter circumvented via encoding variant.",
        "incident_title": "Safety violation — prompt injection bypass detected (8 confirmed jailbreaks)",
        "root_cause": "Adversarial encoding variant discovered bypassing content safety filter. System prompt integrity not validated per-request.",
        "impact": "Safety filter bypassed in 8 interactions. Outputs violated content policy in 3 cases. Requires immediate audit of last 6 hours.",
    },
    "cost_explosion": {
        "drift_type": DriftType.USER_INTENT,
        "severity": SeverityLevel.HIGH,
        "trust_delta": -0.12,
        "drift_delta": +0.12,
        "halluc_delta": +0.028,
        "latency_mult": 10.8,
        "description": "Unbounded context growth in multi-turn conversations. Token cost multiplied 18x — 23 runaway threads consuming 64% of daily budget.",
        "incident_title": "Cost explosion — daily token spend increased 18x due to unbounded context",
        "root_cause": "Feedback loop in multi-turn handler included full conversation history on every request. No context window limit configured.",
        "impact": "Daily cost increased from $240 to $4,320. Projected monthly impact: +$120,000.",
    },
    "tool_failure": {
        "drift_type": DriftType.RETRIEVAL,
        "severity": SeverityLevel.HIGH,
        "trust_delta": -0.24,
        "drift_delta": +0.17,
        "halluc_delta": +0.042,
        "latency_mult": 2.9,
        "description": "External CRM API returning 429 errors after vendor plan downgrade. Silent failures propagating — responses missing customer context.",
        "incident_title": "Tool failure — CRM API rate limiting causing 22% of responses to miss customer context",
        "root_cause": "Vendor plan downgrade caused 429 rate limit errors. No fallback behavior configured for tool failures.",
        "impact": "22% of customer support queries missing account context. Escalation rate increased 31%.",
    },
    "kb_staleness": {
        "drift_type": DriftType.RETRIEVAL,
        "severity": SeverityLevel.MEDIUM,
        "trust_delta": -0.16,
        "drift_delta": +0.22,
        "halluc_delta": +0.089,
        "latency_mult": 1.2,
        "description": "Knowledge base stale for 22 days. Scheduled re-indexing job failed silently on day 8 due to storage quota exceeded.",
        "incident_title": "Knowledge base staleness — 22-day lag causing outdated responses on 31% of queries",
        "root_cause": "Storage quota exceeded caused re-indexing job to fail silently on day 8. No job failure alerting configured.",
        "impact": "31% of queries returning outdated information. Support escalation rate increased 18%.",
    },
}

RECOMMENDED_ACTIONS = {
    "prompt_drift": ["Compress system prompt by removing redundant instructions (est. 28% reduction)", "Split long prompts into layered instruction sets", "Add format validation layer with automatic retry on schema mismatch", "Implement prompt length monitoring with 80% threshold alert"],
    "retrieval_drift": ["Re-index entire knowledge base with current embedding model (est. 4h)", "Implement automated staleness detection at 14-day intervals", "Add retrieval confidence threshold — fallback when similarity < 0.65", "Version-pin embeddings to auto-upgrade with model updates"],
    "hallucination_surge": ["Enable strict citation enforcement — all factual claims must reference source documents", "Lower confidence threshold to 0.60 for unsupported assertions", "Add output validation layer with knowledge source cross-check", "Implement human review queue for high-risk response categories"],
    "latency_spike": ["Implement 5-second hard timeout with graceful degradation response", "Add circuit breaker at 85% of rate limit capacity", "Deploy semantic response cache — est. 40% hit rate", "Configure secondary provider failover with <200ms switchover"],
    "safety_violation": ["Deploy input sanitization layer stripping known injection patterns immediately", "Upgrade content safety filter to v3.4 with adversarial robustness", "Add redundant output safety check independent of system prompt", "Conduct full audit of last 6 hours of responses"],
    "cost_explosion": ["Implement hard context window truncation at 8,000 tokens with sliding window", "Add per-conversation cost cap with graceful context compression", "Deploy conversation length monitoring with alert at 20-turn threshold", "Introduce context summarization for long-running threads"],
    "tool_failure": ["Implement exponential backoff with jitter for all tool calls", "Add explicit fallback responses when tool data unavailable", "Configure tool failure alerting at >2% error rate", "Request vendor plan upgrade or implement local data cache"],
    "kb_staleness": ["Immediately trigger full knowledge base re-index", "Configure storage quota alerts at 80% threshold", "Implement knowledge currency scoring visible in agent responses", "Add automated staleness check — degrade agent flag at 14 days"],
}

TIMELINE_TEMPLATES = {
    "prompt_drift": [
        {"event": "Agent operating normally at 94% accuracy", "type": "info"},
        {"event": "Token budget exceeded during high-volume query burst", "type": "warning"},
        {"event": "Instruction truncation detected in 12% of responses", "type": "warning"},
        {"event": "Format failures cascaded to 67% of queries", "type": "critical"},
        {"event": "AgentGuard drift score crossed 0.18 threshold", "type": "critical"},
        {"event": "Autonomous investigation triggered", "type": "info"},
        {"event": "Root cause confirmed: prompt token overflow", "type": "info"},
        {"event": "Fix recommendations generated and ranked", "type": "resolved"},
    ],
    "retrieval_drift": [
        {"event": "Retrieval relevance baseline: 0.89", "type": "info"},
        {"event": "Embedding model updated upstream without re-indexing", "type": "warning"},
        {"event": "Similarity scores declined 0.89 → 0.74", "type": "warning"},
        {"event": "Precision recall gap exceeded 0.15 threshold", "type": "critical"},
        {"event": "Hallucination rate correlated with retrieval failures", "type": "critical"},
        {"event": "AgentGuard triggered retrieval drift investigation", "type": "info"},
        {"event": "23-version embedding lag confirmed as root cause", "type": "info"},
        {"event": "Urgent re-indexing queued with priority flag", "type": "resolved"},
    ],
}


class InjectRequest(BaseModel):
    agent_id: UUID
    scenario_id: str


class InjectResponse(BaseModel):
    success: bool
    scenario_id: str
    agent_id: str
    agent_name: str
    severity: str
    drift_event_id: str
    incident_id: str
    metrics_before: dict
    metrics_after: dict
    root_cause: str
    impact: str
    recommended_actions: list[str]
    timeline_events: list[dict]
    investigation_confidence: float


@router.post("/inject", response_model=InjectResponse)
async def inject_scenario(payload: InjectRequest, db: AsyncSession = Depends(get_db)):
    # Validate agent
    result = await db.execute(select(Agent).where(Agent.id == payload.agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    scenario_id = payload.scenario_id
    if scenario_id not in SCENARIO_CONFIG:
        raise HTTPException(status_code=400, detail=f"Unknown scenario: {scenario_id}. Valid: {list(SCENARIO_CONFIG.keys())}")

    cfg = SCENARIO_CONFIG[scenario_id]

    # Snapshot before
    metrics_before = {
        "trust_score": round(agent.trust_score, 2),
        "drift_score": round(agent.drift_score, 4),
        "hallucination_rate": round(agent.hallucination_rate, 4),
        "avg_latency_ms": round(agent.avg_latency_ms, 1),
        "accuracy": round(agent.accuracy, 4),
        "status": agent.status.value,
    }

    # Apply degradation to agent
    agent.trust_score = max(20.0, agent.trust_score * (1 + cfg["trust_delta"]))
    agent.drift_score = min(1.0, agent.drift_score + cfg["drift_delta"])
    agent.hallucination_rate = min(0.35, agent.hallucination_rate + cfg["halluc_delta"])
    agent.avg_latency_ms = min(15000.0, agent.avg_latency_ms * cfg["latency_mult"])
    agent.accuracy = max(0.3, agent.accuracy * (1 + cfg["trust_delta"] * 0.8))

    # Update status
    if agent.trust_score < 60 or cfg["severity"] == SeverityLevel.CRITICAL:
        agent.status = AgentStatus.CRITICAL
    elif agent.trust_score < 75:
        agent.status = AgentStatus.WARNING
    agent.updated_at = datetime.utcnow()

    metrics_after = {
        "trust_score": round(agent.trust_score, 2),
        "drift_score": round(agent.drift_score, 4),
        "hallucination_rate": round(agent.hallucination_rate, 4),
        "avg_latency_ms": round(agent.avg_latency_ms, 1),
        "accuracy": round(agent.accuracy, 4),
        "status": agent.status.value,
    }

    # Create drift event
    drift = DriftEvent(
        agent_id=agent.id,
        drift_type=cfg["drift_type"],
        severity=cfg["severity"],
        confidence=round(random.uniform(0.88, 0.97), 3),
        description=cfg["description"],
        evidence={"scenario": scenario_id, "injected": True, "demo_mode": True},
        baseline_value=metrics_before["drift_score"],
        current_value=metrics_after["drift_score"],
        delta=metrics_after["drift_score"] - metrics_before["drift_score"],
        resolved=False,
        created_at=datetime.utcnow(),
    )
    db.add(drift)
    await db.flush()

    # Create hallucination event if halluc surge
    if cfg["halluc_delta"] > 0.05:
        halluc = HallucinationEvent(
            agent_id=agent.id,
            severity=cfg["severity"],
            risk_level=min(0.95, cfg["halluc_delta"] * 5),
            query="[Injected scenario — hallucination event generated by simulator]",
            response_excerpt="Response contained claims that could not be verified against knowledge sources.",
            unsupported_claims=["Claim not grounded in knowledge base"],
            missing_evidence=["No source document found for this assertion"],
            fabrications=["Plausible-sounding statistic with no evidential basis"] if cfg["halluc_delta"] > 0.08 else [],
            suggested_fix=RECOMMENDED_ACTIONS[scenario_id][0],
            confidence=round(random.uniform(0.82, 0.96), 3),
            created_at=datetime.utcnow(),
        )
        db.add(halluc)

    # Build timeline
    template = TIMELINE_TEMPLATES.get(scenario_id)
    if template:
        timeline = [{"time": f"T+{i*3}m", "event": ev["event"], "type": ev["type"]} for i, ev in enumerate(template)]
    else:
        timeline = [
            {"time": "T+0m",  "event": "Agent operating normally", "type": "info"},
            {"time": "T+3m",  "event": f"Anomaly pattern detected: {scenario_id.replace('_',' ')}", "type": "warning"},
            {"time": "T+6m",  "event": "Drift score threshold crossed", "type": "critical"},
            {"time": "T+9m",  "event": "AgentGuard investigation triggered", "type": "info"},
            {"time": "T+12m", "event": cfg["root_cause"][:80], "type": "info"},
            {"time": "T+15m", "event": "Corrective actions generated and ranked", "type": "resolved"},
        ]

    # Create incident record
    incident = Incident(
        agent_id=agent.id,
        title=cfg["incident_title"],
        severity=cfg["severity"],
        status="investigating",
        root_cause=cfg["root_cause"],
        impact_assessment=cfg["impact"],
        recommended_actions=RECOMMENDED_ACTIONS.get(scenario_id, []),
        investigation_confidence=round(random.uniform(0.88, 0.96), 3),
        timeline_events=timeline,
        started_at=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    db.add(incident)
    await db.flush()

    await db.commit()

    # Invalidate caches
    await cache_delete_pattern("agents:list:*")
    await cache_delete_pattern("dashboard:*")

    return InjectResponse(
        success=True,
        scenario_id=scenario_id,
        agent_id=str(agent.id),
        agent_name=agent.name,
        severity=cfg["severity"].value,
        drift_event_id=str(drift.id),
        incident_id=str(incident.id),
        metrics_before=metrics_before,
        metrics_after=metrics_after,
        root_cause=cfg["root_cause"],
        impact=cfg["impact"],
        recommended_actions=RECOMMENDED_ACTIONS.get(scenario_id, []),
        timeline_events=timeline,
        investigation_confidence=incident.investigation_confidence,
    )


@router.post("/recover/{agent_id}")
async def recover_agent(agent_id: UUID, db: AsyncSession = Depends(get_db)):
    """Restore an agent to healthy state after simulation."""
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Restore healthy metrics
    agent.trust_score = min(98.0, agent.trust_score * 1.35 + 5)
    agent.drift_score = max(0.0, agent.drift_score * 0.05)
    agent.hallucination_rate = max(0.005, agent.hallucination_rate * 0.08)
    agent.avg_latency_ms = max(300.0, agent.avg_latency_ms * 0.12)
    agent.accuracy = min(0.99, agent.accuracy * 1.2 + 0.05)

    if agent.trust_score >= 85:
        agent.status = AgentStatus.HEALTHY
    elif agent.trust_score >= 70:
        agent.status = AgentStatus.WARNING
    agent.updated_at = datetime.utcnow()

    # Resolve open drift events
    from sqlalchemy import update
    await db.execute(
        update(DriftEvent)
        .where(DriftEvent.agent_id == agent_id, DriftEvent.resolved == False)
        .values(resolved=True, resolved_at=datetime.utcnow())
    )

    await db.commit()
    await cache_delete_pattern("agents:list:*")
    await cache_delete_pattern("dashboard:*")

    return {
        "success": True,
        "agent_id": str(agent_id),
        "agent_name": agent.name,
        "status": agent.status.value,
        "trust_score": round(agent.trust_score, 2),
        "message": f"{agent.name} restored to healthy state",
    }


@router.get("/scenarios")
async def list_scenarios():
    """List all available simulation scenarios."""
    return [
        {
            "id": k,
            "name": k.replace("_", " ").title(),
            "severity": v["severity"].value,
            "drift_type": v["drift_type"].value,
            "description": v["description"][:120] + "...",
        }
        for k, v in SCENARIO_CONFIG.items()
    ]


@router.post("/inject-and-investigate")
async def inject_and_investigate(payload: InjectRequest, db: AsyncSession = Depends(get_db)):
    """
    Full demo flow: inject failure + immediately run LangGraph investigation.
    Returns both the injection result AND the Gemini root cause analysis.
    Use this for the most impressive demo moment — real AI-generated root cause.
    """
    # Step 1: inject
    inject_result = await inject_scenario(payload, db)

    # Step 2: run LangGraph investigation synchronously
    try:
        from app.agents.investigation_graph import run_investigation
        sc = SCENARIO_CONFIG[payload.scenario_id]
        inv_result = await run_investigation(
            agent_id=str(payload.agent_id),
            agent_name=inject_result.agent_name,
            agent_type="custom",
            trigger_type=payload.scenario_id,
            trigger_severity=sc["severity"].value,
            trigger_description=sc["description"],
        )
        return {
            **inject_result.model_dump(),
            "langgraph_result": {
                "root_cause":          inv_result.get("root_cause"),
                "root_cause_category": inv_result.get("root_cause_category"),
                "confidence_score":    inv_result.get("confidence_score"),
                "recommended_actions": inv_result.get("recommended_actions"),
                "incident_id":         inv_result.get("incident_id"),
                "notification_sent":   inv_result.get("notification_sent"),
                "metrics_analyzed":    len(inv_result.get("recent_metrics", [])),
                "phoenix_traces":      len(inv_result.get("phoenix_traces", [])),
                "gemini_error":        inv_result.get("error"),
            },
        }
    except Exception as e:
        return {**inject_result.model_dump(), "langgraph_result": {"error": str(e)}}
