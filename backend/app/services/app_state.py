"""Small Supabase-backed app state helpers."""

from datetime import datetime, timezone
from typing import Any

import httpx

from app.schemas import FacilityHit
from app.settings import settings


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _configured() -> bool:
    return bool(settings.supabase_url and settings.supabase_service_role_key)


def _headers() -> dict[str, str]:
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }


def _table_url(table: str) -> str:
    base = settings.supabase_url.rstrip("/")
    if base.endswith("/rest/v1"):
        return f"{base}/{table}"
    return f"{base}/rest/v1/{table}"


def log_search_event(
    event_type: str,
    query: str,
    intent: str | None,
    response_facilities: list[FacilityHit],
    summary: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    if not _configured():
        return
    payload = {
        "event_type": event_type,
        "query": query,
        "intent": intent,
        "summary": summary,
        "response_facilities": [
            {
                "facility_id": facility.facility_id,
                "name": facility.name,
                "city": facility.city,
                "state": facility.state,
                "trust_score": facility.trust_score,
                "distance_km": facility.distance_km,
                "trust_status": facility.trust_status,
            }
            for facility in response_facilities[:20]
        ],
        "metadata": metadata or {},
        "created_at": _now(),
    }
    try:
        with httpx.Client(timeout=5) as client:
            client.post(_table_url("search_events"), headers=_headers(), json=payload)
    except Exception:
        return
