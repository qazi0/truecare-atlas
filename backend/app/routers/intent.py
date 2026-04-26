"""POST /api/intent-search — deterministic search router."""

from fastapi import APIRouter, Query

from app.schemas import IntentSearchRequest, IntentSearchResponse, RecentSearchEvent
from app.services.app_state import recent_search_events
from app.services.intent_router import route_intent_search

router = APIRouter(tags=["intent"])


@router.post("/intent-search", response_model=IntentSearchResponse)
async def intent_search(payload: IntentSearchRequest) -> IntentSearchResponse:
    return await route_intent_search(payload.query, mode=payload.mode)


@router.get("/search-events/recent", response_model=list[RecentSearchEvent])
def get_recent_search_events(limit: int = Query(default=6, ge=1, le=20)) -> list[dict]:
    return recent_search_events(limit=limit)
