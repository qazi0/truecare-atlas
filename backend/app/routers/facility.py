"""GET /api/facility/{facility_id} — returns full facility JSON."""

from fastapi import APIRouter

from app.schemas import FacilityFull
from app.services.databricks_sql import query_facility_by_id

router = APIRouter(tags=["facility"])


@router.get("/facility/{facility_id}", response_model=FacilityFull)
def get_facility(facility_id: str) -> FacilityFull:
    return query_facility_by_id(facility_id)
