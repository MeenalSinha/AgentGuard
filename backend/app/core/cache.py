import json
from typing import Any, Optional
import redis.asyncio as redis
from app.core.config import settings

_redis_client: Optional[redis.Redis] = None


def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


async def cache_get(key: str) -> Optional[Any]:
    client = get_redis()
    value = await client.get(key)
    if value:
        return json.loads(value)
    return None


async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    client = get_redis()
    await client.setex(key, ttl, json.dumps(value, default=str))


async def cache_delete(key: str) -> None:
    client = get_redis()
    await client.delete(key)


async def cache_delete_pattern(pattern: str) -> None:
    client = get_redis()
    keys = await client.keys(pattern)
    if keys:
        await client.delete(*keys)
