# TrueCare Atlas Frontend Redesign Brief

## Purpose

Redesign the frontend as a serious healthcare intelligence workspace, not a hackathon search demo.

TrueCare Atlas helps NGO planners, insurers, public-health teams, and provider-network operators turn messy facility listings into a trusted capability map. The product should feel like an operational command center for making high-stakes planning decisions: dense, credible, calm, evidence-first, and fast.

## Current Product State

### What already works

- Public frontend deployed at `https://trustmap-india.vercel.app`.
- Backend deployed on Databricks Apps.
- Vercel API routes securely proxy to Databricks using server-side OAuth M2M.
- Quick search over facilities.
- Deep search SSE agent endpoint, pending full Vector Search readiness.
- Facility detail lookup.
- Trust audit with score, flags, and evidence quotes.
- Medical standards validation endpoint.
- CSV/JSON export for selected facilities.
- Map aggregates by state/pincode capability.
- Confidence interval aggregate endpoint exists.
- 10K facility point map endpoint exists.
- MLflow trace proxy exists.

### Current UX limitations

- The UI currently looks like a functional internal prototype, not a polished business product.
- Navigation is too shallow: Search and Map are tabs, but there is no product-level information architecture.
- The product does not clearly guide a user through the real job: define a planning question, inspect evidence, compare facilities, export a defensible shortlist.
- Trust, contradiction, confidence, and traceability are present but not visually central enough.
- The map is useful but not yet a planning workspace with filters, selected regions, gaps, and action paths.
- Facility detail is an inspector panel, but not yet a durable page with shareable state, back navigation, selected export state, trace links, or validation history.
- There is no saved project/workspace concept, so the startup product story is not yet complete.

## Is Anything Seriously Missing?

### For hackathon demo

The current feature set is good enough to be competitive because it covers the rubric:

- Massive extraction over 10K records.
- Multi-attribute reasoning through search + agent flow.
- Trust scoring with evidence.
- Validator agent.
- Dynamic map.
- Databricks-native deployment.
- Export for NGO planning.

The biggest hackathon risk is not a missing backend feature. It is presentation clarity. The UI needs to make the business workflow and trust story obvious in the first 15 seconds.

### For startup-readiness

The serious missing features are product workflow features, not core AI features:

1. **Accounts and organizations**
   - Users belong to an NGO, insurer, government team, or provider-network team.
   - Needed for saved work, permissions, billing, and customer pilots.
   - Not needed for hackathon demo.

2. **Planning projects**
   - A user should create a project like "Bihar MNCH 2026 rollout".
   - Projects store search queries, selected facilities, filters, exports, and notes.
   - This is the main startup workflow container.

3. **Saved shortlists**
   - Users need to save, compare, remove, and export selected facilities.
   - Current export works, but there is no persistent selection model.

4. **Human review queue**
   - TrueCare Atlas should flag uncertain or contradictory records for manual verification.
   - A startup can sell "AI triage plus human-verifiable workflow", not just search.

5. **Admin/customer data ingestion**
   - Customers should upload a facility list or connect a catalog.
   - Databricks can remain the processing backend, but the frontend needs an ingestion/status page.

6. **Audit history**
   - Users need to know when a facility was extracted, scored, validated, and exported.
   - This matters for procurement, grant reporting, and insurer network decisions.

7. **Role-based access**
   - Admin, planner, reviewer, read-only stakeholder.
   - Important after the hackathon, not before.

Recommendation: do not rush login/admin before judging unless required. For the demo, simulate the product workspace through strong IA and copy. For the startup version, make auth, orgs, projects, saved shortlists, and review queues the next product layer.

## Product Positioning

### One-line product

TrueCare Atlas is an evidence-first healthcare network intelligence platform for finding, auditing, and exporting trusted facility capability data.

### Primary user

Maya, Programme Lead at an NGO planning maternal and neonatal health coverage across Bihar, eastern UP, and Jharkhand.

### Core job

"I need to identify facilities that plausibly provide a life-saving capability, understand where the data is weak or contradictory, and export a defensible shortlist for field verification or partner planning."

### Business wedge

Provider and facility data trust scoring for healthcare access planning.

Initial buyers:

- NGOs and foundations planning health programs.
- Insurers building or auditing provider networks.
- Government/public-health analytics teams.
- Hospital groups evaluating referral-network gaps.

