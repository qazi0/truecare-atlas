# Design System — TrustMap India

## Design Thesis

Cursor's agent-first transparency × Linear's monochrome restraint × clinical-trust color semantics. Raw, schematic, judge-forward — Perplexity Pro meets Palantir Foundry by way of a clinical EHR. Color is reserved for the trust signal alone.

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-trust` | `#10b981` | Verified capability, high trust score |
| `--color-caution` | `#fbbf24` | Mid trust, ambiguous evidence |
| `--color-alert` | `#ef4444` | Contradiction, low trust, rule violation |
| `--color-base` | `#fafafa` | Page background |
| `--color-surface` | `#ffffff` | Card/panel surfaces |
| `--color-border` | `#e5e7eb` | All 1px borders |
| `--color-text` | `#1f2937` | Primary text |
| `--color-text-muted` | `#6b7280` | Secondary text, data labels |

## Typography

- **UI sans**: Inter (400/500/600, line-height 1.5). 14px body, 20px H2, 28px H1.
- **Data mono**: JetBrains Mono (12px, 1.3 line-height). For: facility IDs, pincodes, lat/lng, trust scores, timestamps, tool names, JSON snippets.
- Loaded via `next/font/google` (inlined, no external CDN dependency).

## Motion (Framer Motion)

- Default spring: `{ stiffness: 260, damping: 20, mass: 1 }`
- Entry easing: `cubic-bezier(0.16, 1, 0.3, 1)`, 220ms
- Stagger: 60ms between sibling cards
- Trust-score ring fill: 900ms, easeOut
- Map choropleth bloom: 1500ms, spring `{ stiffness: 120, damping: 18 }`
- All animations honor `prefers-reduced-motion`

## Components (shadcn/ui base)

Card, Badge, Button, Input, Tooltip, Popover, Sheet, ScrollArea, Separator, Skeleton, Tabs

**Custom components**: TrustRing, EvidenceQuote, ReasoningStep, DesertMap, FacilityCard

## Layout (desktop ≥1024px)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Top bar: TrustMap India · Search Input · Map / Audit / Plan tabs     │
├────────────────┬───────────────────────────────────────┬─────────────┤
│  REASONING     │  RESULTS / MAP / AUDIT (active view)  │  TRUST      │
│  TRACE (300px) │  (flex-1)                             │  PANEL      │
│                │                                        │  (380px)    │
└────────────────┴───────────────────────────────────────┴─────────────┘
```

Mobile (<768px): reasoning trace and trust panel collapse to bottom-drawer sheets.
