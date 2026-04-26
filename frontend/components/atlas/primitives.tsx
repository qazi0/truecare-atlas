"use client";

/* eslint-disable react/no-unescaped-entities */

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Activity, AlertOctagon, CheckCircle2, ChevronRight, Database, ListChecks, Map, Route, Search, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FacilityStatus } from "@/lib/atlas";

const NAV = [
  { to: "/command", label: "Search", icon: Search },
  { to: "/map", label: "Map", icon: Map },
  { to: "/planner", label: "Planner", icon: Route },
  { to: "/shortlist", label: "Shortlist", icon: ListChecks },
  { to: "/review", label: "Review", icon: AlertOctagon },
  { to: "/data-health", label: "Data Health", icon: Activity },
];

const TOP_NAV = NAV.filter((item) => item.to !== "/shortlist");

export function Wordmark() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5">
      <span className="relative inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-primary/15 bg-white/95 shadow-sm ring-1 ring-white">
        <Image
          src="/logo.png"
          alt=""
          width={48}
          height={48}
          className="h-full w-full scale-[1.55] object-contain"
          priority
        />
      </span>
      <span className="text-[17px] font-semibold tracking-tight">
        TrueCare <span className="text-primary">Atlas</span>
      </span>
    </Link>
  );
}

export function AppShell({ children, topBarRight, hideRail = false }: { children: ReactNode; topBarRight?: ReactNode; hideRail?: boolean }) {
  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 h-16 border-b hairline bg-background/90 backdrop-blur">
        <div className="flex h-full items-center gap-4 px-4">
          <Wordmark />
          <div className="hidden md:block h-4 w-px bg-hairline" />
          <SystemStatus />
          <HeaderTagline />
          <HeaderNav />
          <div className="ml-auto flex items-center gap-3">{topBarRight}</div>
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        {!hideRail && <LeftRail />}
        <main className="flex-1 min-w-0 flex flex-col pb-14 md:pb-0">{children}</main>
      </div>
      <MobileBottomNav />
    </div>
  );
}

function HeaderTagline() {
  return (
    <div className="ml-1 hidden items-center text-[10px] font-normal uppercase tracking-[0.24em] text-muted-foreground lg:flex">
      Healthcare intelligence for verified patient care
    </div>
  );
}

function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="ml-auto hidden items-center gap-1 xl:flex">
      {TOP_NAV.map((item) => {
        const active = pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            href={item.to}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition",
              active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SystemStatus() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-trust/30 bg-trust-soft px-2 py-0.5 text-[11px] font-medium text-trust">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-trust opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-trust" />
      </span>
      Live backend
    </span>
  );
}

function LeftRail() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r hairline bg-background">
      <div className="px-3 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Workspace</div>
      <nav className="flex flex-col gap-0.5 px-2">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              href={item.to}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px]",
                active ? "bg-primary-soft text-primary font-medium" : "text-foreground hover:bg-surface-muted",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-3 pb-3 pt-4 text-[10px] text-muted-foreground">
        Databricks App + Vercel proxy
      </div>
    </aside>
  );
}

function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t hairline bg-background/95 backdrop-blur">
      <ul className="grid grid-cols-6">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link href={item.to} className={cn("flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] min-h-[48px]", active ? "text-primary" : "text-muted-foreground")}>
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-muted-foreground">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
          {item.to ? <Link href={item.to} className="hover:text-foreground">{item.label}</Link> : <span className="text-foreground">{item.label}</span>}
          {i < items.length - 1 && <ChevronRight className="h-3 w-3" />}
        </span>
      ))}
    </nav>
  );
}

export function TrustRing({ score, size = 56, showLabel = true, status }: { score: number | null | undefined; size?: number; showLabel?: boolean; status?: FacilityStatus }) {
  const safe = Math.max(0, Math.min(100, score ?? 0));
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = status === "Contradiction"
    ? "hsl(var(--alert))"
    : status === "Needs review" || status === "Evidence weak"
      ? "hsl(var(--caution))"
      : safe >= 85 ? "hsl(var(--trust))" : safe >= 60 ? "hsl(var(--caution))" : "hsl(var(--alert))";
  return (
    <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--hairline))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (safe / 100) * c} />
      </svg>
      {showLabel && <span className="absolute font-mono text-sm font-semibold tabular" style={{ color: tone }}>{Math.round(safe)}</span>}
    </span>
  );
}

const STATUS_STYLE: Record<FacilityStatus, string> = {
  Verified: "bg-trust-soft text-trust border-trust/30",
  "Needs review": "bg-caution-soft text-caution border-caution/30",
  "Evidence weak": "bg-caution-soft text-caution border-caution/30",
  Contradiction: "bg-alert-soft text-alert border-alert/30",
};

export function StatusBadge({ status }: { status: FacilityStatus }) {
  const Icon = status === "Verified" ? ShieldCheck : status === "Contradiction" ? AlertOctagon : Search;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium", STATUS_STYLE[status])}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}

export function CapabilityBadge({ label, dimmed }: { label: string; dimmed?: boolean }) {
  return (
    <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium", dimmed ? "border-hairline bg-surface-muted text-muted-foreground" : "border-primary/20 bg-primary-soft text-primary-soft-foreground")}>
      {label}
    </span>
  );
}

export function Hint({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-64 -translate-x-1/2 rounded-md bg-foreground px-3 py-2 text-left text-[11px] leading-relaxed text-background shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}

export function EvidenceQuote({ quote, source, confidence, contradicted }: { quote: string; source?: string | null; confidence?: string | number | null; contradicted?: boolean }) {
  return (
    <blockquote className={cn("border-l-2 pl-3 text-[12px] leading-relaxed", contradicted ? "border-alert text-alert" : "border-primary text-foreground/80")}>
      "{quote}"
      <footer className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
        {source || "source"}
        <span className="h-1 w-1 rounded-full bg-hairline" />
        {typeof confidence === "number" ? `${Math.round(confidence * 100)}%` : confidence || "low"}
      </footer>
    </blockquote>
  );
}

export function Metric({ label, value, tone }: { label: string; value: string | number; tone?: "trust" | "caution" | "alert" }) {
  const color = tone === "trust" ? "text-trust" : tone === "caution" ? "text-caution" : tone === "alert" ? "text-alert" : "text-foreground";
  return (
    <div className="rounded-md border hairline bg-surface px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-[20px] font-mono font-semibold tabular leading-none", color)}>{value}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Database, title, detail }: { icon?: typeof Database; title: string; detail?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border hairline bg-surface p-8 text-center">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <div className="mt-2 text-sm font-medium">{title}</div>
      {detail && <p className="mt-1 max-w-md text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

export function CheckLine({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[13px]">
      <CheckCircle2 className={cn("mt-0.5 h-4 w-4", ok ? "text-trust" : "text-caution")} />
      <span>{children}</span>
    </li>
  );
}
