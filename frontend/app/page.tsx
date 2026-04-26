"use client";

import { useState, useEffect } from "react";
import { SearchConsole } from "@/components/search-console";
import { MapView } from "@/components/map-view";
import type { HealthCheck } from "@/lib/types";

type View = "search" | "map";

export default function Home() {
  const [view, setView] = useState<View>("search");
  const [health, setHealth] = useState<HealthCheck | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setHealth(d as HealthCheck))
      .catch(() => setHealth({ status: "error", message: "Unreachable" }));
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Global header */}
      <header className="flex items-center justify-between border-b border-border px-5 py-2.5 shrink-0 bg-surface">
        <div className="flex items-center gap-6">
          <h1 className="text-sm font-semibold tracking-tight text-text">
            TrueCare Atlas
          </h1>
          <nav className="flex gap-1">
            <TabButton
              active={view === "search"}
              onClick={() => setView("search")}
            >
              Search
            </TabButton>
            <TabButton
              active={view === "map"}
              onClick={() => setView("map")}
            >
              Map
            </TabButton>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {health && <HealthIndicator health={health} />}
        </div>
      </header>

      {/* View content */}
      <main className="flex-1 min-h-0">
        {view === "search" && <SearchConsole />}
        {view === "map" && <MapView />}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-text-muted hover:text-text hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function HealthIndicator({ health }: { health: HealthCheck }) {
  const color =
    health.status === "ok"
      ? "var(--color-trust)"
      : health.status === "degraded"
        ? "var(--color-caution)"
        : "var(--color-alert)";

  const label =
    health.status === "ok"
      ? "Connected"
      : health.status === "degraded"
        ? "Degraded"
        : "Offline";

  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
      />
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}
