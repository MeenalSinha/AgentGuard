from fastapi import APIRouter
from app.api.v1 import (
    agents, dashboard, drift, hallucinations,
    incidents, predictions, copilot, recommendations,
    observability, simulator, investigation, realtime
)

api_router = APIRouter()

api_router.include_router(agents.router,          prefix="/agents",          tags=["agents"])
api_router.include_router(dashboard.router,        prefix="/dashboard",       tags=["dashboard"])
api_router.include_router(drift.router,            prefix="/drift",           tags=["drift"])
api_router.include_router(hallucinations.router,   prefix="/hallucinations",  tags=["hallucinations"])
api_router.include_router(incidents.router,        prefix="/incidents",       tags=["incidents"])
api_router.include_router(predictions.router,      prefix="/predictions",     tags=["predictions"])
api_router.include_router(copilot.router,          prefix="/copilot",         tags=["copilot"])
api_router.include_router(recommendations.router,  prefix="/recommendations", tags=["recommendations"])
api_router.include_router(observability.router,    prefix="/observability",   tags=["observability"])
api_router.include_router(simulator.router,        prefix="/simulator",       tags=["simulator"])
api_router.include_router(investigation.router,    prefix="/investigation",   tags=["investigation"])
api_router.include_router(realtime.router,         prefix="/realtime",        tags=["realtime"])
