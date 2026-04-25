"""GET /api/map/aggregates — returns capability rollups for choropleth map."""

from fastapi import APIRouter, Query

from app.schemas import AggregateLevel, AggregateRow, MapAggregateParams
from app.services.databricks_sql import query_aggregates

router = APIRouter(tags=["map"])


@router.get("/map/aggregates", response_model=list[AggregateRow])
def get_map_aggregates(
    capability: str = Query(default="has_nicu", description="Capability flag to aggregate"),
    level: AggregateLevel = Query(default=AggregateLevel.STATE, description="Geographic level"),
) -> list[AggregateRow]:
    return query_aggregates(level=level, capability=capability)
