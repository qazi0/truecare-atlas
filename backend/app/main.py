from contextlib import asynccontextmanager

import mlflow
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.settings import settings
from app.routers import search, facility, audit, map_routes, traces


@asynccontextmanager
async def lifespan(app: FastAPI):
    mlflow.openai.autolog()
    mlflow.set_experiment(settings.mlflow_experiment)
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


@app.get("/api/health")
def health():
    from app.deps import get_sql_connection

    conn = get_sql_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT current_user()")
    row = cursor.fetchone()
    cursor.close()
    return {"status": "ok", "user": row[0] if row else None}
