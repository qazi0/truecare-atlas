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
    Confidence,
    EvidenceClaim,
    FacilityCapabilities,
    FacilityFilters,
    FacilityFull,
    FacilityHit,
    PlaceResolution,
    RegionSummary,
    Severity,
    SourceField,
    TrustFlag,
    TrustReport,
)
from app.settings import settings

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
        source_field: SourceField | None = None
        confidence = Confidence.LOW
        if detail_json:
            try:
                detail = json.loads(detail_json) if isinstance(detail_json, str) else detail_json
                if isinstance(detail, dict):
                    evidence_quote = detail.get("evidence_quote")
                    raw_source = detail.get("source_field") or detail.get("source")
                    if isinstance(raw_source, str):
                        normalized = raw_source.lower().replace(" ", "_")
                        if normalized in SourceField._value2member_map_:
                            source_field = SourceField(normalized)
                        elif normalized in {"services", "services_offered", "department_list", "infrastructure"}:
                            source_field = SourceField.CAPABILITY
                    raw_conf = detail.get("confidence")
                    if isinstance(raw_conf, str) and raw_conf.lower() in Confidence._value2member_map_:
                        confidence = Confidence(raw_conf.lower())
                    elif isinstance(raw_conf, (int, float)):
                        confidence = (
                            Confidence.HIGH if raw_conf >= 0.8
                            else Confidence.MEDIUM if raw_conf >= 0.5
                            else Confidence.LOW
                        )
            except (json.JSONDecodeError, AttributeError):
                pass
        caps[col] = Capability(
            value=bool(row.get(col)),
            evidence_quote=evidence_quote,
            source_field=source_field,
            confidence=confidence,
        )
    return FacilityCapabilities(
        capabilities_caption=_clean_str(row.get("capabilities_caption")) or "",
        **caps,
    )


def _trust_status(row: dict) -> str:
    if row.get("r6_modality_contradiction"):
        return "Contradiction"
    flag_count = int(row.get("flag_count") or 0)
    score = row.get("trust_score")
    if flag_count > 0:
        return "Needs review"
    if score is not None and int(score) < 60:
        return "Evidence weak"
    return "Verified"


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
        flag_count=int(row.get("flag_count") or 0),
        has_contradiction=bool(row.get("r6_modality_contradiction")),
        trust_status=_trust_status(row),
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


def resolve_place(place: str) -> PlaceResolution | None:
    """Resolve a pincode/city/state to a centroid using the facility table itself."""
    q = place.strip()
    if not q:
        return None
    q_lower = q.lower()

    attempts: list[tuple[str, str, list]] = []
    if q.isdigit():
        attempts.append((
            "pincode",
            """
                SELECT pincode, city, state_canon, AVG(latitude) AS latitude,
                       AVG(longitude) AS longitude, COUNT(*) AS facility_count
                FROM workspace.default.gold_facility_trust
                WHERE pincode = ? AND latitude IS NOT NULL AND longitude IS NOT NULL
                GROUP BY pincode, city, state_canon
                ORDER BY facility_count DESC
                LIMIT 1
            """,
            [q],
        ))

    attempts.extend([
        (
            "city",
            """
                SELECT city, state_canon, AVG(latitude) AS latitude,
                       AVG(longitude) AS longitude, COUNT(*) AS facility_count
                FROM workspace.default.gold_facility_trust
                WHERE LOWER(city) = ? AND latitude IS NOT NULL AND longitude IS NOT NULL
                GROUP BY city, state_canon
                ORDER BY facility_count DESC
                LIMIT 1
            """,
            [q_lower],
        ),
        (
            "state",
            """
                SELECT state_canon, AVG(latitude) AS latitude,
                       AVG(longitude) AS longitude, COUNT(*) AS facility_count
                FROM workspace.default.gold_facility_trust
                WHERE LOWER(state_canon) = ? AND latitude IS NOT NULL AND longitude IS NOT NULL
                GROUP BY state_canon
                ORDER BY facility_count DESC
                LIMIT 1
            """,
            [q_lower],
        ),
        (
            "city_partial",
            """
                SELECT city, state_canon, AVG(latitude) AS latitude,
                       AVG(longitude) AS longitude, COUNT(*) AS facility_count
                FROM workspace.default.gold_facility_trust
                WHERE LOWER(city) LIKE ? AND latitude IS NOT NULL AND longitude IS NOT NULL
                GROUP BY city, state_canon
                ORDER BY facility_count DESC
                LIMIT 1
            """,
            [f"%{q_lower}%"],
        ),
        (
            "state_partial",
            """
                SELECT state_canon, AVG(latitude) AS latitude,
                       AVG(longitude) AS longitude, COUNT(*) AS facility_count
                FROM workspace.default.gold_facility_trust
                WHERE LOWER(state_canon) LIKE ? AND latitude IS NOT NULL AND longitude IS NOT NULL
                GROUP BY state_canon
                ORDER BY facility_count DESC
                LIMIT 1
            """,
            [f"%{q_lower}%"],
        ),
    ])

    for match_type, sql, params in attempts:
        rows = _execute(sql, params)
        if not rows:
            continue
        r = rows[0]
        city = _clean_str(r.get("city"))
        state = _clean_str(r.get("state_canon"))
        pincode = r.get("pincode")
        label_parts = [p for p in [city, state, pincode] if p]
        label = ", ".join(label_parts) if label_parts else q
        return PlaceResolution(
            query=q,
            match_type=match_type,
            label=label,
            latitude=float(r["latitude"]),
            longitude=float(r["longitude"]),
            facility_count=int(r.get("facility_count") or 0),
            city=city,
            state=state,
            pincode=pincode,
        )

    return None


