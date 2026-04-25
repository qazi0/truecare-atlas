"""Vector Search service — async wrapper over WorkspaceClient.vector_search_indexes."""

import json

from app.deps import get_workspace_client
from app.errors import VectorSearchError
from app.schemas import FacilityFilters, FacilityHit, FacilityCapabilities, Capability
from app.settings import settings

_INDEX_COLS = [
    "facility_id", "name", "state_canon", "city", "pincode",
    "trust_score", "trust_score_bucket",
    "has_icu", "has_nicu", "has_dialysis", "has_oncology",
    "has_emergency_surgery", "has_24x7", "has_maternity",
    "has_blood_bank", "has_anesthesia", "has_trauma", "has_cardiac_cath_lab",
    "capabilities_caption",
]

_CAP_BOOL_COLS = {
    "has_icu", "has_nicu", "has_dialysis", "has_oncology",
    "has_emergency_surgery", "has_24x7", "has_maternity",
    "has_blood_bank", "has_anesthesia", "has_trauma", "has_cardiac_cath_lab",
}


def _build_filters_json(filters: FacilityFilters | None) -> str | None:
    """Convert FacilityFilters to the Databricks VS filters_json format."""
    if not filters:
        return None
    f: dict = {}
    if filters.state:
        f["state_canon"] = filters.state
    if filters.pincode:
        f["pincode"] = filters.pincode
    if filters.facility_type:
        f["facility_type_id"] = filters.facility_type
    return json.dumps(f) if f else None


def _result_to_hit(data_row: dict) -> FacilityHit:
    """Map a VS result data_row dict to FacilityHit."""
    caps: dict[str, Capability] = {}
    for col in _CAP_BOOL_COLS:
        caps[col] = Capability(value=bool(data_row.get(col)))
    capabilities = FacilityCapabilities(
        capabilities_caption=data_row.get("capabilities_caption") or "",
        **caps,
    )
    lat = data_row.get("latitude")
    lng = data_row.get("longitude")
    return FacilityHit(
        facility_id=data_row["facility_id"],
        name=data_row.get("name") or "",
        city=data_row.get("city"),
        state=data_row.get("state_canon"),
        pincode=data_row.get("pincode"),
        latitude=float(lat) if lat is not None else None,
        longitude=float(lng) if lng is not None else None,
        facility_type=data_row.get("facility_type_id"),
        trust_score=data_row.get("trust_score"),
        capabilities=capabilities,
    )


async def similarity_search(
    query: str,
    filters: FacilityFilters | None = None,
    k: int = 20,
) -> list[FacilityHit]:
    """Hybrid BM25+dense search against the facility_index vector index."""
    w = get_workspace_client()
    filters_json = _build_filters_json(filters)

    kwargs: dict = dict(
        index_name=settings.vector_search_index,
        columns=_INDEX_COLS,
        query_text=query,
        num_results=k,
    )
    if filters_json:
        kwargs["filters_json"] = filters_json

    try:
        result = w.vector_search_indexes.query_index(**kwargs)
    except Exception as exc:
        # Graceful fallback: if VS index is not ready, fall back to SQL text search
        err_msg = str(exc).lower()
        if "not ready" in err_msg or "not found" in err_msg or "syncing" in err_msg:
            from app.services.databricks_sql import query_facilities_by_text
            return query_facilities_by_text(query, k)
        raise VectorSearchError(str(exc)) from exc

    hits: list[FacilityHit] = []
    if not result or not result.result:
        return hits

    manifest = result.manifest
    data_array = result.result.data_array or []
    if not manifest or not manifest.columns:
        return hits

    col_names = [c.name for c in manifest.columns]
    for row_vals in data_array:
        data_row = dict(zip(col_names, row_vals))
        hits.append(_result_to_hit(data_row))

    return hits
