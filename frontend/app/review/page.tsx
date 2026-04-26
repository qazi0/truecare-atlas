"use client";

/* eslint-disable react-hooks/set-state-in-effect, react/no-unescaped-entities */

import { useEffect, useMemo, useState } from "react";
import { Activity, Check, CheckCircle2, ChevronRight, Loader2, MessageSquare, Phone, UserPlus, X, Zap } from "lucide-react";
import { AppShell, EmptyState, Hint } from "@/components/atlas/primitives";
import { Button } from "@/components/ui/button";
import { clearClientCache, readClientCache, writeClientCache } from "@/lib/client-cache";
import type { AutoReviewRunResponse, AutoReviewSummary, ReviewTask } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = ["Urgent", "Phone verify", "Field visit", "Specialist review", "Low-risk", "Rejected"] as const;
const REVIEW_CACHE_KEY = "truecare.cache.reviews";
const REVIEW_TTL_MS = 30_000;
const REVIEW_PAGE_SIZE = 8;
const TRIAGE_STEPS = [
  "Pull next 50 generated candidates",
  "Classify evidence gaps and contradictions",
  "Assign phone, field, specialist, or low-risk buckets",
  "Refresh queue summary",
];
type CounterFilter = "open" | "progress" | "contradictions" | "generated" | null;

interface ReviewGroup {
  facilityId: string;
  facilityName: string;
  tasks: ReviewTask[];
  severity: ReviewTask["severity"];
  owner: string | null;
}