def query_facilities_nearby(
    lat: float,
    lng: float,
    radius_km: float,
    capability: str | None = None,
    filters: FacilityFilters | None = None,
    k: int = 20,
) -> list[FacilityHit]:
    """Nearby facility search with optional capability and standard filters."""
    safe_capability = None
    if capability:
        normalized = _CAP_ALIASES.get(capability.lower().replace(" ", "_"), capability)
        if normalized in _CAP_COLS:
            safe_capability = normalized

    cap_clause = f" AND t.{safe_capability} = TRUE" if safe_capability else ""
    filter_clause, filter_params = _filters_clause(filters)
    distance_expr = """
        (6371 * acos(LEAST(1, GREATEST(-1,
            cos(radians(?)) * cos(radians(t.latitude)) *
            cos(radians(t.longitude) - radians(?)) +
            sin(radians(?)) * sin(radians(t.latitude))
        ))))
    """
    sql = f"""
        SELECT t.*, {distance_expr} AS distance_km
        FROM workspace.default.gold_facility_trust t
        WHERE
            t.latitude IS NOT NULL
            AND t.longitude IS NOT NULL
            AND {distance_expr} <= ?
            {cap_clause}
            {filter_clause}
        ORDER BY distance_km ASC, t.trust_score DESC
        LIMIT {int(k)}
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


def normalize_capability(value: str | None) -> str | None:
    if not value:
        return None
    normalized = _CAP_ALIASES.get(value.lower().replace(" ", "_"), value)
    return normalized if normalized in _CAP_COLS else None


def query_facilities_by_capability(
    flags: list[str],
    filters: FacilityFilters | None = None,
    k: int = 20,
) -> list[FacilityHit]:
    """Filter by boolean capability columns."""
    valid = set(_CAP_COLS)
    normalized = [normalize_capability(f) for f in flags]
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


def query_raw_record(facility_id: str) -> dict:
    sql = """
        SELECT *
        FROM workspace.default.silver_facility
        WHERE facility_id = ?
        LIMIT 1
    """
    rows = _execute(sql, [facility_id])
    if not rows:
        raise FacilityNotFoundError(facility_id)
    return _json_safe(rows[0])


def query_evidence_claims_for_facility(facility_id: str) -> list[EvidenceClaim]:
    sql = """
        SELECT
            t.*,
            s.description,
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
    return _row_to_evidence_claims(rows[0])