Startup expansion:

- Customer data ingestion.
- Continuous re-scoring.
- Verification workflows.
- Provider network gap analysis.
- Data quality APIs.
- Verified facility intelligence marketplace.

## Design Thesis

### Visual thesis

A restrained public-health command center: map-led, evidence-rich, document-grade typography, with color used only for trust, risk, and action.

### Content thesis

Every screen should answer one operational question: where is care available, how trustworthy is the claim, what evidence supports it, and what should the planner do next?

### Interaction thesis

- Search and map should feel connected: selecting a result should locate it geographically; selecting a region should filter results.
- Trust evidence should progressively reveal from score to rule to quote to source text.
- Exports and saved selections should feel like building a field-verification plan, not downloading random rows.

## Modern Agentic UX Patterns To Borrow

These patterns should shape the redesign.

1. **Search as the first serious action**
   - The first screen should invite a high-intent investigation, not show an empty dashboard.
   - Use a large centered search box with suggested planning questions.
   - The user should understand, within seconds, that they can ask complex operational questions.

2. **Answer first, evidence beside it**
   - Search results should produce a concise synthesis first, then ranked facilities and evidence.
   - Do not bury citations behind a modal.
   - Show exact source quotes near the claims they support.

3. **Agent activity as audit trail**
   - When Deep Reasoning runs, show compact agent activity:
     - Interpreting query.
     - Searching facility index.
     - Filtering by geography.
     - Auditing trust flags.
     - Validating medical plausibility.
     - Preparing recommendation.
   - This should feel like observable work, not a spinner.

4. **Operational objects, not generic chat**
   - First-class objects should be visible:
     - Facility.
     - District.
     - Capability.
     - Trust Signal.
     - Evidence Quote.
     - Review Task.
     - Export Plan.
   - The user should never feel trapped in a text-only assistant.

5. **Human approval for consequential actions**
   - Exporting a field plan, marking a facility as verified, or notifying someone should be explicit.
   - The agent can recommend, but the user confirms.

6. **Source quality over source count**
   - Show whether evidence comes from description, capability text, procedure text, equipment, specialties, model inference, or validation.
   - Separate data quality, model confidence, source recency, and trust score.

7. **Avoid citation theater**
   - Citations must support the exact claim.
   - Do not show generic source badges that do not map to a claim.

## Information Architecture

Use an application shell with a strong first-look command cover. This is not a generic landing page; it is the product's empty state and primary entry point.

### Primary navigation

1. **Command**
   - Search, deep reasoning, result list, facility inspector.
   - Default first screen for demo and daily use.

2. **Map**
   - India capability map, state/pincode aggregates, facility dots.
   - Filters and geographic gap analysis.

3. **Shortlist**
   - Selected facilities, comparison table, export builder.
   - Can be local-only for hackathon; persistent later.

4. **Review**
   - Contradictions, low-confidence facilities, validation results.
   - Startup feature; can be mocked as a future tab if backend is not ready.

5. **Data Health**
   - Pipeline status, indexed rows, table freshness, extraction coverage.
   - Useful for judges and real enterprise buyers.

### Secondary navigation

- Facility detail page: `/facility/:id`
- Trace detail view: `/trace/:id` or external MLflow link
- Export confirmation/history
- Settings/admin later

### Navigation behavior

- App shell persists across pages.
- Breadcrumbs on detail pages: `Command / NICU Bihar / Aastha Children Hospital`.
- Back button returns to previous query/map state.
- Facility detail should be shareable by URL.
- Map and Command views should preserve filters when switching.

## Core Screens

### 0. Mission Control Cover

Purpose: replace the current mostly blank first screen with a polished, useful first impression that explains the product and pushes the user into the main workflow.

This is the default state before a query is submitted. Once the user searches, the layout transitions into the Command Workspace.

#### First impression goals

- Make TrueCare Atlas feel like a real product within 5 seconds.
- Explain the business problem in one or two lines.
- Show that the system is grounded in facility evidence, not generic AI.
- Give a clear action: search, deep search, or inspect map.
- Avoid a sterile blank page.

#### Layout

- Persistent top navigation:
  - TrueCare Atlas wordmark.
  - Command.
  - Map.
  - Shortlist.
  - Review.
  - Data Health.
  - System status badge.
