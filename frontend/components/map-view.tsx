"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { IndiaMap } from "@/components/india-map";
import type { AggregateRow, AggregateLevel, FacilityPoint } from "@/lib/types";

export function MapView() {
  const [aggregates, setAggregates] = useState<AggregateRow[]>([]);
  const [facilities, setFacilities] = useState<FacilityPoint[]>([]);
  const [capability, setCapability] = useState("has_nicu");
  const [level] = useState<AggregateLevel>("state");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const facilitiesFetched = useRef(false);

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
    const timeout = window.setTimeout(() => {
      void fetchAggregates(capability, level);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [capability, level, fetchAggregates]);

  // Fetch facility points once (they don't change with capability)
  useEffect(() => {
    if (facilitiesFetched.current) return;
    facilitiesFetched.current = true;
    fetch("/api/map/facilities")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setFacilities(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col h-full relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-base/60">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: "var(--color-trust)" }}
            />
            <p className="text-sm text-text-muted">Loading map data…</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-surface border border-border rounded-lg shadow-md px-4 py-3 text-center">
          <p className="text-xs text-text">Backend unavailable</p>
          <p className="text-xs font-mono text-alert mt-0.5">{error}</p>
          <button
            onClick={() => fetchAggregates(capability, level)}
            className="mt-2 text-xs text-trust underline"
          >
            Retry
          </button>
        </div>
      )}

      <IndiaMap
        aggregates={aggregates}
        facilities={facilities}
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
