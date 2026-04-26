import type {
  Capability,
  FacilityCapabilities,
  FacilityFull,
  FacilityHit,
  Severity,
  SourceField,
  TrustFlag,
} from "@/lib/types";

export type FacilityStatus = "Verified" | "Needs review" | "Evidence weak" | "Contradiction";

export interface EvidenceRow {
  key: string;
  label: string;
  value: boolean;
  quote: string | null;
  source: SourceField | null;
  confidence: "high" | "medium" | "low";
  status: "Direct" | "Inferred" | "Weak" | "Contradicted";
}

export const CAPABILITY_OPTIONS = [
  { key: "has_nicu", label: "NICU" },
  { key: "has_icu", label: "ICU" },
  { key: "has_dialysis", label: "Dialysis" },
  { key: "has_oncology", label: "Oncology" },
  { key: "has_emergency_surgery", label: "Emergency Surgery" },
  { key: "has_blood_bank", label: "Blood Bank" },
  { key: "has_maternity", label: "Maternity" },
  { key: "has_24x7", label: "24x7" },
  { key: "has_trauma", label: "Trauma" },
  { key: "has_anesthesia", label: "Anesthesia" },
  { key: "has_cardiac_cath_lab", label: "Cath Lab" },
] as const;

export const DEFAULT_PROMPTS = [
  "NICU near Patna",
  "Map dialysis coverage in Chennai",
  "Which maternity facilities need review in Kerala?",
  "Oncology claims in Mumbai with evidence",
  "Emergency surgery near Delhi with anesthesia evidence",
  "Where are neonatal care gaps in Bihar?",
];

export function capabilityLabel(key: string): string {
  return CAPABILITY_OPTIONS.find((cap) => cap.key === key)?.label ?? key.replace(/^has_/, "").replaceAll("_", " ");
}

export function capabilityKeyFromQuery(query: string): string {
  const q = query.toLowerCase();
  return CAPABILITY_OPTIONS.find((cap) => q.includes(cap.label.toLowerCase()) || q.includes(cap.key.replace("has_", "")))?.key ?? "has_nicu";
}

export function deriveStatus(facility: Pick<FacilityHit, "trust_status" | "has_contradiction" | "flag_count" | "trust_score">): FacilityStatus {
  if (facility.trust_status === "Contradiction" || facility.has_contradiction) return "Contradiction";
  if (facility.trust_status === "Needs review" || (facility.flag_count ?? 0) > 0) return "Needs review";
  if (facility.trust_status === "Evidence weak" || (facility.trust_score ?? 100) < 60) return "Evidence weak";
  return "Verified";
}

export function statusFromFlags(flags: TrustFlag[] | undefined, score: number | null | undefined): FacilityStatus {
  if (flags?.some((flag) => flag.severity === "red")) return "Contradiction";
  if ((flags?.length ?? 0) > 0) return "Needs review";
  if ((score ?? 100) < 60) return "Evidence weak";
  return "Verified";
}

export function evidenceRows(capabilities: FacilityCapabilities | null | undefined, contradicted = false): EvidenceRow[] {
  if (!capabilities) return [];
  const rows = CAPABILITY_OPTIONS.map((cap): EvidenceRow | null => {
    const item = capabilities[cap.key as keyof FacilityCapabilities] as Capability | undefined;
    if (!item) return null;
    const weak = item.confidence === "low" || !item.evidence_quote;
    return {
      key: cap.key,
      label: cap.label,
      value: item.value,
      quote: item.evidence_quote,
      source: item.source_field,
      confidence: item.confidence,
      status: contradicted ? "Contradicted" : item.value ? (weak ? "Weak" : "Direct") : "Inferred",
    };
  });
  return rows.filter((row): row is EvidenceRow => row !== null);
}

export function activeEvidenceRows(facility: FacilityHit | FacilityFull): EvidenceRow[] {
  return evidenceRows(facility.capabilities, Boolean(facility.has_contradiction))
    .filter((row) => row.value || row.quote)
    .sort((a, b) => Number(b.value) - Number(a.value));
}

export function trustFlagTitle(flag: TrustFlag): string {
  return flag.label || flag.rule_id.replaceAll("_", " ");
}

export function severityTone(severity: Severity): "trust" | "caution" | "alert" {
  if (severity === "red") return "alert";
  if (severity === "yellow") return "caution";
  return "trust";
}

export function formatLocation(facility: Pick<FacilityHit, "city" | "state" | "pincode">): string {
  return [facility.city, facility.state, facility.pincode].filter(Boolean).join(", ") || "Location unavailable";
}

export function shortlistIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem("truecare.shortlist") ?? "[]");
  } catch {
    return [];
  }
}

export function setShortlistIds(ids: string[]) {
  window.localStorage.setItem("truecare.shortlist", JSON.stringify(Array.from(new Set(ids))));
  window.dispatchEvent(new Event("truecare.shortlist.changed"));
}

export function addToShortlist(id: string) {
  setShortlistIds([...shortlistIds(), id]);
}

export function removeFromShortlist(id: string) {
  setShortlistIds(shortlistIds().filter((item) => item !== id));
}
