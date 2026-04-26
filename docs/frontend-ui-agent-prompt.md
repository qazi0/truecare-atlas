# Standalone UI Design Agent Prompt

Use this prompt with a visual/UI generation agent such as Lovable, v0, Bolt, Figma AI, or another frontend prototype agent. It is written to be self-contained. The agent does not need repository access, backend code, API routes, or deployment context.

## Prompt

You are a senior product designer and frontend prototyping agent. Design a polished, production-quality web application for a healthcare facility intelligence product called **TrueCare Atlas**.

This is not a generic SaaS landing page and not a simple chatbot. It is an operational intelligence workspace for NGO planners, insurers, public-health teams, and provider-network operators who need to make high-stakes decisions from messy healthcare facility data.

The product helps a planner answer questions like:

- Which facilities plausibly provide NICU care in Bihar?
- Which oncology claims in Mumbai are supported by evidence?
- Where are dialysis coverage gaps?
- Which facilities need human verification before being included in a field plan?
- Which claims are contradicted by the available data?

The UI should make the product feel credible, evidence-first, fast, calm, and professionally built. It should look like a public-health command center mixed with an audit ledger: map-led, dense, scannable, restrained, and trustworthy.

## Product Story

Healthcare facility lists are noisy. A facility may claim to offer critical services such as NICU, dialysis, oncology, emergency surgery, maternity care, 24x7 service, trauma care, anesthesia, blood bank, ICU, or cath lab support, but those claims may be incomplete, vague, contradictory, or unsupported by real evidence.

TrueCare Atlas turns messy facility records into a verified capability map. It extracts capabilities, scores trust, surfaces evidence quotes, identifies contradictions, maps regional care gaps, supports deep reasoning, and exports defensible shortlists for field verification.

The user should understand this within the first 5 seconds:

> TrueCare Atlas helps teams find the care claims they can trust.

Recommended first-screen slogan:

> Find the care claims you can trust.

Supporting line:

> Audit healthcare facility records to identify verified capabilities, contradictions, and regional care gaps for NGO, insurer, and public-health planning teams.

## Primary User

Design primarily for **Maya**, a programme lead at an NGO planning maternal and neonatal health coverage across Bihar, eastern Uttar Pradesh, and Jharkhand.

Maya's core job:

> I need to identify facilities that plausibly provide a life-saving capability, understand where the data is weak or contradictory, and export a defensible shortlist for field verification or partner planning.

Secondary users:

- Insurer network managers auditing provider coverage.
- Public-health analytics teams mapping care access gaps.
- Foundation teams planning grants or interventions.
- Hospital groups evaluating referral networks.

## Visual Thesis

A restrained public-health command center: full-canvas map visuals, evidence-rich panels, document-grade typography, compact tables, and color used only for trust, uncertainty, contradiction, and action.

The design must feel:

- Serious.
- Operational.
- Trustworthy.
- Healthcare-specific.
- Evidence-driven.
- Modern, but not flashy.
- Investor-demo ready.

Avoid:

- Generic AI chatbot layouts.
- Generic SaaS card grids.
- Purple/blue gradient startup aesthetics.
- Decorative blobs, orbs, or bokeh backgrounds.
- Oversized rounded cards everywhere.
- Fake mascot/robot AI branding.
- Vague phrases like "unlock insights", "AI magic", or "transform healthcare".

## Required Information Architecture

Create a full app shell with persistent navigation and these top-level sections:

1. **Command**
   - Search, deep reasoning, ranked results, evidence, and facility inspector.

2. **Map**
   - India capability map, state summaries, facility dots, filters, and gap analysis.

3. **Shortlist**
   - Selected facilities, comparison table, export builder, and field-plan summary.

4. **Review**
   - Contradictions, low-evidence claims, validation issues, and human verification tasks.

5. **Data Health**
   - Data pipeline status, search/index health, evidence coverage, governance foundation, and traceability.

Also include:

- Facility detail page or full-screen detail view.
- Back navigation from detail pages.
- Breadcrumb examples such as `Command / NICU Bihar / Aastha Children Hospital`.
- Mobile navigation behavior.

## Screen 0: Mission Control Cover

Design the default first screen as a polished Mission Control cover, not an empty dashboard.

The first screen should include:

- Persistent top navigation.
- TrueCare Atlas wordmark.
- System status badge.
- Large centered command/search box.
- Mode switch: `Fast Search` and `Deep Reasoning`.
- Primary CTA: `Find trusted care`.
- Secondary CTA: `Open capability map`.
- Rotating investigation prompts.
- Compact proof strip.
- Subtle full-screen India map/data background.

The background should be restrained and data-led:

- India map silhouette or basemap.
- Facility dots.
- Capability gap shading.
- Faint document/evidence texture.
- Subtle trust score/risk bands.

