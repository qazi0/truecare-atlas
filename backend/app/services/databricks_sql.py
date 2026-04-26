"""Databricks SQL query helpers — all sync, intended to run in asyncio executor."""

import json
import math
import re
from typing import Any

_CTRL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")

from app.deps import get_sql_connection
from app.errors import DatabricksQueryError, FacilityNotFoundError
from app.schemas import (
    AggregateLevel,
    AggregateRow,
    AggregateRowWithCI,
    Capability,
    FacilityCapabilities,
    FacilityFilters,
    FacilityFull,
    FacilityHit,
    Severity,
    TrustFlag,
    TrustReport,
)

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_CAP_COLS = [
    "has_icu", "has_nicu", "has_dialysis", "has_oncology",
    "has_emergency_surgery", "has_24x7", "has_maternity",
    "has_blood_bank", "has_anesthesia", "has_trauma", "has_cardiac_cath_lab",
]

_RULE_META: dict[str, tuple[str, Severity, list[str]]] = {
    "r1_anesthesia_gap":        ("Claims advanced surgery but no anesthesia evidence",     Severity.RED,    ["has_emergency_surgery_detail", "has_anesthesia_detail"]),
    "r2_nicu_staffing_gap":     ("Claims NICU but no neonatologist/pediatrician evidence", Severity.RED,    ["has_nicu_detail"]),
    "r3_cancer_specialty_gap":  ("Claims oncology but no oncologist/chemo/radiation evidence", Severity.RED, ["has_oncology_detail"]),
    "r4_24x7_gap":              ("Claims 24/7 but no emergency dept evidence",             Severity.YELLOW, ["has_24x7_detail"]),
    "r5_bed_count_contradiction": ("Bed count in text contradicts capacity column (>25%)",  Severity.YELLOW, []),
    "r6_modality_contradiction": ("Traditional medicine description + allopathic specialty claims", Severity.RED, ["has_oncology_detail", "has_icu_detail", "has_emergency_surgery_detail"]),
    "r7_scrape_artifact_density": ("Equipment list >50% non-medical strings (photo/scrape artifacts)", Severity.YELLOW, []),
    "r8_evidence_sparsity":     ("Very sparse text — all claims unverifiable",             Severity.YELLOW, []),
}


def wilson_ci(n: int, k: int, z: float = 1.96) -> tuple[float, float]:
    """Wilson score interval for binomial proportion k/n at confidence z.
    Returns (lower, upper) as proportions in [0, 1]."""
    if n == 0:
        return (0.0, 0.0)
    p_hat = k / n
    denom = 1 + z * z / n
    center = p_hat + z * z / (2 * n)
    spread = z * math.sqrt((p_hat * (1 - p_hat) + z * z / (4 * n)) / n)
    lower = max(0.0, (center - spread) / denom)
    upper = min(1.0, (center + spread) / denom)
    return (round(lower, 4), round(upper, 4))


def _execute(sql: str, params: list | None = None) -> list[dict[str, Any]]:
    conn = get_sql_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(sql, params or [])
        cols = [d[0] for d in cursor.description]
        return [dict(zip(cols, row)) for row in cursor.fetchall()]
    except Exception as exc:
        raise DatabricksQueryError(str(exc)) from exc
    finally:
        cursor.close()


def _filters_clause(filters: FacilityFilters | None, alias: str = "t") -> tuple[str, list]:
    """Return (WHERE clause fragment, param list) for FacilityFilters."""
    clauses: list[str] = []
    params: list = []
    if not filters:
        return "", []
    if filters.state:
        clauses.append(f"{alias}.state_canon = ?")
        params.append(filters.state)
    if filters.pincode:
        clauses.append(f"{alias}.pincode = ?")
        params.append(filters.pincode)
    if filters.facility_type:
        clauses.append(f"{alias}.facility_type_id = ?")
        params.append(filters.facility_type)
    if filters.min_trust_score is not None:
        clauses.append(f"{alias}.trust_score >= ?")
        params.append(filters.min_trust_score)
    return (" AND " + " AND ".join(clauses)) if clauses else "", params


def _clean_str(s: str | None) -> str | None:
    return _CTRL_CHAR_RE.sub("", s) if s else s


def _row_to_capabilities(row: dict) -> FacilityCapabilities:
    """Build FacilityCapabilities from a gold_facility_trust row."""
    caps: dict[str, Capability] = {}
    for col in _CAP_COLS:
        detail_json = row.get(f"{col}_detail")
        evidence_quote: str | None = None
        if detail_json:
            try:
                detail = json.loads(detail_json) if isinstance(detail_json, str) else detail_json
                evidence_quote = detail.get("evidence_quote") if isinstance(detail, dict) else None
            except (json.JSONDecodeError, AttributeError):
                pass
        caps[col] = Capability(value=bool(row.get(col)), evidence_quote=evidence_quote)
    return FacilityCapabilities(
        capabilities_caption=_clean_str(row.get("capabilities_caption")) or "",
        **caps,
    )


