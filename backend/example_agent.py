"""
example_agent.py — Demonstrates AgentGuard SDK instrumentation.

This script shows how to connect ANY existing AI agent to AgentGuard
in under 10 lines. Run it to generate real telemetry in Phoenix + AgentGuard.

Usage:
    python example_agent.py

Requirements:
    GOOGLE_API_KEY env var set
    AgentGuard backend running on localhost:8000
    Arize Phoenix running on localhost:6006
"""
import os
import asyncio
import google.generativeai as genai
from app.sdk.instrument import AgentGuardMonitor

# Configure Gemini
genai.configure(api_key=os.getenv("GOOGLE_API_KEY", ""))
model = genai.GenerativeModel("gemini-2.0-flash-exp")

# ── AgentGuard instrumentation — just these 3 lines ──────────────────────────
monitor = AgentGuardMonitor(
    agent_id="replace-with-your-agent-uuid",  # from AgentGuard dashboard
    agent_name="Demo Customer Support Agent",
    api_url="http://localhost:8000",
    phoenix_url="http://localhost:6006",
)
# ─────────────────────────────────────────────────────────────────────────────

DEMO_QUERIES = [
    "What is the return policy for enterprise customers?",
    "How do I reset my API key?",
    "Can you explain the pricing tiers for the Team plan?",
    "What integrations are supported with Salesforce?",
    "How long does it take to onboard new agents?",
]


def run_agent(query: str) -> str:
    """Your existing agent logic — unchanged."""
    try:
        response = model.generate_content(
            f"You are a helpful customer support agent. Answer concisely: {query}"
        )
        return response.text
    except Exception as e:
        return f"Error: {e}"


async def main():
    print("AgentGuard SDK Demo — sending telemetry to AgentGuard + Phoenix")
    print("=" * 60)

    for i, query in enumerate(DEMO_QUERIES):
        print(f"\n[{i+1}/{len(DEMO_QUERIES)}] Query: {query[:60]}...")

        # ── The ONLY change to your existing agent: wrap with monitor.trace ──
        with monitor.trace(query) as ctx:
            response = run_agent(query)
            ctx.record_response(
                response,
                model="gemini-2.0-flash-exp",
                query_category="support",
            )
        # ─────────────────────────────────────────────────────────────────────

        print(f"   Response: {response[:80]}...")
        print(f"   Telemetry sent to AgentGuard + Phoenix")
        await asyncio.sleep(0.5)

    print("\n" + "=" * 60)
    print("Done. Check AgentGuard dashboard and Arize Phoenix at localhost:6006")


if __name__ == "__main__":
    asyncio.run(main())
