"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import type { TrustFlag } from "@/lib/types";
import { evidenceStagger, evidenceItem } from "@/lib/motion";

interface EvidenceQuoteProps {
  flag: TrustFlag;
  index: number;
}

function severityBadgeClass(severity: string): string {
  if (severity === "green")
    return "bg-trust/10 text-trust border-trust/30";
  if (severity === "yellow")
    return "bg-caution/10 text-caution border-caution/30";
  return "bg-alert/10 text-alert border-alert/30";
}

export function EvidenceQuote({ flag, index: _index }: EvidenceQuoteProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={`text-xs font-mono ${severityBadgeClass(flag.severity)}`}
        >
          {flag.rule_id}
        </Badge>
        <span className="text-xs text-text-muted">{flag.label}</span>
      </div>
      <motion.ul
        variants={evidenceStagger}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-1"
      >
        {flag.evidence_quotes.map((quote, qi) => (
          <motion.li key={qi} variants={evidenceItem}>
            <p className="text-xs italic text-text-muted pl-2 border-l-2 border-border">
              &ldquo;{quote}&rdquo;
            </p>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
