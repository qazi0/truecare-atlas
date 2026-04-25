"""Databricks SQL query helpers — all sync, intended to run in asyncio executor."""

import json
from typing import Any

from app.deps import get_sql_connection
from app.errors import DatabricksQueryError, FacilityNotFoundError
from app.schemas import (
    AggregateLevel,
    AggregateRow,
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

_RULE_LABELS: dict[str, tuple[str, Severity]] = {
    "r1_anesthesia_gap":        ("Claims advanced surgery but no anesthesia evidence",     Severity.RED),
    "r2_nicu_staffing_gap":     ("Claims NICU but no neonatologist/pediatrician evidence", Severity.RED),
    "r3_cancer_specialty_gap":  ("Claims oncology but no oncologist/chemo/radiation evidence", Severity.RED),
    "r4_24x7_gap":              ("Claims 24/7 but no emergency dept evidence",             Severity.YELLOW),
    "r5_bed_count_contradiction": ("Bed count in text contradicts capacity column (>25%)",  Severity.YELLOW),
    "r6_modality_contradiction": ("Traditional medicine description + allopathic specialty claims", Severity.RED),
    "r7_scrape_artifact_density": ("Equipment list >50% non-medical strings (photo/scrape artifacts)", Severity.YELLOW),
    "r8_evidence_sparsity":     ("Very sparse text — all claims unverifiable",             Severity.YELLOW),
}


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
        capabilities_caption=row.get("capabilities_caption") or "",
        **caps,
    )


def _row_to_facility_hit(row: dict, distance_km: float | None = None) -> FacilityHit:
    return FacilityHit(
        facility_id=row["facility_id"],
        name=row["name"],
        city=row.get("city"),
        state=row.get("state_canon"),
        pincode=row.get("pincode"),
        latitude=float(row["latitude"]) if row.get("latitude") is not None else None,
        longitude=float(row["longitude"]) if row.get("longitude") is not None else None,
        facility_type=row.get("facility_type_id"),
        trust_score=row.get("trust_score"),
        distance_km=distance_km,
        capabilities=_row_to_capabilities(row),
    )


def _row_to_trust_report(row: dict) -> TrustReport:
    flags: list[TrustFlag] = []
    for col, (label, severity) in _RULE_LABELS.items():
        if row.get(col):
            flags.append(TrustFlag(rule_id=col, severity=severity, label=label))
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


def query_facilities_by_capability(
    flags: list[str],
    filters: FacilityFilters | None = None,
    k: int = 20,
) -> list[FacilityHit]:
    """Filter by boolean capability columns."""
    # Validate flags to prevent SQL injection — only allow known cap columns
    valid = set(_CAP_COLS)
    safe_flags = [f for f in flags if f in valid]
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

    return FacilityFull(
        **hit.model_dump(),
        description=row.get("description"),
        phone=", ".join(str(x) for x in row["phone_numbers"]) if row.get("phone_numbers") is not None and hasattr(row["phone_numbers"], '__iter__') and not isinstance(row["phone_numbers"], str) else row.get("phone_numbers"),
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
