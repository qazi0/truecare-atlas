"""GET /api/search-nearby — direct geo/place search without the agent loop."""

from fastapi import APIRouter, HTTPException, Query

from app.schemas import FacilityFilters, NearbySearchResponse, PlaceResolution
from app.services.databricks_sql import query_facilities_nearby, resolve_place

router = APIRouter(tags=["nearby"])


@router.get("/search-nearby", response_model=NearbySearchResponse)
def search_nearby(
    place: str | None = Query(default=None, description="City, state, or pincode to resolve"),
    lat: float | None = Query(default=None, description="Latitude if place is not provided"),
    lng: float | None = Query(default=None, description="Longitude if place is not provided"),
    radius_km: float = Query(default=50.0, ge=1.0, le=500.0),
    capability: str | None = Query(default=None, description="Capability flag or alias, e.g. has_nicu or nicu"),
    state: str | None = Query(default=None),
    pincode: str | None = Query(default=None),
    facility_type: str | None = Query(default=None),
    min_trust_score: int | None = Query(default=None, ge=0, le=100),
    k: int = Query(default=20, ge=1, le=100),
) -> NearbySearchResponse:
    origin: PlaceResolution | None
    if place:
        origin = resolve_place(place)
        if origin is None:
            raise HTTPException(status_code=404, detail=f"Could not resolve place: {place}")
        if state is None and origin.state:
            state = origin.state
        if pincode is None and origin.pincode:
            pincode = origin.pincode
    elif lat is not None and lng is not None:
        origin = PlaceResolution(
            query=f"{lat},{lng}",
            match_type="coordinates",
            label="Custom coordinates",
            latitude=lat,
            longitude=lng,
            facility_count=0,
        )
    else:
        raise HTTPException(status_code=400, detail="Provide either place or both lat and lng")

    filters = FacilityFilters(
        state=state,
        pincode=pincode,
        facility_type=facility_type,
        min_trust_score=min_trust_score,
    )
    facilities = query_facilities_nearby(
        lat=origin.latitude,
        lng=origin.longitude,
        radius_km=radius_km,
        capability=capability,
        filters=filters,
        k=k,
    )
    return NearbySearchResponse(
        origin=origin,
        radius_km=radius_km,
        capability=capability,
        facilities=facilities,
    )
