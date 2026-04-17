"""Monthly per-user budget guard backed by Redis."""
from datetime import datetime, timezone

import redis
from fastapi import HTTPException

from app.config import settings


redis_client = redis.from_url(settings.redis_url, decode_responses=True)
MONTH_TTL_SECONDS = 60 * 60 * 24 * 40


def _budget_key(user_id: str) -> str:
    month_key = datetime.now(timezone.utc).strftime("%Y-%m")
    return f"budget:{user_id}:{month_key}"


def estimate_request_cost(input_tokens: int, output_tokens: int) -> float:
    return (input_tokens / 1000) * 0.00015 + (output_tokens / 1000) * 0.0006


def get_current_month_spend(user_id: str) -> float:
    try:
        return float(redis_client.get(_budget_key(user_id)) or 0.0)
    except (redis.RedisError, ValueError):
        return 0.0


def check_budget(user_id: str, estimated_cost: float) -> None:
    key = _budget_key(user_id)
    try:
        current = float(redis_client.get(key) or 0.0)
    except (redis.RedisError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="Budget guard unavailable") from exc

    projected = current + estimated_cost
    if projected > settings.monthly_budget_usd:
        raise HTTPException(status_code=402, detail="Monthly budget exceeded")

    try:
        redis_client.set(key, f"{projected:.6f}")
        redis_client.expire(key, MONTH_TTL_SECONDS)
    except redis.RedisError as exc:
        raise HTTPException(status_code=503, detail="Budget guard unavailable") from exc
