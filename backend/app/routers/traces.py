"""GET /api/traces/{run_id} — proxies MLflow trace JSON."""

from fastapi import APIRouter

from app.services.mlflow_tracing import fetch_trace

router = APIRouter(tags=["traces"])


@router.get("/traces/{run_id}")
def get_trace(run_id: str) -> dict:
    return fetch_trace(run_id)
