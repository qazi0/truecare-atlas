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


def log_health_snapshot(snapshot: dict[str, Any]) -> bool:
    if not _configured():
        return False
    checks = snapshot.get("checks") if isinstance(snapshot, dict) else {}
    feature_checks = snapshot.get("feature_checks") if isinstance(snapshot, dict) else {}
    payload = {
        "status": snapshot.get("status"),
        "sql_ok": bool((checks.get("sql") or {}).get("ok")),
        "vector_search_ok": bool((checks.get("vector_search") or {}).get("ok")),
        "metrics_ok": bool((checks.get("metrics") or {}).get("ok")),
        "clinics_ok": bool((feature_checks.get("clinics") or {}).get("ok")),
        "facility_lookup_ok": bool((feature_checks.get("facility_lookup") or {}).get("ok")),
        "map_aggregates_ok": bool((feature_checks.get("map_aggregates") or {}).get("ok")),
        "supabase_ok": bool((feature_checks.get("supabase") or {}).get("ok")),
        "details": snapshot,
        "created_at": _now(),
    }
    try:
        with httpx.Client(timeout=5) as client:
            resp = client.post(_table_url("health_checks"), headers=_headers(), json=payload)
        return resp.status_code < 400
    except Exception:
        return False


def recent_search_events(limit: int = 6) -> list[dict[str, Any]]:
    if not _configured():
        return []
    safe_limit = max(1, min(int(limit or 6), 20))
    url = _table_url("search_events")
    params = {
        "select": "query,intent,summary,response_facilities,created_at",
        "order": "created_at.desc",
        "limit": str(safe_limit),
    }
    try:
        with httpx.Client(timeout=5) as client:
            resp = client.get(url, headers=_headers(), params=params)
        if resp.status_code >= 400:
            return []
        rows = resp.json()
        if not isinstance(rows, list):
            return []
        unique: list[dict[str, Any]] = []
        seen: set[str] = set()
        for row in rows:
            if not isinstance(row, dict):
                continue
            query = str(row.get("query") or "").strip()
            key = query.lower()
            if not query or key in seen:
                continue
            seen.add(key)
            unique.append(row)
        return unique
    except Exception:
        return []