export default function ReviewPage() {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Urgent");
  const [summary, setSummary] = useState<AutoReviewSummary | null>(null);
  const [triaging, setTriaging] = useState(false);
  const [triageRun, setTriageRun] = useState<AutoReviewRunResponse | null>(null);
  const [triageStep, setTriageStep] = useState(0);
  const [approvingTriage, setApprovingTriage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [counterFilter, setCounterFilter] = useState<CounterFilter>(null);
  const [page, setPage] = useState(0);

  async function load(force = false) {
    const cached = readClientCache<ReviewTask[]>(REVIEW_CACHE_KEY);
    if (!force && cached?.length) {
      setTasks(cached);
      setLoading(false);
      void fetch("/api/reviews/summary").then((r) => r.ok ? r.json() : null).then(setSummary).catch(() => null);
      return;
    }
    setLoading(true);
    const data = await fetch("/api/reviews").then((r) => r.ok ? r.json() : []);
    const nextTasks = Array.isArray(data) ? data : [];
    if (nextTasks.length) writeClientCache(REVIEW_CACHE_KEY, nextTasks, REVIEW_TTL_MS);
    setTasks(nextTasks);
    await fetch("/api/reviews/summary").then((r) => r.ok ? r.json() : null).then(setSummary).catch(() => null);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => tasks.filter((task) => {
    if (counterFilter === "open") return task.status === "pending";
    if (counterFilter === "progress") return task.status === "phone_verification";
    if (counterFilter === "contradictions") return task.severity === "red";
    if (counterFilter === "generated") return task.source === "generated";
    return matchesTab(task, tab);
  }), [counterFilter, tab, tasks]);

  const groups = useMemo(() => groupReviewTasks(filtered), [filtered]);
  const totalPages = Math.max(1, Math.ceil(groups.length / REVIEW_PAGE_SIZE));
  const visibleGroups = useMemo(() => groups.slice(page * REVIEW_PAGE_SIZE, (page + 1) * REVIEW_PAGE_SIZE), [groups, page]);

  const counters = {
    open: tasks.filter((t) => t.status === "pending").length,
    progress: tasks.filter((t) => t.status === "phone_verification").length,
    contradictions: tasks.filter((t) => t.severity === "red").length,
    generated: tasks.filter((t) => t.source === "generated").length,
  };
  const tabCounts = useMemo(() => Object.fromEntries(TABS.map((item) => [item, tasks.filter((task) => matchesTab(task, item)).length])) as Record<(typeof TABS)[number], number>, [tasks]);

  useEffect(() => {
    setPage(0);
  }, [counterFilter, tab]);

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  function applyCounterFilter(filter: CounterFilter) {
    setFilterLoading(true);
    setPage(0);
    window.setTimeout(() => {
      setCounterFilter((current) => current === filter ? null : filter);
      setFilterLoading(false);
    }, 260);
  }

  async function runAutoTriage() {
    setTriageRun(null);
    setTriageStep(0);
    setTriaging(true);
    const runPromise = fetch("/api/reviews/auto-run?limit=50", { method: "POST" }).then((r) => r.ok ? r.json() : null).then((data) => {
      if (data?.summary) setSummary(data.summary);
      if (data) setTriageRun(data);
    }).catch(() => null);
    await Promise.all([runPromise, playStepSequence(setTriageStep, TRIAGE_STEPS.length)]);
    setTriageStep(TRIAGE_STEPS.length);
    clearClientCache(REVIEW_CACHE_KEY);
    await load(true);
    setTriaging(false);
  }

  async function approveAutoTriage() {
    if (!triageRun?.results.length) return;
    setApprovingTriage(true);
    await Promise.all(triageRun.results.map((item) => {
      const body = reviewPatchForBucket(item.bucket);
      return fetch(`/api/reviews/${encodeURIComponent(item.task_id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }));
    clearClientCache(REVIEW_CACHE_KEY);
    await load(true);
    setApprovingTriage(false);
  }

  async function patch(id: string, body: Partial<ReviewTask> & { note?: string }) {
    await fetch(`/api/reviews/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    clearClientCache(REVIEW_CACHE_KEY);
    await load(true);
  }

  async function patchMany(ids: string[], body: Partial<ReviewTask> & { note?: string }) {
    await Promise.all(ids.map((id) => fetch(`/api/reviews/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })));
    clearClientCache(REVIEW_CACHE_KEY);
    await load(true);
  }

  async function addNote(ids: string[]) {
    const note = window.prompt("Add review note", "Reviewed in TrueCare Atlas");
    if (!note?.trim()) return;
    await patchMany(ids, { note: note.trim() });
  }

  return (
    <AppShell>
      <div className="sticky top-12 z-30 border-b hairline bg-background">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <h1 className="text-[16px] font-semibold tracking-tight">Review queue</h1>
          <Counter label="Open" value={counters.open} active={counterFilter === "open"} onClick={() => applyCounterFilter("open")} />
          <Counter label="In progress" value={counters.progress} tone="caution" active={counterFilter === "progress"} onClick={() => applyCounterFilter("progress")} />
          <Counter label="Contradictions" value={counters.contradictions} tone="alert" active={counterFilter === "contradictions"} onClick={() => applyCounterFilter("contradictions")} />
          <Counter label="Generated" value={counters.generated} active={counterFilter === "generated"} onClick={() => applyCounterFilter("generated")} />
          {summary && <span className="rounded-md border hairline bg-surface px-2 py-1 text-[11px] text-muted-foreground">{summary.total_candidates.toLocaleString()} candidates to {summary.buckets.phone_verify ?? 0} phone, {summary.buckets.field_visit_required ?? 0} field, {summary.buckets.auto_verified_low_risk ?? 0} low-risk</span>}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Hint text="Groups the next review candidates by the kind of follow-up they need, then lets you approve the suggested actions.">
              <Button size="sm" className="h-9 px-4 text-[13px]" disabled={triaging} onClick={runAutoTriage}>{triaging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Auto-triage next 50 review items</Button>
            </Hint>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto border-t hairline px-4 py-2">
          {TABS.map((item) => <button key={item} onClick={() => setTab(item)} className={cn("whitespace-nowrap rounded-md px-2.5 py-1 text-[12px]", tab === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-muted")}>{item} <span className="ml-1 font-mono opacity-80">{tabCounts[item] ?? 0}</span></button>)}
        </div>
      </div>
      <div className="flex flex-col gap-3 p-4">
        {(triaging || triageRun) && <TriageActivity running={triaging} step={triageStep} run={triageRun} approving={approvingTriage} onApprove={approveAutoTriage} />}
        {(loading || filterLoading) && <ReviewSkeleton />}
        {!loading && !filterLoading && visibleGroups.map((group) => (
          <article key={group.facilityId} className="rounded-lg border hairline bg-surface">
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_220px]">
              <div className="min-w-0 border-b hairline p-4 lg:border-b-0 lg:border-r">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {group.tasks.length} {group.tasks.length === 1 ? "issue" : "issues"}
                  </span>
                  <Severity severity={group.severity} />
                </div>
                <div className="mt-1.5 text-[14px] font-medium leading-tight">{group.facilityName}</div>
                <div className="mt-2 flex flex-wrap gap-1">{group.tasks.map((task) => <IssueBadge key={task.id} task={task} />)}</div>
                <div className="mt-3 text-[11px] text-muted-foreground">Owner: <span className="font-medium text-foreground">{displayReviewLabel(group.owner || "Unassigned")}</span></div>
                <div className="text-[11px] text-muted-foreground">Status: <span className="font-medium text-foreground">{statusSummary(group.tasks)}</span></div>
              </div>
              <div className="flex flex-col gap-3 p-4">
                {group.tasks.map((task) => (
                  <div key={task.id} className="rounded-md border hairline bg-background p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <IssueBadge task={task} />
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Claim under review</div>
                      <span className="ml-auto text-[11px] text-muted-foreground">Source: <span className="font-medium text-foreground">{displayReviewLabel(task.source)}</span></span>
                    </div>
                    <p className="mt-1 text-[13px]">"{task.claim || task.reason}"</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Evidence title="Evidence for" tone="trust" items={task.evidence_for} />
                      <Evidence title="Evidence against" tone="alert" items={task.evidence_against} />
                    </div>
                    {task.notes.length > 0 && (
                      <div className="mt-3 rounded-md border hairline bg-surface-muted px-2.5 py-2 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">Latest note:</span> {task.notes.at(-1)?.text}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Button size="sm" disabled={task.status === "phone_verification"} className="h-7 text-[11px]" onClick={() => patch(task.id, { status: "phone_verification", note: "Phone verification requested" })}><Phone className="h-3.5 w-3.5" /> {task.status === "phone_verification" ? "Phone requested" : "Phone"}</Button>
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => patch(task.id, { status: "accepted", note: "Claim accepted" })}><Check className="h-3.5 w-3.5" /> Accept</Button>
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => patch(task.id, { status: "rejected", note: "Claim rejected" })}><X className="h-3.5 w-3.5" /> Reject</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1.5 border-t hairline p-4 lg:border-l lg:border-t-0">
                <div className="mb-2 text-[11px] text-muted-foreground">Facility-level actions apply to all visible issues in this card.</div>
                <Button size="sm" variant="ghost" className="h-8 justify-start text-[12px]" onClick={() => patchMany(group.tasks.map((task) => task.id), { owner: "Field team" })}><UserPlus className="h-3.5 w-3.5" /> Assign reviewer</Button>
                <Button size="sm" variant="ghost" className="h-8 justify-start text-[12px]" onClick={() => addNote(group.tasks.map((task) => task.id))}><MessageSquare className="h-3.5 w-3.5" /> Add note</Button>
              </div>
            </div>
          </article>
        ))}
        {!loading && !filterLoading && groups.length > REVIEW_PAGE_SIZE && (
          <div className="flex items-center justify-between rounded-md border hairline bg-surface px-3 py-2 text-[12px] text-muted-foreground">
            <span>Page {page + 1} of {totalPages} · showing {visibleGroups.length} of {groups.length} facility groups</span>
            <Button size="sm" variant="outline" className="h-8 text-[12px]" disabled={page >= totalPages - 1} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}>
              Next page <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {!loading && !filterLoading && !groups.length && <EmptyState title="No review tasks match filters" />}
      </div>
    </AppShell>
  );
}

function Counter({ label, value, tone, active, onClick }: { label: string; value: number; tone?: "caution" | "alert"; active: boolean; onClick: () => void }) {
  const color = tone === "alert" ? "text-alert" : tone === "caution" ? "text-caution" : "text-foreground";
  return <button onClick={onClick} className={cn("inline-flex items-baseline gap-1.5 rounded-md border px-2 py-1 transition", active ? "border-primary bg-primary-soft text-primary" : "hairline bg-surface hover:border-primary/40")}><span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span><span className={cn("font-mono text-[13px] font-semibold", color)}>{value}</span></button>;
}

function TriageActivity({ running, step, run, approving, onApprove }: { running: boolean; step: number; run: AutoReviewRunResponse | null; approving: boolean; onApprove: () => void }) {
  const visibleSteps = TRIAGE_STEPS.slice(0, Math.max(1, Math.min(TRIAGE_STEPS.length, step + 1)));
  return (
    <div className="rounded-lg border border-primary/20 bg-primary-soft/60 p-3.5">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-primary-soft-foreground">
        {running ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <CheckCircle2 className="h-4 w-4 text-trust" />}
        Auto-triage agent
        {run && <span className="ml-auto font-mono text-[11px] text-muted-foreground">{run.processed} proposed</span>}
      </div>
      <ol className="flex flex-col gap-2">
        {visibleSteps.map((item, index) => {
          const done = step > index;
          const active = running && step === index;
          return (
            <li key={item} className="prompt-slide rounded-md border hairline bg-surface/80 px-3 py-2 text-[12px]">
              <div className="flex items-center gap-2">
                {active ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : done ? <CheckCircle2 className="h-3.5 w-3.5 text-trust" /> : <span className="h-3.5 w-3.5 rounded-full border hairline" />}
                <span>{item}</span>
              </div>
            </li>
          );
        })}
      </ol>
      {run && (
        <div className="mt-3 grid gap-3 lg:grid-cols-[260px_1fr]">
          <div className="rounded-md border hairline bg-surface/80 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bucket summary</div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
              {Object.entries(run.summary.buckets).map(([bucket, count]) => (
                <div key={bucket} className="flex items-center justify-between rounded bg-surface-muted px-2 py-1">
                  <span>{bucketLabel(bucket)}</span>
                  <span className="font-mono">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md border hairline bg-surface/80 p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><Activity className="h-3 w-3" /> Proposed classifications</div>
            <ul className="grid gap-1.5 md:grid-cols-2">
              {run.results.slice(0, 6).map((item, index) => (
                <li key={`${item.facility_id}-${item.bucket}-${index}`} className="rounded border hairline bg-background px-2 py-1.5 text-[11px]">
                  <div className="truncate font-medium">{item.facility_name || item.facility_id}</div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-muted-foreground">
                    <span>{bucketLabel(item.bucket)}</span>
                    <Severity severity={item.severity} />
                  </div>
                </li>
              ))}
            </ul>
            <Button size="sm" className="mt-3 h-8 text-[12px]" disabled={approving} onClick={onApprove}>
              {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Approve classifications
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border hairline bg-surface p-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_220px]">
            <div className="space-y-2">
              <div className="loading-shimmer h-5 w-24 rounded" />
              <div className="loading-shimmer h-4 w-56 rounded" />
              <div className="loading-shimmer h-3 w-40 rounded" />
            </div>
            <div className="space-y-2">
              <div className="loading-shimmer h-4 w-2/3 rounded" />
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="loading-shimmer h-16 rounded" />
                <div className="loading-shimmer h-16 rounded" />
              </div>
              <div className="loading-shimmer h-7 w-52 rounded" />
            </div>
            <div className="space-y-2">
              <div className="loading-shimmer h-8 rounded" />
              <div className="loading-shimmer h-8 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function bucketLabel(bucket: string): string {
  return bucket.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function Severity({ severity }: { severity: ReviewTask["severity"] }) {
  const cls = severity === "red" ? "bg-alert-soft text-alert" : severity === "yellow" ? "bg-caution-soft text-caution" : "bg-primary-soft text-primary-soft-foreground";
  return <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", cls)}>{displayReviewLabel(severity)}</span>;
}

function Evidence({ title, tone, items }: { title: string; tone: "trust" | "alert"; items: string[] }) {
  return <div className={cn("min-w-0 rounded-md border p-2.5", tone === "trust" ? "border-trust/30 bg-trust-soft/60" : "border-alert/30 bg-alert-soft/80")}><div className={cn("mb-1 text-[10px] font-semibold uppercase tracking-wider", tone === "trust" ? "text-trust" : "text-alert")}>{title}</div><p className="break-words font-mono text-[12px] text-foreground/80">{items.length ? items.join(" | ") : "No evidence captured"}</p></div>;
}

function matchesTab(task: ReviewTask, tab: (typeof TABS)[number]): boolean {
  const bucket = derivedBucket(task);
  if (tab === "Urgent") return task.severity === "red" && task.status !== "rejected";
  if (tab === "Phone verify") return task.status === "phone_verification" || bucket === "phone_verify";
  if (tab === "Field visit") return bucket === "field_visit_required";
  if (tab === "Specialist review") return bucket === "specialist_review";
  if (tab === "Low-risk") return bucket === "auto_verified_low_risk" || task.status === "accepted";
  return task.status === "rejected";
}

function derivedBucket(task: ReviewTask): string {
  const text = `${task.reason} ${task.evidence_for.join(" ")} ${task.evidence_against.join(" ")} ${task.notes.map((note) => note.text).join(" ")}`.toLowerCase();
  if (text.includes("auto-triage bucket: phone_verify")) return "phone_verify";
  if (text.includes("auto-triage bucket: field_visit_required")) return "field_visit_required";
  if (text.includes("auto-triage bucket: specialist_review")) return "specialist_review";
  if (text.includes("auto-triage bucket: auto_verified_low_risk")) return "auto_verified_low_risk";
  if (text.includes("auto-triage bucket: reject_or_low_confidence")) return "reject_or_low_confidence";
  if (task.severity === "red" && (text.includes("contradiction") || text.includes("modality"))) return "specialist_review";
  if (task.severity === "red") return "field_visit_required";
  if (text.includes("sparse") || text.includes("weak") || task.evidence_for.length === 0) return "phone_verify";
  return "auto_verified_low_risk";
}

function reviewPatchForBucket(bucket: string): Partial<ReviewTask> & { note: string } {
  if (bucket === "phone_verify") return { status: "phone_verification", owner: "Phone team", note: "Auto-triage bucket: phone_verify. Approved for phone verification." };
  if (bucket === "auto_verified_low_risk") return { status: "accepted", owner: "Auto triage", note: "Auto-triage bucket: auto_verified_low_risk. Approved as low-risk." };
  if (bucket === "reject_or_low_confidence") return { status: "rejected", owner: "Auto triage", note: "Auto-triage bucket: reject_or_low_confidence. Approved for rejection until resolved." };
  if (bucket === "specialist_review") return { status: "pending", owner: "Clinical reviewer", note: "Auto-triage bucket: specialist_review. Approved for specialist review." };
  return { status: "pending", owner: "Field team", note: "Auto-triage bucket: field_visit_required. Approved for field verification." };
}

function groupReviewTasks(tasks: ReviewTask[]): ReviewGroup[] {
  const byFacility = new Map<string, ReviewGroup>();
  for (const task of tasks) {
    const key = task.facility_id;
    const current = byFacility.get(key) ?? {
      facilityId: key,
      facilityName: task.facility_name || key,
      tasks: [],
      severity: task.severity,
      owner: task.owner,
    };
    current.tasks.push(task);
    current.tasks.sort((a, b) => issueRank(a) - issueRank(b));
    current.severity = maxSeverity(current.severity, task.severity);
    current.owner = current.owner === task.owner ? current.owner : null;
    byFacility.set(key, current);
  }
  return Array.from(byFacility.values()).sort((a, b) => {
    const bySeverity = severityRank(b.severity) - severityRank(a.severity);
    if (bySeverity !== 0) return bySeverity;
    return a.facilityName.localeCompare(b.facilityName);
  });
}

function maxSeverity(a: ReviewTask["severity"], b: ReviewTask["severity"]): ReviewTask["severity"] {
  return severityRank(a) >= severityRank(b) ? a : b;
}

function severityRank(severity: ReviewTask["severity"]): number {
  if (severity === "red") return 3;
  if (severity === "yellow") return 2;
  return 1;
}

function statusSummary(tasks: ReviewTask[]): string {
  const statuses = Array.from(new Set(tasks.map((task) => displayReviewLabel(task.status))));
  return statuses.length === 1 ? statuses[0] : `${statuses.length} Statuses`;
}

function displayReviewLabel(value: string): string {
  const normalized = value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
  return normalized
    .replace(/\bOk\b/g, "OK")
    .replace(/\bId\b/g, "ID")
    .replace(/\bIcu\b/g, "ICU")
    .replace(/\bNicu\b/g, "NICU");
}

async function playStepSequence(setStep: (step: number) => void, totalSteps: number) {
  for (let step = 1; step < totalSteps; step += 1) {
    await delay(randomStepDelay());
    setStep(step);
  }
}

function randomStepDelay(): number {
  return 800 + Math.floor(Math.random() * 2200);
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function issueRank(task: ReviewTask): number {
  if (task.id.includes("r1_anesthesia_gap")) return 1;
  if (task.id.includes("r2_nicu_staffing_gap")) return 2;
  if (task.id.includes("r3_cancer_specialty_gap")) return 3;
  if (task.id.includes("r4_24x7_gap")) return 4;
  if (task.id.includes("r5_bed_count_contradiction")) return 5;
  if (task.id.includes("r6_modality_contradiction")) return 6;
  if (task.id.includes("r7_scrape_artifact_density")) return 7;
  if (task.id.includes("r8_evidence_sparsity")) return 8;
  return 99;
}

function IssueBadge({ task }: { task: ReviewTask }) {
  return (
    <span title={`Task ${task.id}`} className="inline-flex rounded bg-primary-soft px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary-soft-foreground">
      {issueCode(task)}
    </span>
  );
}

function issueCode(task: ReviewTask): string {
  if (task.id.includes("r1_anesthesia_gap")) return "R1 anesthesia";
  if (task.id.includes("r2_nicu_staffing_gap")) return "R2 NICU staffing";
  if (task.id.includes("r3_cancer_specialty_gap")) return "R3 oncology";
  if (task.id.includes("r4_24x7_gap")) return "R4 24x7";
  if (task.id.includes("r5_bed_count_contradiction")) return "R5 beds";
  if (task.id.includes("r6_modality_contradiction")) return "R6 modality";
  if (task.id.includes("r7_scrape_artifact_density")) return "R7 artifact";
  if (task.id.includes("r8_evidence_sparsity")) return "R8 sparse evidence";
  return task.capability || "Review";
}
