"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ReasoningTrace } from "./reasoning-trace";
import { FacilityCard } from "./facility-card";
import { TrustPanel } from "./trust-panel";
import { ErrorBanner } from "./error-banner";
import { useStream } from "@/hooks/use-stream";
import type { FacilityHit, FacilityFull } from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

const DEMO_QUERIES = [
  "NICU Bihar",
  "oncology Maharashtra",
  "dialysis Rajasthan",
  "maternity Tamil Nadu",
  "Agasthiyar",
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

  const handleSubmit = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      setLastQuery(q);
      setSelectedId(null);
      setSelectedFacility(null);
      setQuickResults([]);
      setQuickSearching(true);
      try {
        const resp = await fetch(`${BACKEND_URL}/api/search-quick?q=${encodeURIComponent(q)}&k=20`);
        if (resp.ok) {
          const data = await resp.json();
          setQuickResults(Array.isArray(data) ? data : []);
        }
      } catch {
        // fall through
      } finally {
        setQuickSearching(false);
      }
    },
    []
  );

  const handleSelect = useCallback(async (facilityId: string) => {
    setSelectedId(facilityId);
    setIsFetchingFacility(true);
    setSelectedFacility(null);
    try {
      const resp = await fetch(`/api/facility?id=${encodeURIComponent(facilityId)}`);
      if (resp.ok) {
        const data = await resp.json();
        setSelectedFacility(data as FacilityFull);
      }
    } catch {
      // fall through — panel shows basic data from FacilityHit
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
    if (e.key === "Enter") handleSubmit(query);
  };

  const trustReport = selectedFacility?.trust_report ?? null;

  return (
    <div className="flex flex-col h-full">
      {/* Top search bar */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
        <h1 className="text-base font-semibold tracking-tight shrink-0 hidden sm:block">
          TrustMap India
        </h1>
        <div className="flex-1 flex gap-2">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Find hospitals in Bihar with NICU + blood bank…"
            className="bg-surface"
            style={{ color: "var(--color-text)" }}
          />
          <Button
            onClick={() => handleSubmit(query)}
            disabled={quickSearching || !query.trim()}
            size="sm"
          >
            {quickSearching ? "Searching…" : "Search"}
          </Button>
          {(quickResults.length > 0 || state.facilities.length > 0) && (
            <Button
              onClick={() => { reset(); setQuickResults([]); setSelectedFacility(null); }}
              variant="ghost"
              size="sm"
              className="text-text-muted"
            >
              Clear
            </Button>
          )}
        </div>
      </header>

      {/* Demo suggestions — only when idle and empty */}
      <AnimatePresence>
        {!state.is_streaming &&
          state.steps.length === 0 &&
          state.facilities.length === 0 && (
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
        {/* Left: Reasoning trace — 300px on desktop, hidden on mobile when no steps */}
        <div
          className="hidden md:flex flex-col border-r border-border shrink-0"
          style={{ width: 300 }}
        >
          <ReasoningTrace steps={state.steps} isStreaming={state.is_streaming} />
        </div>

        {/* Center: Results */}
        <div className="flex flex-col flex-1 min-w-0">
          {state.summary && (
            <div className="px-4 py-2 border-b border-border shrink-0">
              <p className="text-xs text-text-muted leading-relaxed">{state.summary}</p>
              {state.trace_id && (
                <p className="text-xs font-mono text-text-muted mt-0.5">
                  trace: {state.trace_id}
                </p>
              )}
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-2 p-3">
              {quickResults.length === 0 && !quickSearching && state.facilities.length === 0 && !state.is_streaming && (
                <div className="flex items-center justify-center py-16">
                  <p className="text-sm text-text-muted">
                    Search by facility name, city, state, or capability
                  </p>
                </div>
              )}
              {quickSearching && (
                <div className="flex items-center gap-2 py-4 px-1">
                  <motion.div
                    className="w-2 h-2 rounded-full"
                    style={{ background: "var(--color-trust)" }}
                    animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                  <p className="text-xs text-text-muted">Searching Databricks…</p>
                </div>
              )}
              {quickResults.map((facility) => (
                <FacilityCard
                  key={facility.facility_id}
                  facility={facility}
                  isSelected={selectedId === facility.facility_id}
                  onSelect={handleSelect}
                />
              ))}
              {state.facilities.map((facility) => (
                <FacilityCard
                  key={facility.facility_id}
                  facility={facility}
                  isSelected={selectedId === facility.facility_id}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right: Trust panel — 380px on desktop */}
        <div
          className="hidden lg:flex flex-col border-l border-border shrink-0"
          style={{ width: 380 }}
        >
          <div className="px-3 py-2 border-b border-border shrink-0">
            <p className="text-xs font-medium text-text">Trust Analysis</p>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <TrustPanel
              facility={selectedFacility}
              report={trustReport}
              isLoading={isFetchingFacility}
            />
          </div>
        </div>
      </div>

      {/* Mobile: reasoning trace drawer hint */}
      {state.steps.length > 0 && (
        <div className="md:hidden border-t border-border px-4 py-2 shrink-0">
          <p className="text-xs text-text-muted">
            {state.steps.length} reasoning step{state.steps.length !== 1 ? "s" : ""}
            {state.is_streaming ? " (live)" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
