"""MLflow trace fetching plus a small in-process fallback activity store."""

import uuid
from datetime import datetime, timezone
from typing import Any

import mlflow
from mlflow.tracking import MlflowClient

_LOCAL_TRACES: dict[str, dict[str, Any]] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_local_trace_id(prefix: str = "local") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def store_local_trace(trace_id: str, payload: dict[str, Any]) -> None:
    _LOCAL_TRACES[trace_id] = {
        "id": trace_id,
        "trace_state": payload.get("trace_state", "local_activity_only"),
        "stored_at": _now(),
        **payload,
    }
    if len(_LOCAL_TRACES) > 50:
        oldest = sorted(_LOCAL_TRACES, key=lambda key: str(_LOCAL_TRACES[key].get("stored_at") or ""))[:10]
        for key in oldest:
            _LOCAL_TRACES.pop(key, None)


def fetch_trace(run_id: str) -> dict:
    """Return the MLflow trace dict for a given run_id.

    Falls back to an empty dict if the run has no trace data.
    """
    local = _LOCAL_TRACES.get(run_id)
    if local:
        return local

    client = MlflowClient()
    try:
        trace = _first_trace_record(
            mlflow.search_traces(
                filter_string=f"request_id = '{run_id}'",
                max_results=1,
            )
        )
        if trace:
            return trace
    except Exception:
        pass

    try:
        run = client.get_run(run_id)
        tags = run.data.tags
        # MLflow traces are attached via the tracing API; retrieve via search_traces
        trace = _first_trace_record(
            mlflow.search_traces(
            filter_string=f"request_id = '{run_id}'",
            max_results=1,
            )
        )
        if trace:
            return trace
        return {"run_id": run_id, "tags": dict(tags)}
    except Exception:
        return {
            "run_id": run_id,
            "trace_state": "trace_unavailable",
            "error": "trace not found",
            "fallback": {
                "message": "No MLflow trace or local streamed activity was found for this id.",
            },
        }


def recent_traces(limit: int = 10) -> list[dict]:
    """Return recent MLflow traces when available; never fail the API."""
    local_rows: list[dict] = []
    for trace_id, item in sorted(
        _LOCAL_TRACES.items(),
        key=lambda kv: str(kv[1].get("stored_at") or kv[1].get("started_at") or ""),
        reverse=True,
    )[:limit]:
        local_rows.append({
            "id": trace_id,
            "query": item.get("query"),
            "status": item.get("status") or item.get("trace_state"),
            "duration_ms": item.get("duration_ms"),
            "started_at": item.get("started_at") or item.get("stored_at"),
            "steps": len(item.get("steps") or []),
        })

    try:
        traces = mlflow.search_traces(max_results=max(1, min(limit, 50)))
    except Exception:
        return local_rows[:limit]

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
    seen = {item["id"] for item in local_rows}
    merged = local_rows + [item for item in result if item.get("id") not in seen]
    return merged[:limit]


def _first_trace_record(traces: Any) -> dict[str, Any] | None:
    if traces is None or len(traces) == 0:
        return None
    if hasattr(traces, "to_dict"):
        records = traces.to_dict("records")
        return records[0] if records else None
    trace = traces[0]
    if hasattr(trace, "to_dict"):
        return trace.to_dict()
    return trace if isinstance(trace, dict) else None
