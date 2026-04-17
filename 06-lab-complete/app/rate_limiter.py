"""Redis-backed fixed-window rate limiter."""
import time

import redis
from fastapi import HTTPException

from app.config import settings


redis_client = redis.from_url(settings.redis_url, decode_responses=True)


def _rate_key(user_id: str) -> str:
    minute_epoch = int(time.time() // 60)
    return f"rate:{user_id}:{minute_epoch}"


def check_rate_limit(user_id: str) -> None:
    key = _rate_key(user_id)
    try:
        count = redis_client.incr(key)
        if count == 1:
            redis_client.expire(key, 120)
    except redis.RedisError as exc:
        raise HTTPException(status_code=503, detail="Rate limiter unavailable") from exc

    if count > settings.rate_limit_per_minute:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded: {settings.rate_limit_per_minute} req/min",
            headers={"Retry-After": "60"},
        )
