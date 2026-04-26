"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ReasoningTrace } from "./reasoning-trace";
import { FacilityCard } from "./facility-card";
import { TrustPanel } from "./trust-panel";
import { ErrorBanner } from "./error-banner";
import { useStream } from "@/hooks/use-stream";
import type { FacilityHit, FacilityFull } from "@/lib/types";

const DEMO_QUERIES = [
  "hospitals in Bihar",
  "oncology Maharashtra",
  "dialysis Tamil Nadu",
  "Agasthiyar",
  "maternity Kerala",
];

export function SearchConsole() {
  const { state, submit, reset } = useStream();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<FacilityFull | null>(null);
  const [isFetchingFacility, setIsFetchingFacility] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [quickResults, setQuickResults] = useState<FacilityHit[]>([]);
  const [quickSearching, setQuickSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLastQuery(q);
    setSelectedId(null);
    setSelectedFacility(null);
    setQuickResults([]);
    setQuickSearching(true);
    try {
      const resp = await fetch(
        `/api/search-quick?q=${encodeURIComponent(q)}&k=20`
      );
      if (resp.ok) {
        const data = await resp.json();
        setQuickResults(Array.isArray(data) ? data : []);
      }
    } catch {
      // fall through
    } finally {
      setQuickSearching(false);
    }
  }, []);

  const handleAgentSearch = useCallback(
    (q: string) => {
      if (!q.trim()) return;
      setLastQuery(q);
      setSelectedId(null);
      setSelectedFacility(null);
      setQuickResults([]);
      submit(q);
    },
    [submit]
  );

  const handleSelect = useCallback(async (facilityId: string) => {
    setSelectedId(facilityId);
    setIsFetchingFacility(true);
    setSelectedFacility(null);
    try {
      const resp = await fetch(
        `/api/facility?id=${encodeURIComponent(facilityId)}`
      );
      if (resp.ok) {
        const data = await resp.json();
        setSelectedFacility(data as FacilityFull);
      }
    } catch {
      // panel shows basic data from FacilityHit
    } finally {
      setIsFetchingFacility(false);
    }
  }, []);

  const handleDemoQuery = (q: string) => {
    setQuery(q);
    inputRef.current?.focus();
    handleSubmit(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit(query);
    }
  };

  const handleClear = () => {
    reset();
    setQuickResults([]);
    setSelectedFacility(null);
    setSelectedId(null);
    setQuery("");
  };

  const trustReport = selectedFacility?.trust_report ?? null;
  const hasResults =
    quickResults.length > 0 || state.facilities.length > 0;
  const isIdle =
    !state.is_streaming &&
    state.steps.length === 0 &&
    !hasResults &&
    !quickSearching;

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 shrink-0">
        <div className="flex-1 flex gap-2">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search facilities by name, city, state, or capability…"
            className="bg-surface text-sm"
            style={{ color: "var(--color-text)" }}
          />
          <Button
            onClick={() => handleSubmit(query)}
            disabled={quickSearching || !query.trim()}
            size="sm"
            className="shrink-0"
          >
            {quickSearching ? "Searching…" : "Search"}
          </Button>
          {query.trim() && (
            <Button
              onClick={() => handleAgentSearch(query)}
              disabled={state.is_streaming || !query.trim()}
              variant="outline"
              size="sm"
              className="shrink-0 text-xs"
            >
              {state.is_streaming ? "Reasoning…" : "Deep Search"}
            </Button>
          )}
          {hasResults && (
            <Button
              onClick={handleClear}
              variant="ghost"
              size="sm"
              className="text-text-muted shrink-0"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Demo suggestions */}
      <AnimatePresence>
        {isIdle && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex flex-wrap gap-2 px-4 py-2 border-b border-border shrink-0"
          >
            <span className="text-xs text-text-muted self-center">Try:</span>
            {DEMO_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => handleDemoQuery(q)}
                className="text-xs px-2.5 py-1 rounded-full border border-border text-text-muted hover:border-trust hover:text-trust transition-colors"
              >
                {q}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error banner */}
      <AnimatePresence>
        {state.error && (
          <div className="px-4 pt-2 shrink-0">
            <ErrorBanner
              message={state.error}
              onRetry={() => lastQuery && handleSubmit(lastQuery)}
              onDismiss={reset}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Three-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Reasoning trace */}
        {(state.steps.length > 0 || state.is_streaming) && (
          <div
            className="hidden md:flex flex-col border-r border-border shrink-0"
            style={{ width: 280 }}
          >
            <ReasoningTrace
              steps={state.steps}
              isStreaming={state.is_streaming}
            />
          </div>
        )}

        {/* Center: Results */}
        <div className="flex flex-col flex-1 min-w-0">
          {state.summary && (
            <div className="px-4 py-2.5 border-b border-border shrink-0 bg-surface/50">
              <p className="text-xs text-text leading-relaxed">
                {state.summary}
              </p>
              {state.trace_id && (
                <p className="text-xs font-mono text-text-muted mt-0.5">
                  trace: {state.trace_id}
                </p>
              )}
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-1.5 p-3">
              {isIdle && (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <p className="text-sm text-text-muted">
                    Search by facility name, city, state, or capability
                  </p>
                  <p className="text-xs text-text-muted/60">
                    Use &ldquo;Deep Search&rdquo; for AI-powered multi-step reasoning
                  </p>
                </div>
              )}
              {quickSearching && (
                <div className="flex items-center gap-2 py-6 px-1 justify-center">
                  <motion.div
                    className="w-2 h-2 rounded-full"
                    style={{ background: "var(--color-trust)" }}
                    animate={{
                      scale: [1, 1.4, 1],
                      opacity: [1, 0.5, 1],
                    }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                  <p className="text-xs text-text-muted">
                    Searching facilities…
                  </p>
                </div>
              )}
              {quickResults.map((facility, i) => (
                <motion.div
                  key={facility.facility_id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.15 }}
                >
                  <FacilityCard
                    facility={facility}
                    isSelected={selectedId === facility.facility_id}
                    onSelect={handleSelect}
                  />
                </motion.div>
              ))}
              {state.facilities.map((facility, i) => (
                <motion.div
                  key={facility.facility_id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.15 }}
                >
                  <FacilityCard
                    facility={facility}
                    isSelected={selectedId === facility.facility_id}
                    onSelect={handleSelect}
                  />
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right: Trust panel */}
        <div
          className="hidden lg:flex flex-col border-l border-border shrink-0"
          style={{ width: 360 }}
        >
          <TrustPanel
            facility={selectedFacility}
            report={trustReport}
            isLoading={isFetchingFacility}
          />
        </div>
      </div>
    </div>
  );
}
