"""MLflow trace fetching — reads trace JSON by run_id."""

import mlflow
from mlflow.tracking import MlflowClient


def fetch_trace(run_id: str) -> dict:
    """Return the MLflow trace dict for a given run_id.

    Falls back to an empty dict if the run has no trace data.
    """
    client = MlflowClient()
    try:
        run = client.get_run(run_id)
        tags = run.data.tags
        # MLflow traces are attached via the tracing API; retrieve via search_traces
        traces = mlflow.search_traces(
            filter_string=f"request_id = '{run_id}'",
            max_results=1,
        )
        if traces is not None and len(traces) > 0:
            trace = traces[0]
            return trace.to_dict() if hasattr(trace, "to_dict") else {}
        return {"run_id": run_id, "tags": dict(tags)}
    except Exception:
        return {"run_id": run_id, "error": "trace not found"}


def recent_traces(limit: int = 10) -> list[dict]:
    """Return recent MLflow traces when available; never fail the API."""
    try:
        traces = mlflow.search_traces(max_results=max(1, min(limit, 50)))
    except Exception:
        return []

    result: list[dict] = []
    try:
        iterator = traces.to_dict("records") if hasattr(traces, "to_dict") else traces
        for item in iterator:
            if hasattr(item, "to_dict"):
                item = item.to_dict()
            if not isinstance(item, dict):
                continue
            info = item.get("info") if isinstance(item.get("info"), dict) else {}
            data = item.get("data") if isinstance(item.get("data"), dict) else {}
            tags = data.get("tags") if isinstance(data.get("tags"), dict) else {}
            trace_id = (
                item.get("request_id")
                or info.get("request_id")
                or item.get("trace_id")
                or info.get("trace_id")
                or item.get("run_id")
            )
            if not trace_id:
                continue
            result.append({
                "id": str(trace_id),
                "query": tags.get("query") or item.get("query"),
                "status": info.get("status") or item.get("status"),
                "duration_ms": item.get("execution_time_ms") or info.get("execution_time_ms"),
                "started_at": item.get("timestamp_ms") or info.get("timestamp_ms"),
                "steps": None,
            })
    except Exception:
        return []
    return result[:limit]
