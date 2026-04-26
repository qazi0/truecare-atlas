"use client";

/* eslint-disable react-hooks/set-state-in-effect, react/no-unescaped-entities */

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, AlertOctagon, Brain, CheckCircle2, ChevronDown, ChevronRight, Download, ExternalLink, FileText, Filter, Loader2, MapPin, Plus, Search, ShieldCheck, Zap } from "lucide-react";
import { AppShell, CapabilityBadge, EmptyState, EvidenceQuote, StatusBadge, TrustRing } from "@/components/atlas/primitives";
import { Button } from "@/components/ui/button";
import { activeEvidenceRows, addToShortlist, capabilityKeyFromQuery, capabilityLabel, deriveStatus, formatLocation, trustFlagTitle } from "@/lib/atlas";
import { cachedJson, readClientCache, writeClientCache } from "@/lib/client-cache";
import type { FacilityFull, FacilityHit, ValidatorResult } from "@/lib/types";
import { useStream } from "@/hooks/use-stream";
import { cn } from "@/lib/utils";

const COMMAND_STATE_KEY = "truecare.cache.command.state";
const FAST_SEARCH_TTL_MS = 5 * 60_000;
const FACILITY_TTL_MS = 10 * 60_000;
const VALIDATION_TTL_MS = 10 * 60_000;

interface CommandCacheState {
  query: string;
  mode: "fast" | "deep";
  results: FacilityHit[];
  selectedId: string | null;
}

export default function CommandPage() {
  return (
    <Suspense fallback={<AppShell><div className="p-6 text-sm text-muted-foreground">Loading command...</div></AppShell>}>
      <CommandContent />
    </Suspense>
  );
}

