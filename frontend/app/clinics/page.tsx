"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink, Globe, Phone, Search } from "lucide-react";
import { AppShell, CapabilityBadge, EmptyState, StatusBadge, TrustRing } from "@/components/atlas/primitives";
import { Button } from "@/components/ui/button";
import { CAPABILITY_OPTIONS, activeEvidenceRows, deriveStatus, formatLocation } from "@/lib/atlas";
import type { ClinicsPageResponse, FacilityHit } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "verified", label: "Verified" },
  { value: "needs_review", label: "Needs Review" },
  { value: "contradiction", label: "Contradiction" },
  { value: "evidence_weak", label: "Evidence Weak" },
];

export default function ClinicsPage() {
  const [query, setQuery] = useState("");
  const [capability, setCapability] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<FacilityHit[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [activeCursor, setActiveCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageIndex = cursorStack.length + 1;

  async function load(cursor: string | null, dim = false) {
    if (dim) setFiltering(true);
    else setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (query.trim()) params.set("q", query.trim());
    if (capability) params.set("capability", capability);
    if (state.trim()) params.set("state", state.trim());
    if (city.trim()) params.set("city", city.trim());
    if (status) params.set("status", status);
    if (cursor) params.set("cursor", cursor);

    try {
      const resp = await fetch(`/api/clinics?${params.toString()}`);
      const data = (await resp.json()) as ClinicsPageResponse | { detail?: string };
      if (!resp.ok || !("items" in data)) {
        throw new Error("detail" in data && data.detail ? data.detail : "Unable to load clinics");
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setNextCursor(data.next_cursor ?? null);
      setTotal(data.total_estimate ?? null);
      setActiveCursor(cursor);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Unable to load clinics");
      setItems([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
      setFiltering(false);
    }
  }

  useEffect(() => {
    void load(null);
    // Initial fetch only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCursorStack([]);
    void load(null, true);
  }

  function updateFilter(update: () => void) {
    update();
    setCursorStack([]);
    window.setTimeout(() => void load(null, true), 0);
  }

  function nextPage() {
    if (!nextCursor) return;
    setCursorStack((stack) => [...stack, activeCursor ?? ""]);
    void load(nextCursor, true);
  }

  function previousPage() {
    if (!cursorStack.length) return;
    const previousStack = cursorStack.slice(0, -1);
    const previousCursor = previousStack.at(-1) || null;
    setCursorStack(previousStack);
    void load(previousCursor, true);
  }

  const showingRange = useMemo(() => {
    const start = items.length ? (pageIndex - 1) * PAGE_SIZE + 1 : 0;
    const end = (pageIndex - 1) * PAGE_SIZE + items.length;
    return `${start}-${end}`;
  }, [items.length, pageIndex]);

  return (
    <AppShell>
      <div className="sticky top-12 z-30 border-b hairline bg-background">
        <form onSubmit={submit} className="flex flex-col gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="text-[18px] font-semibold tracking-tight">All Clinics</h1>
              <p className="text-[12px] text-muted-foreground">SQL search across every ingested facility record.</p>
            </div>
            <div className="ml-auto text-[11px] text-muted-foreground">
              {total != null ? `${total.toLocaleString()} matching records` : "Loading records"}
            </div>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border hairline bg-surface px-3 focus-within:ring-2 focus-within:ring-primary/30">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
                placeholder="Search clinics, cities, capabilities, or pincode"
              />
            </label>
            <Button type="submit" className="h-10 lg:w-32">Search</Button>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <SelectLabel label="Capability">
              <select value={capability} onChange={(event) => updateFilter(() => setCapability(event.target.value))} className="h-8 w-full bg-transparent text-[12px] outline-none">
                <option value="">All capabilities</option>
                {CAPABILITY_OPTIONS.map((cap) => <option key={cap.key} value={cap.key}>{cap.label}</option>)}
              </select>
            </SelectLabel>
            <InputLabel label="State" value={state} onChange={setState} onCommit={() => { setCursorStack([]); void load(null, true); }} placeholder="e.g. Bihar" />
            <InputLabel label="City" value={city} onChange={setCity} onCommit={() => { setCursorStack([]); void load(null, true); }} placeholder="e.g. Chennai" />
            <SelectLabel label="Status">
              <select value={status} onChange={(event) => updateFilter(() => setStatus(event.target.value))} className="h-8 w-full bg-transparent text-[12px] outline-none">
                {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </SelectLabel>
          </div>
        </form>
      </div>

      <div className="relative flex-1 p-4">
        {(loading || filtering) && <ClinicsSkeleton overlay={filtering && !loading} />}
        {error && !loading && <EmptyState title="Clinics search failed" detail={error} />}
        {!loading && !error && items.length === 0 && <EmptyState title="No clinics match this search" detail="Try a broader city, capability, or pincode." />}
        {!loading && !error && items.length > 0 && (
          <div className={cn("overflow-hidden rounded-lg border hairline bg-surface transition-opacity", filtering && "opacity-45")}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-[12px]">
                <thead className="bg-surface-muted text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Clinic</th>
                    <th className="px-3 py-2 text-left font-medium">Location</th>
                    <th className="px-3 py-2 text-left font-medium">Capabilities</th>
                    <th className="px-3 py-2 text-left font-medium">Contact</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Trust</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((facility) => <ClinicRow key={facility.facility_id} facility={facility} />)}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t hairline px-3 py-2 text-[12px] text-muted-foreground">
              <span>Page {pageIndex} · showing {showingRange}{total != null ? ` of ${total.toLocaleString()}` : ""}</span>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" className="h-8 text-[12px]" disabled={!cursorStack.length || filtering} onClick={previousPage}>Back</Button>
                <Button type="button" size="sm" variant="outline" className="h-8 text-[12px]" disabled={!nextCursor || filtering} onClick={nextPage}>Next page <ChevronRight className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ClinicRow({ facility }: { facility: FacilityHit }) {
  const active = activeEvidenceRows(facility).filter((row) => row.value).slice(0, 3);
  const caption = facility.capabilities?.capabilities_caption;
  return (
    <tr className="border-t hairline align-top hover:bg-surface-muted/50">
      <td className="max-w-[340px] px-3 py-3">
        <Link href={`/facility/${facility.facility_id}`} className="font-medium text-primary hover:underline">{facility.name}</Link>
        <div className="mt-1 text-[11px] text-muted-foreground">{facility.facility_type || "Facility"}</div>
        {caption && <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-foreground/75">{caption}</div>}
      </td>
      <td className="px-3 py-3">
        <div className="font-medium">{formatLocation(facility)}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">ID {facility.facility_id.slice(0, 10)}</div>
      </td>
      <td className="px-3 py-3">
        <div className="flex max-w-[260px] flex-wrap gap-1">
          {active.length ? active.map((row) => <CapabilityBadge key={row.key} label={row.label} />) : <CapabilityBadge label="No active capability" dimmed />}
        </div>
      </td>
      <td className="min-w-[170px] px-3 py-3">
        <div className="flex flex-col gap-1.5">
          {facility.phone && <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><Phone className="h-3 w-3" /> {facility.phone}</span>}
          {facility.website && (
            <a href={facility.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline">
              <Globe className="h-3 w-3" /> Website <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {Boolean(facility.social_links?.length) && <SocialLinks links={facility.social_links ?? []} />}
          {!facility.phone && !facility.website && !facility.social_links?.length && <span className="text-[11px] text-muted-foreground">No contact listed</span>}
        </div>
      </td>
      <td className="px-3 py-3"><StatusBadge status={deriveStatus(facility)} /></td>
      <td className="px-3 py-3 text-right">
        <TrustRing score={facility.trust_score} status={deriveStatus(facility)} size={38} />
      </td>
    </tr>
  );
}

function SocialLinks({ links }: { links: NonNullable<FacilityHit["social_links"]> }) {
  return (
    <div className="flex flex-wrap gap-1">
      {links.slice(0, 4).map((link) => (
        <a
          key={`${link.kind}-${link.url}`}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          aria-label={link.label}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded border hairline bg-surface-muted px-1 text-[10px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary"
        >
          {socialMark(link.kind)}
        </a>
      ))}
    </div>
  );
}

function socialMark(kind: string): string {
  if (kind === "facebook") return "f";
  if (kind === "twitter") return "X";
  if (kind === "linkedin") return "in";
  if (kind === "instagram") return "IG";
  return ">";
}

function SelectLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="rounded-md border hairline bg-surface px-2.5 py-1">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function InputLabel({ label, value, onChange, onCommit, placeholder }: { label: string; value: string; onChange: (value: string) => void; onCommit: () => void; placeholder: string }) {
  return (
    <label className="rounded-md border hairline bg-surface px-2.5 py-1">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
        onKeyDown={(event) => {
          if (event.key === "Enter") onCommit();
        }}
        className="h-8 w-full bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
        placeholder={placeholder}
      />
    </label>
  );
}

function ClinicsSkeleton({ overlay }: { overlay?: boolean }) {
  return (
    <div className={cn(overlay ? "pointer-events-none absolute inset-4 z-10 rounded-lg bg-background/40 backdrop-blur-[1px]" : "")}>
      <div className="overflow-hidden rounded-lg border hairline bg-surface">
        {Array.from({ length: PAGE_SIZE }).map((_, index) => (
          <div key={index} className="grid grid-cols-[2fr_1.4fr_1.4fr_1fr_80px] gap-3 border-t hairline px-3 py-3 first:border-t-0">
            <div className="space-y-2"><div className="h-4 w-2/3 rounded loading-shimmer" /><div className="h-3 w-full rounded loading-shimmer" /></div>
            <div className="space-y-2"><div className="h-3 w-4/5 rounded loading-shimmer" /><div className="h-3 w-1/2 rounded loading-shimmer" /></div>
            <div className="flex gap-1"><div className="h-5 w-14 rounded loading-shimmer" /><div className="h-5 w-16 rounded loading-shimmer" /></div>
            <div className="h-5 w-24 rounded loading-shimmer" />
            <div className="ml-auto h-9 w-9 rounded-full loading-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
