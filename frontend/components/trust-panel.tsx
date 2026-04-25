"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { TrustRing } from "./trust-ring";
import { EvidenceQuote } from "./evidence-quote";
import { ContradictionTug } from "./contradiction-tug";
import type { FacilityFull, TrustReport } from "@/lib/types";
import { fadeIn } from "@/lib/motion";

interface TrustPanelProps {
  facility: FacilityFull | null;
  report: TrustReport | null;
  isLoading: boolean;
}

export function TrustPanel({ facility, report, isLoading }: TrustPanelProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-[120px] w-[120px] rounded-full mx-auto" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <p className="text-text-muted text-sm">Select a facility to see trust analysis</p>
      </div>
    );
  }

  // Find R6 contradiction flags for ContradictionTug
  const r6Flag = report?.flags.find((f) => f.rule_id === "R6");
  const showContradiction =
    r6Flag && r6Flag.evidence_quotes.length >= 2;

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
          <div className="flex flex-col gap-4 p-4">
            {/* Header */}
            <div>
              <h3 className="text-sm font-semibold text-text">{facility.name}</h3>
              <p className="text-xs text-text-muted">
                {[facility.city, facility.state].filter(Boolean).join(", ")}
              </p>
            </div>

            <Separator />

            {/* Trust Ring */}
            <div className="flex justify-center">
              <TrustRing score={score} />
            </div>

            {/* Capabilities caption */}
            {facility.capability_text && facility.capability_text.length > 0 && (
              <p className="text-xs text-text-muted text-center italic">
                {facility.capability_text[0]}
              </p>
            )}

            <Separator />

            {/* Description */}
            {facility.description && (
              <div>
                <p className="text-xs font-medium text-text mb-1">About</p>
                <p className="text-xs text-text-muted leading-relaxed line-clamp-4">
                  {facility.description}
                </p>
              </div>
            )}

            {/* Contradiction Tug for R6 */}
            {showContradiction && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-text mb-2">Contradiction Detected</p>
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
                    Evidence ({report.flags.length} flags)
                  </p>
                  <div className="flex flex-col gap-3">
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
                  <p className="text-xs font-medium text-text mb-1">Specialties</p>
                  <p className="text-xs text-text-muted">
                    {facility.specialties.join(", ")}
                  </p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </motion.div>
    </AnimatePresence>
  );
}
