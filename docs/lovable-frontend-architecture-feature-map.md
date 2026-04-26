# Lovable Frontend Architecture Feature Map

This document records how `truecare-frontend-lovable/` works and how its prototype data maps to the production Next.js app in `frontend/`.

## Lovable App Architecture

- Runtime: Vite, React, React Router, shadcn-style primitives, Tailwind tokens, lucide icons.
- Routes:
  - `/` renders Mission Control.
  - `/command` renders query results, inspector, shortlist actions, validation/export/trace controls, and agent activity.
  - `/map` renders capability filters, a placeholder SVG India map, region panel, list fallback, and national strip.
  - `/facility/:id` renders tabbed detail views for overview, capabilities, trust audit, validation, source evidence, and trace.
  - `/shortlist` renders a local planning table, comparison mode, export settings, and CSV/JSON client export.
  - `/review` renders a queue of human review tasks and action buttons.
  - `/data-health` renders data quality, governance, lineage, trace, and freshness panels.
- Atlas components:
  - `AppShell`, `TopBar`, `LeftRail`, and `MobileBottomNav` define navigation and workspace framing.
  - `TrustRing`, `StatusBadge`, `CapabilityBadge`, and `EvidenceQuote` define the evidence-first visual language.
  - `IndiaMap` is visual-only in Lovable and must be replaced with production Mapbox.
- Design tokens:
  - Warm off-white background, white surfaces, hairline borders, deep teal primary, trust green, caution amber, alert red.
  - Compact typography with Inter and JetBrains Mono, small radii, dense operator-focused layout, and restrained motion.
- Shared mock module:
  - `src/data/facilities.ts` exports `FACILITIES`, `PROOF_METRICS`, `REVIEW_QUEUE`, `TRACE_LOG`, and `PIPELINE_STAGES`.
  - The module drives every Lovable screen and is not allowed in production imports.
- Playwright-observed UI states from the reference implementation:
  - Mission Control cycles prompt placeholders, switches fast/deep mode, and routes search to Command.
  - Command shows a deterministic summary, selectable ranked rows, a desktop inspector, and a collapsible activity drawer.
  - Map toggles capability, verified-only/review-needed filters, selected region, map/list views, and top facilities.
  - Facility Detail switches tab content without navigation.
  - Shortlist mutates selected rows client-side and builds a client-only export.
  - Review filter chips are visual and action buttons do not persist changes.
  - Data Health is entirely static.

## Feature Inventory By Screen

### Mission Control

- Rotating prompts: ported, but searches route into live `/command?q=...&mode=fast|deep`.
- Fast/deep mode: ported to a segmented control.
- Proof strip: backed by `/api/data-health` and `/api/health`, not `PROOF_METRICS`.
- Map-backed visual background: lightweight production background using the existing geographic motif, not a heavy Mapbox instance on first paint.

### Command

- Query parsing: frontend derives display chips from query text while backend search remains authoritative.
- Summary band: fast mode computes a deterministic summary from live results; deep mode uses streamed agent summary.
- Ranked results: live `/api/search-quick` or `/api/search` SSE results.
- Inspector: fetches live `/api/facility?id=...`.
- Shortlist actions: localStorage-backed selected facility IDs.
- Validation/export/trace actions: wired to `/api/validate`, `/api/export`, and trace routes.
- Agent activity drawer: deep mode renders actual streamed steps; fast mode shows the backend mode and timing status only.

### Map

- Capability chips: mapped to backend capability keys.
- Verified/review toggles: call `/api/map/facilities?capability=&verified_only=&show_review_needed=`.
- List fallback: renders the same live marker payload.
- Region summary: calls `/api/map/region-summary?region=&capability=`.
- National strip: calls `/api/map/aggregates/ci`.
- Top facilities: comes from region summary.

### Facility Detail

- Tabs: overview, capabilities, trust audit, validation, source evidence, and trace.
- Capability matrix: built from live `FacilityCapabilities`.
- Contradiction banner: shown when `has_contradiction` or red trust flags exist.
- Validation: calls `/api/validate?id=...`.
- Source evidence: built from capability detail evidence quotes.
- Trace: opens `/trace/[id]` when a trace is available.
- Review handoff: posts to `/api/reviews`.

### Shortlist

- Selected facility table: localStorage stores facility IDs and detail fetches run in parallel.
- Comparison mode: toggles additional evidence and risk columns.
- Export settings: include trust audit and capability flags.
- CSV/JSON download: uses live `/api/export`; no client-only mock export remains.

### Review

- Filters: client-side filters over live/generated tasks.
- Counters: computed from `/api/reviews`.
- Evidence for/against: rendered from task payload.
- Owner/status: rendered live and patched through `/api/reviews/[id]`.
- Actions: phone verification, accept, reject, assign, and note persist through PATCH.

### Data Health

- Status strip: `/api/health` plus `/api/data-health`.
- Lineage: `/api/data-health.pipeline`.
- Governance: `/api/data-health.governance`.
- Evidence quality: `/api/data-health.metrics`.
- Traces: `/api/traces/recent`.
- Freshness: generated timestamps and backend health data, with no hardcoded Lovable row counts.

## Mock-To-Live Mapping

- `FACILITIES`
  - Search rows: `/api/search-quick` and `/api/search`.
  - Full details: `/api/facility?id=...`.
  - Map points: `/api/map/facilities`.
  - Facility statuses: derived from `trust_status`, `has_contradiction`, `flag_count`, `trust_score`, and trust flags.
- `PROOF_METRICS`
  - Total records, review counts, contradictions, trust distribution, capability counts: `/api/data-health.metrics`.
  - SQL/vector/search status: `/api/health` and `/api/data-health.checks`.
- `REVIEW_QUEUE`
  - Queue list: `/api/reviews`, combining persisted JSON tasks and generated trust-flag candidates.
  - Actions: `PATCH /api/reviews/[id]`; generated-task patches create persisted overrides.
- `TRACE_LOG`
  - Recent traces: `/api/traces/recent?limit=...`.
  - Trace detail: `/api/traces/[id]`.
- `PIPELINE_STAGES`
  - Lineage: `/api/data-health.pipeline`.
  - Freshness/status: `/api/data-health.generated_at`, health checks, and vector index checks.

## Known Prototype Issues Fixed During Migration

- Static metrics are replaced by live health/data-health values.
- Visual-only review actions are replaced by API mutations.
- Client-only mock export is replaced by `/api/export`.
- Placeholder SVG map is replaced by the production Mapbox component and live facility points.
- Nested button warnings in Command rows are avoided by using row containers plus separate action buttons.
- Hardcoded trace, status, and count values are replaced by streamed search state, trace endpoints, review data, and backend metrics.