It should not be an abstract gradient. It should not use decorative blobs.

Rotating prompt examples:

- `Find verified NICU facilities in Bihar`
- `Show oncology claims in Mumbai with evidence`
- `Map dialysis coverage in Chennai`
- `Which maternity facilities need review in Kerala?`
- `Find emergency surgery facilities with anesthesia evidence`
- `Where are high-trust neonatal care deserts?`

Suggested quick chips:

- `NICU Bihar`
- `Oncology Mumbai`
- `Dialysis Chennai`
- `Emergency surgery Delhi`
- `Maternity Kerala`

Proof strip:

- `10,000 facility records`
- `11 audited capabilities`
- `Row-level evidence`
- `Vector search`
- `Model traces`
- `Export-ready shortlists`

When a search is submitted, the cover should visually compress into the app workspace:

1. The large search area becomes a compact top command bar.
2. Ranked results appear in the main column.
3. A concise AI summary appears above results.
4. Facility inspector opens on the right.
5. The map background fades into a clean operational workspace.

## Screen 1: Command Workspace

Purpose: answer a planning question and build a trusted shortlist.

Desktop layout:

- Left rail: navigation and current project context.
- Top command bar: search input, mode switch, filters.
- Main column: AI summary and ranked facility results.
- Right inspector: selected facility trust report.
- Optional lower drawer or side rail: agent activity / reasoning trace.

Use the sample active query:

> NICU Bihar

AI summary band should say something like:

> Found 5 candidate facilities for NICU in Bihar. 3 have direct evidence, 1 needs review, and the highest-trust match is Aastha Children Hospital.

Result rows/cards should be compact and scannable. Each result should include:

- Facility name.
- City/state.
- Facility type.
- Trust score.
- Capability badges.
- Evidence quote snippets.
- Risk labels such as `Verified`, `Needs review`, or `Contradiction`.
- Action: `Add to shortlist`.

Example facility results:

- Aastha Children Hospital, Patna, Bihar, Trust Score 100, NICU evidence.
- City Care Hospital, Gaya, Bihar, Trust Score 84, pediatric/emergency evidence.
- Sunrise Maternity Centre, Muzaffarpur, Bihar, Trust Score 68, maternity evidence, needs review.
- Agasthiyar Siddha Clinic, Chennai, Tamil Nadu, Trust Score 42, contradiction detected for oncology claim.

The inspector panel for a selected facility should include:

- Facility name and location.
- Large but restrained trust score.
- Capability matrix.
- Evidence quotes.
- Trust audit rules.
- Validation status.
- Buttons: `Add to shortlist`, `Validate`, `Export`, `Open trace`.

Trust score colors:

- Green: verified/high trust.
- Amber: uncertain/needs review.
- Red: contradiction or high risk.

Do not rely on color alone. Include text labels.

## Screen 2: Map Workspace

Purpose: identify care deserts, regional coverage gaps, and trust quality.

The map should be the main visual anchor. Do not put it inside a small decorative card.

Desktop layout:

- Full-canvas India map.
- Top filter bar.
- Right regional summary panel.
- Bottom national summary strip.

Capability filters:

- NICU.
- ICU.
- Dialysis.
- Oncology.
- Emergency Surgery.
- Blood Bank.
- Maternity.
- 24x7.
- Trauma.
- Anesthesia.
- Cath Lab.

Map layers:

- State-level aggregate bubbles at low zoom.
- Facility dots at high zoom.
- Trust score color.
- Low-confidence opacity.
- Review-needed markers.

Selected region panel should show:

- Region name.
- Claimed count.
- Verified count.
- Verification rate.
- Confidence interval.
- Top facilities.
- Review-needed count.
- CTA: `Show matching facilities`.

Interactions:

- Clicking a state filters Command results.
- Clicking a facility dot opens the facility inspector.
- Toggle `Verified only`.
- Toggle `Show review-needed`.
- Toggle capability type.

## Screen 3: Facility Detail

Purpose: make one facility auditable and shareable.

This screen should feel like a serious audit document, not a marketing profile.

Header:

- Facility name.
- Location.
- Facility type.
- Trust score.
- Status label.
- Actions: `Add to shortlist`, `Validate`, `Export`, `Copy link`, `Open trace`.

Sections or tabs:

- Overview.
- Capabilities.
- Trust Audit.
- Validation.
- Source Evidence.
- Trace.

Capability matrix columns:

- Capability.
- Claim status.
- Evidence quote.
- Source field.
- Confidence.
- Review status.

Trust audit area:

- Rule ID.
- Severity.
- Explanation.
- Evidence quotes.

Contradiction module:

