"""All Clinics explorer endpoints."""

from fastapi import APIRouter, Query

from app.schemas import ClinicsPageResponse
from app.services.databricks_sql import query_clinics_page

router = APIRouter(tags=["clinics"])


@router.get("/clinics", response_model=ClinicsPageResponse)
def get_clinics(
    q: str | None = Query(default=None),
    capability: str | None = Query(default=None),
    state: str | None = Query(default=None),
    city: str | None = Query(default=None),
    status: str | None = Query(
        default=None,
        description="verified | needs_review | contradiction | evidence_weak",
    ),
    limit: int = Query(default=10, ge=1, le=50),
    cursor: str | None = Query(default=None),
) -> ClinicsPageResponse:
    return query_clinics_page(
        q=q,
        capability=capability,
        state=state,
        city=city,
        status=status,
        limit=limit,
        cursor=cursor,
    )