- Centered command area:
  - Product slogan.
  - One-line problem statement.
  - Large search box.
  - Mode switch: `Fast Search` / `Deep Reasoning`.
  - Primary CTA: `Find trusted care`.
  - Secondary CTA: `Open capability map`.
- Background visual:
  - Full-viewport but restrained.
  - Use an actual India map/data visualization motif, not abstract blobs.
  - Layer subtle facility dots, capability deserts, and faint document/evidence textures.
  - Background should animate slowly between:
    - India capability map.
    - Evidence quote snippets.
    - Trust score/risk bands.
  - Keep contrast high behind the search box.
- Lower first-screen proof strip:
  - `10,000 facility records`
  - `11 audited capabilities`
  - `Row-level evidence`
  - `Databricks + Vector Search + MLflow traces`

#### Suggested slogan options

Choose one:

- **Find the care claims you can trust.**
- **Healthcare facility intelligence, audited to the sentence.**
- **From messy facility listings to verified care maps.**
- **Know where care exists, and where the data is lying.**

Recommended for demo:

> **Find the care claims you can trust.**

Supporting line:

> TrueCare Atlas audits 10,000 healthcare facility records to identify verified capabilities, contradictions, and regional care gaps for NGO and insurer planning teams.

#### Rotating prompt text

Inside or above the search input, rotate examples every 2-3 seconds. Animate by fading/sliding, not typing long text letter by letter.

Examples:

- `Find verified NICU facilities in Bihar`
- `Show oncology claims in Mumbai with evidence`
- `Map dialysis coverage in Chennai`
- `Which maternity facilities need review in Kerala?`
- `Find emergency surgery facilities with anesthesia evidence`
- `Where are high-trust neonatal care deserts?`

#### Suggested investigation chips

Below the search box:

- `NICU Bihar`
- `Oncology Mumbai`
- `Dialysis Chennai`
- `Emergency surgery Delhi`
- `Maternity Kerala`

Each chip should run a real query.

#### Technical grounding module

Small, below the hero content or as a right-side rail on desktop:

- `Extracts` unstructured specialties, equipment, procedures, and capability notes.
- `Scores` claims using trust rules and contradiction detection.
- `Searches` with hybrid retrieval over Databricks Vector Search.
- `Traces` reasoning steps with MLflow.
- `Exports` field-ready CSV/JSON shortlists.

Keep this module compact. It should reassure technical judges without becoming documentation.

#### Live system strip

Show the system status without making degradation look like failure:

- SQL: Connected.
- Vector index: Syncing / Ready.
- Indexed rows: current count.
- Last pipeline: if available.

For hackathon demo, label the degraded state clearly:

> Deep reasoning index is syncing. Fast search, map, facility audit, and export are live.

#### Transition into workspace

When the user searches:

1. Cover content compresses upward into a compact top command bar.
2. Results stream into the central workspace.
3. A short answer summary appears above results.
4. Facility inspector opens empty on the right until a result is selected.
5. Background map fades out into a clean app surface.

This creates first-look polish without hiding the real product behind a landing page.

### 1. Command Workspace

Purpose: answer a planning question and build a trusted shortlist.

Layout:

- Left rail: project context and navigation.
- Main column: search input, AI summary, results.
- Right inspector: selected facility trust report.
- Optional lower drawer: reasoning trace.

Key elements:

- Query input with examples:
  - "NICU Bihar"
  - "dialysis Chennai"
  - "oncology Mumbai"
  - "emergency surgery Delhi"
- Mode switch:
  - Fast Search
  - Deep Reasoning
- AI summary band:
  - Highest-trust facility.
  - How many results match capability.
  - How many have evidence.
  - How many need review.
- Result cards:
  - Facility name.
  - Location.
  - Trust score.
  - Capability badges.
  - Evidence quotes.
  - Contradiction warning when present.
  - Add to Shortlist action.
- Inspector:
  - Trust score.
  - Evidence flags.
  - Capability matrix.
  - Validate button and validation result.
  - Export/add action.

Design notes:

- Keep results dense and scannable.
- Avoid big decorative cards.
- Use table-like alignment for scores, locations, and capabilities.
- Show quotes as evidence chips or compact excerpt rows.
- Preserve the query at the top so users can refine it without returning to the cover.
- Offer context-aware follow-ups:
  - `Only show verified NICU`
  - `Limit to Bihar`
  - `Show low-trust claims`
  - `Prepare export`
  - `Open map`

