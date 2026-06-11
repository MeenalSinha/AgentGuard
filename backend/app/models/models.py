import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime,
    ForeignKey, Text, JSON, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class AgentStatus(str, enum.Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    OFFLINE = "offline"


class AgentType(str, enum.Enum):
    CUSTOMER_SUPPORT = "customer_support"
    RESEARCH = "research"
    CODING = "coding"
    HR = "hr"
    FINANCIAL = "financial"
    KNOWLEDGE = "knowledge"
    SALES = "sales"
    CUSTOM = "custom"


class DriftType(str, enum.Enum):
    PROMPT = "prompt"
    MODEL = "model"
    RETRIEVAL = "retrieval"
    USER_INTENT = "user_intent"


class SeverityLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Agent(Base):
    __tablename__ = "agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    agent_type = Column(SAEnum(AgentType), nullable=False)
    status = Column(SAEnum(AgentStatus), default=AgentStatus.HEALTHY)
    owner = Column(String(255))
    environment = Column(String(50), default="production")
    model_name = Column(String(100))
    trust_score = Column(Float, default=100.0)
    accuracy = Column(Float, default=1.0)
    relevance = Column(Float, default=1.0)
    avg_latency_ms = Column(Float, default=0.0)
    cost_per_query = Column(Float, default=0.0)
    total_cost_month = Column(Float, default=0.0)
    user_satisfaction = Column(Float, default=1.0)
    drift_score = Column(Float, default=0.0)
    total_conversations = Column(Integer, default=0)
    hallucination_rate = Column(Float, default=0.0)
    tags = Column(JSON, default=list)
    config = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    metrics = relationship("AgentMetric", back_populates="agent", cascade="all, delete-orphan")
    drift_events = relationship("DriftEvent", back_populates="agent", cascade="all, delete-orphan")
    hallucinations = relationship("HallucinationEvent", back_populates="agent", cascade="all, delete-orphan")
    incidents = relationship("Incident", back_populates="agent", cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="agent", cascade="all, delete-orphan")


class AgentMetric(Base):
    __tablename__ = "agent_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    accuracy = Column(Float)
    relevance = Column(Float)
    latency_ms = Column(Float)
    cost = Column(Float)
    user_satisfaction = Column(Float)
    drift_score = Column(Float)
    hallucination_rate = Column(Float)
    conversation_count = Column(Integer, default=0)
    trust_score = Column(Float)

    agent = relationship("Agent", back_populates="metrics")


class DriftEvent(Base):
    __tablename__ = "drift_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    drift_type = Column(SAEnum(DriftType), nullable=False)
    severity = Column(SAEnum(SeverityLevel), nullable=False)
    confidence = Column(Float, default=0.0)
    description = Column(Text)
    evidence = Column(JSON, default=dict)
    baseline_value = Column(Float)
    current_value = Column(Float)
    delta = Column(Float)
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    agent = relationship("Agent", back_populates="drift_events")


class HallucinationEvent(Base):
    __tablename__ = "hallucination_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    severity = Column(SAEnum(SeverityLevel), nullable=False)
    risk_level = Column(Float, default=0.0)
    query = Column(Text)
    response_excerpt = Column(Text)
    unsupported_claims = Column(JSON, default=list)
    missing_evidence = Column(JSON, default=list)
    fabrications = Column(JSON, default=list)
    suggested_fix = Column(Text)
    confidence = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    agent = relationship("Agent", back_populates="hallucinations")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    severity = Column(SAEnum(SeverityLevel), nullable=False)
    status = Column(String(50), default="open")  # open, investigating, resolved
    root_cause = Column(Text)
    impact_assessment = Column(Text)
    recommended_actions = Column(JSON, default=list)
    investigation_confidence = Column(Float)
    timeline_events = Column(JSON, default=list)
    started_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    agent = relationship("Agent", back_populates="incidents")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    prediction_type = Column(String(100))  # quality_degradation, drift, hallucination, latency
    probability = Column(Float)
    time_horizon_hours = Column(Integer)
    description = Column(Text)
    confidence = Column(Float)
    features_used = Column(JSON, default=list)
    forecast_data = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime)

    agent = relationship("Agent", back_populates="predictions")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"))
    title = Column(String(500))
    description = Column(Text)
    category = Column(String(100))  # prompt, knowledge, retrieval, model, evaluation
    impact = Column(String(50))  # low, medium, high
    risk = Column(String(50))
    confidence = Column(Float)
    estimated_improvement = Column(Float)  # percentage
    status = Column(String(50), default="pending")  # pending, applied, dismissed
    created_at = Column(DateTime, default=datetime.utcnow)