- Clear warning: `Do not rely on this claim without field verification.`
- Supporting quote side-by-side with contradicting quote.
- Suggested action: `Send to review queue`.

## Screen 4: Shortlist / Export Builder

Purpose: convert research into an actionable field verification plan.

This can feel like a working table, not a set of large cards.

Include:

- Selected facilities table.
- Comparison mode.
- Export settings.
- Field-plan summary.

Selected facilities table columns:

- Facility.
- Location.
- Capabilities.
- Trust score.
- Risk flags.
- Validation status.
- Evidence count.
- Remove action.

Planner summary example:

> 8 facilities selected across 3 districts. 6 have direct evidence, 2 need field verification.

Export options:

- CSV.
- JSON.
- Include trust audit.
- Include source evidence.
- Include validation findings.

Primary CTA:

> Export field plan

## Screen 5: Review Queue

Purpose: turn AI uncertainty into a human verification workflow.

This is a startup-readiness screen. It may use sample data, but it should look like a real product workflow.

Filters:

- Contradictions.
- Low evidence.
- High-acuity capability.
- Low confidence.
- State/district.
- Assigned reviewer.

Review item fields:

- Facility.
- Claim.
- Evidence for.
- Evidence against.
- Severity.
- Suggested action.
- Owner.
- Status.

Actions:

- Mark for phone verification.
- Accept claim.
- Reject claim.
- Assign reviewer.
- Add note.

Do not make this feel like a generic task manager. It should feel healthcare-data-specific.

## Screen 6: Data Health / Governance

Purpose: build enterprise confidence without requiring a full admin system.

This screen should show that the product is built on a governed, traceable, auditable data foundation.

It should feel like an operational control room for data quality, governance, and traceability.

Primary message:

> Every facility recommendation is backed by governed tables, extraction coverage, trust rules, evidence quotes, and model traces.

Top status strip:

- App status.
- SQL/data warehouse status.
- Search index status.
- Indexed row count.
- Last checked time.

Pipeline lineage panel:

- Bronze raw facility data.
- Silver cleaned facility records.
- Gold capability extraction.
- Gold trust scoring.
- Aggregates and search index.

Show this as a simple horizontal pipeline, not a decorative diagram.

Governance panel:

- Governed healthcare facility tables.
- Server-side app access.
- Browser never receives data-platform credentials.
- Explicit scoped service access.
- Ready for customer-specific policies.

Evidence quality panel:

- Total facility rows.
- Extraction coverage.
- Capability flags audited.
- Trust score distribution.
- Contradiction count.
- Records requiring review.

Traceability panel:

- Recent deep search trace IDs.
- Tool steps: search index, capability filter, facility lookup, trust audit, validation.
- Action: `Open trace`.

Data freshness panel:

- Last pipeline run.
- Last aggregate refresh.
- Last search index sync.
- Current sync state.

Important: do not show login, signup, RBAC, billing, or admin-user management. This is not an auth settings page.

Use wording like:

- `Governance foundation`
- `Traceable recommendations`
- `Ready for customer-specific policies`

Do not claim completed multi-tenant governance or per-customer row-level policy unless explicitly represented as future-ready.

## Agent Activity / Deep Reasoning UI

Deep Reasoning should not look like a loading spinner. Show observable work:

- Interpreting query.
- Searching facility index.
- Filtering by geography.
- Auditing trust flags.
- Validating medical plausibility.
- Preparing recommendation.

Each step should be compact and collapsible. Show the tool/action name, short result preview, and status. Example:

- `Searching facility index` -> `Found 12 candidate facilities`
- `Filtering geography` -> `5 facilities in Bihar`
- `Auditing trust` -> `3 verified, 1 needs review`
- `Preparing recommendation` -> `Shortlist ready`

## Design System

Tone:

- Serious.
- Operational.
- Trustworthy.
- Evidence-first.

Palette:

- Base: warm off-white or light grey.
- Text: deep charcoal.
- Surface: white with subtle borders.
- Primary accent: deep teal or restrained Databricks-adjacent orange.
- Trust: green.
- Caution: amber.
- Alert/contradiction: red.
- Map neutral: pale grey.

Typography:

- Use one clean sans-serif for UI.
- Optional monospace for trace IDs, rule IDs, timestamps, and technical metadata.
- Use tabular numerals in tables and metrics.
- Headings inside the app should be compact, not hero-sized.

Component style:

- App shell with persistent navigation.
- Thin dividers and subtle borders.
- Compact badges.
- Tables for comparison/review.
- Cards only for repeated selectable results or focused detail chunks.
- No card-inside-card layouts.
- No heavy shadows.
- No decorative UI chrome.

Iconography:

Use simple functional icons for:

