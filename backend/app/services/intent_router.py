"""Deterministic intent routing for Command and planner searches."""

import json
import re
from dataclasses import dataclass

from app.schemas import (
    FacilityFilters,
    IntentSearchResponse,
    PlaceResolution,
    RegionSummary,
)
from app.services.databricks_fm import chat_completion
from app.services.databricks_sql import (
    normalize_capability,
    query_facilities_by_capability,
    query_facilities_by_text,
    query_facilities_nearby,
    query_region_summary,
    query_review_needed_facilities,
    resolve_place,
)
from app.services.app_state import log_search_event

CAPABILITY_ALIASES: dict[str, str] = {
    "nicu": "has_nicu",
    "neonatal": "has_nicu",
    "icu": "has_icu",
    "intensive care": "has_icu",
    "dialysis": "has_dialysis",
    "oncology": "has_oncology",
    "cancer": "has_oncology",
    "maternity": "has_maternity",
    "maternal": "has_maternity",
    "trauma": "has_trauma",
    "emergency surgery": "has_emergency_surgery",
    "surgery": "has_emergency_surgery",
    "blood bank": "has_blood_bank",
    "anesthesia": "has_anesthesia",
    "anaesthesia": "has_anesthesia",
    "cath lab": "has_cardiac_cath_lab",
    "cardiac cath": "has_cardiac_cath_lab",
}

STATE_NAMES = [
    "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh",
    "delhi", "goa", "gujarat", "haryana", "himachal pradesh", "jharkhand",
    "karnataka", "kerala", "madhya pradesh", "maharashtra", "manipur",
    "meghalaya", "mizoram", "nagaland", "odisha", "punjab", "rajasthan",
    "sikkim", "tamil nadu", "telangana", "tripura", "uttar pradesh",
    "uttarakhand", "west bengal", "puducherry",
]

NEARBY_WORDS = {"near", "nearest", "nearby", "around", "from", "within", "closest"}
COVERAGE_WORDS = {"map", "coverage", "desert", "gap", "gaps", "where are"}
REVIEW_WORDS = {"needs review", "contradiction", "weak evidence", "verify", "review"}


@dataclass
class ParsedIntent:
    query: str
    intent: str
    capability: str | None
    place: str | None
    radius_km: float | None
    confidence: float
    reason: str

    def as_context(self) -> dict:
        return {
            "intent": self.intent,
            "intent_confidence": self.confidence,
            "routing_reason": self.reason,
            "capability": self.capability,
            "place": self.place,
            "radius_km": self.radius_km,
        }


def parse_intent(query: str) -> ParsedIntent:
    q = query.strip()
    ql = q.lower()
    capability = _extract_capability(ql)
    place = _extract_place(ql, capability)
    radius_km = _extract_radius_km(ql)
    has_nearby = any(word in ql for word in NEARBY_WORDS)
    has_coverage = any(word in ql for word in COVERAGE_WORDS)
    has_review = any(word in ql for word in REVIEW_WORDS)

    if has_review:
        return ParsedIntent(q, "review_needed_search", capability, place, radius_km, 0.88, "review language detected")
    if has_coverage:
        return ParsedIntent(q, "coverage_gap_search", capability, place, radius_km, 0.86, "coverage/gap language detected")
    if (has_nearby or " needs " in f" {ql} ") and place:
        return ParsedIntent(q, "nearby_facility_search", capability, place, radius_km or 100.0, 0.9, "nearby language and place detected")
    if capability:
        return ParsedIntent(q, "capability_search", capability, place, radius_km, 0.78, "capability language detected")
    return ParsedIntent(q, "text_search", None, place, radius_km, 0.45, "fallback text search")


async def route_intent_search(query: str, mode: str = "fast") -> IntentSearchResponse:
    parsed = parse_intent(query)
    if parsed.confidence < 0.5:
        parsed = await _llm_parse_fallback(parsed)

    origin: PlaceResolution | None = None
    if parsed.place:
        origin = resolve_place(parsed.place)

    results = []
    region_summary: RegionSummary | None = None
    capability = normalize_capability(parsed.capability) if parsed.capability else None

    if parsed.intent == "nearby_facility_search" and origin:
        filters = FacilityFilters(min_trust_score=60)
        results = query_facilities_nearby(
            lat=origin.latitude,
            lng=origin.longitude,
            radius_km=parsed.radius_km or 100.0,
            capability=capability,
            filters=filters,
            k=20,
        )
    elif parsed.intent == "coverage_gap_search":
        region = origin.state if origin and origin.state else parsed.place
        if region:
            region_summary = query_region_summary(region=region, capability=capability or "has_nicu")
            results = region_summary.top_facilities
        elif capability:
            results = query_facilities_by_capability([capability], k=20)
    elif parsed.intent == "review_needed_search":
        results = query_review_needed_facilities(capability=capability, state=origin.state if origin else None, k=20)
    elif capability:
        filters = FacilityFilters(state=origin.state if origin and origin.match_type.startswith("state") else None)
        results = query_facilities_by_capability([capability], filters=filters, k=20)
        if parsed.place and results:
            place_l = parsed.place.lower()
            results = [r for r in results if place_l in " ".join([r.city or "", r.state or "", r.pincode or ""]).lower()] or results
    if not results and parsed.query:
        results = query_facilities_by_text(parsed.query, k=20)

    evidence = _evidence_preview(results[:5])
    response = IntentSearchResponse(
        intent=parsed.intent,
        intent_confidence=parsed.confidence,
        routing_reason=parsed.reason,
        capability=capability,
        place=origin.label if origin else parsed.place,
        radius_km=parsed.radius_km,
        results=results,
        summary=_summary(parsed, results, region_summary),
        evidence=evidence,
        region_summary=region_summary,
    )
    log_search_event(
        event_type="intent_search",
        query=query,
        intent=response.intent,
        response_facilities=response.results,
        summary=response.summary,
        metadata={
            "capability": response.capability,
            "place": response.place,
            "radius_km": response.radius_km,
            "intent_confidence": response.intent_confidence,
            "routing_reason": response.routing_reason,
        },
    )
    return response


