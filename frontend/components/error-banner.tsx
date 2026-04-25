"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center gap-3 px-4 py-2 rounded-md border text-sm"
      style={{
        background: "color-mix(in srgb, var(--color-alert) 10%, var(--color-surface))",
        borderColor: "var(--color-alert)",
        color: "var(--color-text)",
      }}
    >
      <span
        className="shrink-0 text-xs font-medium"
        style={{ color: "var(--color-alert)" }}
      >
        Error
      </span>
      <span className="flex-1 text-xs text-text-muted truncate">{message}</span>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-xs"
        onClick={onRetry}
      >
        Retry
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-xs"
        onClick={onDismiss}
      >
        Dismiss
      </Button>
    </motion.div>
  );
}
