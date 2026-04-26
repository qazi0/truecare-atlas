"""Care access planner endpoint."""

from fastapi import APIRouter

from app.schemas import (
    CareNeed,
    CarePlanExport,
    CarePlanRecommendation,
    CarePlanRequest,
    CarePlanResponse,
)
from app.services.app_state import log_search_event
from app.services.databricks_sql import query_evidence_claims_for_facility
from app.services.intent_router import parse_intent, route_intent_search

router = APIRouter(tags=["care-plan"])


@router.post("/care-plan", response_model=CarePlanResponse)
async def care_plan(payload: CarePlanRequest) -> CarePlanResponse:
    parsed = parse_intent(payload.query)
    search = await route_intent_search(payload.query, mode="fast")
    recommendations: list[CarePlanRecommendation] = []
    for idx, facility in enumerate(search.results[:5], start=1):
        claims = []
        try:
            claims = query_evidence_claims_for_facility(facility.facility_id)
        except Exception:
            claims = []
        matching = [c for c in claims if not search.capability or c.capability == search.capability]
        first = matching[0] if matching else (claims[0] if claims else None)
        status = facility.trust_status or "Needs review"
        recommendations.append(CarePlanRecommendation(
            facility=facility,
            rank=idx,
            evidence_summary=first.source_quote if first and first.source_quote else "Evidence details available in facility ledger.",
            risk_label=status,
            verification_warning="Call first and confirm capability availability before referral.",
            evidence_claim_ids=[c.claim_id for c in matching[:3]],
        ))

    warnings = [
        "This planner ranks records by evidence and distance; it is not a medical diagnosis or emergency dispatch tool.",
        "Confirm bed, staff, and equipment availability directly with the facility before referral.",
    ]
    response = CarePlanResponse(
        need=CareNeed(
            capability=search.capability or parsed.capability,
            place=search.place or parsed.place,
            urgency=payload.urgency or ("emergency" if "emergency" in payload.query.lower() else "urgent"),
        ),
        recommendations=recommendations,
        call_first_checklist=[
            "Confirm the required service is available right now.",
            "Ask whether specialist staff and equipment are on site.",
            "Confirm patient intake, cost constraints, and referral documents.",
            "Record the staff name, time called, and any denial reason.",
        ],
        warnings=warnings,
        export=CarePlanExport(referral_brief_id=f"brief_{abs(hash(payload.query)) % 10_000_000}"),
    )
    log_search_event(
        event_type="care_plan",
        query=payload.query,
        intent="care_plan",
        response_facilities=[item.facility for item in response.recommendations],
        summary=f"{len(response.recommendations)} care recommendations generated",
        metadata=response.need.model_dump(),
    )
    return response
