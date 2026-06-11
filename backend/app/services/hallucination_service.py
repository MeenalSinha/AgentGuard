"""
Hallucination detection service using Gemini structured output.
Called per-response or in batch. Returns risk_level, claims, evidence gaps, fix.
"""
import json
import structlog

logger = structlog.get_logger()


async def analyze_response_for_hallucination(
    agent_id: str,
    query: str,
    response: str,
    knowledge_sources: list[str] | None = None,
) -> dict:
    """
    Use Gemini to analyze a response for hallucination signals.
    Returns structured detection result.
    """
    from app.core.config import settings
    import google.generativeai as genai

    genai.configure(api_key=settings.GOOGLE_API_KEY)

    try:
        model = genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL,
            system_instruction="""You are a hallucination detection expert for AI systems.
Analyze the given AI response and identify factual reliability issues.
Respond ONLY with valid JSON. No markdown. No explanation outside the JSON.""",
            generation_config={"response_mime_type": "application/json"},
        )

        ks_text = "\n".join(knowledge_sources) if knowledge_sources else "Not provided"
        prompt = f"""Analyze this AI agent response for hallucination.

QUERY: {query}

AI RESPONSE: {response}

KNOWLEDGE SOURCES AVAILABLE: {ks_text}

Return JSON:
{{
  "risk_level": <0.0-1.0 float>,
  "unsupported_claims": ["<claim not verifiable from sources>"],
  "missing_evidence": ["<fact that should have a citation>"],
  "fabrications": ["<invented statistic or reference>"],
  "inconsistent_reasoning": ["<logical inconsistency>"],
  "suggested_fix": "<specific actionable fix for this response>",
  "confidence": <0.0-1.0 how confident you are in this analysis>
}}"""

        result = model.generate_content(prompt)
        raw = result.text.strip().lstrip("```json").lstrip("```").rstrip("```")
        data = json.loads(raw)
        return {
            "risk_level": float(data.get("risk_level", 0.0)),
            "unsupported_claims": data.get("unsupported_claims", []),
            "missing_evidence": data.get("missing_evidence", []),
            "fabrications": data.get("fabrications", []),
            "inconsistent_reasoning": data.get("inconsistent_reasoning", []),
            "suggested_fix": data.get("suggested_fix", ""),
            "confidence": float(data.get("confidence", 0.8)),
        }

    except Exception as e:
        logger.warning("Hallucination analysis failed", error=str(e))
        return {
            "risk_level": 0.0,
            "unsupported_claims": [],
            "missing_evidence": [],
            "fabrications": [],
            "inconsistent_reasoning": [],
            "suggested_fix": "Configure GOOGLE_API_KEY for live hallucination detection",
            "confidence": 0.0,
        }
