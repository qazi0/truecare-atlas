from enum import StrEnum
from pydantic import BaseModel


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


class FacilityFull(FacilityHit):
    description: str | None = None
    phone: str | None = None
    address: str | None = None
    specialties: list[str] = []
    procedures: list[str] = []
    equipment: list[str] = []
    capability_text: list[str] = []
    trust_report: TrustReport | None = None


class SSEEventType(StrEnum):
    STEP = "step"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    REASONING = "reasoning"
    RESULT = "result"
    ERROR = "error"
    DONE = "done"


class SSEEvent(BaseModel):
    type: SSEEventType
    payload: dict
