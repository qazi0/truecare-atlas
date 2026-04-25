// Mirrors backend/app/schemas.py — snake_case matches Pydantic v2 wire format

export type Confidence = "high" | "medium" | "low";
export type SourceField =
  | "description"
  | "capability"
  | "procedure"
  | "equipment"
  | "specialties"
  | "multiple";
export type Severity = "red" | "yellow" | "green";
export type AggregateLevel = "state" | "district" | "pincode";
export type SSEEventType =
  | "step"
  | "tool_call"
  | "tool_result"
  | "reasoning"
  | "result"
  | "error"
  | "done";

export interface Capability {
  value: boolean;
  evidence_quote: string | null;
  source_field: SourceField | null;
  confidence: Confidence;
}

export interface FacilityCapabilities {
  has_icu: Capability;
  has_nicu: Capability;
  has_dialysis: Capability;
  has_oncology: Capability;
  has_emergency_surgery: Capability;
  has_24x7: Capability;
  has_maternity: Capability;
  has_blood_bank: Capability;
  has_anesthesia: Capability;
  has_trauma: Capability;
  has_cardiac_cath_lab: Capability;
  capabilities_caption: string;
}

export interface TrustFlag {
  rule_id: string;
  severity: Severity;
  label: string;
  evidence_quotes: string[];
}

export interface TrustReport {
  facility_id: string;
  score: number;
  flags: TrustFlag[];
}

export interface FacilityHit {
  facility_id: string;
  name: string;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  facility_type: string | null;
  trust_score: number | null;
  distance_km: number | null;
  capabilities: FacilityCapabilities | null;
}

export interface FacilityFull extends FacilityHit {
  description: string | null;
  phone: string | null;
  address: string | null;
  specialties: string[];
  procedures: string[];
  equipment: string[];
  capability_text: string[];
  trust_report: TrustReport | null;
}

export interface AggregateRow {
  region_name: string;
  region_level: AggregateLevel;
  capability: string;
  claimed_count: number;
  verified_count: number;
  population: number | null;
  per_100k: number | null;
}

export interface SSEEvent {
  type: SSEEventType;
  payload: Record<string, unknown>;
}

// Frontend-only derived state
export interface StreamStep {
  step_index: number;
  description: string;
  timestamp: string;
  tool_call: {
    tool_name: string;
    arguments: Record<string, unknown>;
  } | null;
  tool_result: {
    result: unknown;
    duration_ms: number;
  } | null;
  reasoning_text: string;
}

export interface SearchStreamState {
  steps: StreamStep[];
  facilities: FacilityHit[];
  summary: string;
  trace_id: string | null;
  error: string | null;
  is_streaming: boolean;
}
