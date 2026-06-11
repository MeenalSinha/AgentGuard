"""
Seed the database with realistic enterprise demo data.
Run: python -m app.scripts.seed_demo_data
"""
import asyncio
import random
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal, engine, Base
from app.models.models import (
    Agent, AgentMetric, DriftEvent, HallucinationEvent,
    Incident, Prediction, Recommendation,
    AgentStatus, AgentType, DriftType, SeverityLevel
)

AGENTS_DATA = [
    {"name": "Apex Support Agent", "type": AgentType.CUSTOMER_SUPPORT, "owner": "Support Team", "model": "gemini-2.0-flash", "trust": 96.2, "status": AgentStatus.HEALTHY},
    {"name": "ResearchBot Pro", "type": AgentType.RESEARCH, "owner": "Research Division", "model": "gemini-2.0-pro", "trust": 91.8, "status": AgentStatus.HEALTHY},
    {"name": "SalesForce Agent", "type": AgentType.SALES, "owner": "Revenue Team", "model": "gemini-2.0-flash", "trust": 88.5, "status": AgentStatus.WARNING},
    {"name": "HR Assistant v2", "type": AgentType.HR, "owner": "People Ops", "model": "gemini-1.5-flash", "trust": 84.1, "status": AgentStatus.WARNING},
    {"name": "CodePilot Enterprise", "type": AgentType.CODING, "owner": "Engineering", "model": "gemini-2.0-pro", "trust": 79.3, "status": AgentStatus.CRITICAL},
    {"name": "FinAdvisor AI", "type": AgentType.FINANCIAL, "owner": "Finance Team", "model": "gemini-2.0-flash", "trust": 93.7, "status": AgentStatus.HEALTHY},
    {"name": "KnowledgeBase Bot", "type": AgentType.KNOWLEDGE, "owner": "Product Team", "model": "gemini-1.5-pro", "trust": 87.6, "status": AgentStatus.HEALTHY},
    {"name": "Onboarding Agent", "type": AgentType.HR, "owner": "People Ops", "model": "gemini-1.5-flash", "trust": 82.4, "status": AgentStatus.WARNING},
    {"name": "Legal Assistant", "type": AgentType.KNOWLEDGE, "owner": "Legal Team", "model": "gemini-2.0-pro", "trust": 94.9, "status": AgentStatus.HEALTHY},
    {"name": "Marketing Copilot", "type": AgentType.CUSTOM, "owner": "Marketing", "model": "gemini-2.0-flash", "trust": 76.8, "status": AgentStatus.CRITICAL},
    {"name": "DataAnalysis Agent", "type": AgentType.RESEARCH, "owner": "Analytics", "model": "gemini-2.0-pro", "trust": 90.1, "status": AgentStatus.HEALTHY},
    {"name": "Customer Success Bot", "type": AgentType.CUSTOMER_SUPPORT, "owner": "CS Team", "model": "gemini-1.5-flash", "trust": 88.9, "status": AgentStatus.HEALTHY},
    {"name": "Procurement Agent", "type": AgentType.FINANCIAL, "owner": "Operations", "model": "gemini-1.5-pro", "trust": 85.3, "status": AgentStatus.WARNING},
    {"name": "Compliance Monitor", "type": AgentType.KNOWLEDGE, "owner": "Risk Team", "model": "gemini-2.0-pro", "trust": 97.1, "status": AgentStatus.HEALTHY},
    {"name": "Training Assistant", "type": AgentType.HR, "owner": "L&D Team", "model": "gemini-1.5-flash", "trust": 83.6, "status": AgentStatus.HEALTHY},
    {"name": "Incident Response Bot", "type": AgentType.CODING, "owner": "SRE Team", "model": "gemini-2.0-flash", "trust": 91.2, "status": AgentStatus.HEALTHY},
    {"name": "Product Feedback Agent", "type": AgentType.CUSTOM, "owner": "Product", "model": "gemini-1.5-flash", "trust": 78.4, "status": AgentStatus.WARNING},
    {"name": "Executive Briefing Bot", "type": AgentType.RESEARCH, "owner": "C-Suite", "model": "gemini-2.0-pro", "trust": 95.5, "status": AgentStatus.HEALTHY},
    {"name": "Vendor Evaluation AI", "type": AgentType.FINANCIAL, "owner": "Procurement", "model": "gemini-1.5-pro", "trust": 86.7, "status": AgentStatus.HEALTHY},
    {"name": "Security Analyst Agent", "type": AgentType.CODING, "owner": "Security", "model": "gemini-2.0-pro", "trust": 92.3, "status": AgentStatus.HEALTHY},
]

