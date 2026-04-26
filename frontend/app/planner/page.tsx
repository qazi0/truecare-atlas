"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardList, Loader2, MapPin, Search } from "lucide-react";
import { AppShell, CapabilityBadge, EmptyState, StatusBadge, TrustRing } from "@/components/atlas/primitives";
import { Button } from "@/components/ui/button";
import { capabilityLabel, deriveStatus, formatLocation } from "@/lib/atlas";
import type { CarePlanResponse } from "@/lib/types";

export default function PlannerPage() {
  const [query, setQuery] = useState("Mother in Patna needs NICU");
  const [plan, setPlan] = useState<CarePlanResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    const data = await fetch("/api/care-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    }).then((r) => r.ok ? r.json() : null).catch(() => null);
    setPlan(data);
    setLoading(false);
  }

  return (
    <AppShell>
      <div className="sticky top-12 z-30 border-b hairline bg-background px-4 py-3">
        <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 min-w-[280px] flex-1 items-center gap-2 rounded-md border hairline bg-surface px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 bg-transparent text-[13px] outline-none" aria-label="Care need" />
          </div>
          <Button type="submit" size="sm" className="h-9" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />} Plan care access</Button>
        </form>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          {!plan && <EmptyState title="Enter a care need" detail="Example: Mother in Patna needs NICU." />}
          {plan && (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
                <CapabilityBadge label={plan.need.capability ? capabilityLabel(plan.need.capability) : "Care need"} />
                <span className="rounded-full border hairline bg-surface px-2 py-0.5 text-muted-foreground">Place: {plan.need.place || "not resolved"}</span>
                <span className="rounded-full border hairline bg-surface px-2 py-0.5 text-muted-foreground">Urgency: {plan.need.urgency}</span>
              </div>
              <div className="overflow-hidden rounded-md border hairline bg-surface">
                <table className="w-full text-[12px]">
                  <thead className="bg-surface-muted text-muted-foreground">
                    <tr><th className="px-3 py-2 text-left">Rank</th><th className="px-3 py-2 text-left">Facility</th><th className="px-3 py-2 text-left">Evidence</th><th className="px-3 py-2 text-left">Risk</th><th className="px-3 py-2 text-right">Trust</th></tr>
                  </thead>
                  <tbody>
                    {plan.recommendations.map((item) => (
                      <tr key={item.facility.facility_id} className="border-t hairline align-top">
                        <td className="px-3 py-2 font-mono">{item.rank}</td>
                        <td className="px-3 py-2">
                          <Link href={`/facility/${item.facility.facility_id}`} className="font-medium hover:underline">{item.facility.name}</Link>
                          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3" /> {formatLocation(item.facility)}{item.facility.distance_km != null ? ` · ${item.facility.distance_km.toFixed(1)} km` : ""}</div>
                        </td>
                        <td className="max-w-md px-3 py-2 text-muted-foreground">{item.evidence_summary}</td>
                        <td className="px-3 py-2"><StatusBadge status={deriveStatus(item.facility)} /><div className="mt-1 text-[11px] text-muted-foreground">{item.verification_warning}</div></td>
                        <td className="px-3 py-2 text-right"><TrustRing score={item.facility.trust_score} size={36} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
        <aside className="flex flex-col gap-3">
          <Panel title="Call-first checklist">{plan?.call_first_checklist.map((item) => <li key={item}>{item}</li>) ?? <li>Run a care plan to generate the checklist.</li>}</Panel>
          <Panel title="Safety warnings" tone="alert">{plan?.warnings.map((item) => <li key={item}>{item}</li>) ?? <li>Recommendations require direct facility confirmation.</li>}</Panel>
          {plan && <Panel title="Referral brief"><li className="font-mono">{plan.export.referral_brief_id}</li></Panel>}
        </aside>
      </div>
    </AppShell>
  );
}

function Panel({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "alert" }) {
  return (
    <div className="rounded-md border hairline bg-surface p-4">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tone === "alert" && <AlertTriangle className="h-3.5 w-3.5 text-alert" />}{title}</div>
      <ul className="flex list-disc flex-col gap-1 pl-4 text-[12px] text-muted-foreground">{children}</ul>
    </div>
  );
}
