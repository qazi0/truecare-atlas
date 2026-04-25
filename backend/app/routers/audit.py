"""GET /api/audit/{facility_id} — returns TrustReport JSON."""

from fastapi import APIRouter

from app.schemas import TrustReport
from app.services.databricks_sql import query_trust_report

router = APIRouter(tags=["audit"])


@router.get("/audit/{facility_id}", response_model=TrustReport)
def get_trust_report(facility_id: str) -> TrustReport:
    return query_trust_report(facility_id)
