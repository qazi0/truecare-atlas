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