function CommandContent() {
  const params = useSearchParams();
  const router = useRouter();
  const urlQuery = params.get("q")?.trim() ?? "";
  const mode = (params.get("mode") === "deep" ? "deep" : "fast") as "fast" | "deep";
  const [query, setQuery] = useState(() => urlQuery || readClientCache<CommandCacheState>(COMMAND_STATE_KEY)?.query || "");
  const [results, setResults] = useState<FacilityHit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<FacilityFull | null>(null);
  const [validation, setValidation] = useState<ValidatorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [validationLoading, setValidationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const stream = useStream();

  function notify(kind: ToastMessage["kind"], title: string, detail?: string) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((items) => [...items, { id, kind, title, detail }].slice(-4));
    window.setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
    }, 3600);
  }

  useEffect(() => {
    if (!urlQuery) {
      const cached = readClientCache<CommandCacheState>(COMMAND_STATE_KEY);
      stream.reset();
      setQuery(cached?.query ?? "");
      setResults(cached?.results ?? []);
      setSelectedId(cached?.selectedId ?? cached?.results?.[0]?.facility_id ?? null);
      setSelected(null);
      setValidation(null);
      setError(null);
      setLoading(false);
      return;
    }

    setQuery(urlQuery);
    setSelected(null);
    setSelectedId(null);
    setValidation(null);
    setError(null);
    setLoading(true);
    if (mode === "deep") {
      void stream.submit(urlQuery);
    } else {
      stream.reset();
      cachedJson<FacilityHit[]>(
        `truecare.cache.command.fast.${urlQuery.toLowerCase()}`,
        `/api/search-quick?q=${encodeURIComponent(urlQuery)}&k=20`,
        FAST_SEARCH_TTL_MS,
        [],
      )
        .then((data) => {
          const nextResults = Array.isArray(data) ? data : [];
          setResults(nextResults);
          writeClientCache<CommandCacheState>(COMMAND_STATE_KEY, {
            query: urlQuery,
            mode,
            results: nextResults,
            selectedId: nextResults[0]?.facility_id ?? null,
          }, FAST_SEARCH_TTL_MS);
        })
        .catch((err) => {
          const message = (err as Error).message;
          setError(message);
          notify("error", "Search failed", message);
        })
        .finally(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQuery, mode]);

  useEffect(() => {
    if (mode === "deep") {
      setResults(stream.state.facilities);
      setLoading(stream.state.is_streaming && stream.state.facilities.length === 0);
      setError(stream.state.error);
      if (!stream.state.is_streaming && stream.state.facilities.length > 0) {
        writeClientCache<CommandCacheState>(COMMAND_STATE_KEY, {
          query: urlQuery,
          mode,
          results: stream.state.facilities,
          selectedId: stream.state.facilities[0]?.facility_id ?? null,
        }, FAST_SEARCH_TTL_MS);
      }
    }
  }, [mode, stream.state, urlQuery]);

  useEffect(() => {
    if (!selectedId && results[0]) setSelectedId(results[0].facility_id);
  }, [results, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    setSelected(null);
    setValidation(null);
    setSelectedLoading(true);
    setValidationLoading(true);
    cachedJson<FacilityFull | null>(
      `truecare.cache.facility.${selectedId}`,
      `/api/facility?id=${encodeURIComponent(selectedId)}`,
      FACILITY_TTL_MS,
      null,
    )
      .then((data) => setSelected(data))
      .catch((err) => notify("error", "Facility load failed", (err as Error).message))
      .finally(() => setSelectedLoading(false));
    cachedJson<ValidatorResult | null>(
      `truecare.cache.validate.${selectedId}`,
      `/api/validate?id=${encodeURIComponent(selectedId)}`,
      VALIDATION_TTL_MS,
      null,
    )
      .then((data) => {
        setValidation(data);
        if (data) notify("success", "Validation complete", "Medical plausibility checks are ready.");
      })
      .catch((err) => notify("error", "Validation failed", (err as Error).message))
      .finally(() => setValidationLoading(false));
  }, [selectedId]);

  const activeQuery = urlQuery || query;
  const capKey = capabilityKeyFromQuery(activeQuery);
  const verified = results.filter((f) => deriveStatus(f) === "Verified").length;
  const review = results.filter((f) => deriveStatus(f) !== "Verified").length;
  const summary = !activeQuery && results.length === 0
    ? "Enter a capability, facility type, or region to search live records."
    : mode === "deep" && stream.state.summary
    ? stream.state.summary
    : `Found ${results.length} candidate facilities for ${capabilityLabel(capKey)}. ${verified} are verified and ${review} need review. ${results[0]?.name ? `Highest-trust match is ${results[0].name}.` : ""}`;

  function resubmit() {
    const nextQuery = query.trim();
    if (!nextQuery) {
      setResults([]);
      setSelectedId(null);
      setSelected(null);
      setValidation(null);
      setLoading(false);
      router.push("/command");
      return;
    }
    router.push(`/command?q=${encodeURIComponent(nextQuery)}&mode=${mode}`);
  }

  async function exportSelectedFacility(id: string) {
    try {
      await exportFacility(id);
      notify("success", "Export ready", "Facility CSV downloaded.");
    } catch (err) {
      notify("error", "Export failed", (err as Error).message);
    }
  }

  function shortlistFacility(id: string) {
    addToShortlist(id);
    notify("success", "Added to shortlist", "The facility is available in the shortlist workspace.");
  }

  return (
    <AppShell>
      <ToastViewport toasts={toasts} />
      <div className="sticky top-12 z-30 border-b hairline bg-background">
        <div className="flex flex-col gap-2 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 flex-1 items-center gap-2 rounded-md border hairline bg-surface px-2.5 focus-within:ring-2 focus-within:ring-primary/30">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && resubmit()} aria-label="Search facilities" placeholder="Search facilities, capabilities, or regions" className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
              <span className="font-mono text-[11px] text-muted-foreground">{results.length} results</span>
            </div>
            <div className="hidden rounded-md border hairline bg-surface-muted p-0.5 text-[12px] md:inline-flex">
              <ModeLink q={query} mode="fast" active={mode === "fast"} icon={Zap} />
              <ModeLink q={query} mode="deep" active={mode === "deep"} icon={Brain} />
            </div>
            <Button size="sm" variant="outline" className="hidden h-9 md:inline-flex"><Filter className="h-3.5 w-3.5" /> Filters</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border hairline bg-surface px-2 py-0.5 text-muted-foreground">Capability: {capabilityLabel(capKey)}</span>
            <span className="rounded-full border hairline bg-surface px-2 py-0.5 text-muted-foreground">{mode === "deep" ? "Deep reasoning" : "Fast search"}</span>
            {stream.state.trace_id && <Link href={`/trace/${stream.state.trace_id}`} className="ml-auto font-mono text-primary hover:underline">trace {stream.state.trace_id}</Link>}
          </div>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="min-w-0 overflow-y-auto border-r hairline">
          <div className="m-4 rounded-lg border border-primary/20 bg-primary-soft/60 p-3.5">
            <div className="flex items-start gap-2.5">
              <Brain className="mt-1 h-4 w-4 text-primary" />
              <div className="text-[13px] leading-relaxed text-primary-soft-foreground">
                {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching live facility records...</span> : <FormattedSummary text={summary} />}
                <div className="mt-1.5 flex gap-3 font-mono text-[11px] text-muted-foreground">
                  <span>{mode}</span><span>{stream.state.steps.length || 1} steps</span>
                </div>
              </div>
            </div>
          </div>
          {error && <div className="mx-4 mb-3 rounded-md border border-alert/30 bg-alert-soft p-3 text-sm text-alert">{error}</div>}
          {loading ? <SearchSkeleton /> : (
            <ul className="flex flex-col gap-2 px-4 pb-4">
              {results.map((facility, i) => (
                <ResultRow key={facility.facility_id} facility={facility} selected={facility.facility_id === selectedId} onSelect={() => setSelectedId(facility.facility_id)} onShortlist={shortlistFacility} index={i} />
              ))}
            </ul>
          )}
          {!loading && results.length === 0 && <div className="p-4"><EmptyState title="No live matches" detail="Try a broader capability or geography." /></div>}
          <AgentActivity steps={stream.state.steps} traceId={stream.state.trace_id} isStreaming={stream.state.is_streaming} />
        </section>
        <aside className="hidden min-h-0 flex-col overflow-y-auto bg-surface lg:flex">
          {selectedLoading ? <InspectorSkeleton /> : selected ? <Inspector facility={selected} validation={validation} validationLoading={validationLoading} traceId={stream.state.trace_id} onExport={exportSelectedFacility} onShortlist={shortlistFacility} /> : <div className="p-4"><EmptyState title="Select a facility" /></div>}
        </aside>
      </div>
    </AppShell>
  );
}