DRIFT_DESCRIPTIONS = {
    DriftType.PROMPT: [
        "Prompt effectiveness declining — responses becoming less structured",
        "System prompt token budget exceeded causing truncation",
        "Instruction following accuracy dropped below baseline",
    ],
    DriftType.MODEL: [
        "Model output distribution shifted from baseline",
        "Response format consistency degraded after model update",
        "Reasoning chain quality declined across eval set",
    ],
    DriftType.RETRIEVAL: [
        "Knowledge base retrieval relevance score declining",
        "Embedding model mismatch causing retrieval failures",
        "Vector index staleness detected — docs not re-indexed",
    ],
    DriftType.USER_INTENT: [
        "Users asking off-topic questions not covered by agent scope",
        "Query complexity increasing beyond agent design parameters",
        "Topic distribution shifted significantly from training set",
    ],
}

HALLUCINATION_QUERIES = [
    "What is our Q3 refund policy for enterprise customers?",
    "Can you explain the technical architecture of our auth system?",
    "What are the legal requirements for GDPR compliance in Germany?",
    "Summarize the last board meeting outcomes",
    "What discount tiers apply to Fortune 500 accounts?",
]

INCIDENT_TITLES = [
    "Critical accuracy degradation in customer support responses",
    "Retrieval system returning stale knowledge base entries",
    "Hallucination rate spike during peak load period",
    "Model drift detected after upstream provider update",
    "Safety filter bypass detected in financial agent",
    "Latency regression — P99 exceeds 8 second threshold",
]


