"""
AgentGuard SDK — instrument any AI agent in < 10 lines.

Usage:
    from agentguard.sdk import AgentGuardMonitor

    monitor = AgentGuardMonitor(agent_id="your-agent-uuid", agent_name="My Agent")

    with monitor.trace("user query here") as ctx:
        response = your_llm_call(query)
        ctx.record_response(response)
"""
import time
import httpx
import asyncio
from datetime import datetime
from typing import Optional
from contextlib import contextmanager
import structlog

logger = structlog.get_logger()


class AgentInvocationContext:
    def __init__(self, monitor: "AgentGuardMonitor", query: str):
        self.monitor = monitor
        self.query = query
        self.start_time = time.time()
        self.response: Optional[str] = None
        self.metadata: dict = {}

    def record_response(self, response: str, **metadata):
        self.response = response
        self.metadata.update(metadata)

    def set_metadata(self, **kwargs):
        self.metadata.update(kwargs)


class AgentGuardMonitor:
    """
    Lightweight SDK to send telemetry to AgentGuard + Arize Phoenix.

    Args:
        agent_id:    UUID of the registered agent in AgentGuard
        agent_name:  Display name
        api_url:     AgentGuard backend URL
        phoenix_url: Arize Phoenix URL
    """

    def __init__(
        self,
        agent_id: str,
        agent_name: str,
        api_url: str = "http://localhost:8000",
        phoenix_url: str = "http://localhost:6006",
    ):
        self.agent_id   = agent_id
        self.agent_name = agent_name
        self.api_url    = api_url
        self.phoenix_url = phoenix_url
        self._setup_otel()

    def _setup_otel(self):
        """Initialize OpenTelemetry exporting to Phoenix."""
        try:
            from opentelemetry import trace
            from opentelemetry.sdk.trace import TracerProvider
            from opentelemetry.sdk.trace.export import BatchSpanProcessor
            from opentelemetry.sdk.resources import Resource
            from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

            resource = Resource.create({
                "service.name": f"agent.{self.agent_name.lower().replace(' ', '_')}",
                "agentguard.agent_id": self.agent_id,
            })
            provider = TracerProvider(resource=resource)
            exporter = OTLPSpanExporter(
                endpoint=f"{self.phoenix_url}/v1/traces",
                headers={"x-phoenix-project-name": "agentguard"},
            )
            provider.add_span_processor(BatchSpanProcessor(exporter))
            trace.set_tracer_provider(provider)
            self._tracer = trace.get_tracer(f"agentguard.{self.agent_id}")
        except Exception as e:
            logger.warning("OTEL setup failed", error=str(e))
            self._tracer = None

    @contextmanager
    def trace(self, query: str):
        """Context manager — wraps a single agent invocation."""
        ctx = AgentInvocationContext(self, query)
        span = None
        if self._tracer:
            span = self._tracer.start_span(f"agent.invoke.{self.agent_name}")
            span.set_attribute("agentguard.agent_id", self.agent_id)
            span.set_attribute("llm.input", query[:500])
        try:
            yield ctx
        finally:
            latency_ms = (time.time() - ctx.start_time) * 1000
            if span:
                span.set_attribute("llm.output", (ctx.response or "")[:500])
                span.set_attribute("llm.latency_ms", latency_ms)
                span.end()
            # Fire-and-forget metric push
            if ctx.response:
                self._push_metric_async(query, ctx.response, latency_ms, ctx.metadata)

    def _push_metric_async(self, query: str, response: str, latency_ms: float, metadata: dict):
        """Push metric snapshot to AgentGuard backend (non-blocking)."""
        try:
            asyncio.get_event_loop().run_until_complete(
                self._push_metric(query, response, latency_ms, metadata)
            )
        except RuntimeError:
            # No event loop — schedule as fire-and-forget
            import threading
            threading.Thread(
                target=asyncio.run,
                args=(self._push_metric(query, response, latency_ms, metadata),),
                daemon=True,
            ).start()

    async def _push_metric(self, query: str, response: str, latency_ms: float, metadata: dict):
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                await client.post(
                    f"{self.api_url}/api/v1/agents/{self.agent_id}/ingest",
                    json={
                        "query": query[:500],
                        "response": response[:500],
                        "latency_ms": latency_ms,
                        "timestamp": datetime.utcnow().isoformat(),
                        **metadata,
                    },
                )
        except Exception:
            pass  # Non-blocking — never fail the agent due to monitoring