def query_evidence_claim(claim_id: str) -> EvidenceClaim:
    parts = claim_id.split("__", 1)
    if len(parts) != 2:
        raise FacilityNotFoundError(claim_id)
    for claim in query_evidence_claims_for_facility(parts[0]):
        if claim.claim_id == claim_id:
            return claim
    raise FacilityNotFoundError(claim_id)


def _row_to_evidence_claims(row: dict) -> list[EvidenceClaim]:
    raw_record = {
        "name": _clean_str(row.get("name")),
        "description": _clean_str(row.get("description")),
        "specialties": _json_safe(row.get("specialties")),
        "procedures": _json_safe(row.get("procedures")),
        "equipment": _json_safe(row.get("equipment")),
        "capabilities": _json_safe(row.get("silver_capabilities")),
    }
    flags = _row_to_trust_report(row).flags
    claims: list[EvidenceClaim] = []
    for col in _CAP_COLS:
        detail = _detail_to_dict(row.get(f"{col}_detail"))
        quote = _clean_str(detail.get("evidence_quote")) if detail else None
        value = bool(row.get(col))
        if not value and not quote:
            continue
        rule_ids = [
            flag.rule_id for flag in flags
            if quote and quote in flag.evidence_quotes
        ]
        raw_source = detail.get("source_field") or detail.get("source") if detail else None
        confidence = str(detail.get("confidence") or "low") if detail else "low"
        claims.append(EvidenceClaim(
            claim_id=f"{row['facility_id']}__{col}",
            facility_id=row["facility_id"],
            capability=col,
            claim=f"Facility has {col.replace('has_', '').replace('_', ' ')}",
            decision="verified" if value and quote else "claimed",
            source_field=str(raw_source) if raw_source else None,
            source_quote=quote,
            raw_record=raw_record,
            trust_rule_ids=rule_ids,
            confidence=confidence,
            model_version=settings.extraction_model,
            created_at=str(row.get("created_at") or ""),
            evidence_against=[
                q for flag in flags for q in flag.evidence_quotes
                if quote is None or q != quote
            ][:4],
        ))
    return claims


def _detail_to_dict(detail: Any) -> dict:
    if not detail:
        return {}
    if isinstance(detail, dict):
        return detail
    if isinstance(detail, str):
        try:
            parsed = json.loads(detail)
            return parsed if isinstance(parsed, dict) else {}
        except (json.JSONDecodeError, ValueError):
            return {}
    return {}


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [_json_safe(item) for item in value]
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    return str(value)


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


