"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { StreamStep } from "@/lib/types";
import { slideInLeft } from "@/lib/motion";

interface ReasoningTraceProps {
  steps: StreamStep[];
  isStreaming: boolean;
}

interface ReasoningStepProps {
  step: StreamStep;
  isLatest: boolean;
}

function ReasoningStep({ step, isLatest }: ReasoningStepProps) {
  const time = new Date(step.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <motion.div
      variants={slideInLeft}
      initial="hidden"
      animate="visible"
      className="flex gap-2"
    >
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center shrink-0">
        <div className="relative">
          {isLatest ? (
            <motion.div
              className="w-2 h-2 rounded-full mt-1"
              style={{ background: "var(--color-trust)" }}
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : (
            <div
              className="w-2 h-2 rounded-full mt-1"
              style={{ background: "var(--color-border)" }}
            />
          )}
        </div>
        <div
          className="w-px flex-1 mt-1"
          style={{ background: "var(--color-border)", minHeight: 12 }}
        />
      </div>

      {/* Content */}
      <div className="pb-3 flex-1 min-w-0">
        <p
          className="font-mono text-text-muted leading-none mb-0.5"
          style={{ fontSize: 11 }}
        >
          {time}
        </p>
        <p className="text-xs text-text leading-snug">{step.description}</p>
        {step.tool_call && (
          <div className="mt-1 flex items-center gap-1">
            <span
              className="font-mono px-1.5 py-0.5 rounded text-xs"
              style={{
                fontSize: 10,
                background: "color-mix(in srgb, var(--color-caution) 12%, transparent)",
                color: "var(--color-caution)",
                border: "1px solid color-mix(in srgb, var(--color-caution) 30%, transparent)",
              }}
            >
              {step.tool_call.tool_name}
            </span>
            {step.tool_result && (
              <span
                className="font-mono text-text-muted"
                style={{ fontSize: 10 }}
              >
                {step.tool_result.duration_ms}ms
              </span>
            )}
          </div>
        )}
        {step.reasoning_text && (
          <p
            className="text-xs text-text-muted italic mt-1 line-clamp-2"
          >
            {step.reasoning_text}
          </p>
        )}
      </div>
    </motion.div>
  );
}

export function ReasoningTrace({ steps, isStreaming }: ReasoningTraceProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-text">Reasoning</p>
          {isStreaming && (
            <motion.span
              className="text-xs font-mono"
              style={{ color: "var(--color-trust)" }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              live
            </motion.span>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3">
          {steps.length === 0 && !isStreaming && (
            <p className="text-xs text-text-muted text-center py-4">
              No steps yet
            </p>
          )}
          <AnimatePresence>
            {steps.map((step, i) => (
              <ReasoningStep
                key={step.step_index}
                step={step}
                isLatest={isStreaming && i === steps.length - 1}
              />
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}