### 2. Map Workspace

Purpose: identify capability deserts and inspect regional trust quality.

Layout:

- Full-canvas India map.
- Top filter bar.
- Right regional panel.
- Bottom summary strip.

Key elements:

- Capability filters:
  - NICU, ICU, Dialysis, Oncology, Emergency Surgery, Blood Bank, Maternity, 24x7, Trauma, Cath Lab.
- Region summary:
  - Claimed count.
  - Verified count.
  - Verification rate.
  - Confidence interval.
  - Top facilities.
  - Review-needed count.
- Map layers:
  - State aggregate bubbles at low zoom.
  - Facility dots at higher zoom.
  - Trust score color.
  - Low-confidence opacity.
- Interactions:
  - Click state -> filter command results.
  - Click facility dot -> open facility inspector.
  - Toggle "Show only review-needed".
  - Toggle "Verified only" vs "All claims".

Design notes:

- Map should be the visual anchor, not a small chart card.
- Use restrained basemap styling.
- Trust color scale: verified green, uncertain amber, contradiction red.
- Avoid decorative gradients.

### 3. Facility Detail

Purpose: make one facility auditable and shareable.

Layout:

- Header with name, location, type, trust score.
- Tabs or segmented sections:
  - Overview
  - Capabilities
  - Trust Audit
  - Validation
  - Source Evidence
  - Trace

Key elements:

- Facility summary and address.
- Capability matrix:
  - Capability.
  - Claim status.
  - Evidence quote.
  - Source field.
  - Confidence.
- Trust rules:
  - Rule ID.
  - Severity.
  - Explanation.
  - Evidence quotes.
- Contradiction module:
  - Supporting quote vs contradicting quote.
  - Clear label: "Do not rely on this claim without field verification."
- Actions:
  - Add to Shortlist.
  - Validate.
  - Export CSV.
  - Open MLflow trace.
  - Copy facility link.

Design notes:

- This page should feel like an audit document.
- Use strong typographic hierarchy and compact tables.
- Quotes need high contrast and line wrapping.

### 4. Shortlist / Export Builder

Purpose: convert research into an actionable field plan.

Can be implemented client-side first.

Key elements:

- Selected facilities table.
- Columns:
  - Facility.
  - Location.
  - Capabilities.
  - Trust score.
  - Risk flags.
  - Validation status.
- Compare mode:
  - Side-by-side capability/evidence comparison.
- Export options:
  - CSV.
  - JSON.
  - Include trust audit.
  - Include capabilities.
- Planner summary:
  - "8 facilities selected across 3 districts; 2 need field verification."

Backend mapping:

- Uses `POST /api/export`.
- Facility rows come from search/map/detail state.

Startup extension:

- Persist shortlist to a project.
- Add notes, owners, status, and verification tasks.

### 5. Review Queue

Purpose: turn AI uncertainty into a human workflow.

This is the clearest startup feature gap.

Key elements:

- Queue filters:
  - Contradictions.
  - Low evidence.
  - High-acuity capability.
  - Low confidence.
  - State/district.
- Review item:
  - Facility.
  - Claim.
  - Evidence for.
  - Evidence against.
  - Suggested action.
- Actions:
  - Mark for phone verification.
  - Mark as accepted.
  - Mark as rejected.
  - Assign reviewer.

Current backend support:

- Trust flags and validation findings exist.
- Persistence for review status does not exist yet.

### 6. Data Health / Governance

Purpose: build enterprise confidence without adding a full admin or auth system before the hackathon.

This view should make the Databricks foundation visible to judges and buyers. It is not a generic settings page. It should feel like an operational control room for data quality, governance, and traceability.

Primary message:

> Every facility recommendation is backed by governed tables, service-principal access, extraction coverage, trust rules, evidence quotes, and model traces.

Key layout:

- Top status strip:
  - Backend app status.
  - Databricks SQL status.
  - Vector Search status.
  - Indexed row count.
  - Last checked time.
- Pipeline lineage panel:
  - Bronze raw facility data.
  - Silver cleaned facility records.
  - Gold capability extraction.
  - Gold trust scoring.
  - Aggregates and vector index.
  - Show this as a simple horizontal pipeline, not a decorative diagram.