def _row_to_facility_hit(row: dict, distance_km: float | None = None) -> FacilityHit:
    return FacilityHit(
        facility_id=row["facility_id"],
        name=_clean_str(row["name"]) or "",
        city=_clean_str(row.get("city")),
        state=_clean_str(row.get("state_canon")),
        pincode=row.get("pincode"),
        latitude=float(row["latitude"]) if row.get("latitude") is not None else None,
        longitude=float(row["longitude"]) if row.get("longitude") is not None else None,
        facility_type=row.get("facility_type_id"),
        trust_score=row.get("trust_score"),
        distance_km=distance_km,
        capabilities=_row_to_capabilities(row),
    )


def _extract_evidence(row: dict, detail_cols: list[str]) -> list[str]:
    """Pull evidence_quote strings from has_*_detail struct columns."""
    quotes: list[str] = []
    for col in detail_cols:
        detail = row.get(col)
        if not detail:
            continue
        if isinstance(detail, str):
            try:
                detail = json.loads(detail)
            except (json.JSONDecodeError, ValueError):
                continue
        if isinstance(detail, dict):
            quote = detail.get("evidence_quote")
            if quote:
                quotes.append(quote)
    return quotes


def _row_to_trust_report(row: dict) -> TrustReport:
    flags: list[TrustFlag] = []
    for col, (label, severity, detail_cols) in _RULE_META.items():
        if row.get(col):
            evidence = _extract_evidence(row, detail_cols)
            flags.append(TrustFlag(
                rule_id=col, severity=severity, label=label,
                evidence_quotes=evidence,
            ))
    return TrustReport(
        facility_id=row["facility_id"],
        score=row.get("trust_score") or 0,
        flags=flags,
    )


# ---------------------------------------------------------------------------
# Public query functions
# ---------------------------------------------------------------------------

def query_facilities_by_geo(
    lat: float,
    lng: float,
    radius_km: float,
    filters: FacilityFilters | None = None,
) -> list[FacilityHit]:
    """Haversine-bounded query against gold_facility_trust."""
    filter_clause, filter_params = _filters_clause(filters)
    sql = f"""
        SELECT
            t.*,
            (6371 * acos(
                cos(radians(?)) * cos(radians(t.latitude)) *
                cos(radians(t.longitude) - radians(?)) +
                sin(radians(?)) * sin(radians(t.latitude))
            )) AS distance_km
        FROM workspace.default.gold_facility_trust t
        WHERE
            t.latitude IS NOT NULL
            AND t.longitude IS NOT NULL
            AND (6371 * acos(
                cos(radians(?)) * cos(radians(t.latitude)) *
                cos(radians(t.longitude) - radians(?)) +
                sin(radians(?)) * sin(radians(t.latitude))
            )) <= ?
            {filter_clause}
        ORDER BY distance_km
        LIMIT 50
    """
    params = [lat, lng, lat, lat, lng, lat, radius_km] + filter_params
    rows = _execute(sql, params)
    return [_row_to_facility_hit(r, distance_km=r.get("distance_km")) for r in rows]


_CAP_ALIASES: dict[str, str] = {
    "icu": "has_icu", "nicu": "has_nicu", "dialysis": "has_dialysis",
    "oncology": "has_oncology", "emergency_surgery": "has_emergency_surgery",
    "24x7": "has_24x7", "maternity": "has_maternity", "blood_bank": "has_blood_bank",
    "anesthesia": "has_anesthesia", "trauma": "has_trauma",
    "cardiac_cath_lab": "has_cardiac_cath_lab",
}


def query_facilities_by_capability(
    flags: list[str],
    filters: FacilityFilters | None = None,
    k: int = 20,
) -> list[FacilityHit]:
    """Filter by boolean capability columns."""
    valid = set(_CAP_COLS)
    normalized = [_CAP_ALIASES.get(f.lower().replace(" ", "_"), f) for f in flags]
    safe_flags = [f for f in normalized if f in valid]
    if not safe_flags:
        return []
    flag_clauses = " AND ".join(f"t.{f} = TRUE" for f in safe_flags)
    filter_clause, filter_params = _filters_clause(filters)
    sql = f"""
        SELECT t.*
        FROM workspace.default.gold_facility_trust t
        WHERE {flag_clauses}
        {filter_clause}
        ORDER BY t.trust_score DESC
        LIMIT {int(k)}
    """
    rows = _execute(sql, filter_params)
    return [_row_to_facility_hit(r) for r in rows]