- Search.
- Map.
- Hospital.
- Shield/check.
- Warning.
- Activity.
- Clipboard.
- Download/export.
- Trace/external link.

Icons must improve scanning. Do not use icons as decoration.

## Accessibility Requirements

The design must be accessible:

- All controls keyboard reachable.
- Visible focus states.
- Minimum 44px touch targets on mobile.
- Do not rely on color alone for trust/risk.
- Include labels such as `Verified`, `Needs review`, and `Contradiction`.
- Evidence quotes must wrap cleanly.
- Search input must have a visible or accessible label.
- Loading states must not trap focus.
- Map must have a non-map list/table fallback.
- Respect reduced motion.
- Maintain strong contrast over the Mission Control background.

## Responsive Behavior

Desktop:

- Three-pane Command layout.
- Full map workspace with right inspector.
- Persistent left rail or top nav.

Tablet:

- Two-pane layout.
- Inspector becomes drawer.
- Map filters collapse into a compact bar.

Mobile:

- Bottom navigation.
- Search and results first.
- Facility detail opens as full-screen sheet.
- Trust panel becomes a tab inside facility detail.
- Map filters become a top or bottom sheet.
- No important trust/evidence information may disappear on mobile.

## Motion Direction

Use restrained motion that clarifies state:

- Hero/Mission Control entrance: subtle stagger.
- Rotating prompt text: fade/slide, not long typewriter animation.
- Search transition: cover compresses into command workspace.
- Result entrance: quick stagger, 100-180ms.
- Trust score ring: fills when facility selected.
- Evidence reveal: score -> flags -> quotes.
- Map capability switch: smooth color/radius transition.
- Inspector open/close: slide from right on desktop, bottom/fullscreen on mobile.

Respect reduced-motion preferences.

Motion should make the UI feel alive and understandable, not decorative.

## Copy Guidelines

Use direct product UI copy.

Good labels:

- `Verified claims`
- `Needs review`
- `Evidence`
- `Contradiction`
- `Add to shortlist`
- `Export field plan`
- `Open trace`
- `Validation pending`
- `Show matching facilities`
- `Prepare review plan`

Avoid:

- `AI magic`
- `Revolutionary`
- `Unlock insights`
- `Transform healthcare`
- `Supercharge`
- `Seamless`

## Required Prototype Content

Use realistic sample data directly in the design so the screens feel populated.

Sample query:

> NICU Bihar

Sample facilities:

1. Aastha Children Hospital
   - Patna, Bihar.
   - Trust Score: 100.
   - Capabilities: NICU, Pediatrics, Emergency.
   - Evidence: "Neonatal Intensive Care Unit".
   - Status: Verified.

2. City Care Hospital
   - Gaya, Bihar.
   - Trust Score: 84.
   - Capabilities: ICU, Pediatrics, 24x7.
   - Evidence: "Emergency pediatric care available".
   - Status: Needs review.

3. Sunrise Maternity Centre
   - Muzaffarpur, Bihar.
   - Trust Score: 68.
   - Capabilities: Maternity, NICU claim.
   - Evidence: "Newborn care services".
   - Status: Evidence weak.

4. Agasthiyar Siddha Clinic
   - Chennai, Tamil Nadu.
   - Trust Score: 42.
   - Capabilities: Oncology claim.
   - Evidence for: "Treats cancer".
   - Evidence against: "Siddha wellness clinic".
   - Status: Contradiction.

Sample metrics:

- 10,000 facility records.
- 11 audited capabilities.
- 9,956 high-trust records.
- 44 review-needed records.
- 5 pipeline stages.
- 4,050 indexed rows syncing, or show ready state if preferred.

## Deliverables

Produce a polished initial frontend design/prototype covering:

1. Mission Control Cover.
2. Command Workspace.
3. Map Workspace.
4. Facility Detail.
5. Shortlist / Export Builder.
6. Review Queue.
7. Data Health / Governance.
8. Mobile states for Command, Facility Detail, and Map.

The prototype should include realistic content, not empty placeholders.

The first screen must create immediate confidence. A judge or buyer should understand the product's purpose within 5 seconds and see the operational workflow within 30 seconds.

## Quality Bar

Before finishing, check:

- Does the first screen clearly say what the product does?
- Is the search box central and useful?
- Is the India/map context visible early?
- Can a user move from search to evidence to map to shortlist?
- Is trust/evidence visually central?
- Are contradictions impossible to miss?
- Does the app feel serious enough for healthcare planning?
- Does Data Health make the data foundation credible?
- Is the design accessible and responsive?
- Is the UI free of generic SaaS filler?

Final direction:

Design this as a real healthcare intelligence workspace that could become a startup product, but keep the prototype focused on the hackathon story: search, map, evidence, trust, review, export, and governance confidence.
