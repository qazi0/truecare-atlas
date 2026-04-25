"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AggregateRow, AggregateLevel } from "@/lib/types";
import { staggerItem } from "@/lib/motion";

interface DesertMapProps {
  aggregates: AggregateRow[];
  capability: string;
  level: AggregateLevel;
  onRegionClick: (name: string, level: AggregateLevel) => void;
}

const CAPABILITY_OPTIONS = [
  { key: "has_nicu", label: "NICU" },
  { key: "has_icu", label: "ICU" },
  { key: "has_dialysis", label: "Dialysis" },
  { key: "has_oncology", label: "Oncology" },
  { key: "has_emergency_surgery", label: "Emerg Surgery" },
  { key: "has_blood_bank", label: "Blood Bank" },
  { key: "has_maternity", label: "Maternity" },
  { key: "has_24x7", label: "24×7" },
  { key: "has_trauma", label: "Trauma" },
  { key: "has_cardiac_cath_lab", label: "Cath Lab" },
];

function trustColor(verified: number, claimed: number): string {
  if (claimed === 0) return "var(--color-border)";
  const ratio = verified / claimed;
  if (ratio >= 0.7) return "var(--color-trust)";
  if (ratio >= 0.4) return "var(--color-caution)";
  return "var(--color-alert)";
}

function trustStyle(verified: number, claimed: number): React.CSSProperties {
  const color = trustColor(verified, claimed);
  return {
    borderColor: color,
    background: `color-mix(in srgb, ${color} 8%, var(--color-surface))`,
  };
}

export function DesertMap({
  aggregates,
  capability,
  level,
  onRegionClick,
}: DesertMapProps) {
  const [activeCap, setActiveCap] = useState(capability);

  const filtered = aggregates.filter((r) => r.capability === activeCap);
  // Sort by verified desc
  const sorted = [...filtered].sort((a, b) => b.verified_count - a.verified_count);

  return (
    <div className="flex flex-col h-full gap-3 p-4">
      {/* Capability toggle pills */}
      <div className="flex flex-wrap gap-1.5">
        {CAPABILITY_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setActiveCap(opt.key)}
            className="text-xs px-2 py-1 rounded-full border transition-colors"
            style={
              activeCap === opt.key
                ? {
                    background: "var(--color-trust)",
                    borderColor: "var(--color-trust)",
                    color: "#fff",
                  }
                : {
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-muted)",
                  }
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <p className="text-xs text-text-muted">
          Showing {sorted.length} {level}s
        </p>
        <Badge variant="outline" className="text-xs font-mono">
          {CAPABILITY_OPTIONS.find((o) => o.key === activeCap)?.label ?? activeCap}
        </Badge>
        <div className="flex items-center gap-3 ml-auto">
          <LegendDot color="var(--color-trust)" label="≥70% verified" />
          <LegendDot color="var(--color-caution)" label="40-69%" />
          <LegendDot color="var(--color-alert)" label="<40%" />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 pr-2">
          {sorted.map((row, i) => (
            <motion.div
              key={`${row.region_name}-${row.capability}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className="cursor-pointer"
                style={trustStyle(row.verified_count, row.claimed_count)}
                onClick={() => onRegionClick(row.region_name, row.region_level)}
              >
                <CardContent className="p-2.5">
                  <p className="text-xs font-semibold text-text truncate">
                    {row.region_name}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {row.verified_count}/{row.claimed_count} verified
                  </p>
                  {row.per_100k !== null && (
                    <p className="text-xs font-mono text-text-muted">
                      {row.per_100k.toFixed(1)}/100k
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {sorted.length === 0 && (
            <div className="col-span-full text-center py-8">
              <p className="text-sm text-text-muted">No data for this capability</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: color }}
      />
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}
