"use client";

import { motion } from "framer-motion";

interface ContradictionTugProps {
  supportingQuote: string;
  contradictingQuote: string;
  ruleId: string;
  label: string;
}

// Arrow oscillates 2 cycles between the two boxes
const arrowVariants = {
  start: { x: -6, opacity: 0.6 },
  end: { x: 6, opacity: 1 },
};

export function ContradictionTug({
  supportingQuote,
  contradictingQuote,
  ruleId,
  label,
}: ContradictionTugProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-text-muted">{ruleId}</span>
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <div className="flex items-start gap-2">
        {/* Supporting box */}
        <motion.div
          className="flex-1 rounded-md p-2 border text-xs"
          style={{
            borderColor: "var(--color-trust)",
            background: "color-mix(in srgb, var(--color-trust) 8%, transparent)",
          }}
          animate={{ opacity: [1, 0.65, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-trust)" }}>
            Supporting
          </p>
          <p className="italic text-text-muted">&ldquo;{supportingQuote}&rdquo;</p>
        </motion.div>

        {/* Oscillating arrow */}
        <div className="flex items-center justify-center pt-6 shrink-0">
          <motion.div
            className="text-text-muted text-sm select-none"
            variants={arrowVariants}
            animate="end"
            initial="start"
            transition={{
              duration: 0.5,
              repeat: 4, // 2 full oscillation cycles
              repeatType: "reverse",
              ease: "easeInOut",
            }}
          >
            ⇄
          </motion.div>
        </div>

        {/* Contradicting box */}
        <motion.div
          className="flex-1 rounded-md p-2 border text-xs"
          style={{
            borderColor: "var(--color-alert)",
            background: "color-mix(in srgb, var(--color-alert) 8%, transparent)",
          }}
          animate={{ opacity: [1, 0.65, 1] }}
          transition={{
            duration: 1.0,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.2,
          }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-alert)" }}>
            Contradicting
          </p>
          <p className="italic text-text-muted">&ldquo;{contradictingQuote}&rdquo;</p>
        </motion.div>
      </div>
    </div>
  );
}
