"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FacilityHit, FacilityCapabilities } from "@/lib/types";

interface FacilityCardProps {
  facility: FacilityHit;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const CAPABILITY_LABELS: Record<string, string> = {
  has_icu: "ICU",
  has_nicu: "NICU",
  has_dialysis: "Dialysis",
  has_oncology: "Oncology",
  has_emergency_surgery: "Emerg. Surgery",
  has_24x7: "24×7",
  has_maternity: "Maternity",
  has_blood_bank: "Blood Bank",
  has_anesthesia: "Anesthesia",
  has_trauma: "Trauma",
  has_cardiac_cath_lab: "Cath Lab",
};

function scoreColor(score: number | null): string {
  if (score === null) return "var(--color-text-muted)";
  if (score >= 70) return "var(--color-trust)";
  if (score >= 40) return "var(--color-caution)";
  return "var(--color-alert)";
}

function trueCapabilities(facility: FacilityHit): string[] {
  if (!facility.capabilities) return [];
  const caps = facility.capabilities;
  return Object.entries(CAPABILITY_LABELS)
    .filter(([key]) => {
      const cap = caps[key as keyof FacilityCapabilities];
      return cap && typeof cap === "object" && "value" in cap && cap.value;
    })
    .map(([, label]) => label)
    .slice(0, 5);
}

export function FacilityCard({
  facility,
  isSelected,
  onSelect,
}: FacilityCardProps) {
  const trueCaps = trueCapabilities(facility);
  const location = [facility.city, facility.state].filter(Boolean).join(", ");

  return (
    <Card
      className="cursor-pointer transition-all duration-150 hover:shadow-sm"
      style={{
        borderColor: isSelected
          ? "var(--color-trust)"
          : "var(--color-border)",
        background: isSelected
          ? "color-mix(in srgb, var(--color-trust) 4%, var(--color-surface))"
          : "var(--color-surface)",
      }}
      onClick={() => onSelect(facility.facility_id)}
    >
      <CardContent className="px-3.5 py-2.5 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text truncate leading-snug">
              {facility.name}
            </p>
            {location && (
              <p className="text-xs text-text-muted truncate mt-0.5">
                {location}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {facility.distance_km !== null && (
              <span className="text-xs text-text-muted font-mono tabular-nums">
                {facility.distance_km.toFixed(1)}km
              </span>
            )}
            {facility.trust_score !== null && (
              <span
                className="text-xs font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded border"
                style={{
                  color: scoreColor(facility.trust_score),
                  borderColor: `color-mix(in srgb, ${scoreColor(facility.trust_score)} 30%, transparent)`,
                  background: `color-mix(in srgb, ${scoreColor(facility.trust_score)} 8%, transparent)`,
                }}
              >
                {facility.trust_score}
              </span>
            )}
          </div>
        </div>
        {(facility.facility_type || trueCaps.length > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {facility.facility_type && (
              <span className="text-xs text-text-muted">
                {facility.facility_type}
              </span>
            )}
            {facility.facility_type && trueCaps.length > 0 && (
              <span className="text-text-muted/30">·</span>
            )}
            {trueCaps.map((cap) => (
              <Badge
                key={cap}
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4"
              >
                {cap}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
