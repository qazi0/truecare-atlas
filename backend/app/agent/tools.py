"""6 agent tool functions + TOOL_REGISTRY + OpenAI tool definitions."""

import asyncio
from typing import Callable

from pydantic import BaseModel

from app.schemas import (
    AggregateByInput,
    AggregateRow,
    AuditTrustInput,
    CapabilityFilterInput,
    FacilityFull,
    FacilityHit,
    GeoSearchInput,
    GetFacilityInput,
    TrustReport,
    VectorSearchInput,
)
from app.services import databricks_sql, databricks_vs


async def geo_search(params: GeoSearchInput) -> list[FacilityHit]:
    """Find facilities within radius_km of (lat, lng). Returns facilities ordered by
    distance using the Haversine formula against the gold_facility_trust table."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None,
        databricks_sql.query_facilities_by_geo,
        params.lat,
        params.lng,
        params.radius_km,
        params.filters,
    )


async def vector_search(params: VectorSearchInput) -> list[FacilityHit]:
    """Hybrid BM25+dense semantic search across all 10K facilities. Use for free-text
    queries about facility names, specialties, or capability descriptions."""
    return await databricks_vs.similarity_search(
        query=params.query,
        filters=params.filters,
        k=params.k,
    )


async def capability_filter(params: CapabilityFilterInput) -> list[FacilityHit]:
    """Return up to k facilities that have ALL the requested capability flags set to TRUE,
    ordered by trust_score descending."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None,
        databricks_sql.query_facilities_by_capability,
        params.flags,
        params.filters,
        params.k,
    )


async def get_facility(params: GetFacilityInput) -> FacilityFull:
    """Retrieve a full facility record including silver description, trust report, and
    evidence details by facility_id."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None,
        databricks_sql.query_facility_by_id,
        params.facility_id,
    )


async def audit_trust(params: AuditTrustInput) -> TrustReport:
    """Fetch the pre-computed trust report for a facility: score (0-100), rule flags
    (R1-R8), and evidence quotes that triggered each flag."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None,
        databricks_sql.query_trust_report,
        params.facility_id,
    )


async def aggregate_by(params: AggregateByInput) -> list[AggregateRow]:
    """Read pre-computed capability rollups from gold_state_aggregates or
    gold_pincode_aggregates. Returns claimed vs verified counts per region."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None,
        databricks_sql.query_aggregates,
        params.level,
        params.capability,
    )


# ---------------------------------------------------------------------------
# Registry and OpenAI tool definitions
# ---------------------------------------------------------------------------

TOOL_REGISTRY: dict[str, Callable] = {
    "geo_search":       geo_search,
    "vector_search":    vector_search,
    "capability_filter": capability_filter,
    "get_facility":     get_facility,
    "audit_trust":      audit_trust,
    "aggregate_by":     aggregate_by,
}

TOOL_DEFINITIONS: list[tuple[str, Callable, type[BaseModel]]] = [
    ("geo_search",        geo_search,        GeoSearchInput),
    ("vector_search",     vector_search,     VectorSearchInput),
    ("capability_filter", capability_filter, CapabilityFilterInput),
    ("get_facility",      get_facility,      GetFacilityInput),
    ("audit_trust",       audit_trust,       AuditTrustInput),
    ("aggregate_by",      aggregate_by,      AggregateByInput),
]


def get_openai_tool_definitions() -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": name,
                "description": fn.__doc__,
                "parameters": schema.model_json_schema(),
            },
        }
        for name, fn, schema in TOOL_DEFINITIONS
    ]
