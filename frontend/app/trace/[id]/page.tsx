"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Braces, ExternalLink } from "lucide-react";
import { AppShell, EmptyState } from "@/components/atlas/primitives";
import { Button } from "@/components/ui/button";

export default function TracePage() {
  const { id } = useParams<{ id: string }>();
  const [trace, setTrace] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`/api/traces/${encodeURIComponent(id)}`).then((r) => r.ok ? r.json() : null).then(setTrace).catch(() => null);
  }, [id]);

  return (
    <AppShell>
      <div className="border-b hairline bg-background px-4 py-2.5">
        <Link href="/data-health" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Data Health</Link>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-[20px] font-semibold tracking-tight">Trace {id}</h1><p className="text-[12px] text-muted-foreground">MLflow trace payload from the backend proxy.</p></div>
          <Button variant="outline" size="sm" className="h-8 text-[12px]"><ExternalLink className="h-3.5 w-3.5" /> Backend trace</Button>
        </div>
        {trace ? (
          <div className="overflow-hidden rounded-lg border hairline bg-surface">
            <div className="flex items-center gap-2 border-b hairline px-3 py-2 text-[12px] font-medium"><Braces className="h-4 w-4 text-primary" /> Trace JSON</div>
            <pre className="max-h-[70vh] overflow-auto p-4 text-[12px] leading-relaxed">{JSON.stringify(trace, null, 2)}</pre>
          </div>
        ) : (
          <EmptyState title="Trace unavailable" detail="Trace search can be empty while MLflow is unavailable or the run has expired." />
        )}
      </div>
    </AppShell>
  );
}
