"""GET /api/validate/{facility_id} — second-pass LLM validator against medical standards."""

import asyncio

from fastapi import APIRouter

from app.schemas import ValidatorResult
from app.services.validator import validate_facility

router = APIRouter(tags=["validate"])


@router.get("/validate/{facility_id}", response_model=ValidatorResult)
async def get_validation(facility_id: str) -> ValidatorResult:
    return await validate_facility(facility_id)
