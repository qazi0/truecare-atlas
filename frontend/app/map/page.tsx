"use client";

import { useState, useEffect, useCallback } from "react";
import { DesertMap } from "@/components/desert-map";
import type { AggregateRow, AggregateLevel } from "@/lib/types";

export default function MapPage() {
  const [aggregates, setAggregates] = useState<AggregateRow[]>([]);
  const [capability, setCapability] = useState("has_nicu");
  const [level, setLevel] = useState<AggregateLevel>("state");
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

  const handleRegionClick = (name: string, clickedLevel: AggregateLevel) => {
    // Future: drill down into region
    console.log("Region clicked:", name, clickedLevel);
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">Loading map data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
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
    <div className="flex flex-col flex-1 h-screen">
      <header className="px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-base font-semibold text-text">Healthcare Desert Map</h1>
        <p className="text-xs text-text-muted mt-0.5">
          Verified vs. claimed capability coverage by state
        </p>
      </header>
      <div className="flex-1 min-h-0">
        <DesertMap
          aggregates={aggregates}
          capability={capability}
          level={level}
          onRegionClick={handleRegionClick}
          onCapabilityChange={(cap) => {
            setCapability(cap);
            fetchAggregates(cap, level);
          }}
        />
      </div>
    </div>
  );
}
