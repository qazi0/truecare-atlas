"""GET /api/data-health — governance and data quality summary."""

from datetime import datetime, timezone

from fastapi import APIRouter

from app.schemas import DataHealthResponse
from app.services.health_monitor import build_health_snapshot
from app.settings import settings

router = APIRouter(tags=["data-health"])


@router.get("/data-health", response_model=DataHealthResponse)
def get_data_health() -> DataHealthResponse:
    snapshot = build_health_snapshot(include_metrics=True)
    checks = snapshot["checks"]
    checks["feature_checks"] = snapshot["feature_checks"]
    metrics = snapshot["metrics"]

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

    status = snapshot["status"]
    return DataHealthResponse(
        status=status,
        generated_at=snapshot["generated_at"] or datetime.now(timezone.utc).isoformat(),
        checks=checks,
        metrics=metrics,
        pipeline=pipeline,
        governance=governance,
    )
