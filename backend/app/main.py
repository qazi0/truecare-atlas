from contextlib import asynccontextmanager

import mlflow
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.errors import DatabricksQueryError, FacilityNotFoundError, VectorSearchError
from app.settings import settings
from app.routers import search, facility, audit, map_routes, traces, export, validate


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        mlflow.openai.autolog()
        mlflow.set_experiment(settings.mlflow_experiment)
    except Exception:
        pass
    yield


app = FastAPI(title="TrustMap India", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router, prefix="/api")
app.include_router(facility.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(map_routes.router, prefix="/api")
app.include_router(traces.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(validate.router, prefix="/api")


@app.exception_handler(FacilityNotFoundError)
async def facility_not_found_handler(request: Request, exc: FacilityNotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(DatabricksQueryError)
async def databricks_query_handler(request: Request, exc: DatabricksQueryError):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.exception_handler(VectorSearchError)
async def vector_search_handler(request: Request, exc: VectorSearchError):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.get("/api/health")
def health():
    from app.deps import get_sql_connection, get_workspace_client

    checks: dict = {}

    # SQL warehouse
    try:
        conn = get_sql_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT current_user()")
        row = cursor.fetchone()
        cursor.close()
        checks["sql"] = {"ok": True, "user": row[0] if row else None}
    except Exception as e:
        checks["sql"] = {"ok": False, "error": str(e)}

    # Vector search index
    try:
        w = get_workspace_client()
        idx = w.vector_search_indexes.get_index(settings.vector_search_index)
        checks["vector_search"] = {
            "ok": idx.status.ready if idx.status else False,
            "indexed_rows": idx.status.indexed_row_count if idx.status else 0,
        }
    except Exception as e:
        checks["vector_search"] = {"ok": False, "error": str(e)}

    all_ok = all(c.get("ok") for c in checks.values())
    return {"status": "ok" if all_ok else "degraded", "checks": checks}


@app.get("/api/search-quick")
def search_quick(q: str = "", k: int = 20):
    from app.services.databricks_sql import query_facilities_by_text
    if not q.strip():
        return []
    return query_facilities_by_text(q.strip(), k)


if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("DATABRICKS_APP_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
