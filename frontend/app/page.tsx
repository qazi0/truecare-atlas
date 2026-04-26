"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Brain, Map as MapIcon, Search, Zap } from "lucide-react";
import { AppShell, Hint, Metric } from "@/components/atlas/primitives";
import { Button } from "@/components/ui/button";
import { DEFAULT_PROMPTS } from "@/lib/atlas";
import type { DataHealthResponse, HealthCheck } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHIPS = ["NICU near Patna", "Map dialysis coverage in Chennai", "Oncology Mumbai", "Emergency surgery near Delhi", "Maternity Kerala needs review"];

export default function MissionControl() {
  const router = useRouter();
  const [promptIdx, setPromptIdx] = useState(0);
  const [mode, setMode] = useState<"fast" | "deep">("fast");
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [dataHealth, setDataHealth] = useState<DataHealthResponse | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setPromptIdx((i) => (i + 1) % DEFAULT_PROMPTS.length), 3500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void Promise.all([
      fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => null),
      fetch("/api/data-health").then((r) => r.json()).then(setDataHealth).catch(() => null),
    ]);
  }, []);

  const metrics = useMemo(() => {
    const raw = dataHealth?.metrics ?? {};
    const trust = (raw.trust ?? {}) as Record<string, number>;
    const tables = (raw.tables ?? {}) as Record<string, number>;
    const indexed = ((health?.checks?.vector_search as { indexed_rows?: number } | undefined)?.indexed_rows ?? 0);
    return {
      records: trust.total_facilities ?? tables.gold_facility_trust ?? 0,
      review: trust.review_needed ?? 0,
      contradictions: trust.contradictions ?? 0,
      indexed,
    };
  }, [dataHealth, health]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim() || DEFAULT_PROMPTS[promptIdx];
    router.push(`/command?q=${encodeURIComponent(q)}&mode=${mode}`);
  }

  return (
    <AppShell hideRail>
      <main className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 doc-grid opacity-70" />
          <div className="absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/15" />
          <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-trust/20" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/20 to-background" />
        </div>

        <div className="relative z-10 flex min-h-[calc(100svh-48px)] flex-col items-center justify-center px-4 py-8 md:-translate-y-6">
          <div className="w-full max-w-4xl">
            <div className="mb-5 flex justify-center">
              <span className="inline-flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-primary/15 bg-white/95 shadow-sm ring-1 ring-white">
                <Image
                  src="/logo.png"
                  alt=""
                  width={96}
                  height={96}
                  className="h-full w-full scale-[1.45] object-contain"
                  priority
                />
              </span>
            </div>
            <div className="mb-5 flex items-center justify-center gap-2 text-[11px] font-mono text-muted-foreground">
              <span className="h-px w-6 bg-hairline" />
              MISSION CONTROL
              <span className="h-px w-6 bg-hairline" />
            </div>
            <h1 className="text-center text-[34px] font-semibold leading-[1.05] tracking-tight md:whitespace-nowrap md:text-[40px] lg:text-[44px]">
              Know who can deliver <span className="text-primary">life-saving care.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-4xl text-center text-[14px] text-muted-foreground md:whitespace-nowrap md:text-[15px]">
              Audit healthcare facility records to identify verified capabilities, contradictions, and regional care gaps.
            </p>

            <form onSubmit={submit} className="mt-6">
              <div className="rounded-xl border hairline bg-surface shadow-sm focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/30">
                <div className="flex items-center gap-2 px-3 py-3 md:px-4">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="relative min-w-0 flex-1">
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="relative z-10 w-full bg-transparent text-[15px] outline-none placeholder:text-transparent md:text-base"
                      style={{
                        color: "#1b1f23",
                        caretColor: "#0f5e5a",
                        WebkitTextFillColor: "#1b1f23",
                      }}
                      aria-label="Ask TrueCare Atlas"
                      placeholder=""
                      autoComplete="off"
                    />
                    {!query && (
                      <span
                        key={promptIdx}
                        className="prompt-slide pointer-events-none absolute inset-0 z-20 flex items-center truncate text-[15px] md:text-base"
                        style={{ color: "#5a6169" }}
                      >
                        {DEFAULT_PROMPTS[promptIdx]}
                      </span>
                    )}
                  </div>
                  <Button type="submit" size="sm" className="hidden h-9 sm:inline-flex">Find trusted care <ArrowRight className="h-4 w-4" /></Button>
                </div>
                <div className="flex items-center justify-between gap-2 border-t hairline px-3 py-2 md:px-4">
                  <div className="inline-flex rounded-md border hairline bg-surface-muted p-0.5 text-[12px]">
                    <Hint text="Fast Search quickly matches the meaning of your request to relevant facilities and evidence.">
                      <ModeButton active={mode === "fast"} onClick={() => setMode("fast")} icon={Zap} label="Fast Search" />
                    </Hint>
                    <Hint text="Deep Reasoning uses an AI agent workflow to investigate the request, compare evidence, and explain the answer.">
                      <ModeButton active={mode === "deep"} onClick={() => setMode("deep")} icon={Brain} label="Deep Reasoning" />
                    </Hint>
                  </div>
                  <button type="button" onClick={() => router.push("/map")} className="hidden items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground sm:inline-flex">
                    <MapIcon className="h-3.5 w-3.5" /> Open capability map
                  </button>
                </div>
              </div>
              <Button type="submit" size="sm" className="mt-3 h-10 w-full sm:hidden">Find trusted care <ArrowRight className="h-4 w-4" /></Button>
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span className="mr-1 text-[11px] uppercase tracking-wider text-muted-foreground">Try</span>
              {CHIPS.map((chip) => (
                <button key={chip} onClick={() => router.push(`/command?q=${encodeURIComponent(chip)}&mode=fast`)} className="rounded-full border hairline bg-surface px-2.5 py-1 text-[12px] transition hover:border-primary/40 hover:text-primary">
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-12 grid w-full max-w-5xl grid-cols-2 gap-2 md:mt-16 md:grid-cols-4">
            <Metric label="Facility records" value={metrics.records.toLocaleString()} />
            <Metric label="Indexed rows" value={metrics.indexed.toLocaleString()} tone={metrics.indexed ? "trust" : "caution"} />
            <Metric label="Review needed" value={metrics.review.toLocaleString()} tone="caution" />
            <Metric label="Contradictions" value={metrics.contradictions.toLocaleString()} tone="alert" />
          </div>
        </div>
      </main>
    </AppShell>
  );
}

function ModeButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Zap; label: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-1 rounded-[4px] px-2.5 py-1 font-medium", active ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground")}>
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}
