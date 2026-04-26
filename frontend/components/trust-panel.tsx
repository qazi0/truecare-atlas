"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { TrustRing } from "./trust-ring";
import { EvidenceQuote } from "./evidence-quote";
import { ContradictionTug } from "./contradiction-tug";
import type { FacilityFull, TrustReport, ValidatorResult } from "@/lib/types";
import { fadeIn } from "@/lib/motion";

interface TrustPanelProps {
  facility: FacilityFull | null;
  report: TrustReport | null;
  isLoading: boolean;
}

export function TrustPanel({ facility, report, isLoading }: TrustPanelProps) {
  const [validation, setValidation] = useState<ValidatorResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleValidate = useCallback(async () => {
    if (!facility) return;
    setValidating(true);
    try {
      const resp = await fetch(
        `/api/validate?id=${encodeURIComponent(facility.facility_id)}`
      );
      if (resp.ok) {
        setValidation(await resp.json());
      }
    } catch {
      // silent
    } finally {
      setValidating(false);
    }
  }, [facility]);

  const handleExport = useCallback(async () => {
    if (!facility) return;
    setExporting(true);
    try {
      const resp = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_ids: [facility.facility_id],
          format: "csv",
          include_trust_audit: true,
          include_capabilities: true,
        }),
      });
      if (resp.ok) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${facility.name.replace(/[^a-zA-Z0-9]/g, "_")}_audit.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // silent
    } finally {
      setExporting(false);
    }
  }, [facility]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-[100px] w-[100px] rounded-full mx-auto" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <p className="text-xs text-text-muted">
          Select a facility to see trust analysis
        </p>
      </div>
    );
  }

  const r6Flag = report?.flags.find((f) => f.rule_id === "R6");
  const showContradiction = r6Flag && r6Flag.evidence_quotes.length >= 2;
  const score = report?.score ?? facility.trust_score ?? 0;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={facility.facility_id}
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        className="flex flex-col h-full"
      >
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-3 p-4">
            {/* Header */}
            <div>
              <h3 className="text-sm font-semibold text-text leading-snug">
                {facility.name}
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                {[facility.city, facility.state, facility.pincode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {facility.facility_type && (
                <Badge variant="secondary" className="text-xs mt-1.5">
                  {facility.facility_type}
                </Badge>
              )}
            </div>

            <Separator />

            {/* Trust Ring */}
            <div className="flex justify-center py-1">
              <TrustRing score={score} size={100} strokeWidth={8} />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-7"
                onClick={handleValidate}
                disabled={validating}
              >
                {validating ? "Validating…" : "Validate"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-7"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? "Exporting…" : "Export CSV"}
              </Button>
            </div>

            {/* Validator result */}
            {validation && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-text mb-1.5">
                    Medical Standards Validation
                  </p>
                  <p className="text-xs text-text-muted leading-relaxed mb-2">
                    {validation.overall_assessment}
                  </p>
                  {validation.findings.map((f) => (
                    <div
                      key={f.capability}
                      className="flex items-start gap-2 py-1.5 border-t border-border/50"
                    >
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 ${
                          f.plausible
                            ? "border-trust/40 text-trust"
                            : "border-alert/40 text-alert"
                        }`}
                      >
                        {f.plausible ? "Plausible" : "Questionable"}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-xs text-text font-medium">
                          {f.capability}
                        </p>
                        <p className="text-xs text-text-muted leading-relaxed mt-0.5">
                          {f.reasoning}
                        </p>
                      </div>
                    </div>
                  ))}
                  {validation.recommendation && (
                    <p className="text-xs text-text-muted italic mt-2 pt-2 border-t border-border/50">
                      {validation.recommendation}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Description */}
            {facility.description && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-text mb-1">About</p>
                  <p className="text-xs text-text-muted leading-relaxed line-clamp-4">
                    {facility.description}
                  </p>
                </div>
              </>
            )}

            {/* Contradiction Tug */}
            {showContradiction && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-text mb-2">
                    Contradiction Detected
                  </p>
                  <ContradictionTug
                    ruleId={r6Flag.rule_id}
                    label={r6Flag.label}
                    supportingQuote={r6Flag.evidence_quotes[0]}
                    contradictingQuote={r6Flag.evidence_quotes[1]}
                  />
                </div>
              </>
            )}

            {/* Trust Flags */}
            {report && report.flags.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-text mb-2">
                    Evidence ({report.flags.length} flag
                    {report.flags.length !== 1 ? "s" : ""})
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {report.flags.map((flag, i) => (
                      <EvidenceQuote key={flag.rule_id} flag={flag} index={i} />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Specialties */}
            {facility.specialties.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-text mb-1">
                    Specialties
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {facility.specialties.map((s) => (
                      <Badge
                        key={s}
                        variant="outline"
                        className="text-xs"
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </motion.div>
    </AnimatePresence>
  );
}
