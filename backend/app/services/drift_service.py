"""
Background Celery task — periodic drift scanning with autonomous LangGraph investigation.
Runs every 60s. When severity >= HIGH, fires the full LangGraph investigation graph.
This is the genuine autonomous loop: detect → investigate → create_incident → notify.
"""
import asyncio
import statistics
from datetime import datetime, timedelta
import structlog

from app.core.celery import celery_app

logger = structlog.get_logger()

DRIFT_THRESHOLD_HIGH   = 0.12
DRIFT_THRESHOLD_MEDIUM = 0.06
INVESTIGATE_SEVERITIES = {"critical", "high"}


@celery_app.task(name="app.services.drift_service.periodic_drift_scan")
def periodic_drift_scan():
    """Celery beat task — runs every 60 seconds."""
    asyncio.run(_scan_all_agents())


async def _scan_all_agents():
    from app.core.database import AsyncSessionLocal
    from app.models.models import Agent
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Agent).where(Agent.is_active == True))
        agents = res.scalars().all()

    triggered = 0
    for agent in agents:
        try:
            triggered += await _check_agent_drift(agent)
        except Exception as e:
            logger.error("Drift scan error", agent=str(agent.id), error=str(e))

    logger.info("Drift scan complete", agents_checked=len(agents), investigations_triggered=triggered)


async def _check_agent_drift(agent) -> int:
    """
    Compare last-24h metrics vs 7-day baseline.
    Returns 1 if a LangGraph investigation was triggered, else 0.
    """
    from app.core.database import AsyncSessionLocal
    from app.models.models import AgentMetric, DriftEvent, DriftType, SeverityLevel, Agent, AgentStatus
    from app.core.cache import cache_delete_pattern
    from sqlalchemy import select, update

    now = datetime.utcnow()
    window_start = now - timedelta(hours=24)
    baseline_start = now - timedelta(days=8)
    baseline_end = now - timedelta(days=1)

    async with AsyncSessionLocal() as db:
        recent_res = await db.execute(
            select(AgentMetric)
            .where(AgentMetric.agent_id == agent.id, AgentMetric.timestamp >= window_start)
        )
        recent = recent_res.scalars().all()

        baseline_res = await db.execute(
            select(AgentMetric)
            .where(AgentMetric.agent_id == agent.id,
                   AgentMetric.timestamp.between(baseline_start, baseline_end))
        )
        baseline = baseline_res.scalars().all()

        if len(recent) < 3 or len(baseline) < 5:
            return 0

        # Compute deltas across key metrics
        checks = [
            ("accuracy",          DriftType.MODEL,       [m.accuracy for m in recent if m.accuracy],          [m.accuracy for m in baseline if m.accuracy]),
            ("hallucination_rate",DriftType.MODEL,       [m.hallucination_rate for m in recent if m.hallucination_rate], [m.hallucination_rate for m in baseline if m.hallucination_rate]),
            ("drift_score",       DriftType.PROMPT,      [m.drift_score for m in recent if m.drift_score],     [m.drift_score for m in baseline if m.drift_score]),
        ]

        worst_severity = None
        worst_delta = 0
        worst_type = DriftType.MODEL
        worst_desc = ""
        worst_baseline = 0
        worst_current = 0

        for metric_name, drift_type, r_vals, b_vals in checks:
            if not r_vals or not b_vals:
                continue
            r_mean = statistics.mean(r_vals)
            b_mean = statistics.mean(b_vals)
            delta = r_mean - b_mean

            # For hallucination_rate, increase is bad; for accuracy, decrease is bad
            magnitude = abs(delta)
            if magnitude < DRIFT_THRESHOLD_MEDIUM:
                continue

            if magnitude > DRIFT_THRESHOLD_HIGH:
                severity = SeverityLevel.CRITICAL if magnitude > 0.20 else SeverityLevel.HIGH
            else:
                severity = SeverityLevel.MEDIUM

            description = (
                f"{metric_name.replace('_', ' ').title()} drifted {delta:+.3f} from 7-day baseline "
                f"({b_mean:.3f} → {r_mean:.3f}) — {magnitude*100:.1f}% deviation detected"
            )

            drift_event = DriftEvent(
                agent_id=agent.id,
                drift_type=drift_type,
                severity=severity,
                confidence=min(0.98, 0.65 + magnitude * 2),
                description=description,
                evidence={"metric": metric_name, "baseline_mean": b_mean, "recent_mean": r_mean, "sample_count": len(r_vals)},
                baseline_value=b_mean,
                current_value=r_mean,
                delta=delta,
                resolved=False,
                created_at=now,
            )
            db.add(drift_event)

            if magnitude > worst_delta:
                worst_delta = magnitude
                worst_severity = severity
                worst_type = drift_type
                worst_desc = description
                worst_baseline = b_mean
                worst_current = r_mean

        # Update agent status and drift score
        if worst_severity in (SeverityLevel.CRITICAL, SeverityLevel.HIGH):
            agent.status = AgentStatus.CRITICAL if worst_severity == SeverityLevel.CRITICAL else AgentStatus.WARNING
            agent.drift_score = min(1.0, worst_delta * 2)
        elif worst_severity == SeverityLevel.MEDIUM:
            if agent.status == AgentStatus.HEALTHY:
                agent.status = AgentStatus.WARNING
            agent.drift_score = min(1.0, worst_delta * 1.5)

        agent.updated_at = now
        await db.commit()
        await cache_delete_pattern("agents:list:*")
        await cache_delete_pattern("dashboard:*")

    # ── Trigger LangGraph investigation for HIGH/CRITICAL ─────────────────
    if worst_severity and worst_severity.value in INVESTIGATE_SEVERITIES:
        try:
            from app.agents.investigation_graph import run_investigation
            await run_investigation(
                agent_id=str(agent.id),
                agent_name=agent.name,
                agent_type=agent.agent_type.value,
                trigger_type=worst_type.value + "_drift",
                trigger_severity=worst_severity.value,
                trigger_description=worst_desc,
            )
            logger.info("LangGraph investigation completed", agent=agent.name, severity=worst_severity.value)
            return 1
        except Exception as e:
            logger.error("LangGraph investigation failed", agent=agent.name, error=str(e))

    return 0
