"""GET /api/data-health — governance and data quality summary."""

from datetime import datetime, timezone

from fastapi import APIRouter

from app.deps import get_sql_connection, get_workspace_client
from app.schemas import DataHealthResponse
from app.services.databricks_sql import query_data_health_metrics
from app.settings import settings

router = APIRouter(tags=["data-health"])


@router.get("/data-health", response_model=DataHealthResponse)
def get_data_health() -> DataHealthResponse:
    checks: dict = {}

    try:
        conn = get_sql_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT current_user()")
        row = cursor.fetchone()
        cursor.close()
        checks["sql"] = {"ok": True, "user": row[0] if row else None}
    except Exception as exc:
        checks["sql"] = {"ok": False, "error": str(exc)}

    try:
        w = get_workspace_client()
        idx = w.vector_search_indexes.get_index(settings.vector_search_index)
        checks["vector_search"] = {
            "ok": bool(idx.status.ready) if idx.status else False,
            "indexed_rows": idx.status.indexed_row_count if idx.status else 0,
        }
    except Exception as exc:
        checks["vector_search"] = {"ok": False, "error": str(exc)}

    try:
        metrics = query_data_health_metrics()
        checks["metrics"] = {"ok": True}
    except Exception as exc:
        metrics = {}
        checks["metrics"] = {"ok": False, "error": str(exc)}

    pipeline = [
        {"stage": "Bronze", "asset": "health_india", "status": "source table"},
        {"stage": "Silver", "asset": "silver_facility", "status": "cleaned records"},
        {"stage": "Gold", "asset": "gold_facility_capabilities", "status": "capability extraction"},
        {"stage": "Gold", "asset": "gold_facility_trust", "status": "trust scoring"},
        {"stage": "Serving", "asset": settings.vector_search_index, "status": "search index"},
    ]
    governance = [
        "Backend runs as a Databricks App with service-principal data access.",
        "Browser clients call server-side proxy routes; Databricks credentials are never exposed to the browser.",
        "Facility recommendations include row-level evidence quotes and trust-rule flags.",
        "Deep reasoning operations are instrumented with MLflow tracing.",
        "Customer-specific auth, RBAC, and row policies are startup-path features, not hackathon scope.",
    ]

    all_ok = all(c.get("ok") for c in checks.values())
    status = "ok" if all_ok else "degraded"
    return DataHealthResponse(
        status=status,
        generated_at=datetime.now(timezone.utc).isoformat(),
        checks=checks,
        metrics=metrics,
        pipeline=pipeline,
        governance=governance,
    )