function ModeLink({ q, mode, active, icon: Icon }: { q: string; mode: "fast" | "deep"; active: boolean; icon: typeof Zap }) {
  const trimmed = q.trim();
  const href = trimmed ? `/command?q=${encodeURIComponent(trimmed)}&mode=${mode}` : `/command?mode=${mode}`;
  return <Link href={href} className={cn("inline-flex items-center gap-1 rounded-[3px] px-2 py-1 capitalize", active ? "bg-surface shadow-sm" : "text-muted-foreground")}><Icon className="h-3 w-3" /> {mode}</Link>;
}

function ResultRow({ facility, selected, onSelect, onShortlist, index }: { facility: FacilityHit; selected: boolean; onSelect: () => void; onShortlist: (id: string) => void; index: number }) {
  const rows = activeEvidenceRows(facility);
  const status = deriveStatus(facility);
  return (
    <li className={cn("rounded-lg border p-3 transition", selected ? "border-primary/50 bg-primary-soft/40 ring-1 ring-primary/30" : "hairline bg-surface hover:border-primary/30")} style={{ animationDelay: `${index * 40}ms` }}>
      <div role="button" tabIndex={0} onClick={onSelect} onKeyDown={(e) => e.key === "Enter" && onSelect()} className="cursor-pointer">
        <div className="flex items-start gap-3">
          <TrustRing score={facility.trust_score} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[14px] font-medium">{facility.name}</span>
                  <StatusBadge status={status} />
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground"><MapPin className="h-3 w-3" /> {formatLocation(facility)}<span className="h-3 w-px bg-hairline" />{facility.facility_type || "Facility"}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onShortlist(facility.facility_id); }} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] text-muted-foreground hover:bg-surface-muted hover:text-foreground"><Plus className="h-3.5 w-3.5" /> Shortlist</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">{rows.slice(0, 5).map((row) => <CapabilityBadge key={row.key} label={row.label} />)}</div>
            {rows[0]?.quote && <p className="mt-2 truncate text-[12px] text-muted-foreground"><span className="mr-1.5 font-mono text-[10px] text-foreground/60">{rows[0].source}</span>"{rows[0].quote}"</p>}
          </div>
        </div>
      </div>
    </li>
  );
}

