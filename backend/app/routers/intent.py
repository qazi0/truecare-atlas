"""POST /api/intent-search — deterministic search router."""

from fastapi import APIRouter

from app.schemas import IntentSearchRequest, IntentSearchResponse
from app.services.intent_router import route_intent_search

router = APIRouter(tags=["intent"])


@router.post("/intent-search", response_model=IntentSearchResponse)
async def intent_search(payload: IntentSearchRequest) -> IntentSearchResponse:
    return await route_intent_search(payload.query, mode=payload.mode)
