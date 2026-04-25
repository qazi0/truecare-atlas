"use client";

import { useCallback, useRef, useState } from "react";
import type { SearchStreamState, SSEEvent, StreamStep } from "@/lib/types";

const INITIAL_STATE: SearchStreamState = {
  steps: [],
  facilities: [],
  summary: "",
  trace_id: null,
  error: null,
  is_streaming: false,
};

// Reduce a single SSE event into the current state
function reduceEvent(
  state: SearchStreamState,
  event: SSEEvent
): SearchStreamState {
  switch (event.type) {
    case "step": {
      const p = event.payload as {
        step_index: number;
        description: string;
        timestamp: string;
      };
      const newStep: StreamStep = {
        step_index: p.step_index,
        description: p.description ?? "",
        timestamp: p.timestamp ?? new Date().toISOString(),
        tool_call: null,
        tool_result: null,
        reasoning_text: "",
      };
      return { ...state, steps: [...state.steps, newStep] };
    }
    case "tool_call": {
      const p = event.payload as {
        step_index: number;
        tool_name: string;
        arguments: Record<string, unknown>;
      };
      const steps = state.steps.map((s) =>
        s.step_index === p.step_index
          ? {
              ...s,
              tool_call: {
                tool_name: p.tool_name,
                arguments: p.arguments ?? {},
              },
            }
          : s
      );
      return { ...state, steps };
    }
    case "tool_result": {
      const p = event.payload as {
        step_index: number;
        result: unknown;
        duration_ms: number;
      };
      const steps = state.steps.map((s) =>
        s.step_index === p.step_index
          ? {
              ...s,
              tool_result: {
                result: p.result,
                duration_ms: p.duration_ms ?? 0,
              },
            }
          : s
      );
      return { ...state, steps };
    }
    case "reasoning": {
      const p = event.payload as { step_index: number; text: string };
      const steps = state.steps.map((s) =>
        s.step_index === p.step_index
          ? { ...s, reasoning_text: s.reasoning_text + (p.text ?? "") }
          : s
      );
      return { ...state, steps };
    }
    case "result": {
      const p = event.payload as {
        facilities: SearchStreamState["facilities"];
        summary: string;
        trace_id: string | null;
      };
      return {
        ...state,
        facilities: p.facilities ?? [],
        summary: p.summary ?? "",
        trace_id: p.trace_id ?? null,
      };
    }
    case "error": {
      const p = event.payload as { message: string };
      return { ...state, error: p.message ?? "Unknown error" };
    }
    case "done": {
      return { ...state, is_streaming: false };
    }
    default:
      return state;
  }
}

export function useStream() {
  const [state, setState] = useState<SearchStreamState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  // Batch buffer: collect events for 200ms then flush
  const bufferRef = useRef<SSEEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushBuffer = useCallback(() => {
    flushTimerRef.current = null;
    const batch = bufferRef.current.splice(0);
    if (batch.length === 0) return;
    setState((prev) => {
      let next = prev;
      for (const ev of batch) {
        next = reduceEvent(next, ev);
      }
      return next;
    });
  }, []);

  const enqueue = useCallback(
    (event: SSEEvent) => {
      bufferRef.current.push(event);
      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(flushBuffer, 200);
      }
    },
    [flushBuffer]
  );

  const submit = useCallback(
    async (query: string) => {
      // Cancel any in-flight stream
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      bufferRef.current = [];
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      setState({ ...INITIAL_STATE, is_streaming: true });

      try {
        const resp = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
          signal: controller.signal,
        });

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          setState((prev) => ({
            ...prev,
            error: `HTTP ${resp.status}: ${text}`,
            is_streaming: false,
          }));
          return;
        }

        const reader = resp.body?.getReader();
        if (!reader) {
          setState((prev) => ({
            ...prev,
            error: "No response body",
            is_streaming: false,
          }));
          return;
        }

        const decoder = new TextDecoder();
        let partial = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          partial += decoder.decode(value, { stream: true });

          // SSE lines: "data: {...}\n\n"
          const lines = partial.split("\n");
          partial = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;
            try {
              const event = JSON.parse(jsonStr) as SSEEvent;
              enqueue(event);
            } catch {
              // malformed line — skip
            }
          }
        }

        // Flush any remaining events immediately
        if (bufferRef.current.length > 0) {
          if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
          }
          flushBuffer();
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState((prev) => ({
          ...prev,
          error: (err as Error).message ?? "Stream error",
          is_streaming: false,
        }));
      }
    },
    [enqueue, flushBuffer]
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    bufferRef.current = [];
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    setState(INITIAL_STATE);
  }, []);

  return { state, submit, reset };
}