def query_facilities_by_text(query: str, k: int = 20) -> list[FacilityHit]:
    """Text search — splits query into words, each must match at least one column."""
    words = [w for w in query.split() if len(w) >= 2]
    if not words:
        return []
    searchable = "LOWER(CONCAT(COALESCE(t.name,''), ' ', COALESCE(t.city,''), ' ', COALESCE(t.state_canon,''), ' ', COALESCE(t.capabilities_caption,'')))"
    word_clauses = [f"{searchable} LIKE LOWER(CONCAT('%', ?, '%'))" for _ in words]
    sql = f"""
        SELECT t.*
        FROM workspace.default.gold_facility_trust t
        WHERE {' AND '.join(word_clauses)}
        ORDER BY t.trust_score DESC
        LIMIT {int(k)}
    """
    rows = _execute(sql, words)
    return [_row_to_facility_hit(r) for r in rows]


def query_facility_by_id(facility_id: str) -> FacilityFull:
    """Full facility record: gold_facility_trust JOIN silver_facility."""
    sql = """
        SELECT
            t.*,
            s.description,
            s.phone_numbers,
            s.address_line1,
            s.address_line2,
            s.address_line3,
            s.specialties,
            s.procedures,
            s.equipment,
            s.capabilities AS silver_capabilities
        FROM workspace.default.gold_facility_trust t
        LEFT JOIN workspace.default.silver_facility s
            ON t.facility_id = s.facility_id
        WHERE t.facility_id = ?
        LIMIT 1
    """
    rows = _execute(sql, [facility_id])
    if not rows:
        raise FacilityNotFoundError(facility_id)
    row = rows[0]
    hit = _row_to_facility_hit(row)
    trust_report = _row_to_trust_report(row)

    # Build address from silver parts
    addr_parts = [row.get("address_line1"), row.get("address_line2"), row.get("address_line3")]
    address = ", ".join(p for p in addr_parts if p)

    def _to_list(val: Any) -> list[str]:
        if val is None:
            return []
        if isinstance(val, list):
            return [str(x) for x in val if x]
        return []

    raw_desc = row.get("description")
    phone_raw = row.get("phone_numbers")
    if phone_raw is not None and hasattr(phone_raw, "__iter__") and not isinstance(phone_raw, str):
        phone = ", ".join(str(x) for x in phone_raw)
    else:
        phone = str(phone_raw) if phone_raw else None

    return FacilityFull(
        **hit.model_dump(),
        description=_clean_str(raw_desc),
        phone=phone,
        address=address or None,
        specialties=_to_list(row.get("specialties")),
        procedures=_to_list(row.get("procedures")),
        equipment=_to_list(row.get("equipment")),
        capability_text=_to_list(row.get("silver_capabilities")),
        trust_report=trust_report,
    )


def query_trust_report(facility_id: str) -> TrustReport:
    """Trust score + rule flags from gold_facility_trust."""
    sql = """
        SELECT *
        FROM workspace.default.gold_facility_trust
        WHERE facility_id = ?
        LIMIT 1
    """
    rows = _execute(sql, [facility_id])
    if not rows:
        raise FacilityNotFoundError(facility_id)
    return _row_to_trust_report(rows[0])


def query_aggregates(level: AggregateLevel, capability: str) -> list[AggregateRow]:
    """Read pre-computed rollups from gold_state_aggregates or gold_pincode_aggregates."""
    # Map capability name to claimed/verified column pairs
    cap_map = {
        "has_icu":               ("icu_claimed",               "icu_verified"),
        "has_nicu":              ("nicu_claimed",              "nicu_verified"),
        "has_dialysis":          ("dialysis_claimed",          "dialysis_verified"),
        "has_oncology":          ("oncology_claimed",          "oncology_verified"),
        "has_maternity":         ("maternity_claimed",         "maternity_verified"),
        "has_trauma":            ("trauma_claimed",            "trauma_verified"),
        "has_emergency_surgery": ("emergency_surgery_claimed", "emergency_surgery_claimed"),
        "has_24x7":              ("h24x7_claimed",             "h24x7_claimed"),
        "has_blood_bank":        ("blood_bank_claimed",        "blood_bank_claimed"),
        "has_cardiac_cath_lab":  ("cardiac_cath_lab_claimed",  "cardiac_cath_lab_claimed"),
    }
    claimed_col, verified_col = cap_map.get(capability, ("icu_claimed", "icu_verified"))

    if level == AggregateLevel.STATE:
        sql = f"""
            SELECT
                state_canon AS region_name,
                {claimed_col} AS claimed_count,
                {verified_col} AS verified_count
            FROM workspace.default.gold_state_aggregates
            ORDER BY claimed_count DESC
        """
        rows = _execute(sql)
        return [
            AggregateRow(
                region_name=r["region_name"],
                region_level=AggregateLevel.STATE,
                capability=capability,
                claimed_count=r["claimed_count"] or 0,
                verified_count=r["verified_count"] or 0,
            )
            for r in rows
        ]

    # Pincode level (district not in schema — fall back to pincode)
    sql = f"""
        SELECT
            pincode AS region_name,
            state_canon,
            city,
            {_pincode_col(capability)} AS claimed_count
        FROM workspace.default.gold_pincode_aggregates
        ORDER BY claimed_count DESC
        LIMIT 500
    """
    rows = _execute(sql)
    return [
        AggregateRow(
            region_name=r["region_name"],
            region_level=AggregateLevel.PINCODE,
            capability=capability,
            claimed_count=r["claimed_count"] or 0,
            # pincode table has no separate verified column
            verified_count=r["claimed_count"] or 0,
        )
        for r in rows
    ]


