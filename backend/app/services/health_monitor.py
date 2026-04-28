from __future__ import annotations

from datetime import datetime, timezone
import logging
from threading import Event, Lock, Thread
from typing import Any

from app.deps import get_sql_connection, get_workspace_client
from app.services.app_state import log_health_snapshot
from app.services.databricks_sql import query_data_health_metrics
from app.settings import settings

_MONITOR_LOCK = Lock()
_MONITOR_STOP = Event()
_MONITOR_THREAD: Thread | None = None
_LOGGER = logging.getLogger("truecare.health_monitor")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _close_quietly(resource: Any) -> None:
    try:
        resource.close()
    except Exception:
        return


def _sql_scalar(sql: str) -> Any:
    conn = None
    cursor = None
    try:
        conn = get_sql_connection()
        cursor = conn.cursor()
        cursor.execute(sql)
        row = cursor.fetchone()
        return row[0] if row else None
    finally:
        if cursor is not None:
            _close_quietly(cursor)
        if conn is not None:
            _close_quietly(conn)


def build_health_snapshot(include_metrics: bool = True) -> dict[str, Any]:
    checks: dict[str, Any] = {}
    feature_checks: dict[str, Any] = {}
    metrics: dict[str, Any] = {}

    try:
        user = _sql_scalar("SELECT current_user()")
        checks["sql"] = {"ok": True, "user": user}
    except Exception as exc:
        checks["sql"] = {"ok": False, "error": str(exc)}

    try:
        facility_id = _sql_scalar("SELECT facility_id FROM workspace.default.gold_facility_trust LIMIT 1")
        feature_checks["facility_lookup"] = {"ok": bool(facility_id), "sample_facility_id": facility_id}
    except Exception as exc:
        feature_checks["facility_lookup"] = {"ok": False, "error": str(exc)}

    try:
        sample_name = _sql_scalar("SELECT name FROM workspace.default.gold_facility_trust ORDER BY LOWER(name) ASC LIMIT 1")
        feature_checks["clinics"] = {"ok": bool(sample_name), "sample_name": sample_name}
    except Exception as exc:
        feature_checks["clinics"] = {"ok": False, "error": str(exc)}

    try:
        region_name = _sql_scalar("SELECT state_canon FROM workspace.default.gold_state_aggregates LIMIT 1")
        feature_checks["map_aggregates"] = {"ok": bool(region_name), "sample_region": region_name}
    except Exception as exc:
        feature_checks["map_aggregates"] = {"ok": False, "error": str(exc)}

    try:
        w = get_workspace_client()
        idx = w.vector_search_indexes.get_index(settings.vector_search_index)
        checks["vector_search"] = {
            "ok": bool(idx.status.ready) if idx.status else False,
            "indexed_rows": idx.status.indexed_row_count if idx.status else 0,
        }
    except Exception as exc:
        checks["vector_search"] = {"ok": False, "error": str(exc)}

    if include_metrics:
        try:
            metrics = query_data_health_metrics()
            checks["metrics"] = {"ok": True}
        except Exception as exc:
            checks["metrics"] = {"ok": False, "error": str(exc)}
    else:
        checks["metrics"] = {"ok": True, "skipped": True}

    feature_checks["supabase"] = {
        "ok": bool(settings.supabase_url and settings.supabase_service_role_key),
        "configured": bool(settings.supabase_url and settings.supabase_service_role_key),
    }

    core_checks = [
        checks.get("sql", {}).get("ok"),
        checks.get("vector_search", {}).get("ok"),
        feature_checks.get("facility_lookup", {}).get("ok"),
        feature_checks.get("clinics", {}).get("ok"),
        feature_checks.get("map_aggregates", {}).get("ok"),
    ]
    if include_metrics:
        core_checks.append(checks.get("metrics", {}).get("ok"))
    if feature_checks["supabase"]["configured"]:
        core_checks.append(feature_checks["supabase"]["ok"])

    return {
        "status": "ok" if all(core_checks) else "degraded",
        "generated_at": _now(),
        "checks": checks,
        "feature_checks": feature_checks,
        "metrics": metrics,
    }


def record_health_snapshot() -> dict[str, Any]:
    snapshot = build_health_snapshot(include_metrics=True)
    wrote = log_health_snapshot(snapshot)
    snapshot["feature_checks"]["supabase"] = {
        "ok": wrote,
        "configured": bool(settings.supabase_url and settings.supabase_service_role_key),
    }
    return snapshot


def _monitor_loop() -> None:
    while not _MONITOR_STOP.is_set():
        try:
            snapshot = record_health_snapshot()
            _LOGGER.info(
                "health monitor tick status=%s sql_ok=%s vector_ok=%s supabase_ok=%s",
                snapshot.get("status"),
                (snapshot.get("checks") or {}).get("sql", {}).get("ok"),
                (snapshot.get("checks") or {}).get("vector_search", {}).get("ok"),
                (snapshot.get("feature_checks") or {}).get("supabase", {}).get("ok"),
            )
        except Exception:
            _LOGGER.exception("health monitor tick failed")
        _MONITOR_STOP.wait(max(60, int(settings.health_monitor_interval_seconds)))


def start_health_monitor() -> None:
    if not settings.health_monitor_enabled:
        return
    global _MONITOR_THREAD
    with _MONITOR_LOCK:
        if _MONITOR_THREAD and _MONITOR_THREAD.is_alive():
            return
        _MONITOR_STOP.clear()
        try:
            snapshot = record_health_snapshot()
            _LOGGER.info(
                "health monitor startup status=%s sql_ok=%s vector_ok=%s supabase_ok=%s",
                snapshot.get("status"),
                (snapshot.get("checks") or {}).get("sql", {}).get("ok"),
                (snapshot.get("checks") or {}).get("vector_search", {}).get("ok"),
                (snapshot.get("feature_checks") or {}).get("supabase", {}).get("ok"),
            )
        except Exception:
            _LOGGER.exception("health monitor startup check failed")
        _MONITOR_THREAD = Thread(target=_monitor_loop, name="truecare-health-monitor", daemon=True)
        _MONITOR_THREAD.start()


def stop_health_monitor() -> None:
    _MONITOR_STOP.set()
    thread = _MONITOR_THREAD
    if thread and thread.is_alive():
        thread.join(timeout=2)
