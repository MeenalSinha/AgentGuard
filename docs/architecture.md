# AgentGuard — Architecture Documentation

## System Overview

AgentGuard is a production-grade autonomous AI observability platform.
The defining characteristic: it does not merely display metrics — it *reasons* about them.

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                    AgentGuard Platform                      │
                    │                                                             │
  Browser ────────> │   Next.js 15 Frontend  ←──────→  FastAPI Backend           │
  (SSE live feed)   │   (Clerk Auth)                   (PostgreSQL + Redis)      │
                    │                                   (Celery Beat)            │
                    │                                                             │
  AI Agents ──────> │   AgentGuard SDK (10 lines)  ──> OTEL → Phoenix            │
  (instrumented)    │   POST /agents/{id}/ingest        (Arize Traces)           │
                    │                                                             │
                    │   LangGraph Investigation Graph (5 nodes):                 │
                    │   gather_evidence → fetch_phoenix_traces                   │
                    │   → analyze_with_gemini → create_incident → notify         │
                    │                                                             │
                    │   scikit-learn ML Predictions:                              │
                    │   LinearRegression + IsolationForest per agent             │
                    └─────────────────────────────────────────────────────────────┘
```

## The Autonomous Loop

This is what separates AgentGuard from a dashboard:

```
1. Celery Beat (every 60s)
   └─> _check_agent_drift()
       └─> Statistical baseline comparison (24h vs 7-day baseline)
           └─> If HIGH/CRITICAL drift detected:
               └─> LangGraph StateGraph.ainvoke() [FULLY AUTONOMOUS]
                   ├─> Node 1: gather_evidence() — PostgreSQL queries
                   ├─> Node 2: fetch_phoenix_traces() — Arize Phoenix REST
                   ├─> Node 3: analyze_with_gemini() — Gemini 2.0 Flash RCA
                   ├─> Node 4: create_incident() — Persist to DB
                   └─> Node 5: notify_operator() — Slack webhook (if configured)
```

No human trigger required. Detect → Reason → Create Incident → Notify.

## LangGraph Investigation Graph

```python
# State type
class InvestigationState(TypedDict):
    agent_id: str; agent_name: str; trigger_type: str; trigger_severity: str
    recent_metrics: List[dict]   # From PostgreSQL AgentMetric table
    drift_events: List[dict]     # From PostgreSQL DriftEvent table
    phoenix_traces: List[dict]   # From Arize Phoenix REST API
    root_cause: str              # Gemini-generated
    root_cause_category: str     # prompt | retrieval | model | infrastructure | data
    confidence_score: float      # Gemini confidence
    recommended_actions: List[str]  # Gemini-generated, ranked by impact
    incident_id: Optional[str]   # Created autonomously
    notification_sent: bool      # Slack notification status
```

## ML Prediction Models

Per-agent, trained on 30-day rolling window:

| Model | Purpose | Algorithm |
|-------|---------|-----------|
| Trust degradation forecast | Predict quality decline | LinearRegression on trust_score time series |
| Drift trajectory | Project drift score increase | LinearRegression on drift_score |
| Anomaly detection | Multi-variate outlier scoring | IsolationForest (accuracy, drift, hallucination, latency) |
| Hallucination spike | Predict rate increase | LinearRegression on hallucination_rate |

Confidence intervals computed from residual standard deviation (95% CI).

## Arize Phoenix Integration

Every interaction creates an OTEL span:

```python
# SDK automatically sends spans
from agentguard.sdk import AgentGuardMonitor
monitor = AgentGuardMonitor(agent_id="...", phoenix_url="http://localhost:6006")

with monitor.trace(query) as ctx:
    response = your_llm(query)
    ctx.record_response(response)
# → Creates span in Phoenix with: agent.name, llm.input, llm.output, llm.latency_ms
```

Phoenix project: `agentguard` — all spans tagged with `x-phoenix-project-name: agentguard`

## Agent SDK

10-line instrumentation for any existing agent:

```python
from app.sdk.instrument import AgentGuardMonitor
monitor = AgentGuardMonitor(agent_id="your-uuid", agent_name="My Agent")

with monitor.trace(query) as ctx:    # OTEL span → Phoenix
    response = llm.invoke(query)
    ctx.record_response(response)    # Metric push → AgentGuard
```

## API Reference

### Core endpoints
```
GET  /api/v1/dashboard/kpis                — KPI aggregates (Redis cached, 30s TTL)
GET  /api/v1/agents/                       — Agent fleet with status
GET  /api/v1/agents/{id}/metrics?period=7d — Time-series telemetry
POST /api/v1/agents/{id}/ingest            — SDK telemetry receiver
GET  /api/v1/realtime/feed                 — Server-Sent Events live stream
```

### LangGraph / Investigation
```
POST /api/v1/investigation/trigger         — Fire LangGraph async (background)
POST /api/v1/investigation/trigger-sync    — Fire LangGraph, wait for result
GET  /api/v1/investigation/graph-structure — Graph nodes/edges for visualization
```

### Simulator (Judge Demo Mode)
```
POST /api/v1/simulator/inject                  — Inject failure, degrade agent metrics
POST /api/v1/simulator/inject-and-investigate  — Inject + run LangGraph immediately
POST /api/v1/simulator/recover/{agent_id}      — Restore healthy state
GET  /api/v1/simulator/scenarios               — List all 8 scenarios
```

### Observability
```
GET  /api/v1/observability/status  — Phoenix connection check
GET  /api/v1/observability/traces  — Proxy Phoenix traces
GET  /metrics                      — Prometheus metrics
```

## Trust Score Algorithm

```
trust_score = (
  accuracy_score  × 0.30 +   # (accuracy × relevance × (1 - hallucination_rate×3))
  safety_score    × 0.25 +   # (1 - safety_violations × 5)
  drift_health    × 0.20 +   # (1 - drift_score)
  reliability     × 0.15 +   # (uptime × (1 - latency_sla_breach_rate))
  cost_efficiency × 0.10     # min(1, target_cost / actual_cost)
)
```

Range: 0–100. Updated by Celery scan every 60 seconds.

## Database Schema

```
agents              — Agent registry with rolling metrics
agent_metrics       — Time-series telemetry (one row per 6h per agent)
drift_events        — Detected drift with type, severity, evidence
hallucination_events— Detected fabrications with claims and suggested fixes
incidents           — Auto-created by LangGraph, with full RCA timeline
predictions         — ML model outputs with forecast data arrays
recommendations     — Ranked corrective actions per agent
```

## Deployment

### Local
```bash
docker compose -f infra/docker/docker-compose.yml up -d
cd backend && uvicorn app.main:app --reload
cd frontend && npm run dev
```

### Production (Google Cloud Run)
```bash
gcloud builds submit --tag gcr.io/PROJECT/agentguard-api backend/
gcloud run deploy agentguard-api --image gcr.io/PROJECT/agentguard-api --set-env-vars GOOGLE_API_KEY=xxx
```

## Demo Flow (30 seconds)

1. Navigate to `/dashboard/simulator`
2. Select any agent (loaded from live DB)
3. Click "Retrieval Drift" or "Safety Violation"
4. Click "Break Agent — Inject + Investigate"
   - Calls `POST /simulator/inject-and-investigate`
   - Degrades real DB metrics
   - Fires LangGraph graph synchronously
   - Gemini generates real root cause from live evidence
5. Investigation completes — real Gemini RCA appears in 5-15 seconds
6. Incident auto-created in PostgreSQL (visible in `/dashboard/incidents`)
7. If Slack configured: notification fires automatically
