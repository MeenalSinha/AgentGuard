"""
Arize Phoenix OTEL integration.
- Initializes OTLP tracing so every Gemini call creates a span in Phoenix
- Provides helper to instrument agent invocations
"""
import structlog
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.sdk.resources import Resource
from app.core.config import settings

logger = structlog.get_logger()
_tracer: trace.Tracer | None = None


async def init_phoenix():
    global _tracer
    try:
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

        resource = Resource.create({
            "service.name": "agentguard-backend",
            "service.version": "1.0.0",
        })
        provider = TracerProvider(resource=resource)

        # Export to Phoenix
        headers = {"x-phoenix-project-name": settings.PHOENIX_PROJECT_NAME}
        if settings.PHOENIX_API_KEY:
            headers["api_key"] = settings.PHOENIX_API_KEY
        if settings.PHOENIX_SPACE_ID:
            headers["space_id"] = settings.PHOENIX_SPACE_ID

        otlp_exporter = OTLPSpanExporter(
            endpoint=f"{settings.PHOENIX_ENDPOINT}/v1/traces",
            headers=headers,
        )
        provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
        trace.set_tracer_provider(provider)
        _tracer = trace.get_tracer("agentguard.backend")
        logger.info("Arize Phoenix tracing initialized", endpoint=settings.PHOENIX_ENDPOINT)
    except Exception as e:
        logger.warning("Phoenix OTEL init failed — continuing without tracing", error=str(e))
        _tracer = None


def get_tracer() -> trace.Tracer | None:
    return _tracer


def trace_agent_invocation(agent_name: str, query: str, response: str, metadata: dict = None):
    """Create an OTEL span for an agent invocation — sends to Phoenix."""
    if _tracer is None:
        return
    with _tracer.start_as_current_span(f"agent.invoke.{agent_name}") as span:
        span.set_attribute("agent.name", agent_name)
        span.set_attribute("llm.input", query[:500])
        span.set_attribute("llm.output", response[:500])
        if metadata:
            for k, v in metadata.items():
                span.set_attribute(f"agent.{k}", str(v))
