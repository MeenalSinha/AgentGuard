from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime
from uuid import UUID
from app.models.models import AgentStatus, AgentType, DriftType, SeverityLevel


# ── Agent ──────────────────────────────────────────────────────────
class AgentBase(BaseModel):
    name: str
    description: Optional[str] = None
    agent_type: AgentType
    owner: Optional[str] = None
    environment: str = "production"
    model_name: Optional[str] = None
    tags: List[str] = []


class AgentCreate(AgentBase):
    pass


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[AgentStatus] = None
    owner: Optional[str] = None
    environment: Optional[str] = None


class AgentResponse(AgentBase):
    id: UUID
    status: AgentStatus
    trust_score: float
    accuracy: float
    relevance: float
    avg_latency_ms: float
    cost_per_query: float
    total_cost_month: float
    user_satisfaction: float
    drift_score: float
    total_conversations: int
    hallucination_rate: float
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Metrics ────────────────────────────────────────────────────────
class MetricPoint(BaseModel):
    timestamp: datetime
    accuracy: Optional[float] = None
    relevance: Optional[float] = None
    latency_ms: Optional[float] = None
    cost: Optional[float] = None
    user_satisfaction: Optional[float] = None
    drift_score: Optional[float] = None
    hallucination_rate: Optional[float] = None
    trust_score: Optional[float] = None
    conversation_count: Optional[int] = None

    class Config:
        from_attributes = True


# ── Drift ──────────────────────────────────────────────────────────
class DriftEventResponse(BaseModel):
    id: UUID
    agent_id: UUID
    agent_name: Optional[str] = None
    drift_type: DriftType
    severity: SeverityLevel
    confidence: float
    description: Optional[str] = None
    evidence: Dict[str, Any] = {}
    baseline_value: Optional[float] = None
    current_value: Optional[float] = None
    delta: Optional[float] = None
    resolved: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Hallucination ──────────────────────────────────────────────────
class HallucinationEventResponse(BaseModel):
    id: UUID
    agent_id: UUID
    agent_name: Optional[str] = None
    severity: SeverityLevel
    risk_level: float
    query: Optional[str] = None
    response_excerpt: Optional[str] = None
    unsupported_claims: List[str] = []
    missing_evidence: List[str] = []
    fabrications: List[str] = []
    suggested_fix: Optional[str] = None
    confidence: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Incident ───────────────────────────────────────────────────────
class IncidentResponse(BaseModel):
    id: UUID
    agent_id: UUID
    agent_name: Optional[str] = None
    title: str
    severity: SeverityLevel
    status: str
    root_cause: Optional[str] = None
    impact_assessment: Optional[str] = None
    recommended_actions: List[str] = []
    investigation_confidence: Optional[float] = None
    timeline_events: List[Dict[str, Any]] = []
    started_at: datetime
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Prediction ─────────────────────────────────────────────────────
class PredictionResponse(BaseModel):
    id: UUID
    agent_id: UUID
    agent_name: Optional[str] = None
    prediction_type: str
    probability: float
    time_horizon_hours: int
    description: str
    confidence: float
    features_used: List[str] = []
    forecast_data: List[Dict[str, Any]] = []
    created_at: datetime
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Recommendation ─────────────────────────────────────────────────
class RecommendationResponse(BaseModel):
    id: UUID
    agent_id: Optional[UUID] = None
    agent_name: Optional[str] = None
    title: str
    description: str
    category: str
    impact: str
    risk: str
    confidence: float
    estimated_improvement: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Dashboard ──────────────────────────────────────────────────────
class DashboardKPIs(BaseModel):
    active_agents: int
    avg_health_score: float
    drift_events_today: int
    hallucination_alerts_today: int
    total_monthly_cost: float
    avg_response_quality: float
    critical_incidents: int
    agents_at_risk: int


# ── Copilot ────────────────────────────────────────────────────────
class CopilotMessage(BaseModel):
    role: str
    content: str


class CopilotRequest(BaseModel):
    messages: List[CopilotMessage]
    agent_id: Optional[UUID] = None


class CopilotResponse(BaseModel):
    message: str
    sources: List[str] = []
    confidence: float = 1.0