- Governance panel:
  - Unity Catalog-backed tables.
  - Backend accesses data through a Databricks App service principal.
  - Browser never receives Databricks credentials.
  - Vercel calls server-side proxy routes, which mint Databricks OAuth tokens.
  - Table access is explicit and scoped to the app service principal.
- Evidence quality panel:
  - Total facility rows.
  - Extraction coverage.
  - Capability flags audited.
  - Trust score distribution.
  - Contradiction count.
  - Records requiring review.
- Traceability panel:
  - Recent deep search trace IDs.
  - Link or button label: `Open MLflow trace`.
  - Show tool steps such as vector search, capability filter, facility lookup, and trust audit.
- Data freshness panel:
  - Last pipeline run.
  - Last aggregate refresh.
  - Last vector index sync.
  - Current sync status if the index is still syncing.

Hackathon implementation instruction:

- Build this as a visible top-level navigation item named `Data Health` or `Governance`.
- Use real values from `GET /api/health` wherever available.
- For metadata that is not available yet, use clearly labeled static demo values derived from the known pipeline, such as `10,000 facility records`, `11 audited capabilities`, `Bronze -> Silver -> Gold`, and `Databricks App service principal`.
- Do not build login, signup, RBAC, admin management, or customer-specific policy screens for the hackathon.
- Do not imply per-customer row-level access is implemented. Phrase it as "Databricks-native foundation" or "ready for customer-specific policies", not as completed multi-tenant governance.
- Add one concise future-readiness callout: "Startup path: add org-level auth, Lakebase-backed projects, review assignments, and customer-specific Unity Catalog policies."

Current backend support:

- `GET /api/health` provides SQL and Vector Search status.
- The deployed architecture already uses Vercel server-side proxy routes and Databricks OAuth M2M.
- The backend enables MLflow tracing for agent/tool operations.
- Additional pipeline run metadata, historical freshness, and persisted review status would require backend additions.

## API Mapping

Use these existing frontend proxy routes. The redesign should not call Databricks directly from the browser.

| UI Need | Frontend Route | Backend Route |
|---|---|---|
| Health/status | `GET /api/health` | `GET /api/health` |
| Fast search | `GET /api/search-quick?q=&k=` | `GET /api/search-quick` |
| Deep reasoning | `POST /api/search` | `POST /api/search` |
| Facility detail | `GET /api/facility?id=` | `GET /api/facility/{id}` |
| Trust audit | `GET /api/audit?id=` | `GET /api/audit/{id}` |
| Validation | `GET /api/validate?id=` | `GET /api/validate/{id}` |
| Map aggregate | `GET /api/map?capability=&level=` | `GET /api/map/aggregates` |
| Facility dots | `GET /api/map/facilities` | `GET /api/map/facilities` |
| Export | `POST /api/export` | `POST /api/export` |

Backend route available but missing frontend proxy:

| UI Need | Backend Route | Suggested Frontend Route |
|---|---|---|
| Confidence intervals | `GET /api/map/aggregates/ci` | `GET /api/map/ci` |
| MLflow traces | `GET /api/traces/{run_id}` | `GET /api/traces?id=` |

## Design System Direction

### Tone

Serious, operational, trustworthy. Avoid startup-marketing gloss.

### Palette

- Base: warm off-white or light grey.
- Text: deep charcoal.
- Surface: white with subtle borders.
- Primary action: Databricks-adjacent orange or deep teal, but use sparingly.
- Trust: green.
- Caution: amber.
- Alert/contradiction: red.
- Map neutral: pale grey, thin borders.

Avoid:

- Purple/blue gradient SaaS aesthetic.
- Large rounded marketing cards.
- Decorative blobs/orbs.
- Over-saturated map colors.

### Typography

- Use one clean sans-serif for UI.
- Optional mono for IDs, trace IDs, timings, rule IDs.
- Dense tables should use tabular numerals.
- Keep headings compact inside the app surface.

### Iconography

Use `lucide-react` icons:

- Search, Map, ListChecks, FileDown, ShieldCheck, AlertTriangle, Activity, Hospital, ClipboardCheck, History, ExternalLink.

Do not use icons decoratively. Every icon should improve scanning.

### Component Style

