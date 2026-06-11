from fastapi import APIRouter
from app.core.config import settings
import httpx

router = APIRouter()


@router.get("/traces")
async def get_traces(limit: int = 50):
    """Proxy Arize Phoenix traces."""
    if "arize.com" in settings.PHOENIX_ENDPOINT:
        return {"traces": [], "message": "View traces directly in Arize Cloud"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.PHOENIX_ENDPOINT}/v1/traces?limit={limit}")
            return resp.json()
    except Exception:
        return {"traces": [], "message": "Phoenix not connected — start with docker compose"}


@router.get("/evaluations")
async def get_evaluations():
    if "arize.com" in settings.PHOENIX_ENDPOINT:
        return {"evaluations": [], "message": "View evaluations directly in Arize Cloud"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.PHOENIX_ENDPOINT}/v1/evaluations")
            return resp.json()
    except Exception:
        return {"evaluations": [], "message": "Phoenix not connected"}


@router.get("/status")
async def phoenix_status():
    if "arize.com" in settings.PHOENIX_ENDPOINT:
        return {"connected": True, "endpoint": settings.PHOENIX_ENDPOINT}
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.PHOENIX_ENDPOINT}/health")
            return {"connected": resp.status_code == 200, "endpoint": settings.PHOENIX_ENDPOINT}
    except Exception:
        return {"connected": False, "endpoint": settings.PHOENIX_ENDPOINT}
