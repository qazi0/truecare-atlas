"use client";

/* eslint-disable react/no-unescaped-entities */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertOctagon, ArrowLeft, Download, MapPin, Plus, ShieldCheck } from "lucide-react";
import { AppShell, Breadcrumbs, CapabilityBadge, EmptyState, EvidenceQuote, StatusBadge, TrustRing } from "@/components/atlas/primitives";
import { Button } from "@/components/ui/button";
import { activeEvidenceRows, addToShortlist, deriveStatus, formatLocation, trustFlagTitle } from "@/lib/atlas";
import type { FacilityFull, ValidatorResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = ["Overview", "Capabilities", "Trust Audit", "Validation", "Source Evidence", "Trace"] as const;
type Tab = typeof TABS[number];

export default function FacilityPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [facility, setFacility] = useState<FacilityFull | null>(null);
  const [validation, setValidation] = useState<ValidatorResult | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");

  useEffect(() => {
    fetch(`/api/facility?id=${encodeURIComponent(id)}`).then((r) => r.ok ? r.json() : null).then(setFacility).catch(() => null);
    fetch(`/api/validate?id=${encodeURIComponent(id)}`).then((r) => r.ok ? r.json() : null).then(setValidation).catch(() => null);
  }, [id]);

  if (!facility) return <AppShell><div className="p-6"><EmptyState title="Loading facility" detail={id} /></div></AppShell>;

  const rows = activeEvidenceRows(facility);
  const status = deriveStatus(facility);
  const contradiction = status === "Contradiction" || facility.trust_report?.flags.some((f) => f.severity === "red");

  return (
    <AppShell>
      <div className="border-b hairline bg-background">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Link href="/command" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back</Link>
          <Breadcrumbs items={[{ label: "Command", to: "/command" }, { label: facility.name }]} />
        </div>
      </div>
      <header className="border-b hairline bg-surface">
        <div className="flex flex-wrap items-start gap-5 px-6 py-5">
          <TrustRing score={facility.trust_score} size={84} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-[22px] font-semibold tracking-tight">{facility.name}</h1><StatusBadge status={status} /></div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {formatLocation(facility)}</span><span className="h-3 w-px bg-hairline" /><span>{facility.facility_type || "Facility"}</span><span className="h-3 w-px bg-hairline" /><span className="font-mono">id {facility.facility_id}</span></div>
            <div className="mt-3 flex flex-wrap gap-1">{rows.slice(0, 8).map((row) => <CapabilityBadge key={row.key} label={row.label} />)}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="h-8 text-[12px]" onClick={() => addToShortlist(facility.facility_id)}><Plus className="h-3.5 w-3.5" /> Shortlist</Button>
            <Button size="sm" variant="outline" className="h-8 text-[12px]"><ShieldCheck className="h-3.5 w-3.5" /> Validate</Button>
            <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => exportFacility(facility.facility_id)}><Download className="h-3.5 w-3.5" /> Export</Button>
            <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => createReview(facility)}><AlertOctagon className="h-3.5 w-3.5" /> Review</Button>
          </div>
        </div>
        <div className="px-6"><div className="-mb-px flex overflow-x-auto">{TABS.map((item) => <button key={item} onClick={() => setTab(item)} className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-[12px] font-medium", tab === item ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{item}</button>)}</div></div>
      </header>
      <div className="grid flex-1 grid-cols-1 gap-5 px-6 py-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {contradiction && <div className="mb-5 rounded-lg border border-alert/30 bg-alert-soft p-4 text-[13px] text-alert"><AlertOctagon className="mr-2 inline h-4 w-4" /> Contradiction detected in trust rules or facility claims. Review before field use.</div>}
          {(tab === "Overview" || tab === "Capabilities") && <Section title="Capability matrix" subtitle="Per-capability claim, evidence, and confidence"><CapabilityTable rows={rows} /></Section>}
          {(tab === "Overview" || tab === "Trust Audit") && <Section title="Trust audit" subtitle="Rules evaluated against evidence"><TrustAudit facility={facility} /></Section>}
          {tab === "Validation" && <Section title="Validation" subtitle="Medical-plausibility checks">{validation ? <Validation validation={validation} /> : <p className="text-sm text-muted-foreground">Validation running...</p>}</Section>}
          {(tab === "Overview" || tab === "Source Evidence") && <Section title="Source evidence" subtitle="Verbatim quotes from facility records"><div className="grid gap-3 sm:grid-cols-2">{rows.filter((r) => r.quote).map((row) => <div key={row.key} className="rounded-md border hairline bg-surface p-3"><EvidenceQuote quote={row.quote!} source={row.source} confidence={row.confidence} contradicted={row.status === "Contradicted"} /></div>)}</div></Section>}
          {tab === "Trace" && <Section title="Trace" subtitle="Facility scoring provenance"><TracePanel id={facility.facility_id} rows={rows.length} flags={facility.trust_report?.flags.length ?? 0} /></Section>}
        </div>
        <aside className="flex flex-col gap-4">
          <Panel title="Trust score"><div className="flex items-center gap-3"><TrustRing score={facility.trust_score} size={64} /><p className="text-[12px] text-muted-foreground">Score combines evidence directness, trust flags, and cross-field plausibility.</p></div></Panel>
          <Panel title="Evidence summary"><Summary rows={rows} /></Panel>
          <Panel title="Provenance"><ul className="flex flex-col gap-1 font-mono text-[12px] text-muted-foreground"><li>silver_facility</li><li>gold_facility_capabilities</li><li>gold_facility_trust</li><li>validator agent</li></ul></Panel>
        </aside>
      </div>
    </AppShell>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <section className="mb-5"><header className="mb-2"><h2 className="text-[13px] font-semibold">{title}</h2>{subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}</header>{children}</section>;
}

function CapabilityTable({ rows }: { rows: ReturnType<typeof activeEvidenceRows> }) {
  return <div className="overflow-hidden rounded-md border hairline bg-surface"><table className="w-full text-[12px]"><thead className="bg-surface-muted text-muted-foreground"><tr><th className="px-3 py-2 text-left font-medium">Capability</th><th className="px-3 py-2 text-left font-medium">Status</th><th className="px-3 py-2 text-left font-medium">Evidence</th><th className="px-3 py-2 text-left font-medium">Source</th><th className="px-3 py-2 text-right font-medium">Confidence</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key} className="border-t hairline align-top"><td className="px-3 py-2 font-medium">{row.label}</td><td className="px-3 py-2">{row.status}</td><td className="max-w-[420px] px-3 py-2 text-foreground/80">{row.quote || "No quote captured"}</td><td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{row.source || "unknown"}</td><td className="px-3 py-2 text-right font-mono">{row.confidence}</td></tr>)}</tbody></table></div>;
}

