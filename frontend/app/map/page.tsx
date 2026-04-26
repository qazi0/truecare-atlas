"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, List, MapPin, Search } from "lucide-react";
import { AppShell, CapabilityBadge, EmptyState, Hint, Metric, StatusBadge, TrustRing } from "@/components/atlas/primitives";
import { IndiaMap } from "@/components/india-map";
import { Button } from "@/components/ui/button";
import { CAPABILITY_OPTIONS, capabilityLabel, deriveStatus, formatLocation } from "@/lib/atlas";
import { cachedJson } from "@/lib/client-cache";
import type { AggregateRowWithCI, FacilityHit, FacilityPoint, RegionSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAP_TTL_MS = 5 * 60_000;
const REGION_SUGGEST_DELAY_MS = 2_000;

export default function MapPage() {
  return (
    <Suspense fallback={<AppShell><div className="p-6 text-sm text-muted-foreground">Loading map...</div></AppShell>}>
      <MapContent />
    </Suspense>
  );
}

function MapContent() {
  const params = useSearchParams();
  const [capability, setCapability] = useState(params.get("capability") || "has_nicu");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showReview, setShowReview] = useState(true);
  const [deficitMode, setDeficitMode] = useState(false);
  const [region, setRegion] = useState(params.get("region") || "Bihar");
  const [regionQuery, setRegionQuery] = useState(params.get("region") || "Bihar");
  const [regionSuggestions, setRegionSuggestions] = useState<string[]>([]);
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

  const national = useMemo(() => aggregates.reduce((acc, row) => ({
    claimed: acc.claimed + row.claimed_count,
    verified: acc.verified + row.verified_count,
    absentRegions: acc.absentRegions + (row.claimed_count === 0 ? 1 : 0),
    coveredRegions: acc.coveredRegions + (row.verified_count > 0 ? 1 : 0),
    regions: acc.regions + 1,
  }), { claimed: 0, verified: 0, absentRegions: 0, coveredRegions: 0, regions: 0 }), [aggregates]);
  const visibleAggregates = useMemo(
    () => deficitMode ? aggregates.filter((row) => row.claimed_count === 0) : aggregates,
    [aggregates, deficitMode],
  );
  const visibleFacilities = deficitMode ? [] : facilities;

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (deficitMode && !visibleAggregates.some((row) => normalizeRegion(row.region_name) === normalizeRegion(region))) {
      setSummary(null);
      return;
    }
    const resolved = resolveRegionName(region, aggregates, facilities) ?? region;
    const isStateRegion = aggregates.some((row) => normalizeRegion(row.region_name) === normalizeRegion(resolved));
    if (!isStateRegion) {
      setSummary(buildLocalRegionSummary(resolved, capability, aggregates, facilities));
      return;
    }
    void fetch(`/api/map/region-summary?region=${encodeURIComponent(resolved)}&capability=${encodeURIComponent(capability)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.region) setSummary(data);
      })
      .catch(() => null);
  }, [aggregates, capability, deficitMode, facilities, region, visibleAggregates]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRegionSuggestions(findRegionSuggestions(regionQuery, deficitMode ? visibleAggregates : aggregates, deficitMode ? [] : facilities));
    }, REGION_SUGGEST_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [aggregates, deficitMode, facilities, regionQuery, visibleAggregates]);

  function submitRegionSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = regionQuery.trim();
    const resolved = resolveRegionName(next, deficitMode ? visibleAggregates : aggregates, deficitMode ? [] : facilities);
    if (resolved) {
      setRegion(resolved);
      setRegionQuery(resolved);
      setRegionSuggestions([]);
    }
  }

  function selectRegionSuggestion(next: string) {
    setRegion(next);
    setRegionQuery(next);
    setRegionSuggestions([]);
  }

  useEffect(() => {
    if (!deficitMode || visibleAggregates.length === 0) return;
    const currentVisible = visibleAggregates.some((row) => normalizeRegion(row.region_name) === normalizeRegion(region));
    if (!currentVisible) {
      const nextRegion = visibleAggregates[0].region_name;
      setRegion(nextRegion);
      setRegionQuery(nextRegion);
    }
  }, [deficitMode, region, visibleAggregates]);

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
            <Toggle label="Verified Only" hint="Show facilities that are currently safest to use for planning based on available evidence." on={verifiedOnly} onChange={setVerifiedOnly} />
            <Toggle label="Show Review-Needed" hint="Include promising facilities that should be confirmed before referral or field use." on={showReview} onChange={setShowReview} />
            <DeficitSwitch on={deficitMode} onChange={setDeficitMode} />
            <div className="inline-flex rounded-md border hairline bg-surface-muted p-0.5">
              <button onClick={() => setView("map")} className={cn("inline-flex items-center gap-1 rounded-[3px] px-2 py-1 text-[11px]", view === "map" ? "bg-surface shadow-sm" : "text-muted-foreground")}><MapPin className="h-3 w-3" /> Map</button>
              <button onClick={() => setView("list")} className={cn("inline-flex items-center gap-1 rounded-[3px] px-2 py-1 text-[11px]", view === "list" ? "bg-surface shadow-sm" : "text-muted-foreground")}><List className="h-3 w-3" /> List</button>
            </div>
          </div>
        </div>
        <form onSubmit={submitRegionSearch} className="flex flex-wrap items-center gap-2 border-t hairline px-4 py-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="map-region-search">Region</label>
          <div className="flex h-8 min-w-[240px] flex-1 max-w-md items-center gap-2 rounded-md border hairline bg-surface px-2.5 focus-within:ring-2 focus-within:ring-primary/30">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              id="map-region-search"
              value={regionQuery}
              onChange={(event) => setRegionQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
              placeholder={deficitMode ? "Search missing region" : "Search state or city"}
            />
          </div>
          <Button type="submit" size="sm" variant="outline" className="h-8 text-[12px]">Update Region</Button>
          {regionSuggestions.length > 0 && (
            <div className="flex w-full flex-wrap items-center gap-1 pl-[58px] text-[11px]">
              <span className="mr-1 text-muted-foreground">Suggestions</span>
              {regionSuggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => selectRegionSuggestion(item)}
                  className="rounded-full border hairline bg-surface px-2 py-0.5 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>

      <div className="grid flex-1 grid-cols-1 lg:min-h-[calc(100svh-128px)] lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative min-h-[62vh] bg-map-water lg:min-h-0">
          {view === "map" ? (
            <IndiaMap aggregates={visibleAggregates} facilities={visibleFacilities} capability={capability} level="state" mode={deficitMode ? "deficit" : "coverage"} onRegionClick={(name) => { setRegion(name); setRegionQuery(name); }} />
          ) : (
            deficitMode ? <AbsenceList aggregates={visibleAggregates} capability={capability} /> : <ListFallback facilities={facilities} capability={capability} />
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
                <Metric label={deficitMode ? "Capability Status" : "Needs Review"} value={deficitMode ? "Absent" : summary.needs_review_count} tone="caution" />
                <Metric label={deficitMode ? "Severity" : "Contradictions"} value={deficitMode ? "Critical" : summary.contradiction_count} tone={deficitMode ? "alert" : "alert"} />
              </div>
              <div className="border-b hairline px-4 py-3 text-[12px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Verification rate</span><span className="font-mono">{Math.round((summary.verification_rate ?? 0) * 100)}%</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full bg-trust" style={{ width: `${Math.round((summary.verification_rate ?? 0) * 100)}%` }} /></div>
                <div className="mt-1.5 text-[11px] text-muted-foreground">95% CI {Math.round((summary.ci_lower ?? 0) * 100)}% to {Math.round((summary.ci_upper ?? 0) * 100)}%</div>
                {deficitMode && (
                  <div className="mt-2 rounded-md border hairline bg-surface-muted px-2.5 py-2 text-[11px] text-muted-foreground">
                    No claimed {capabilityLabel(capability)} facilities are present in this region in the current dataset.
                  </div>
                )}
              </div>
              {deficitMode ? (
                <div className="border-b hairline px-4 py-3 text-[12px] text-muted-foreground">
                  Facility markers are hidden in deficit mode because the selected capability is absent in the highlighted regions.
                </div>
              ) : (
                <div className="border-b hairline px-4 py-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Top Facilities</div>
                  <ul className="flex flex-col gap-1">
                    {summary.top_facilities.map((facility) => <li key={facility.facility_id}><Link href={`/facility/${facility.facility_id}`} className="flex items-center gap-2 rounded-md border hairline bg-surface px-2 py-1.5 hover:border-primary/30"><TrustRing score={facility.trust_score} size={28} showLabel={false} /><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium">{facility.name}</span><span className="block truncate text-[11px] text-muted-foreground">{formatLocation(facility)}</span></span><StatusBadge status={deriveStatus(facility)} /></Link></li>)}
                  </ul>
                </div>
              )}
            </>
          ) : <div className="p-4"><EmptyState title={deficitMode ? "No Missing Regions" : "No Region Summary"} detail={deficitMode ? `Every region currently has at least one claimed ${capabilityLabel(capability)} facility.` : undefined} /></div>}
          <div className="mt-auto border-t hairline px-4 py-3">
            <Link href={`/command?q=${encodeURIComponent(`${capabilityLabel(capability)} ${region}`)}`}><Button className="h-9 w-full text-[12px]">{deficitMode ? "Investigate Nearby Options" : "Show Matching Facilities"} <ChevronRight className="h-4 w-4" /></Button></Link>
          </div>
        </aside>
      </div>
      <div className="border-t hairline bg-surface px-4 py-2.5 text-[12px]">
        <span className="mr-6 text-[10px] uppercase tracking-wider text-muted-foreground">National · {capabilityLabel(capability)}</span>
        <span className="mr-6">Claimed <strong className="font-mono">{national.claimed.toLocaleString()}</strong></span>
        <span className="mr-6">Verified <strong className="font-mono text-trust">{national.verified.toLocaleString()}</strong></span>
        {deficitMode && (
          <>
            <span className="mr-6">Capability absent regions <strong className="font-mono text-alert">{national.absentRegions.toLocaleString()}</strong></span>
            <span>Visible <strong className="font-mono text-alert">{visibleAggregates.length.toLocaleString()}</strong></span>
          </>
        )}
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
  const resolvedRegion = resolveRegionName(region, aggregates, facilities) ?? region;
  const regionLower = normalizeRegion(resolvedRegion);
  const aggregate = aggregates.find((row) => normalizeRegion(row.region_name) === regionLower);
  const regionFacilities = facilities.filter((facility) => normalizeRegion(facility.state) === regionLower || normalizeRegion(facility.city) === regionLower);
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
    region: resolvedRegion,
    capability,
    claimed_count: aggregate?.claimed_count ?? regionFacilities.length,
    verified_count: aggregate?.verified_count ?? regionFacilities.filter((facility) => facility.trust_status === "Verified").length,
    needs_review_count: Math.max(0, (aggregate?.claimed_count ?? regionFacilities.length) - (aggregate?.verified_count ?? regionFacilities.filter((facility) => facility.trust_status === "Verified").length)),
    contradiction_count: regionFacilities.filter((facility) => facility.has_contradiction).length,
    ci_lower: aggregate?.ci_lower ?? null,
    ci_upper: aggregate?.ci_upper ?? null,
    verification_rate: aggregate?.verification_rate ?? (regionFacilities.length ? regionFacilities.filter((facility) => facility.trust_status === "Verified").length / regionFacilities.length : null),
    top_facilities: topFacilities,
  };
}

function resolveRegionName(query: string, aggregates: AggregateRowWithCI[], facilities: FacilityPoint[]): string | null {
  const normalized = normalizeRegion(query);
  if (!normalized) return null;
  const names = regionNameOptions(aggregates, facilities);
  return (
    names.find((name) => normalizeRegion(name) === normalized) ??
    names.find((name) => normalizeRegion(name).startsWith(normalized)) ??
    names.find((name) => normalizeRegion(name).includes(normalized)) ??
    null
  );
}

function findRegionSuggestions(query: string, aggregates: AggregateRowWithCI[], facilities: FacilityPoint[]): string[] {
  const normalized = normalizeRegion(query);
  if (normalized.length < 2) return [];
  const names = regionNameOptions(aggregates, facilities);
  return names
    .filter((name) => normalizeRegion(name).includes(normalized))
    .sort((a, b) => {
      const aStarts = normalizeRegion(a).startsWith(normalized);
      const bStarts = normalizeRegion(b).startsWith(normalized);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return a.localeCompare(b);
    })
    .slice(0, 6);
}

function regionNameOptions(aggregates: AggregateRowWithCI[], facilities: FacilityPoint[]): string[] {
  const names = new Set<string>();
  for (const row of aggregates) names.add(row.region_name);
  for (const facility of facilities) {
    if (facility.state) names.add(facility.state);
    if (facility.city) names.add(facility.city);
  }
  return Array.from(names);
}

function normalizeRegion(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return <Hint text={hint}><button onClick={() => onChange(!on)} role="switch" aria-checked={on} className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium", on ? "border-primary/40 bg-primary-soft text-primary-soft-foreground" : "hairline bg-surface text-muted-foreground")}><span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-primary" : "bg-muted-foreground/40")} />{label}</button></Hint>;
}

function DeficitSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Hint text="Show only regions where the selected capability has no claimed facility records. Facility and city markers are hidden in this mode.">
      <button
        type="button"
        onClick={() => onChange(!on)}
        role="switch"
        aria-checked={on}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
          on ? "border-alert/40 bg-alert-soft text-alert" : "hairline bg-surface text-muted-foreground",
        )}
      >
        <span className={cn("relative h-4 w-7 rounded-full transition", on ? "bg-alert" : "bg-muted-foreground/25")}>
          <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition", on ? "left-3.5" : "left-0.5")} />
        </span>
        Deficit Regions
      </button>
    </Hint>
  );
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

function AbsenceList({ aggregates, capability }: { aggregates: AggregateRowWithCI[]; capability: string }) {
  return (
    <div className="absolute inset-0 overflow-auto p-4">
      <table className="w-full overflow-hidden rounded-md border hairline bg-surface text-[12px]">
        <thead className="bg-surface-muted text-muted-foreground">
          <tr><th className="px-3 py-2 text-left font-medium">Region</th><th className="px-3 py-2 text-left font-medium">Capability</th><th className="px-3 py-2 text-right font-medium">Claimed</th><th className="px-3 py-2 text-right font-medium">Verified</th></tr>
        </thead>
        <tbody>
          {aggregates.map((row) => (
            <tr key={row.region_name} className="border-t hairline">
              <td className="px-3 py-2 font-medium">{row.region_name}</td>
              <td className="px-3 py-2"><CapabilityBadge label={capabilityLabel(capability)} /></td>
              <td className="px-3 py-2 text-right font-mono">{row.claimed_count}</td>
              <td className="px-3 py-2 text-right font-mono">{row.verified_count}</td>
            </tr>
          ))}
          {aggregates.length === 0 && (
            <tr><td colSpan={4} className="p-6"><EmptyState title="No Missing Regions" detail={`Every region currently has at least one claimed ${capabilityLabel(capability)} facility.`} /></td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
