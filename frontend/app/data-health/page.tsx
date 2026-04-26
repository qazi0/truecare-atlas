"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, CheckCircle2, Database, ExternalLink, FileSearch, Lock, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { AppShell, EmptyState, Metric } from "@/components/atlas/primitives";
import type { DataHealthResponse, HealthCheck, RecentTrace } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function DataHealthPage() {
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [data, setData] = useState<DataHealthResponse | null>(null);
  const [traces, setTraces] = useState<RecentTrace[]>([]);

  useEffect(() => {
    void Promise.all([
      fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => null),
      fetch("/api/data-health").then((r) => r.json()).then(setData).catch(() => null),
      fetch("/api/traces/recent?limit=10").then((r) => r.ok ? r.json() : []).then((items) => setTraces(Array.isArray(items) ? items : [])).catch(() => null),
    ]);
  }, []);

  const metrics = useMemo(() => {
    const raw = data?.metrics ?? {};
    return {
      trust: (raw.trust ?? {}) as Record<string, number>,
      tables: (raw.tables ?? {}) as Record<string, number>,
      caps: (raw.capabilities ?? {}) as Record<string, number>,
    };
  }, [data]);
  const vs = health?.checks?.vector_search as { ok?: boolean; indexed_rows?: number } | undefined;

  return (
    <AppShell>
      <div className="flex flex-1 flex-col gap-5 px-6 py-5">
        <header><h1 className="text-[20px] font-semibold tracking-tight">Data Health</h1><p className="max-w-2xl text-[13px] text-muted-foreground">Every facility recommendation is backed by governed tables, evidence quotes, trust rules, and model traces.</p></header>
        <div className="rounded-lg border hairline bg-surface"><ul className="grid grid-cols-2 divide-y divide-hairline md:grid-cols-5 md:divide-x md:divide-y-0"><Status label="App" state={health?.status === "error" ? "error" : "ok"} detail={health?.status ?? "loading"} icon={CheckCircle2} /><Status label="SQL Warehouse" state={(health?.checks?.sql as { ok?: boolean } | undefined)?.ok ? "ok" : "error"} detail={(health?.checks?.sql as { ok?: boolean } | undefined)?.ok ? "green" : "check"} icon={Database} /><Status label="Search Index" state={vs?.ok ? "ok" : "syncing"} detail={vs?.ok ? "ready" : "syncing"} icon={RefreshCw} /><Status label="Indexed Rows" state={vs?.indexed_rows ? "ok" : "syncing"} detail={(vs?.indexed_rows ?? 0).toLocaleString()} icon={FileSearch} /><Status label="Generated" state="ok" detail={data?.generated_at ? new Date(data.generated_at).toLocaleTimeString() : "Live"} icon={Activity} mono /></ul></div>
        <Section title="Pipeline lineage" subtitle="Bronze to Silver to Gold to serving">
          <div className="overflow-x-auto rounded-lg border hairline bg-surface p-4"><div className="flex min-w-[720px] items-stretch gap-2">{(data?.pipeline ?? []).map((stage, i) => <div key={`${stage.asset}-${i}`} className="flex flex-1 items-stretch"><div className="flex-1 rounded-md border hairline bg-background p-3"><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-trust" /><span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Stage {i + 1}</span></div><div className="mt-1.5 text-[13px] font-medium">{displayLabel(String(stage.stage))} · {displayLabel(String(stage.asset))}</div><div className="mt-2 text-[11px] text-muted-foreground">{displayLabel(String(stage.status))}</div></div>{i < (data?.pipeline.length ?? 0) - 1 && <div className="self-center px-1 text-muted-foreground">→</div>}</div>)}</div></div>
        </Section>
        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Governance foundation" subtitle="How facility data stays controlled"><div className="rounded-lg border hairline bg-surface p-4"><ul className="flex flex-col gap-2 text-[13px]">{(data?.governance?.length ? data.governance : ["Server-side proxy protects Databricks credentials.", "Facility recommendations include evidence and trust flags."]).map((text, i) => <Bullet key={text} icon={[Database, Server, Lock, ShieldCheck, CheckCircle2][i % 5]} text={text} />)}</ul></div></Section>
          <Section title="Evidence quality" subtitle="Coverage, audited capabilities, and review load"><div className="grid grid-cols-2 gap-2 rounded-lg border hairline bg-surface p-4"><Metric label="Total Facilities" value={(metrics.trust.total_facilities ?? metrics.tables.gold_facility_trust ?? 0).toLocaleString()} /><Metric label="Avg Trust Score" value={metrics.trust.avg_trust_score ?? "-"} tone="trust" /><Metric label="High Trust" value={(metrics.trust.high_trust ?? 0).toLocaleString()} tone="trust" /><Metric label="Review Needed" value={(metrics.trust.review_needed ?? 0).toLocaleString()} tone="caution" /><Metric label="Contradictions" value={(metrics.trust.contradictions ?? 0).toLocaleString()} tone="alert" /><Metric label="Capabilities" value={Object.keys(metrics.caps).length} /></div></Section>
          <Section title="Traceability" subtitle="Recent deep search traces"><div className="overflow-hidden rounded-lg border hairline bg-surface">{traces.length ? <table className="w-full text-[12px]"><thead className="bg-surface-muted text-muted-foreground"><tr><th className="px-3 py-2 text-left font-medium">Trace ID</th><th className="px-3 py-2 text-left font-medium">Query</th><th className="px-3 py-2 text-right font-medium">Time</th><th /></tr></thead><tbody>{traces.map((trace) => <tr key={trace.id} className="border-t hairline"><td className="px-3 py-2 font-mono text-muted-foreground">{trace.id}</td><td className="px-3 py-2">{trace.query || "Deep search"}</td><td className="px-3 py-2 text-right font-mono">{trace.duration_ms ? `${trace.duration_ms}ms` : "-"}</td><td className="px-3 py-2 text-right"><Link href={`/trace/${trace.id}`} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">Open <ExternalLink className="h-3 w-3" /></Link></td></tr>)}</tbody></table> : <div className="p-4"><EmptyState title="No recent traces available" detail="The API returns an empty list when MLflow trace search is unavailable." /></div>}</div></Section>
          <Section title="Data freshness" subtitle="Live values from health checks"><div className="rounded-lg border hairline bg-surface p-4"><Row label="Backend Status" value={health?.status ?? "loading"} tone={health?.status === "ok" ? "trust" : "caution"} /><Row label="Data-Health Status" value={data?.status ?? "loading"} tone={data?.status === "ok" ? "trust" : "caution"} /><Row label="Indexed Rows" value={(vs?.indexed_rows ?? 0).toLocaleString()} /><Row label="Tables Tracked" value={Object.keys(metrics.tables).length.toString()} /></div></Section>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <section><header className="mb-2"><h2 className="text-[13px] font-semibold">{title}</h2>{subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}</header>{children}</section>;
}

function Status({ label, state, detail, icon: Icon, mono }: { label: string; state: "ok" | "syncing" | "error"; detail: string; icon: typeof CheckCircle2; mono?: boolean }) {
  const color = state === "ok" ? "text-trust" : state === "syncing" ? "text-caution" : "text-alert";
  return <li className="flex items-center gap-3 px-4 py-3"><Icon className={cn("h-4 w-4", color, state === "syncing" && "animate-spin")} /><div className="min-w-0"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div><div className={cn("truncate text-[13px] font-medium", mono && "font-mono")}>{mono ? detail : displayLabel(detail)}</div></div></li>;
}

function Bullet({ icon: Icon, text }: { icon: typeof CheckCircle2; text: string }) {
  return <li className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 text-primary" /><span>{text}</span></li>;
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "trust" | "caution" }) {
  return <div className="flex justify-between border-b hairline py-2 text-[13px] last:border-0"><span className="text-muted-foreground">{label}</span><span className={cn("font-mono", tone === "trust" && "text-trust", tone === "caution" && "text-caution")}>{displayLabel(value)}</span></div>;
}

function displayLabel(value: string): string {
  const normalized = value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  return normalized
    .replace(/\bOk\b/g, "OK")
    .replace(/\bSql\b/g, "SQL")
    .replace(/\bId\b/g, "ID")
    .replace(/\bIcu\b/g, "ICU")
    .replace(/\bNicu\b/g, "NICU");
}