function TrustAudit({ facility }: { facility: FacilityFull }) {
  const flags = facility.trust_report?.flags ?? [];
  if (!flags.length) return <EmptyState title="No active trust flags" />;
  return <ul className="flex flex-col gap-2">{flags.map((flag) => <li key={flag.rule_id} className="rounded-md border hairline bg-surface p-3 text-[13px]"><div className="font-medium"><span className="mr-2 font-mono text-[11px] text-muted-foreground">{flag.rule_id}</span>{trustFlagTitle(flag)}</div>{flag.evidence_quotes.map((quote) => <p key={quote} className="mt-1 text-[12px] text-muted-foreground">"{quote}"</p>)}</li>)}</ul>;
}

function Validation({ validation }: { validation: ValidatorResult }) {
  return <div className="rounded-md border hairline bg-surface p-4 text-[13px]"><p>{validation.overall_assessment || validation.recommendation}</p><ul className="mt-3 flex flex-col gap-2">{validation.findings.map((finding) => <li key={finding.capability} className="border-t hairline pt-2"><strong>{finding.capability}</strong>: {finding.reasoning}</li>)}</ul></div>;
}

function TracePanel({ id, rows, flags }: { id: string; rows: number; flags: number }) {
  const items = [["facility_lookup", id], ["capability_matrix", `${rows} evidence rows`], ["trust_audit", `${flags} flags`], ["validation", "on demand"]];
  return <div className="overflow-hidden rounded-md border hairline bg-surface"><table className="w-full text-[12px]"><tbody>{items.map(([tool, result], i) => <tr key={tool} className="border-t hairline first:border-t-0"><td className="px-3 py-2 font-mono text-muted-foreground">{String(i + 1).padStart(2, "0")}</td><td className="px-3 py-2 font-mono">{tool}</td><td className="px-3 py-2">{result}</td></tr>)}</tbody></table></div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-md border hairline bg-surface p-4"><h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>{children}</div>;
}

function Summary({ rows }: { rows: ReturnType<typeof activeEvidenceRows> }) {
  return <ul className="flex flex-col gap-1 text-[12px]"><li className="flex justify-between"><span className="text-muted-foreground">Total rows</span><span className="font-mono">{rows.length}</span></li><li className="flex justify-between"><span className="text-muted-foreground">Direct</span><span className="font-mono">{rows.filter((r) => r.status === "Direct").length}</span></li><li className="flex justify-between"><span className="text-muted-foreground">Weak</span><span className="font-mono">{rows.filter((r) => r.status === "Weak").length}</span></li><li className="flex justify-between"><span className="text-muted-foreground">Contradicted</span><span className="font-mono">{rows.filter((r) => r.status === "Contradicted").length}</span></li></ul>;
}

async function createReview(facility: FacilityFull) {
  await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facility_id: facility.facility_id, facility_name: facility.name, reason: "Manual facility review requested", severity: facility.has_contradiction ? "red" : "yellow", evidence_for: [], evidence_against: [] }) });
}

async function exportFacility(id: string) {
  const resp = await fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facility_ids: [id], format: "csv", include_trust_audit: true, include_capabilities: true }) });
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "truecare-facility.csv"; a.click();
  URL.revokeObjectURL(url);
}
