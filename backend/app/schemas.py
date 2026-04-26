from enum import StrEnum
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class Confidence(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class SourceField(StrEnum):
    DESCRIPTION = "description"
    CAPABILITY = "capability"
    PROCEDURE = "procedure"
    EQUIPMENT = "equipment"
    SPECIALTIES = "specialties"
    MULTIPLE = "multiple"


class Severity(StrEnum):
    RED = "red"
    YELLOW = "yellow"
    GREEN = "green"


class AggregateLevel(StrEnum):
    STATE = "state"
    DISTRICT = "district"
    PINCODE = "pincode"


class SSEEventType(StrEnum):
    STEP = "step"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    REASONING = "reasoning"
    RESULT = "result"
    ERROR = "error"
    DONE = "done"


# ---------------------------------------------------------------------------
# Domain models
# ---------------------------------------------------------------------------

class Capability(BaseModel):
    value: bool
    evidence_quote: str | None = None
    source_field: SourceField | None = None
    confidence: Confidence = Confidence.LOW


class FacilityCapabilities(BaseModel):
    has_icu: Capability = Capability(value=False)
    has_nicu: Capability = Capability(value=False)
    has_dialysis: Capability = Capability(value=False)
    has_oncology: Capability = Capability(value=False)
    has_emergency_surgery: Capability = Capability(value=False)
    has_24x7: Capability = Capability(value=False)
    has_maternity: Capability = Capability(value=False)
    has_blood_bank: Capability = Capability(value=False)
    has_anesthesia: Capability = Capability(value=False)
    has_trauma: Capability = Capability(value=False)
    has_cardiac_cath_lab: Capability = Capability(value=False)
    capabilities_caption: str = ""


class TrustFlag(BaseModel):
    rule_id: str
    severity: Severity
    label: str
    evidence_quotes: list[str] = []


class TrustReport(BaseModel):
    facility_id: str
    score: int
    flags: list[TrustFlag] = []


class FacilityHit(BaseModel):
    facility_id: str
    name: str
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    facility_type: str | None = None
    trust_score: int | None = None
    distance_km: float | None = None
    capabilities: FacilityCapabilities | None = None
    flag_count: int | None = None
    has_contradiction: bool | None = None
    trust_status: str | None = None


class FacilityFull(FacilityHit):
    description: str | None = None
    phone: str | None = None
    address: str | None = None
    specialties: list[str] = []
    procedures: list[str] = []
    equipment: list[str] = []
    capability_text: list[str] = []
    trust_report: TrustReport | None = None


class SSEEvent(BaseModel):
    type: SSEEventType
    payload: dict


# ---------------------------------------------------------------------------
# Tool input schemas (§3.2)
# ---------------------------------------------------------------------------

class FacilityFilters(BaseModel):
    state: str | None = None
    district: str | None = None
    pincode: str | None = None
    facility_type: str | None = None
    min_trust_score: int | None = None


class GeoSearchInput(BaseModel):
    lat: float
    lng: float
    radius_km: float = 30.0
    filters: FacilityFilters | None = None


class VectorSearchInput(BaseModel):
    query: str
    filters: FacilityFilters | None = None
    k: int = 20


class CapabilityFilterInput(BaseModel):
    flags: list[str]  # e.g. ["has_icu", "has_nicu", "has_oncology", "has_trauma"]
    filters: FacilityFilters | None = None
    k: int = 20


class GetFacilityInput(BaseModel):
    facility_id: str


class AuditTrustInput(BaseModel):
    facility_id: str


class AggregateByInput(BaseModel):
    level: AggregateLevel
    capability: str  # e.g. "has_nicu"


class PlaceResolution(BaseModel):
    query: str
    match_type: str
    label: str
    latitude: float
    longitude: float
    facility_count: int
    city: str | None = None
    state: str | None = None
    pincode: str | None = None


class NearbySearchResponse(BaseModel):
    origin: PlaceResolution
    radius_km: float
    capability: str | None = None
    facilities: list[FacilityHit]


# ---------------------------------------------------------------------------
# Tool output / API response schemas (§3.3)
# ---------------------------------------------------------------------------

class AggregateRow(BaseModel):
    region_name: str
    region_level: AggregateLevel
    capability: str
    claimed_count: int
    verified_count: int
    population: int | None = None
    per_100k: float | None = None


class SearchRequest(BaseModel):
    query: str
    session_id: str | None = None


class SearchResult(BaseModel):
    facilities: list[FacilityHit]
    summary: str
    trace_id: str | None = None


class MapAggregateParams(BaseModel):
    capability: str = "has_nicu"
    level: AggregateLevel = AggregateLevel.STATE


# ---------------------------------------------------------------------------
# F7: Confidence intervals on aggregates
# ---------------------------------------------------------------------------

class AggregateRowWithCI(AggregateRow):
    ci_lower: float | None = None
    ci_upper: float | None = None
    verification_rate: float | None = None


class RegionSummary(BaseModel):
    region: str
    capability: str
    claimed_count: int
    verified_count: int
    needs_review_count: int
    contradiction_count: int
    ci_lower: float | None = None
    ci_upper: float | None = None
    verification_rate: float | None = None
    top_facilities: list[FacilityHit] = []


class RecentTrace(BaseModel):
    id: str
    query: str | None = None
    status: str | None = None
    duration_ms: int | None = None
    started_at: str | None = None
    steps: int | None = None


# ---------------------------------------------------------------------------
# F8: NGO planning export
# ---------------------------------------------------------------------------

class ExportFormat(StrEnum):
    CSV = "csv"
    JSON = "json"


class ExportRequest(BaseModel):
    facility_ids: list[str]
    format: ExportFormat = ExportFormat.CSV
    include_trust_audit: bool = True
    include_capabilities: bool = True


class ExportRow(BaseModel):
    facility_id: str
    name: str
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    facility_type: str | None = None
    phone: str | None = None
    address: str | None = None
    description: str | None = None
    trust_score: int | None = None
    trust_flags: str | None = None
    has_icu: bool = False
    has_nicu: bool = False
    has_dialysis: bool = False
    has_oncology: bool = False
    has_emergency_surgery: bool = False
    has_24x7: bool = False
    has_maternity: bool = False
    has_blood_bank: bool = False
    has_anesthesia: bool = False
    has_trauma: bool = False
    has_cardiac_cath_lab: bool = False
    capabilities_caption: str = ""
    specialties: str = ""
    evidence_summary: str = ""


# ---------------------------------------------------------------------------
# F6: Validator agent
# ---------------------------------------------------------------------------

class ValidationFinding(BaseModel):
    capability: str
    claimed: bool
    plausible: bool
    reasoning: str
    evidence_for: list[str] = []
    evidence_against: list[str] = []


class ValidatorResult(BaseModel):
    facility_id: str
    facility_name: str
    overall_assessment: str
    findings: list[ValidationFinding] = []
    medical_standards_checked: list[str] = []
    recommendation: str = ""


# ---------------------------------------------------------------------------
# Review queue
# ---------------------------------------------------------------------------

class ReviewStatus(StrEnum):
    PENDING = "pending"
    PHONE_VERIFICATION = "phone_verification"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class ReviewNote(BaseModel):
    text: str
    created_at: str


class ReviewTaskCreate(BaseModel):
    facility_id: str
    facility_name: str | None = None
    capability: str | None = None
    claim: str | None = None
    reason: str
    severity: Severity = Severity.YELLOW
    evidence_for: list[str] = []
    evidence_against: list[str] = []
    source: str = "manual"


class ReviewTaskUpdate(BaseModel):
    status: ReviewStatus | None = None
    owner: str | None = None
    note: str | None = None


class ReviewTask(BaseModel):
    id: str
    facility_id: str
    facility_name: str | None = None
    capability: str | None = None
    claim: str | None = None
    reason: str
    severity: Severity
    evidence_for: list[str] = []
    evidence_against: list[str] = []
    source: str = "manual"
    status: ReviewStatus = ReviewStatus.PENDING
    owner: str | None = None
    notes: list[ReviewNote] = []
    created_at: str
    updated_at: str


# ---------------------------------------------------------------------------
# Data Health / Governance
# ---------------------------------------------------------------------------

class DataHealthResponse(BaseModel):
    status: str
    generated_at: str
    checks: dict
    metrics: dict
    pipeline: list[dict]
    governance: list[str]
