from contextlib import asynccontextmanager

import mlflow
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.errors import DatabricksQueryError, FacilityNotFoundError, VectorSearchError
from app.settings import settings
from app.routers import search, facility, audit, map_routes, traces


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
    from app.deps import get_sql_connection

    conn = get_sql_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT current_user()")
    row = cursor.fetchone()
    cursor.close()
    return {"status": "ok", "user": row[0] if row else None}
