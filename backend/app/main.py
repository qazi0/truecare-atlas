from contextlib import asynccontextmanager

import mlflow
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.errors import DatabricksQueryError, FacilityNotFoundError, VectorSearchError
from app.settings import settings
from app.services.health_monitor import build_health_snapshot, start_health_monitor, stop_health_monitor
from app.routers import (
    audit,
    care_plan,
    clinics,
    data_health,
    export,
    facility,
    intent,
    map_routes,
    nearby,
    reviews,
    search,
    traces,
    validate,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        mlflow.openai.autolog()
        mlflow.set_experiment(settings.mlflow_experiment)
    except Exception:
        pass
    start_health_monitor()
    yield
    stop_health_monitor()


app = FastAPI(title="TrueCare Atlas", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router, prefix="/api")
app.include_router(intent.router, prefix="/api")
app.include_router(care_plan.router, prefix="/api")
app.include_router(clinics.router, prefix="/api")
app.include_router(facility.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(map_routes.router, prefix="/api")
app.include_router(nearby.router, prefix="/api")
app.include_router(traces.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(validate.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(data_health.router, prefix="/api")


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
    snapshot = build_health_snapshot(include_metrics=False)
    return {
        "status": snapshot["status"],
        "generated_at": snapshot["generated_at"],
        "checks": snapshot["checks"],
        "feature_checks": snapshot["feature_checks"],
    }


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
