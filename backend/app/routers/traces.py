"""MLflow trace endpoints."""

from fastapi import APIRouter, Query

from app.schemas import RecentTrace
from app.services.mlflow_tracing import fetch_trace, recent_traces

router = APIRouter(tags=["traces"])


@router.get("/traces/recent", response_model=list[RecentTrace])
def get_recent_traces(limit: int = Query(default=10, ge=1, le=50)) -> list[RecentTrace]:
    return [RecentTrace.model_validate(item) for item in recent_traces(limit=limit)]


@router.get("/traces/{run_id}")
def get_trace(run_id: str) -> dict:
    return fetch_trace(run_id)
