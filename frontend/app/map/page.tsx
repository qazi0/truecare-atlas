"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, List, MapPin } from "lucide-react";
import { AppShell, CapabilityBadge, EmptyState, Metric, StatusBadge, TrustRing } from "@/components/atlas/primitives";
import { IndiaMap } from "@/components/india-map";
import { Button } from "@/components/ui/button";
import { CAPABILITY_OPTIONS, capabilityLabel, deriveStatus, formatLocation } from "@/lib/atlas";
import { cachedJson } from "@/lib/client-cache";
import type { AggregateRowWithCI, FacilityHit, FacilityPoint, RegionSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAP_TTL_MS = 5 * 60_000;

export default function MapPage() {
  const [capability, setCapability] = useState("has_nicu");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showReview, setShowReview] = useState(true);
  const [region, setRegion] = useState("Bihar");
  const [view, setView] = useState<"map" | "list">("map");
  const [aggregates, setAggregates] = useState<AggregateRowWithCI[]>([]);
  const [facilities, setFacilities] = useState<FacilityPoint[]>([]);
  const [summary, setSummary] = useState<RegionSummary | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ capability, verified_only: String(verifiedOnly), show_review_needed: String(showReview) });
    const [agg, pts] = await Promise.all([
      cachedJson<AggregateRowWithCI[]>(
        `truecare.cache.map.aggregates.${capability}`,
        `/api/map/aggregates/ci?capability=${capability}&level=state`,
        MAP_TTL_MS,
        [],
      ),
      cachedJson<FacilityPoint[]>(
        `truecare.cache.map.facilities.${qs.toString()}`,
        `/api/map/facilities?${qs.toString()}`,
        MAP_TTL_MS,
        [],
      ),
    ]);
    const nextAggregates = Array.isArray(agg) ? agg : [];
    const nextFacilities = Array.isArray(pts) ? pts : [];
    setAggregates(nextAggregates);
    setFacilities(nextFacilities);
    setSummary(buildLocalRegionSummary(region, capability, nextAggregates, nextFacilities));
  }, [capability, region, showReview, verifiedOnly]);

  useEffect(() => { void load(); }, [load]);

  const national = useMemo(() => aggregates.reduce((acc, row) => ({
    claimed: acc.claimed + row.claimed_count,
    verified: acc.verified + row.verified_count,
  }), { claimed: 0, verified: 0 }), [aggregates]);

  return (
    <AppShell>
      <div className="sticky top-12 z-30 border-b hairline bg-background">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">Capability</span>
            {CAPABILITY_OPTIONS.map((cap) => (
              <button key={cap.key} onClick={() => setCapability(cap.key)} className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", capability === cap.key ? "border-primary bg-primary text-primary-foreground" : "hairline bg-surface text-muted-foreground hover:text-foreground")}>{cap.label}</button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Toggle label="Verified only" on={verifiedOnly} onChange={setVerifiedOnly} />
            <Toggle label="Show review-needed" on={showReview} onChange={setShowReview} />
            <div className="inline-flex rounded-md border hairline bg-surface-muted p-0.5">
              <button onClick={() => setView("map")} className={cn("inline-flex items-center gap-1 rounded-[3px] px-2 py-1 text-[11px]", view === "map" ? "bg-surface shadow-sm" : "text-muted-foreground")}><MapPin className="h-3 w-3" /> Map</button>
              <button onClick={() => setView("list")} className={cn("inline-flex items-center gap-1 rounded-[3px] px-2 py-1 text-[11px]", view === "list" ? "bg-surface shadow-sm" : "text-muted-foreground")}><List className="h-3 w-3" /> List</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 lg:min-h-[calc(100svh-128px)] lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative min-h-[62vh] bg-map-water lg:min-h-0">
          {view === "map" ? (
            <IndiaMap aggregates={aggregates} facilities={facilities} capability={capability} level="state" onRegionClick={(name) => setRegion(name)} onCapabilityChange={setCapability} />
          ) : (
            <ListFallback facilities={facilities} capability={capability} />
          )}
        </div>
        <aside className="flex flex-col overflow-y-auto border-l hairline bg-surface">
          <div className="border-b hairline px-4 py-3">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Region · Capability</div>
            <div className="mt-1 flex items-baseline gap-2"><h2 className="text-[18px] font-semibold">{region}</h2><span className="text-[13px] text-muted-foreground">· {capabilityLabel(capability)}</span></div>
          </div>
          {summary ? (
            <>
              <div className="grid grid-cols-2 gap-2 border-b hairline px-4 py-3">
                <Metric label="Claimed" value={summary.claimed_count} />
                <Metric label="Verified" value={summary.verified_count} tone="trust" />
                <Metric label="Needs review" value={summary.needs_review_count} tone="caution" />
                <Metric label="Contradictions" value={summary.contradiction_count} tone="alert" />
              </div>
              <div className="border-b hairline px-4 py-3 text-[12px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Verification rate</span><span className="font-mono">{Math.round((summary.verification_rate ?? 0) * 100)}%</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full bg-trust" style={{ width: `${Math.round((summary.verification_rate ?? 0) * 100)}%` }} /></div>
                <div className="mt-1.5 text-[11px] text-muted-foreground">95% CI {Math.round((summary.ci_lower ?? 0) * 100)}% to {Math.round((summary.ci_upper ?? 0) * 100)}%</div>
              </div>
              <div className="border-b hairline px-4 py-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Top facilities</div>
                <ul className="flex flex-col gap-1">
                  {summary.top_facilities.map((facility) => <li key={facility.facility_id}><Link href={`/facility/${facility.facility_id}`} className="flex items-center gap-2 rounded-md border hairline bg-surface px-2 py-1.5 hover:border-primary/30"><TrustRing score={facility.trust_score} size={28} showLabel={false} /><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium">{facility.name}</span><span className="block truncate text-[11px] text-muted-foreground">{formatLocation(facility)}</span></span><StatusBadge status={deriveStatus(facility)} /></Link></li>)}
                </ul>
              </div>
            </>
          ) : <div className="p-4"><EmptyState title="No region summary" /></div>}
          <div className="mt-auto border-t hairline px-4 py-3">
            <Link href={`/command?q=${encodeURIComponent(`${capabilityLabel(capability)} ${region}`)}`}><Button className="h-9 w-full text-[12px]">Show matching facilities <ChevronRight className="h-4 w-4" /></Button></Link>
          </div>
        </aside>
      </div>
      <div className="border-t hairline bg-surface px-4 py-2.5 text-[12px]">
        <span className="mr-6 text-[10px] uppercase tracking-wider text-muted-foreground">National · {capabilityLabel(capability)}</span>
        <span className="mr-6">Claimed <strong className="font-mono">{national.claimed.toLocaleString()}</strong></span>
        <span>Verified <strong className="font-mono text-trust">{national.verified.toLocaleString()}</strong></span>
      </div>
    </AppShell>
  );
}

function buildLocalRegionSummary(
  region: string,
  capability: string,
  aggregates: AggregateRowWithCI[],
  facilities: FacilityPoint[],
): RegionSummary {
  const aggregate = aggregates.find((row) => row.region_name === region);
  const regionFacilities = facilities.filter((facility) => facility.state === region);
  const topFacilities: FacilityHit[] = regionFacilities
    .slice()
    .sort((a, b) => (b.trust_score ?? 0) - (a.trust_score ?? 0))
    .slice(0, 5)
    .map((facility) => ({
      facility_id: facility.facility_id,
      name: facility.name,
      city: facility.city,
      state: facility.state,
      pincode: null,
      latitude: facility.lat,
      longitude: facility.lng,
      facility_type: facility.type,
      trust_score: facility.trust_score,
      distance_km: null,
      capabilities: null,
      flag_count: facility.flag_count,
      has_contradiction: facility.has_contradiction,
      trust_status: facility.trust_status,
    }));

  return {
    region,
    capability,
    claimed_count: aggregate?.claimed_count ?? regionFacilities.length,
    verified_count: aggregate?.verified_count ?? regionFacilities.filter((facility) => facility.trust_status === "Verified").length,
    needs_review_count: regionFacilities.filter((facility) => facility.trust_status !== "Verified").length,
    contradiction_count: regionFacilities.filter((facility) => facility.has_contradiction).length,
    ci_lower: aggregate?.ci_lower ?? null,
    ci_upper: aggregate?.ci_upper ?? null,
    verification_rate: aggregate?.verification_rate ?? null,
    top_facilities: topFacilities,
  };
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return <button onClick={() => onChange(!on)} role="switch" aria-checked={on} className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium", on ? "border-primary/40 bg-primary-soft text-primary-soft-foreground" : "hairline bg-surface text-muted-foreground")}><span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-primary" : "bg-muted-foreground/40")} />{label}</button>;
}

function ListFallback({ facilities, capability }: { facilities: FacilityPoint[]; capability: string }) {
  return (
    <div className="absolute inset-0 overflow-auto p-4">
      <table className="w-full overflow-hidden rounded-md border hairline bg-surface text-[12px]">
        <thead className="bg-surface-muted text-muted-foreground"><tr><th className="px-3 py-2 text-left font-medium">Facility</th><th className="px-3 py-2 text-left font-medium">Location</th><th className="px-3 py-2 text-left font-medium">Status</th><th className="px-3 py-2 text-right font-medium">Trust</th></tr></thead>
        <tbody>{facilities.map((facility) => <tr key={facility.facility_id} className="border-t hairline"><td className="px-3 py-2"><Link href={`/facility/${facility.facility_id}`} className="font-medium hover:underline">{facility.name}</Link><div className="text-[11px] text-muted-foreground"><CapabilityBadge label={capabilityLabel(capability)} /></div></td><td className="px-3 py-2">{facility.city}, {facility.state}</td><td className="px-3 py-2"><StatusBadge status={deriveStatus(facility)} /></td><td className="px-3 py-2 text-right font-mono">{facility.trust_score ?? "-"}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