async def seed(db: AsyncSession):
    print("Seeding demo data...")

    agent_objects = []
    for idx, data in enumerate(AGENTS_DATA):
        base_trust = data["trust"]
        agent = Agent(
            id=uuid4(),
            name=data["name"],
            description=f"Enterprise {data['type'].value.replace('_', ' ')} agent for {data['owner']}",
            agent_type=data["type"],
            status=data["status"],
            owner=data["owner"],
            environment="production" if idx % 3 != 0 else "staging",
            model_name=data["model"],
            trust_score=base_trust,
            accuracy=round(base_trust / 100 * random.uniform(0.92, 0.99), 4),
            relevance=round(base_trust / 100 * random.uniform(0.90, 0.98), 4),
            avg_latency_ms=round(random.uniform(350, 2800), 1),
            cost_per_query=round(random.uniform(0.001, 0.025), 4),
            total_cost_month=round(random.uniform(120, 4800), 2),
            user_satisfaction=round(base_trust / 100 * random.uniform(0.88, 0.99), 4),
            drift_score=round(random.uniform(0, 0.35) if data["status"] != AgentStatus.HEALTHY else random.uniform(0, 0.08), 4),
            total_conversations=random.randint(800, 45000),
            hallucination_rate=round(random.uniform(0.02, 0.18) if data["status"] == AgentStatus.CRITICAL else random.uniform(0.001, 0.04), 4),
            tags=["production", data["type"].value],
        )
        db.add(agent)
        agent_objects.append(agent)

    await db.flush()

    # Metrics — 30 days of hourly data per agent
    now = datetime.utcnow()
    for agent in agent_objects:
        base_trust = agent.trust_score
        for days_ago in range(30, 0, -1):
            for hour in [0, 6, 12, 18]:
                ts = now - timedelta(days=days_ago, hours=hour)
                noise = random.uniform(-0.03, 0.03)
                trend = (30 - days_ago) / 30 * random.uniform(-0.05, 0.05)
                metric = AgentMetric(
                    agent_id=agent.id,
                    timestamp=ts,
                    accuracy=max(0.5, min(1.0, agent.accuracy + noise + trend)),
                    relevance=max(0.5, min(1.0, agent.relevance + noise)),
                    latency_ms=max(100, agent.avg_latency_ms + random.uniform(-200, 500)),
                    cost=agent.cost_per_query * random.uniform(0.8, 1.3),
                    user_satisfaction=max(0.5, min(1.0, agent.user_satisfaction + noise)),
                    drift_score=max(0, min(1.0, agent.drift_score + noise * 0.5)),
                    hallucination_rate=max(0, min(1.0, agent.hallucination_rate + random.uniform(-0.005, 0.005))),
                    trust_score=max(0, min(100, base_trust + noise * 10)),
                    conversation_count=random.randint(10, 150),
                )
                db.add(metric)

    # Drift events
    for agent in agent_objects:
        n_events = random.randint(1, 6) if agent.status != AgentStatus.HEALTHY else random.randint(0, 2)
        for _ in range(n_events):
            drift_type = random.choice(list(DriftType))
            severity = random.choice([SeverityLevel.LOW, SeverityLevel.MEDIUM, SeverityLevel.HIGH, SeverityLevel.CRITICAL])
            baseline = round(random.uniform(0.7, 0.95), 3)
            current = round(baseline * random.uniform(0.6, 0.9), 3)
            drift = DriftEvent(
                agent_id=agent.id,
                drift_type=drift_type,
                severity=severity,
                confidence=round(random.uniform(0.70, 0.98), 3),
                description=random.choice(DRIFT_DESCRIPTIONS[drift_type]),
                evidence={"samples": random.randint(50, 500), "window": "24h"},
                baseline_value=baseline,
                current_value=current,
                delta=round(current - baseline, 3),
                resolved=random.random() > 0.4,
                created_at=now - timedelta(days=random.randint(0, 14)),
            )
            db.add(drift)

    # Hallucination events
    for agent in agent_objects:
        n = random.randint(2, 12)
        for _ in range(n):
            severity = random.choice([SeverityLevel.LOW, SeverityLevel.MEDIUM, SeverityLevel.HIGH])
            h = HallucinationEvent(
                agent_id=agent.id,
                severity=severity,
                risk_level=round(random.uniform(0.2, 0.95), 2),
                query=random.choice(HALLUCINATION_QUERIES),
                response_excerpt="The agent provided information that could not be verified against knowledge sources...",
                unsupported_claims=["Claimed 30-day refund window", "Referenced non-existent policy v2.3"],
                missing_evidence=["No source document found", "Knowledge base does not contain this information"],
                fabrications=["Invented compliance requirement"],
                suggested_fix="Improve retrieval grounding and add source citation requirements to system prompt",
                confidence=round(random.uniform(0.75, 0.98), 3),
                created_at=now - timedelta(days=random.randint(0, 7), hours=random.randint(0, 23)),
            )
            db.add(h)

    # Incidents
    for agent in agent_objects[:8]:
        n = random.randint(1, 3)
        for _ in range(n):
            resolved = random.random() > 0.35
            start = now - timedelta(days=random.randint(0, 20), hours=random.randint(1, 12))
            timeline = [
                {"time": start.isoformat(), "event": "Agent operating normally", "type": "info"},
                {"time": (start + timedelta(minutes=12)).isoformat(), "event": "Anomaly detected in output quality", "type": "warning"},
                {"time": (start + timedelta(minutes=18)).isoformat(), "event": "Drift score crossed threshold", "type": "warning"},
                {"time": (start + timedelta(minutes=25)).isoformat(), "event": "Alert triggered — on-call notified", "type": "critical"},
                {"time": (start + timedelta(minutes=33)).isoformat(), "event": "Root cause identified by AgentGuard", "type": "info"},
                {"time": (start + timedelta(minutes=35)).isoformat(), "event": "Corrective action recommended", "type": "info"},
            ]
            if resolved:
                timeline.append({"time": (start + timedelta(minutes=50)).isoformat(), "event": "Issue resolved and verified", "type": "resolved"})
            incident = Incident(
                agent_id=agent.id,
                title=random.choice(INCIDENT_TITLES),
                severity=random.choice([SeverityLevel.MEDIUM, SeverityLevel.HIGH, SeverityLevel.CRITICAL]),
                status="resolved" if resolved else random.choice(["open", "investigating"]),
                root_cause="Knowledge base embedding drift combined with increased query complexity caused retrieval failures, leading to hallucinated responses.",
                impact_assessment=f"Approximately {random.randint(50, 800)} user interactions affected. Estimated {random.randint(2, 15)}% reduction in CSAT during incident window.",
                recommended_actions=[
                    "Re-index knowledge base with updated embeddings",
                    "Add source citation enforcement to system prompt",
                    "Implement automated quality gate at 0.85 accuracy threshold",
                    "Schedule weekly drift review for this agent",
                ],
                investigation_confidence=round(random.uniform(0.78, 0.97), 2),
                timeline_events=timeline,
                started_at=start,
                resolved_at=start + timedelta(hours=random.randint(1, 4)) if resolved else None,
                created_at=start,
            )
            db.add(incident)

    # Predictions
    prediction_types = [
        ("quality_degradation", "Quality degradation predicted within time window"),
        ("drift", "Retrieval drift likely based on trend analysis"),
        ("hallucination", "Hallucination rate may increase"),
        ("latency", "Latency regression risk detected"),
    ]
    for agent in agent_objects:
        for ptype, pdesc in random.sample(prediction_types, k=random.randint(1, 3)):
            horizon = random.choice([24, 48, 72, 168])
            prob = round(random.uniform(0.35, 0.88), 2)
            forecast = []
            for h in range(0, horizon, max(1, horizon // 12)):
                forecast.append({
                    "hours_ahead": h,
                    "value": round(agent.trust_score - (h / horizon) * prob * 15, 1),
                    "lower": round(agent.trust_score - (h / horizon) * prob * 20, 1),
                    "upper": round(agent.trust_score - (h / horizon) * prob * 8, 1),
                })
            pred = Prediction(
                agent_id=agent.id,
                prediction_type=ptype,
                probability=prob,
                time_horizon_hours=horizon,
                description=pdesc,
                confidence=round(random.uniform(0.68, 0.95), 2),
                features_used=["drift_score", "hallucination_rate", "accuracy_trend", "latency_p99"],
                forecast_data=forecast,
                created_at=now,
                expires_at=now + timedelta(hours=24),
            )
            db.add(pred)

    # Recommendations
    rec_data = [
        ("Update retrieval knowledge base", "Knowledge base has not been updated in 14 days. Re-indexing with current documents will improve retrieval accuracy.", "knowledge", "high", "low", 0.91, 18.5),
        ("Refine system prompt clarity", "System prompt lacks specificity in output format requirements causing inconsistent responses.", "prompt", "medium", "low", 0.85, 12.0),
        ("Add evaluation dataset", "No automated eval dataset configured. Adding 200 golden examples will enable continuous quality monitoring.", "evaluation", "high", "medium", 0.88, 22.0),
        ("Rebuild vector embeddings", "Current embeddings are 3 model versions behind. Rebuilding will improve semantic search by an estimated 15%.", "retrieval", "high", "medium", 0.79, 15.0),
        ("Implement response caching", "40% of queries are near-duplicates. Semantic caching could reduce cost by $800/month and latency by 60%.", "model", "medium", "low", 0.93, 30.0),
    ]
    for agent in agent_objects[:10]:
        for title, desc, cat, impact, risk, conf, improvement in random.sample(rec_data, k=random.randint(1, 3)):
            rec = Recommendation(
                agent_id=agent.id,
                title=title,
                description=desc,
                category=cat,
                impact=impact,
                risk=risk,
                confidence=conf,
                estimated_improvement=improvement,
                status=random.choice(["pending", "pending", "applied", "dismissed"]),
                created_at=now - timedelta(days=random.randint(0, 7)),
            )
            db.add(rec)

    await db.commit()
    print(f"Seeded {len(AGENTS_DATA)} agents with full historical data, incidents, predictions, and recommendations.")


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as db:
        await seed(db)


if __name__ == "__main__":
    asyncio.run(main())


async def seed_recent_activity(db: AsyncSession):
    """Generate events in the last 2 hours so the live feed has fresh data."""
    from app.models.models import Agent, DriftEvent, HallucinationEvent, Incident
    from sqlalchemy import select
    import random

    result = await db.execute(select(Agent).where(Agent.is_active == True).limit(20))
    agents = result.scalars().all()
    if not agents:
        return

    now = datetime.utcnow()
    critical_agents = [a for a in agents if a.status.value in ("critical", "warning")]
    target_agents = critical_agents or agents[:4]

    for agent in target_agents[:4]:
        for minutes_ago in [5, 18, 34, 52, 78, 105]:
            ts = now - timedelta(minutes=minutes_ago + random.randint(0, 3))
            sev = random.choice([SeverityLevel.HIGH, SeverityLevel.CRITICAL, SeverityLevel.MEDIUM])
            drift_type = random.choice(list(DriftType))
            drift = DriftEvent(
                agent_id=agent.id,
                drift_type=drift_type,
                severity=sev,
                confidence=round(random.uniform(0.75, 0.97), 3),
                description=f"{drift_type.value.replace('_', ' ').title()} drift detected — {sev.value} severity on {agent.name}",
                evidence={"recent": True, "demo": True},
                baseline_value=round(random.uniform(0.7, 0.95), 3),
                current_value=round(random.uniform(0.5, 0.8), 3),
                delta=round(random.uniform(-0.25, -0.05), 3),
                resolved=False,
                created_at=ts,
            )
            db.add(drift)

    # Hallucinations in the last 2 hours
    for agent in target_agents[:3]:
        for minutes_ago in [8, 22, 45, 90]:
            ts = now - timedelta(minutes=minutes_ago + random.randint(0, 5))
            h = HallucinationEvent(
                agent_id=agent.id,
                severity=random.choice([SeverityLevel.HIGH, SeverityLevel.CRITICAL]),
                risk_level=round(random.uniform(0.55, 0.92), 2),
                query="What are our Q4 enterprise pricing terms?",
                response_excerpt="Based on our latest documentation, enterprise pricing is $299/seat...",
                unsupported_claims=["Price figure not in current knowledge base"],
                missing_evidence=["No pricing document indexed for Q4"],
                fabrications=["Invented pricing tier"],
                suggested_fix="Re-index latest pricing documentation and enforce source citation",
                confidence=round(random.uniform(0.80, 0.96), 3),
                created_at=ts,
            )
            db.add(h)

    await db.commit()
    print(f"Seeded recent activity for {len(target_agents[:4])} agents")


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as db:
        await seed(db)
        await seed_recent_activity(db)


if __name__ == "__main__":
    asyncio.run(main())