- App shell with left rail and top command bar.
- Panels use subtle borders, not heavy shadows.
- Cards only for repeated selectable items or modal/detail chunks.
- Use compact badges for capabilities.
- Use status pills for trust/risk.
- Tables for comparison and review.
- Sheets/drawers for inspector on mobile.

## Accessibility Requirements

- All interactive controls keyboard reachable.
- Visible focus states on buttons, links, map controls, result cards.
- Minimum 44px touch target on mobile.
- Do not rely on color alone for trust/risk:
  - Include labels like Verified, Review, Contradiction.
- Quotes and evidence text must wrap.
- Search input must have accessible label.
- Loading states must not trap focus.
- Map needs non-map fallback list/table.
- Respect reduced motion for animations.

## Responsive Behavior

Desktop:

- Three-pane Command layout.
- Full map workspace with right panel.

Tablet:

- Two-pane layout.
- Inspector becomes resizable drawer.

Mobile:

- Bottom navigation.
- Result list first.
- Facility detail opens as full-screen sheet.
- Map filters collapse into top sheet.
- Trust panel must not disappear; it becomes a tab inside facility detail.

## Motion

Use restrained motion only where it clarifies state:

- Search result entrance: quick stagger, 100-180ms.
- Trust score ring: fill when facility selected.
- Evidence reveal: score -> flags -> quotes.
- Map capability switch: smooth color/radius transition.
- Inspector open/close: slide from right on desktop, bottom/fullscreen on mobile.

Respect `prefers-reduced-motion`.

## Copy Guidelines

Use product UI copy, not pitch copy.

Good labels:

- "Verified claims"
- "Needs review"
- "Evidence"
- "Contradiction"
- "Add to shortlist"
- "Export field plan"
- "Open trace"
- "Validation pending"

Avoid:

- "AI magic"
- "Revolutionary"
- "Unlock insights"
- "Transform healthcare"

## Recommended Build Phases

### Phase A: Demo-grade redesign without backend changes

- New app shell and navigation.
- Command workspace.
- Map workspace.
- Facility detail route.
- Client-side shortlist.
- Export builder using existing export endpoint.
- Confidence intervals wired via new frontend route proxy.
- Trace link/proxy wired.
- Mobile trust panel sheet.

### Phase B: Startup workflow layer

- Auth and organizations.
- Projects.
- Persistent shortlists.
- Review queue persistence.
- Admin data ingestion page.
- Audit history.
- Usage/event logging.

### Phase C: Enterprise polish

- Role-based access.
- Customer-specific datasets.
- Field verification assignments.
- Billing/plan management.
- SLA/data freshness dashboards.

## Visual Mockup Prompt

Use this prompt in a visual tool:

> Design a serious healthcare network intelligence web app called TrueCare Atlas. It is not a generic SaaS landing page. It is an operational AI workspace for NGO and insurer teams auditing 10,000 messy Indian healthcare facility records. The first screen is a polished Mission Control cover: persistent top navigation, subtle animated India map/data background, centered large search box, rotating investigation prompts, slogan "Find the care claims you can trust", supporting line about auditing facility records for verified capabilities, contradictions, and regional care gaps, primary CTA "Find trusted care", secondary CTA "Open capability map", and compact proof strip showing 10,000 facility records, row-level evidence, Databricks Vector Search, and MLflow traces. After search, transition into a command workspace with left navigation rail, top command bar, central ranked facility results, right trust audit inspector, and optional agent activity rail. The visual language is public-health command center meets audit ledger: off-white background, charcoal typography, thin borders, compact tables, green for verified claims, amber for uncertain claims, red for contradictions. Include tabs for Command, Map, Shortlist, Review, and Data Health. Show a query "NICU Bihar", ranked facility results with trust scores and evidence quotes, and an inspector for Aastha Children Hospital showing Trust Score 100, NICU evidence, validation, and export actions. Also design a full-canvas India map workspace with capability filters and state verification summary. Avoid purple gradients, oversized cards, decorative blobs, fake AI mascots, and vague marketing copy.

## Decision

For the hackathon, the current backend feature set is strong enough. The fastest path to a winning presentation is a frontend overhaul that makes the product feel like a real planning and audit workflow.

For the startup path, the next serious product investment should be projects, saved shortlists, review queues, and organization-level auth. Those turn the system from "AI search over facilities" into a repeatable operating system for healthcare network verification.