def _extract_capability(ql: str) -> str | None:
    for alias in sorted(CAPABILITY_ALIASES, key=len, reverse=True):
        if re.search(rf"\b{re.escape(alias)}\b", ql):
            return CAPABILITY_ALIASES[alias]
    return None


def _extract_radius_km(ql: str) -> float | None:
    km = re.search(r"within\s+(\d+(?:\.\d+)?)\s*(?:km|kilometers?)", ql)
    if km:
        return float(km.group(1))
    minutes = re.search(r"within\s+(\d+)\s*(?:min|mins|minutes?)", ql)
    if minutes:
        return min(500.0, max(10.0, float(minutes.group(1)) * 1.5))
    return None


def _extract_place(ql: str, capability: str | None) -> str | None:
    pin = re.search(r"\b\d{6}\b", ql)
    if pin:
        return pin.group(0)
    for state in STATE_NAMES:
        if re.search(rf"\b{re.escape(state)}\b", ql):
            return state.title()
    for marker in [" near ", " nearest ", " around ", " from ", " in ", " at "]:
        if marker not in f" {ql} ":
            continue
        tail = f" {ql} ".split(marker, 1)[1]
        tail = re.split(r"\b(?:within|with|for|that|who|which|and)\b", tail, maxsplit=1)[0]
        candidate = _clean_place_candidate(tail, capability)
        if candidate:
            return candidate
    cleaned = _clean_place_candidate(ql, capability)
    tokens = cleaned.split()
    return " ".join(tokens[-2:]).title() if len(tokens) >= 1 else None


def _clean_place_candidate(text: str, capability: str | None) -> str:
    cleaned = text
    for phrase in list(CAPABILITY_ALIASES) + list(NEARBY_WORDS) + list(COVERAGE_WORDS) + list(REVIEW_WORDS):
        cleaned = re.sub(rf"\b{re.escape(phrase)}\b", " ", cleaned)
    cleaned = re.sub(r"\b(?:find|show|map|facilities|facility|hospital|hospitals|claims|care|verified|high trust|trusted|mother|needs)\b", " ", cleaned)
    cleaned = re.sub(r"[^a-z0-9\s]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if capability:
        cleaned = cleaned.replace(capability.replace("has_", "").replace("_", " "), " ")
    return cleaned.title().strip()


async def _llm_parse_fallback(parsed: ParsedIntent) -> ParsedIntent:
    try:
        response = await chat_completion(messages=[
            {"role": "system", "content": "Return only compact JSON for healthcare search intent. Allowed intents: nearby_facility_search, coverage_gap_search, review_needed_search, capability_search, text_search. Capabilities must be has_nicu, has_icu, has_dialysis, has_oncology, has_maternity, has_trauma, has_emergency_surgery, has_blood_bank, has_anesthesia, has_cardiac_cath_lab, or null."},
            {"role": "user", "content": parsed.query},
        ])
        content = response["choices"][0]["message"].get("content") or "{}"
        data = json.loads(content.strip().strip("`"))
        return ParsedIntent(
            query=parsed.query,
            intent=str(data.get("intent") or parsed.intent),
            capability=normalize_capability(data.get("capability")) if data.get("capability") else parsed.capability,
            place=data.get("place") or parsed.place,
            radius_km=float(data["radius_km"]) if data.get("radius_km") else parsed.radius_km,
            confidence=float(data.get("intent_confidence") or 0.62),
            reason="Databricks model serving fallback parse",
        )
    except Exception:
        return parsed


def _evidence_preview(results) -> list[dict]:
    out: list[dict] = []
    for facility in results:
        caps = facility.capabilities
        if not caps:
            continue
        for key, value in caps.model_dump().items():
            if not key.startswith("has_") or not isinstance(value, dict) or not value.get("value"):
                continue
            out.append({
                "facility_id": facility.facility_id,
                "facility_name": facility.name,
                "capability": key,
                "source_quote": value.get("evidence_quote"),
                "confidence": value.get("confidence"),
            })
            break
    return out


def _summary(parsed: ParsedIntent, results, region_summary: RegionSummary | None) -> str:
    if region_summary:
        rate = round((region_summary.verification_rate or 0) * 100)
        return (
            f"{region_summary.region} has {region_summary.claimed_count} claimed "
            f"{region_summary.capability.replace('has_', '').replace('_', ' ')} records, "
            f"{region_summary.verified_count} verified ({rate}%)."
        )
    if not results:
        return f"No matching facilities found for {parsed.query}."
    top = results[0]
    distance = f" at {top.distance_km:.1f} km" if top.distance_km is not None else ""
    trust = top.trust_score if top.trust_score is not None else "unknown"
    return (
        f"Routed as {parsed.intent.replace('_', ' ')}. "
        f"Top match is {top.name}{distance} with trust score {trust}."
    )
