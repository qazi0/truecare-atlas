"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileJson, FileSpreadsheet, Loader2, Quote, ShieldCheck, X } from "lucide-react";
import { AppShell, CapabilityBadge, EmptyState, Metric, StatusBadge, TrustRing } from "@/components/atlas/primitives";
import { Button } from "@/components/ui/button";
import { activeEvidenceRows, deriveStatus, formatLocation, removeFromShortlist, setShortlistIds, shortlistIds } from "@/lib/atlas";
import type { FacilityFull } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ShortlistPage() {
  const [ids, setIds] = useState<string[]>([]);
  const [facilities, setFacilities] = useState<FacilityFull[]>([]);
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [includeAudit, setIncludeAudit] = useState(true);
  const [includeCaps, setIncludeCaps] = useState(true);
  const [comparison, setComparison] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    const loadIds = () => setIds(shortlistIds());
    loadIds();
    window.addEventListener("truecare.shortlist.changed", loadIds);
    return () => window.removeEventListener("truecare.shortlist.changed", loadIds);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!ids.length) {
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setFacilities([]);
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    void Promise.all(ids.map((id) => fetch(`/api/facility?id=${encodeURIComponent(id)}`).then((r) => r.ok ? r.json() : null).catch(() => null)))
      .then((items) => {
        if (!cancelled) setFacilities(items.filter(Boolean) as FacilityFull[]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const stats = useMemo(() => ({
    verified: facilities.filter((f) => deriveStatus(f) === "Verified").length,
    review: facilities.filter((f) => deriveStatus(f) !== "Verified").length,
    states: new Set(facilities.map((f) => f.state).filter(Boolean)).size,
    evidence: facilities.reduce((acc, f) => acc + activeEvidenceRows(f).length, 0),
  }), [facilities]);

  function remove(id: string) {
    setBusyAction(`remove:${id}`);
    removeFromShortlist(id);
    setIds(shortlistIds());
    window.setTimeout(() => setBusyAction(null), 250);
  }

  async function runExport(actionId: string) {
    setBusyAction(actionId);
    try {
      await exportPlan(ids, format, includeAudit, includeCaps);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-1 flex-col gap-5 px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-[20px] font-semibold tracking-tight">Shortlist</h1><p className="text-[12px] text-muted-foreground">Convert live search results into an exportable field verification plan.</p></div>
          <div className="flex gap-2"><Button size="sm" variant="outline" className="h-9 text-[12px]" onClick={() => setComparison(!comparison)}>Comparison Mode</Button><Button size="sm" className="h-9 text-[12px]" disabled={busyAction === "export-top" || !ids.length} onClick={() => runExport("export-top")}>{busyAction === "export-top" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Export</Button></div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4"><Metric label="Facilities" value={facilities.length} /><Metric label="Verified" value={stats.verified} tone="trust" /><Metric label="Needs Review" value={stats.review} tone="caution" /><Metric label="Evidence Rows" value={stats.evidence} /></div>
        <div className="overflow-hidden rounded-lg border hairline bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-surface-muted text-muted-foreground"><tr><th className="px-3 py-2 text-left font-medium">Facility</th><th className="px-3 py-2 text-left font-medium">Location</th><th className="px-3 py-2 text-left font-medium">Capabilities</th><th className="px-3 py-2 text-right font-medium">Trust</th><th className="px-3 py-2 text-left font-medium">Status</th>{comparison && <th className="px-3 py-2 text-left font-medium">Evidence</th>}<th /></tr></thead>
              <tbody>
                {loading && <ShortlistSkeletonRows comparison={comparison} />}
                {!loading && facilities.map((facility) => {
                  const rows = activeEvidenceRows(facility);
                  const removing = busyAction === `remove:${facility.facility_id}`;
                  return <tr key={facility.facility_id} className="border-t hairline align-top"><td className={cn("px-3 py-2 transition", removing && "opacity-50")}><div className="flex items-center gap-2"><TrustRing score={facility.trust_score} size={28} showLabel={false} /><Link href={`/facility/${facility.facility_id}`} className="font-medium hover:underline">{facility.name}</Link></div><div className="ml-9 mt-0.5 text-[11px] text-muted-foreground">{facility.facility_type}</div></td><td className="px-3 py-2">{formatLocation(facility)}</td><td className="px-3 py-2"><div className="flex max-w-[260px] flex-wrap gap-1">{rows.slice(0, 4).map((row) => <CapabilityBadge key={row.key} label={row.label} />)}{rows.length > 4 && <CapabilityBadge label={`+${rows.length - 4}`} dimmed />}</div></td><td className="px-3 py-2 text-right font-mono">{facility.trust_score ?? "-"}</td><td className="px-3 py-2"><StatusBadge status={deriveStatus(facility)} /></td>{comparison && <td className="max-w-[320px] px-3 py-2 text-muted-foreground">{rows[0]?.quote || "No Quote Captured"}</td>}<td className="px-3 py-2 text-right"><button disabled={removing} onClick={() => remove(facility.facility_id)} aria-label={`Remove ${facility.name}`} className="text-muted-foreground hover:text-alert disabled:opacity-50">{removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}</button></td></tr>;
                })}
                {!loading && facilities.length === 0 && <tr><td colSpan={comparison ? 7 : 6} className="p-6"><EmptyState title="No Facilities Selected" detail="Add facilities from Search or Facility Detail." /></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="rounded-lg border hairline bg-surface p-4">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Export Settings</h3>
            <div className="mb-4 flex flex-wrap gap-2"><FormatBtn active={format === "csv"} onClick={() => setFormat("csv")} icon={FileSpreadsheet} label="CSV" /><FormatBtn active={format === "json"} onClick={() => setFormat("json")} icon={FileJson} label="JSON" /></div>
            <div className="flex flex-col gap-2"><Check label="Include Trust Audit" icon={ShieldCheck} on={includeAudit} onChange={setIncludeAudit} /><Check label="Include Capabilities" icon={Quote} on={includeCaps} onChange={setIncludeCaps} /></div>
          </div>
          <div className="rounded-lg border hairline bg-surface p-4">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Plan Summary</h3>
            <ul className="flex flex-col gap-1 text-[12px]"><Li label="Facilities" value={facilities.length} /><Li label="States" value={stats.states} /><Li label="Evidence Rows" value={stats.evidence} /></ul>
            <Button className="mt-4 h-9 w-full text-[12px]" disabled={busyAction === "export-side" || !ids.length} onClick={() => runExport("export-side")}>{busyAction === "export-side" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Export Field Plan</Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function FormatBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Download; label: string }) {
  return <button onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-medium", active ? "border-primary bg-primary text-primary-foreground" : "hairline bg-surface hover:border-primary/40")}><Icon className="h-3.5 w-3.5" /> {label}</button>;
}

function Check({ label, icon: Icon, on, onChange }: { label: string; icon: typeof Download; on: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex cursor-pointer items-center gap-2 text-[13px]"><input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="accent-[hsl(var(--primary))]" /><Icon className="h-3.5 w-3.5 text-muted-foreground" />{label}</label>;
}

function Li({ label, value }: { label: string; value: number }) {
  return <li className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-mono">{value}</span></li>;
}

function ShortlistSkeletonRows({ comparison }: { comparison: boolean }) {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i} className="border-t hairline">
          <td className="px-3 py-3"><div className="flex items-center gap-2"><div className="loading-shimmer h-7 w-7 rounded-full" /><div className="space-y-1.5"><div className="loading-shimmer h-3.5 w-48 rounded" /><div className="loading-shimmer h-2.5 w-20 rounded" /></div></div></td>
          <td className="px-3 py-3"><div className="loading-shimmer h-3.5 w-32 rounded" /></td>
          <td className="px-3 py-3"><div className="flex gap-1"><div className="loading-shimmer h-5 w-16 rounded" /><div className="loading-shimmer h-5 w-20 rounded" /></div></td>
          <td className="px-3 py-3 text-right"><div className="loading-shimmer ml-auto h-3.5 w-8 rounded" /></td>
          <td className="px-3 py-3"><div className="loading-shimmer h-5 w-24 rounded-full" /></td>
          {comparison && <td className="px-3 py-3"><div className="loading-shimmer h-3.5 w-52 rounded" /></td>}
          <td className="px-3 py-3"><div className="loading-shimmer ml-auto h-4 w-4 rounded" /></td>
        </tr>
      ))}
    </>
  );
}

async function exportPlan(ids: string[], format: "csv" | "json", includeAudit: boolean, includeCaps: boolean) {
  if (!ids.length) return;
  setShortlistIds(ids);
  const resp = await fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facility_ids: ids, format, include_trust_audit: includeAudit, include_capabilities: includeCaps }) });
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `truecare-field-plan.${format}`; a.click();
  URL.revokeObjectURL(url);
}
