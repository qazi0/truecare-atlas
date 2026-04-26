"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { EvidenceQuote } from "@/components/atlas/primitives";
import type { EvidenceClaim } from "@/lib/types";

export function EvidenceLedgerButton({
  facilityId,
  capability,
  quote,
  source,
  confidence,
  contradicted,
}: {
  facilityId: string;
  capability: string;
  quote: string;
  source?: string | null;
  confidence?: string | number | null;
  contradicted?: boolean;
}) {
  const [claim, setClaim] = useState<EvidenceClaim | null>(null);
  const [open, setOpen] = useState(false);

  async function show() {
    setOpen(true);
    const id = `${facilityId}__${capability}`;
    const data = await fetch(`/api/evidence/${encodeURIComponent(id)}`).then((r) => r.ok ? r.json() : null).catch(() => null);
    setClaim(data);
  }

  return (
    <>
      <button type="button" onClick={show} className="block w-full rounded text-left hover:bg-surface-muted/70">
        <EvidenceQuote quote={quote} source={source} confidence={confidence} contradicted={contradicted} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
          <div className="h-full w-full max-w-xl overflow-y-auto border-l hairline bg-background p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence ledger</div>
                <h2 className="mt-1 text-[17px] font-semibold">{claim?.claim || capability.replaceAll("_", " ")}</h2>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-md p-1.5 hover:bg-surface-muted" aria-label="Close evidence ledger"><X className="h-4 w-4" /></button>
            </div>
            {claim ? (
              <div className="space-y-4 text-[12px]">
                <LedgerRow label="Decision" value={claim.decision} />
                <LedgerRow label="Capability" value={claim.capability} />
                <LedgerRow label="Source" value={claim.source_field || "unknown"} />
                <LedgerRow label="Confidence" value={claim.confidence} />
                <div>
                  <div className="mb-1 font-medium">Exact source quote</div>
                  <div className="rounded-md border hairline bg-surface p-3 font-mono leading-relaxed">{claim.source_quote || "No source quote captured"}</div>
                </div>
                {claim.evidence_against.length > 0 && (
                  <div>
                    <div className="mb-1 font-medium text-alert">Contradicting or caution evidence</div>
                    <div className="rounded-md border border-alert/25 bg-alert-soft p-3 font-mono leading-relaxed">{claim.evidence_against.join(" | ")}</div>
                  </div>
                )}
                <div>
                  <div className="mb-1 font-medium">Raw source record excerpt</div>
                  <pre className="max-h-72 overflow-auto rounded-md border hairline bg-surface p-3 text-[11px] leading-relaxed">{JSON.stringify(claim.raw_record, null, 2)}</pre>
                </div>
                <LedgerRow label="Trust rules" value={claim.trust_rule_ids.length ? claim.trust_rule_ids.join(", ") : "none"} />
                <LedgerRow label="Model" value={claim.model_version || "unknown"} />
              </div>
            ) : (
              <div className="rounded-md border hairline bg-surface p-4 text-sm text-muted-foreground">Loading evidence...</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function LedgerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b hairline pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}
