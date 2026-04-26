"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import type { TrustFlag } from "@/lib/types";
import { evidenceStagger, evidenceItem } from "@/lib/motion";

interface EvidenceQuoteProps {
  flag: TrustFlag;
  index: number;
}

const SEVERITY_STYLES: Record<string, string> = {
  green: "border-trust/30 text-trust bg-trust/5",
  yellow: "border-caution/30 text-caution bg-caution/5",
  red: "border-alert/30 text-alert bg-alert/5",
};

export function EvidenceQuote({ flag }: EvidenceQuoteProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2 flex-wrap">
        <Badge
          variant="outline"
          className={`text-[10px] font-mono shrink-0 ${SEVERITY_STYLES[flag.severity] ?? ""}`}
        >
          {flag.rule_id}
        </Badge>
        <span className="text-xs text-text-muted leading-snug break-words min-w-0">
          {flag.label}
        </span>
      </div>
      {flag.evidence_quotes.length > 0 && (
        <motion.ul
          variants={evidenceStagger}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-0.5 mt-0.5"
        >
          {flag.evidence_quotes.map((quote, qi) => (
            <motion.li key={qi} variants={evidenceItem}>
              <p className="text-xs italic text-text-muted pl-2 border-l-2 border-border leading-relaxed break-words">
                &ldquo;{quote}&rdquo;
              </p>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}