def query_aggregates_with_ci(
    level: AggregateLevel, capability: str
) -> list[AggregateRowWithCI]:
    """Aggregates enriched with Wilson score confidence intervals on verification rate."""
    base_rows = query_aggregates(level=level, capability=capability)
    result: list[AggregateRowWithCI] = []
    for r in base_rows:
        claimed = r.claimed_count
        verified = r.verified_count
        rate = round(verified / claimed, 4) if claimed > 0 else 0.0
        ci_low, ci_high = wilson_ci(n=claimed, k=verified)
        result.append(AggregateRowWithCI(
            region_name=r.region_name,
            region_level=r.region_level,
            capability=r.capability,
            claimed_count=claimed,
            verified_count=verified,
            population=r.population,
            per_100k=r.per_100k,
            verification_rate=rate,
            ci_lower=ci_low,
            ci_upper=ci_high,
        ))
    return result


def query_facilities_for_export(facility_ids: list[str]) -> list[dict]:
    """Fetch full facility data for CSV/JSON export. Joins gold trust + silver."""
    if not facility_ids:
        return []
    placeholders = ", ".join("?" for _ in facility_ids)
    sql = f"""
        SELECT
            t.facility_id, t.name, t.city, t.state_canon, t.pincode,
            t.latitude, t.longitude, t.facility_type_id,
            t.trust_score, t.trust_score_bucket,
            t.has_icu, t.has_nicu, t.has_dialysis, t.has_oncology,
            t.has_emergency_surgery, t.has_24x7, t.has_maternity,
            t.has_blood_bank, t.has_anesthesia, t.has_trauma, t.has_cardiac_cath_lab,
            t.capabilities_caption, t.flag_count,
            t.r1_anesthesia_gap, t.r2_nicu_staffing_gap, t.r3_cancer_specialty_gap,
            t.r4_24x7_gap, t.r5_bed_count_contradiction, t.r6_modality_contradiction,
            t.r7_scrape_artifact_density, t.r8_evidence_sparsity,
            s.description, s.phone_numbers,
            s.address_line1, s.address_line2, s.address_line3,
            s.specialties
        FROM workspace.default.gold_facility_trust t
        LEFT JOIN workspace.default.silver_facility s
            ON t.facility_id = s.facility_id
        WHERE t.facility_id IN ({placeholders})
    """
    return _execute(sql, facility_ids)


def query_map_facilities() -> list[dict]:
    """Lightweight facility list for map markers — only id, name, lat/lng, trust, type."""
    sql = """
        SELECT facility_id, name, latitude, longitude, trust_score,
               trust_score_bucket, facility_type_id, state_canon, city
        FROM workspace.default.gold_facility_trust
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    """
    rows = _execute(sql, [])
    return [
        {
            "facility_id": r["facility_id"],
            "name": _clean_str(r["name"]) or "",
            "lat": float(r["latitude"]),
            "lng": float(r["longitude"]),
            "trust_score": r.get("trust_score"),
            "trust_bucket": r.get("trust_score_bucket", "unknown"),
            "type": r.get("facility_type_id"),
            "state": _clean_str(r.get("state_canon")),
            "city": _clean_str(r.get("city")),
        }
        for r in rows
        if r.get("latitude") is not None and r.get("longitude") is not None
    ]


def _pincode_col(capability: str) -> str:
    """Map capability name to gold_pincode_aggregates count column."""
    mapping = {
        "has_icu":               "icu_count",
        "has_nicu":              "nicu_count",
        "has_dialysis":          "dialysis_count",
        "has_oncology":          "oncology_count",
        "has_maternity":         "maternity_count",
        "has_trauma":            "trauma_count",
        "has_emergency_surgery": "emergency_surgery_count",
        "has_24x7":              "h24x7_count",
        "has_blood_bank":        "blood_bank_count",
        "has_cardiac_cath_lab":  "cardiac_cath_lab_count",
    }
    return mapping.get(capability, "icu_count")
