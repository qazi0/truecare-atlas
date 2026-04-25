"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FacilityHit, FacilityCapabilities } from "@/lib/types";
import { slideInUp } from "@/lib/motion";

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
  has_emergency_surgery: "Emergency Surgery",
  has_24x7: "24×7",
  has_maternity: "Maternity",
  has_blood_bank: "Blood Bank",
  has_anesthesia: "Anesthesia",
  has_trauma: "Trauma",
  has_cardiac_cath_lab: "Cath Lab",
};

function scoreBadgeStyle(score: number | null): React.CSSProperties {
  if (score === null) return {};
  if (score >= 70)
    return {
      borderColor: "var(--color-trust)",
      color: "var(--color-trust)",
      background: "color-mix(in srgb, var(--color-trust) 10%, transparent)",
    };
  if (score >= 40)
    return {
      borderColor: "var(--color-caution)",
      color: "var(--color-caution)",
      background: "color-mix(in srgb, var(--color-caution) 10%, transparent)",
    };
  return {
    borderColor: "var(--color-alert)",
    color: "var(--color-alert)",
    background: "color-mix(in srgb, var(--color-alert) 10%, transparent)",
  };
}

function trueCapabilities(facility: FacilityHit): string[] {
  if (!facility.capabilities) return [];
  const caps = facility.capabilities;
  return Object.entries(CAPABILITY_LABELS)
    .filter(([key]) => {
      const cap = caps[key as keyof FacilityCapabilities];
      return cap && typeof cap === "object" && "value" in cap && cap.value === true;
    })
    .map(([, label]) => label)
    .slice(0, 4);
}

export function FacilityCard({ facility, isSelected, onSelect }: FacilityCardProps) {
  const trueCaps = trueCapabilities(facility);
  const location = [facility.city, facility.state].filter(Boolean).join(", ");

  return (
    <motion.div
      variants={slideInUp}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.15 }}
    >
      <Card
        className="cursor-pointer transition-colors"
        style={{
          borderColor: isSelected ? "var(--color-trust)" : "var(--color-border)",
          background: isSelected
            ? "color-mix(in srgb, var(--color-trust) 5%, var(--color-surface))"
            : "var(--color-surface)",
        }}
        onClick={() => onSelect(facility.facility_id)}
      >
        <CardContent className="p-3 flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text truncate">{facility.name}</p>
              {location && (
                <p className="text-xs text-text-muted truncate">{location}</p>
              )}
              {facility.facility_type && (
                <p className="text-xs text-text-muted">{facility.facility_type}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {facility.trust_score !== null && (
                <Badge
                  variant="outline"
                  className="text-xs font-mono tabular-nums"
                  style={scoreBadgeStyle(facility.trust_score)}
                >
                  {facility.trust_score}
                </Badge>
              )}
              {facility.distance_km !== null && (
                <span className="text-xs text-text-muted font-mono">
                  {facility.distance_km.toFixed(1)} km
                </span>
              )}
            </div>
          </div>
          {trueCaps.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {trueCaps.map((cap) => (
                <Badge
                  key={cap}
                  variant="secondary"
                  className="text-xs px-1.5 py-0"
                >
                  {cap}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
