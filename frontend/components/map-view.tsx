"use client";

import { useState, useEffect, useCallback } from "react";
import { DesertMap } from "@/components/desert-map";
import type { AggregateRow, AggregateLevel } from "@/lib/types";

export function MapView() {
  const [aggregates, setAggregates] = useState<AggregateRow[]>([]);
  const [capability, setCapability] = useState("has_nicu");
  const [level] = useState<AggregateLevel>("state");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAggregates = useCallback(
    async (cap: string, lvl: AggregateLevel) => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(
          `/api/map?capability=${encodeURIComponent(cap)}&level=${encodeURIComponent(lvl)}`
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        setAggregates(Array.isArray(data) ? data : []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchAggregates(capability, level);
  }, [capability, level, fetchAggregates]);

  if (loading) {
    return (
      <div className="flex flex-1 h-full items-center justify-center">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: "var(--color-trust)" }}
          />
          <p className="text-sm text-text-muted">Loading map data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-text">Failed to load map data</p>
          <p className="text-xs font-mono text-alert mt-1">{error}</p>
          <button
            onClick={() => fetchAggregates(capability, level)}
            className="mt-3 text-xs text-trust underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DesertMap
        aggregates={aggregates}
        capability={capability}
        level={level}
        onRegionClick={() => {}}
        onCapabilityChange={(cap) => {
          setCapability(cap);
          fetchAggregates(cap, level);
        }}
      />
    </div>
  );
}
