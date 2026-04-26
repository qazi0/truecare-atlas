"""Map endpoints — aggregates for choropleth + lightweight facility points."""

from fastapi import APIRouter, Query

from app.schemas import AggregateLevel, AggregateRow, AggregateRowWithCI, RegionSummary
from app.services.databricks_sql import (
    query_aggregates,
    query_aggregates_with_ci,
    query_map_facilities,
    query_region_summary,
)

router = APIRouter(tags=["map"])


@router.get("/map/aggregates", response_model=list[AggregateRow])
def get_map_aggregates(
    capability: str = Query(default="has_nicu", description="Capability flag to aggregate"),
    level: AggregateLevel = Query(default=AggregateLevel.STATE, description="Geographic level"),
) -> list[AggregateRow]:
    return query_aggregates(level=level, capability=capability)


@router.get("/map/facilities")
def get_map_facilities(
    capability: str | None = Query(default=None),
    verified_only: bool = Query(default=False),
    show_review_needed: bool = Query(default=True),
) -> list[dict]:
    """All facility points for map markers — lightweight payload."""
    return query_map_facilities(
        capability=capability,
        verified_only=verified_only,
        show_review_needed=show_review_needed,
    )


@router.get("/map/aggregates/ci", response_model=list[AggregateRowWithCI])
def get_map_aggregates_with_ci(
    capability: str = Query(default="has_nicu", description="Capability flag to aggregate"),
    level: AggregateLevel = Query(default=AggregateLevel.STATE, description="Geographic level"),
) -> list[AggregateRowWithCI]:
    return query_aggregates_with_ci(level=level, capability=capability)


@router.get("/map/region-summary", response_model=RegionSummary)
def get_map_region_summary(
    region: str = Query(..., description="State/region name"),
    capability: str = Query(default="has_nicu", description="Capability flag"),
) -> RegionSummary:
    return query_region_summary(region=region, capability=capability)
