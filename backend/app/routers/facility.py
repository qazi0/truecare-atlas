"""GET /api/facility/{facility_id} — returns full facility JSON."""

from fastapi import APIRouter

from app.schemas import EvidenceClaim, FacilityFull
from app.services.databricks_sql import (
    query_evidence_claim,
    query_evidence_claims_for_facility,
    query_facility_by_id,
    query_raw_record,
)

router = APIRouter(tags=["facility"])


@router.get("/facility/{facility_id}", response_model=FacilityFull)
def get_facility(facility_id: str) -> FacilityFull:
    return query_facility_by_id(facility_id)


@router.get("/facility/{facility_id}/evidence", response_model=list[EvidenceClaim])
def get_facility_evidence(facility_id: str) -> list[EvidenceClaim]:
    return query_evidence_claims_for_facility(facility_id)


@router.get("/facility/{facility_id}/raw-record")
def get_facility_raw_record(facility_id: str) -> dict:
    return query_raw_record(facility_id)


@router.get("/evidence/{claim_id}", response_model=EvidenceClaim)
def get_evidence_claim(claim_id: str) -> EvidenceClaim:
    return query_evidence_claim(claim_id)
