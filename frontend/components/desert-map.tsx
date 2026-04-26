"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AggregateRow, AggregateLevel } from "@/lib/types";

interface DesertMapProps {
  aggregates: AggregateRow[];
  capability: string;
  level: AggregateLevel;
  onRegionClick: (name: string, level: AggregateLevel) => void;
  onCapabilityChange?: (cap: string) => void;
}

const CAPABILITY_OPTIONS = [
  { key: "has_nicu", label: "NICU" },
  { key: "has_icu", label: "ICU" },
  { key: "has_dialysis", label: "Dialysis" },
  { key: "has_oncology", label: "Oncology" },
  { key: "has_emergency_surgery", label: "Emerg. Surgery" },
  { key: "has_blood_bank", label: "Blood Bank" },
  { key: "has_maternity", label: "Maternity" },
  { key: "has_24x7", label: "24×7" },
  { key: "has_trauma", label: "Trauma" },
  { key: "has_cardiac_cath_lab", label: "Cath Lab" },
];

function verificationColor(verified: number, claimed: number): string {
  if (claimed === 0) return "var(--color-border)";
  const ratio = verified / claimed;
  if (ratio >= 0.7) return "var(--color-trust)";
  if (ratio >= 0.4) return "var(--color-caution)";
  return "var(--color-alert)";
}

export function DesertMap({
  aggregates,
  capability,
  level,
  onRegionClick,
  onCapabilityChange,
}: DesertMapProps) {
  const [activeCap, setActiveCap] = useState(capability);

  const handleCapChange = (cap: string) => {
    setActiveCap(cap);
    onCapabilityChange?.(cap);
  };

  const sorted = [...aggregates].sort(
    (a, b) => b.claimed_count - a.claimed_count
  );

  const totalClaimed = sorted.reduce((s, r) => s + r.claimed_count, 0);
  const totalVerified = sorted.reduce((s, r) => s + r.verified_count, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Capability pills */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border shrink-0">
        <div className="flex flex-wrap gap-1.5 flex-1">
          {CAPABILITY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleCapChange(opt.key)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                activeCap === opt.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-text-muted hover:border-text-muted/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <LegendDot color="var(--color-trust)" label="≥70%" />
          <LegendDot color="var(--color-caution)" label="40–69%" />
          <LegendDot color="var(--color-alert)" label="<40%" />
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border/50 shrink-0 bg-muted/30">
        <span className="text-xs text-text-muted">
          {sorted.length} {level}s
        </span>
        <Badge variant="outline" className="text-xs font-mono h-5">
          {CAPABILITY_OPTIONS.find((o) => o.key === activeCap)?.label ??
            activeCap}
        </Badge>
        <span className="text-xs text-text-muted ml-auto font-mono tabular-nums">
          {totalVerified}/{totalClaimed} verified nationally
        </span>
      </div>

      {/* Grid */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-4">
          {sorted.map((row, i) => {
            const color = verificationColor(
              row.verified_count,
              row.claimed_count
            );
            const ratio =
              row.claimed_count > 0
                ? Math.round((row.verified_count / row.claimed_count) * 100)
                : 0;

            return (
              <motion.div
                key={`${row.region_name}-${row.capability}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02, duration: 0.15 }}
              >
                <Card
                  className="cursor-pointer transition-all duration-150 hover:shadow-sm"
                  style={{
                    borderColor: `color-mix(in srgb, ${color} 40%, var(--color-border))`,
                    background: `color-mix(in srgb, ${color} 5%, var(--color-surface))`,
                  }}
                  onClick={() =>
                    onRegionClick(row.region_name, row.region_level)
                  }
                >
                  <CardContent className="p-2.5">
                    <p className="text-xs font-medium text-text truncate leading-snug">
                      {row.region_name}
                    </p>
                    <div className="flex items-baseline justify-between mt-1 gap-1">
                      <span className="text-xs text-text-muted font-mono tabular-nums">
                        {row.verified_count}/{row.claimed_count}
                      </span>
                      {row.claimed_count > 0 && (
                        <span
                          className="text-[10px] font-mono font-medium tabular-nums"
                          style={{ color }}
                        >
                          {ratio}%
                        </span>
                      )}
                    </div>
                    {row.per_100k !== null && row.per_100k > 0 && (
                      <p className="text-[10px] font-mono text-text-muted mt-0.5">
                        {row.per_100k.toFixed(1)}/100k
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
          {sorted.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-sm text-text-muted">
                No data for this capability
              </p>
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
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: color }}
      />
      <span className="text-[10px] text-text-muted">{label}</span>
    </div>
  );
}
