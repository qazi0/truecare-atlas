"""GET /api/map/aggregates — returns capability rollups for choropleth map."""

from fastapi import APIRouter, Query

from app.schemas import AggregateLevel, AggregateRow, AggregateRowWithCI
from app.services.databricks_sql import query_aggregates, query_aggregates_with_ci

router = APIRouter(tags=["map"])


@router.get("/map/aggregates", response_model=list[AggregateRow])
def get_map_aggregates(
    capability: str = Query(default="has_nicu", description="Capability flag to aggregate"),
    level: AggregateLevel = Query(default=AggregateLevel.STATE, description="Geographic level"),
) -> list[AggregateRow]:
    return query_aggregates(level=level, capability=capability)


@router.get("/map/aggregates/ci", response_model=list[AggregateRowWithCI])
def get_map_aggregates_with_ci(
    capability: str = Query(default="has_nicu", description="Capability flag to aggregate"),
    level: AggregateLevel = Query(default=AggregateLevel.STATE, description="Geographic level"),
) -> list[AggregateRowWithCI]:
    return query_aggregates_with_ci(level=level, capability=capability)