function Inspector({ facility, validation, validationLoading, traceId, onExport, onShortlist }: { facility: FacilityFull; validation: ValidatorResult | null; validationLoading: boolean; traceId: string | null; onExport: (id: string) => void; onShortlist: (id: string) => void }) {
  const rows = activeEvidenceRows(facility);
  const status = deriveStatus(facility);
  return (
    <>
      <div className="border-b hairline px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div><Link href={`/facility/${facility.facility_id}`} className="text-[15px] font-semibold hover:underline">{facility.name}</Link><div className="mt-0.5 text-[12px] text-muted-foreground">{formatLocation(facility)}</div></div>
          <TrustRing score={facility.trust_score} size={64} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2"><StatusBadge status={status} /><span className="font-mono text-[11px] text-muted-foreground">id {facility.facility_id}</span></div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" className="h-8 text-[12px]" onClick={() => onShortlist(facility.facility_id)}><Plus className="h-3.5 w-3.5" /> Add</Button>
          <Button size="sm" variant="outline" disabled={validationLoading || Boolean(validation)} className="h-8 text-[12px] disabled:opacity-70">{validationLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} {validation ? "Validated" : "Validate"}</Button>
          <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => onExport(facility.facility_id)}><Download className="h-3.5 w-3.5" /> Export</Button>
          <Link href={traceId ? `/trace/${traceId}` : `/facility/${facility.facility_id}`}><Button size="sm" variant="outline" className="h-8 w-full text-[12px]"><ExternalLink className="h-3.5 w-3.5" /> Trace</Button></Link>
        </div>
      </div>
      <Section title="Capability matrix">
        <table className="w-full text-[12px]"><tbody>{rows.slice(0, 8).map((row) => <tr key={row.key} className="border-b hairline last:border-0"><td className="py-1.5 font-medium">{row.label}</td><td className="py-1.5">{row.status}</td><td className="py-1.5 text-right font-mono">{row.confidence}</td></tr>)}</tbody></table>
      </Section>
      <Section title="Evidence quotes">{rows.filter((r) => r.quote).slice(0, 3).map((row) => <EvidenceQuote key={row.key} quote={row.quote!} source={row.source} confidence={row.confidence} contradicted={row.status === "Contradicted"} />)}</Section>
      <Section title="Trust audit">{facility.trust_report?.flags.length ? facility.trust_report.flags.map((flag) => <div key={flag.rule_id} className="rounded-md border hairline bg-surface px-2.5 py-1.5 text-[12px]"><AlertOctagon className="mr-1 inline h-3.5 w-3.5 text-alert" />{trustFlagTitle(flag)}</div>) : <p className="text-[12px] text-muted-foreground">No active trust flags.</p>}</Section>
      <Section title="Validation">
        {validationLoading ? (
          <div className="flex items-center gap-2 rounded-md border hairline bg-surface-muted px-3 py-2 text-[12px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Validation running...
          </div>
        ) : validation ? (
          <div className="rounded-md border border-trust/30 bg-trust-soft/70 px-3 py-2 text-[12px] text-foreground">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-trust"><CheckCircle2 className="h-3.5 w-3.5" /> Validation complete</div>
            <p className="text-muted-foreground">{validation.overall_assessment || validation.recommendation || "Validation completed successfully."}</p>
            {validation.findings?.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1.5">
                {validation.findings.slice(0, 4).map((finding) => (
                  <li key={finding.capability} className="rounded border hairline bg-surface px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{finding.capability.replaceAll("_", " ")}</span>
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-light uppercase tracking-wide",
                        finding.plausible ? "bg-trust-soft text-trust" : "bg-caution-soft text-caution",
                      )}>
                        {finding.plausible ? "Plausible" : "Needs review"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{finding.reasoning}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">Validation has not run.</p>
        )}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="border-b hairline p-4"><h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3><div className="flex flex-col gap-2">{children}</div></div>;
}

function AgentActivity({ steps, traceId, isStreaming }: { steps: ReturnType<typeof useStream>["state"]["steps"]; traceId: string | null; isStreaming: boolean }) {
  const [open, setOpen] = useState(true);
  if (!steps.length && !isStreaming) return null;
  return (
    <div className="mx-4 mb-6 rounded-lg border hairline bg-surface">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 border-b hairline px-3 py-2 text-[12px] font-medium">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}<Activity className="h-3.5 w-3.5 text-primary" /> Agent activity <span className="text-muted-foreground">· {steps.length} steps</span>{traceId && <span className="ml-auto font-mono text-[10px] text-muted-foreground">trace {traceId}</span>}
      </button>
      {open && <ol className="flex flex-col gap-1 p-2">{steps.map((s, i) => <li key={i} className="flex items-center gap-2 rounded px-2 py-1.5 text-[12px]"><span className="w-5 font-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span><span className="h-1.5 w-1.5 rounded-full bg-trust" /><span className="w-56 shrink-0 font-medium">{s.tool_call?.tool_name || s.description}</span><span className="flex-1 truncate text-muted-foreground">{s.reasoning_text || (s.tool_result ? "Tool result received" : "Running")}</span><FileText className="h-3 w-3 text-muted-foreground" /></li>)}</ol>}
    </div>
  );
}

async function exportFacility(id: string) {
  const resp = await fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facility_ids: [id], format: "csv", include_trust_audit: true, include_capabilities: true }) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "truecare-facility.csv"; a.click();
  URL.revokeObjectURL(url);
}

function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-4 pb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border hairline bg-surface p-3">
          <div className="flex items-start gap-3">
            <div className="loading-shimmer h-12 w-12 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="loading-shimmer h-4 w-2/5 rounded" />
              <div className="loading-shimmer h-3 w-3/5 rounded" />
              <div className="flex gap-1">
                <div className="loading-shimmer h-5 w-14 rounded" />
                <div className="loading-shimmer h-5 w-20 rounded" />
                <div className="loading-shimmer h-5 w-16 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InspectorSkeleton() {
  return (
    <div className="p-4">
      <div className="mb-4 flex items-start justify-between">
        <div className="space-y-2">
          <div className="loading-shimmer h-4 w-48 rounded" />
          <div className="loading-shimmer h-3 w-36 rounded" />
        </div>
        <div className="loading-shimmer h-16 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="loading-shimmer h-8 rounded" />)}
      </div>
      <div className="mt-5 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="loading-shimmer h-10 rounded" />)}
      </div>
    </div>
  );
}

function FormattedSummary({ text }: { text: string }) {
  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/(?<!\d)([.!?])\s+(?=[A-Z][a-z])/g, "$1\n")
    .replace(/\s+(\d+\.\s+(?=[A-Z]))/g, "\n$1")
    .trim();
  const lines = normalized.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return (
    <div className="space-y-1 leading-relaxed">
      {lines.map((line, index) => (
        <p key={`${line}-${index}`} className="max-w-4xl whitespace-normal">
          {line}
        </p>
      ))}
    </div>
  );
}

interface ToastMessage {
  id: string;
  kind: "success" | "error";
  title: string;
  detail?: string;
}

function ToastViewport({ toasts }: { toasts: ToastMessage[] }) {
  return (
    <div className="fixed right-4 top-16 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className={cn("rounded-md border bg-surface px-3 py-2 shadow-sm", toast.kind === "success" ? "border-trust/30" : "border-alert/30")}>
          <div className={cn("flex items-center gap-2 text-[13px] font-medium", toast.kind === "success" ? "text-trust" : "text-alert")}>
            {toast.kind === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertOctagon className="h-4 w-4" />}
            {toast.title}
          </div>
          {toast.detail && <p className="mt-0.5 text-[12px] text-muted-foreground">{toast.detail}</p>}
        </div>
      ))}
    </div>
  );
}