def query_map_facilities(
    capability: str | None = None,
    verified_only: bool = False,
    show_review_needed: bool = True,
) -> list[dict]:
    """Lightweight facility list for map markers — only id, name, lat/lng, trust, type."""
    normalized = None
    if capability:
        normalized = _CAP_ALIASES.get(capability.lower().replace(" ", "_"), capability)
        if normalized not in _CAP_COLS:
            normalized = None
    clauses = ["latitude IS NOT NULL", "longitude IS NOT NULL"]
    if normalized:
        clauses.append(f"{normalized} = TRUE")
    if verified_only:
        clauses.append("trust_score >= 80")
        clauses.append("COALESCE(flag_count, 0) = 0")
        clauses.append("COALESCE(r6_modality_contradiction, FALSE) = FALSE")
    if not show_review_needed:
        clauses.append("COALESCE(flag_count, 0) = 0")
        clauses.append("trust_score >= 60")
    sql = f"""
        SELECT facility_id, name, latitude, longitude, trust_score,
               trust_score_bucket, facility_type_id, state_canon, city,
               flag_count, r6_modality_contradiction
        FROM workspace.default.gold_facility_trust
        WHERE {" AND ".join(clauses)}
        ORDER BY trust_score DESC
        LIMIT 10000
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
            "flag_count": int(r.get("flag_count") or 0),
            "has_contradiction": bool(r.get("r6_modality_contradiction")),
            "trust_status": _trust_status(r),
        }
        for r in rows
        if r.get("latitude") is not None and r.get("longitude") is not None
    ]


def query_region_summary(region: str, capability: str = "has_nicu") -> RegionSummary:
    """Capability summary for one state/region plus top matching facilities."""
    normalized = _CAP_ALIASES.get(capability.lower().replace(" ", "_"), capability)
    if normalized not in _CAP_COLS:
        normalized = "has_nicu"
    rows = _execute(
        f"""
        SELECT
            COUNT(*) AS claimed_count,
            SUM(CASE WHEN trust_score >= 80 AND COALESCE(flag_count, 0) = 0 THEN 1 ELSE 0 END) AS verified_count,
            SUM(CASE WHEN COALESCE(flag_count, 0) > 0 OR trust_score < 80 THEN 1 ELSE 0 END) AS needs_review_count,
            SUM(CASE WHEN COALESCE(r6_modality_contradiction, FALSE) THEN 1 ELSE 0 END) AS contradiction_count
        FROM workspace.default.gold_facility_trust
        WHERE state_canon = ? AND {normalized} = TRUE
        """,
        [region],
    )
    stats = rows[0] if rows else {}
    claimed = int(stats.get("claimed_count") or 0)
    verified = int(stats.get("verified_count") or 0)
    ci_low, ci_high = wilson_ci(n=claimed, k=verified)
    top_rows = _execute(
        f"""
        SELECT *
        FROM workspace.default.gold_facility_trust
        WHERE state_canon = ? AND {normalized} = TRUE
        ORDER BY trust_score DESC, COALESCE(flag_count, 0) ASC
        LIMIT 5
        """,
        [region],
    )
    return RegionSummary(
        region=region,
        capability=normalized,
        claimed_count=claimed,
        verified_count=verified,
        needs_review_count=int(stats.get("needs_review_count") or 0),
        contradiction_count=int(stats.get("contradiction_count") or 0),
        ci_lower=ci_low,
        ci_upper=ci_high,
        verification_rate=round(verified / claimed, 4) if claimed else 0.0,
        top_facilities=[_row_to_facility_hit(r) for r in top_rows],
    )


def query_generated_review_candidates(limit: int = 50) -> list[dict]:
    """Deterministic review candidates derived from trust flags."""
    sql = f"""
        SELECT *
        FROM workspace.default.gold_facility_trust
        WHERE COALESCE(flag_count, 0) > 0 OR COALESCE(r6_modality_contradiction, FALSE)
        ORDER BY COALESCE(r6_modality_contradiction, FALSE) DESC, flag_count DESC, trust_score ASC
        LIMIT {int(limit)}
    """
    rows = _execute(sql, [])
    candidates: list[dict] = []
    for row in rows:
        report = _row_to_trust_report(row)
        flags = report.flags or [
            TrustFlag(
                rule_id="review_needed",
                severity=Severity.YELLOW,
                label="Facility has trust flags requiring review",
                evidence_quotes=[],
            )
        ]
        for flag in flags[:2]:
            candidates.append({
                "id": f"gen_{row['facility_id']}_{flag.rule_id}",
                "facility_id": row["facility_id"],
                "facility_name": _clean_str(row.get("name")),
                "capability": None,
                "claim": flag.label,
                "reason": flag.label,
                "severity": flag.severity,
                "evidence_for": flag.evidence_quotes[:1],
                "evidence_against": flag.evidence_quotes[1:] or [flag.label],
                "source": "generated",
            })
    return candidates


def query_review_needed_facilities(
    capability: str | None = None,
    state: str | None = None,
    k: int = 20,
) -> list[FacilityHit]:
    normalized = normalize_capability(capability)
    clauses = ["(COALESCE(flag_count, 0) > 0 OR COALESCE(r6_modality_contradiction, FALSE) OR trust_score < 80)"]
    params: list = []
    if normalized:
        clauses.append(f"{normalized} = TRUE")
    if state:
        clauses.append("state_canon = ?")
        params.append(state)
    sql = f"""
        SELECT *
        FROM workspace.default.gold_facility_trust
        WHERE {" AND ".join(clauses)}
        ORDER BY COALESCE(r6_modality_contradiction, FALSE) DESC, flag_count DESC, trust_score ASC
        LIMIT {int(k)}
    """
    rows = _execute(sql, params)
    return [_row_to_facility_hit(r) for r in rows]


def query_data_health_metrics() -> dict:
    """Small set of counts for the Data Health / Governance screen."""
    metrics: dict[str, Any] = {}

    table_rows = _execute("""
        SELECT 'silver_facility' AS table_name, COUNT(*) AS row_count
        FROM workspace.default.silver_facility
        UNION ALL
        SELECT 'gold_facility_capabilities' AS table_name, COUNT(*) AS row_count
        FROM workspace.default.gold_facility_capabilities
        UNION ALL
        SELECT 'gold_facility_trust' AS table_name, COUNT(*) AS row_count
        FROM workspace.default.gold_facility_trust
        UNION ALL
        SELECT 'gold_state_aggregates' AS table_name, COUNT(*) AS row_count
        FROM workspace.default.gold_state_aggregates
    """)
    metrics["tables"] = {
        r["table_name"]: int(r["row_count"] or 0)
        for r in table_rows
    }

    trust_rows = _execute("""
        SELECT
            COUNT(*) AS total_facilities,
            AVG(trust_score) AS avg_trust_score,
            SUM(CASE WHEN trust_score >= 80 AND COALESCE(flag_count, 0) = 0 THEN 1 ELSE 0 END) AS high_trust,
            SUM(CASE WHEN trust_score >= 50 AND trust_score < 80 THEN 1 ELSE 0 END) AS medium_trust,
            SUM(CASE WHEN trust_score < 50 THEN 1 ELSE 0 END) AS low_trust,
            SUM(CASE WHEN flag_count > 0 THEN 1 ELSE 0 END) AS review_needed,
            SUM(CASE WHEN r6_modality_contradiction THEN 1 ELSE 0 END) AS contradictions
        FROM workspace.default.gold_facility_trust
    """)
    if trust_rows:
        r = trust_rows[0]
        metrics["trust"] = {
            "total_facilities": int(r.get("total_facilities") or 0),
            "avg_trust_score": round(float(r.get("avg_trust_score") or 0), 2),
            "high_trust": int(r.get("high_trust") or 0),
            "medium_trust": int(r.get("medium_trust") or 0),
            "low_trust": int(r.get("low_trust") or 0),
            "review_needed": int(r.get("review_needed") or 0),
            "contradictions": int(r.get("contradictions") or 0),
        }

    cap_rows = _execute("""
        SELECT
            SUM(CASE WHEN has_icu THEN 1 ELSE 0 END) AS has_icu,
            SUM(CASE WHEN has_nicu THEN 1 ELSE 0 END) AS has_nicu,
            SUM(CASE WHEN has_dialysis THEN 1 ELSE 0 END) AS has_dialysis,
            SUM(CASE WHEN has_oncology THEN 1 ELSE 0 END) AS has_oncology,
            SUM(CASE WHEN has_emergency_surgery THEN 1 ELSE 0 END) AS has_emergency_surgery,
            SUM(CASE WHEN has_24x7 THEN 1 ELSE 0 END) AS has_24x7,
            SUM(CASE WHEN has_maternity THEN 1 ELSE 0 END) AS has_maternity,
            SUM(CASE WHEN has_blood_bank THEN 1 ELSE 0 END) AS has_blood_bank,
            SUM(CASE WHEN has_anesthesia THEN 1 ELSE 0 END) AS has_anesthesia,
            SUM(CASE WHEN has_trauma THEN 1 ELSE 0 END) AS has_trauma,
            SUM(CASE WHEN has_cardiac_cath_lab THEN 1 ELSE 0 END) AS has_cardiac_cath_lab
        FROM workspace.default.gold_facility_trust
    """)
    if cap_rows:
        metrics["capabilities"] = {
            k: int(v or 0)
            for k, v in cap_rows[0].items()
        }

    return metrics


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
