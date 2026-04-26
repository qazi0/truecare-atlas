# TrueCare Atlas — PROGRESS

> **For the next Claude session**: read this file first, then `git log --oneline -10`, then `PLAN.md` (specifically §0-§5 and the current phase). Do NOT re-explore the dataset — every finding is in PLAN.md §1.

## Current state
- **Phase**: Phase 7 frontend deploy done. VS index still syncing. Frontend UX polish next.
- **Status**: All tables rebuilt + `vs_facility_search` materialized. VS index `facility_index` syncing on `tm_endpoint`. Backend live on Databricks Apps. Frontend live on Vercel.
- **Workspace**: `dbc-d744432c-1635`. Profile: `sj-wksp`. Warehouse ID: `38034fae49ef0da4`.
- **Databricks App**: `trustmap-india` → `https://trustmap-india-7474646917144080.aws.databricksapps.com` (RUNNING)
- **Vercel Frontend**: `trustmap-india` → `https://trustmap-india.vercel.app` (deployed, smoke-tested)
- **App SP ID**: `9b58b18f-02ef-4a09-afe9-ff4a7afdcfa9` (has SELECT on all tables)
- **Last commit**: d9f0aed (rename product to TrueCare Atlas)
- **Branch**: main
- **Wall-clock used**: ~17h / 36h
- **Last updated**: 2026-04-26

## CRITICAL: What must happen before the app is fully demo-ready

1. ~~**Add control char stripping to `clean.sql`**~~ — DONE (session 8).
2. ~~**Run Phases 1-4 via bundle job**~~ — DONE (session 8). All 4 tasks succeeded in ~12 min.
3. ~~**Run Phase 4b: Vector Search**~~ — DONE (session 9). `tm_endpoint` ONLINE, `vs_facility_search` table materialized (10K rows, CDF enabled), delta-sync index `facility_index` created and syncing.
4. ~~**Verify backend health**~~ — DONE (session 9). Local + deployed backend both healthy. SQL works, VS pending sync.
5. ~~**Deploy backend to Databricks Apps**~~ — DONE (session 9). App running at URL above.
6. **Wait for VS index sync** — check: `databricks vector-search-indexes get-index workspace.default.facility_index --profile sj-wksp`
7. ~~**Deploy frontend to Vercel**~~ — DONE (session 10). Public URL: `https://trustmap-india.vercel.app`

## Active context (read this first)

### What was done this session (session 9)
1. **Vector Search pipeline** — created `vs_prep.sql` bundle task (Phase 4b). Materializes `vs_facility_search` table joining gold_facility_capabilities + gold_facility_trust with CDF enabled. Added to pipeline as task 5. Ran via `databricks bundle run --only vs_prep`. Created delta-sync index `workspace.default.facility_index` on `tm_endpoint` with `databricks-gte-large-en` embeddings on `search_text`. Index syncing.
2. **10K facility map dots** — new `GET /api/map/facilities` endpoint returns lightweight facility points. Frontend `india-map.tsx` now has two layers: state aggregates (zoom 3-7) crossfading to individual facility dots (zoom 5+). Click a dot → opens facility detail.
3. **Evidence quotes in search results** — `FacilityCard` now shows up to 3 capability evidence quotes (e.g., `NICU — "NEONATAL INTENSIVE CARE UNIT"`). Data was already in API, just not rendered.
4. **Multi-word search fix** — `query_facilities_by_text` now splits query into words and matches each with AND logic. "NICU Bihar" now returns results. Demo query pills updated.
5. **Databricks Apps deploy** — created app `trustmap-india`, uploaded backend code (app/ + requirements.txt + app.yaml) to workspace, deployed. App running at `https://trustmap-india-7474646917144080.aws.databricksapps.com`. Had to grant SELECT on all tables to app SP `9b58b18f-02ef-4a09-afe9-ff4a7afdcfa9`.

### What was done this session (session 10)
1. **Vercel frontend deployed** — linked `frontend/` to Vercel project `trustmap-india`, deployed production alias `https://trustmap-india.vercel.app`.
2. **Vercel → Databricks auth fixed** — Next.js proxy routes now mint Databricks OAuth M2M tokens server-side using Vercel env vars `DATABRICKS_HOST`, `DATABRICKS_CLIENT_ID`, `DATABRICKS_CLIENT_SECRET`. Raw browser traffic never sees Databricks credentials.
3. **App permission fixed** — granted `CAN_USE` on Databricks App `trustmap-india` to app SP `9b58b18f-02ef-4a09-afe9-ff4a7afdcfa9`, allowing OAuth M2M tokens to call `/api/*`.
4. **Deployment smoke tested** — public Vercel API routes work for `/api/health`, `/api/search-quick?q=NICU%20Bihar`, and `/api/map`. Browser-tested public URL with Playwright: search cards render, facility trust panel opens, and Mapbox map tab renders.
5. **Demo-query fallback added** — `/api/search-quick` now falls back to individual-term searches only when the backend returns an empty result for a multi-word query. This keeps `NICU Bihar` reliable while the backend text search behavior is imperfect.

### What was done this session (session 11)
1. **Product rename** — user-facing product name changed from TrustMap India to TrueCare Atlas across frontend title/header, backend OpenAPI title, agent prompt, export filenames, README, and design docs. Deployment slugs/URLs such as `trustmap-india` were intentionally kept stable.
2. **Frontend redesign brief** — added `docs/frontend-product-redesign-brief.md` with the full product/UX direction, startup-readiness analysis, Mission Control cover concept, core screens, Data Health/Governance view, design system, accessibility, motion, and build phases.
3. **Standalone UI-agent prompt** — added `docs/frontend-ui-agent-prompt.md`, a self-contained prompt for Lovable/v0/Bolt/Figma AI-style tools to generate the initial TrueCare Atlas frontend design without codebase context.
4. **Direct place/geo backend search** — added `GET /api/search-nearby`. It accepts `place` or `lat/lng`, resolves city/state/pincode against `gold_facility_trust`, applies optional capability/trust filters, and returns distance-ranked facilities. Verified with `place=Bihar&capability=nicu&radius_km=300&k=3`; results matched independent Databricks SQL checks. State/pincode place searches now auto-scope results to the resolved state/pincode.
5. **Hackathon review queue** — added JSON-backed `GET/POST/PATCH/DELETE /api/reviews` for manual verification workflow: status, owner, notes, evidence for/against, severity. This avoids Lakebase while giving persistence on the same app instance; it is not a production multi-instance store.
6. **Data Health/Governance API** — added `GET /api/data-health` with SQL status, Vector Search status/indexed rows, table counts, trust distribution, capability counts, pipeline stage metadata, and governance statements for the new frontend Data Health view.
7. **Verification** — backend compile passed; review queue create/list/update/delete passed using a temp JSON path; route registration passed; local smoke on port `8001` succeeded and was shut down. Existing port `8000` backend listeners were left untouched.

### Databricks Apps deployment learnings
- **DO NOT** use `databricks workspace import-dir` on the entire backend/ — it uploads .venv (thousands of files). Upload only `app/`, `app.yaml`, `requirements.txt`, `pyproject.toml`.
- The app's service principal (shown in health endpoint as `user`) needs explicit `GRANT SELECT ON TABLE ... TO \`<sp-id>\`` for each table.
- `source_code_path` in `apps.yml` bundle config needs an absolute workspace path (`/Workspace/Users/.../trustmap-backend`), not a relative path like `../backend`.
- `valueFrom` → `value_from` (snake_case) in `apps.yml` env config.
- The app auto-installs from `requirements.txt` — no need to upload .venv or uv.lock.
- Auth: Databricks Apps are behind workspace SSO. API calls need `Authorization: Bearer <token>` from `databricks auth token --profile sj-wksp`. The Vercel frontend will need a server-side token to proxy calls to the Databricks backend — the token is NOT exposed to the browser user.
- App URL pattern: `https://<app-name>-<workspace-id>.aws.databricksapps.com`

### Vercel → Databricks backend auth pattern
The Vercel frontend already proxies all API calls through Next.js API routes (`/api/*` → backend). In production:
1. Set `NEXT_PUBLIC_BACKEND_URL=https://trustmap-india-7474646917144080.aws.databricksapps.com` as a Vercel env var
2. Set `DATABRICKS_TOKEN=<service-principal-token-or-pat>` as a Vercel **server-side** env var (no NEXT_PUBLIC_ prefix)
3. The Next.js API routes add `Authorization: Bearer ${process.env.DATABRICKS_TOKEN}` header when proxying to the backend
4. The browser user never sees the Databricks token — they only talk to Vercel
5. For long-lived auth, create a service principal with a PAT or use OAuth M2M client credentials (the app SP can be reused)

### What was done session (session 8)
1. **Control char stripping** — added REGEXP_REPLACE for ctrl chars on `name`, `description`, `address_city` in `clean.sql`. Previously 9,042/10K rows had ctrl chars (D009). Now fixed at source.
2. **State alias map inlined** — moved from separate `CREATE TEMPORARY VIEW` to a CTE inside the main query. clean.sql is now fully self-contained.
3. **Bundle job deployed + ran successfully** — `databricks bundle deploy` then `databricks bundle run trustmap_pipeline`. Full 4-phase pipeline (clean→extract→score→aggregate) completed in ~12 min with full traceability in Databricks UI. Job ID `492052241634170`, run ID `585558684827346`.
4. **apps.yml fixed** — warehouse ID updated from old `7180e1001ad3c807` to `38034fae49ef0da4`. Temporarily excluded from bundle (path resolution issue with `source_code_path: ../backend` — needs fix for Phase 7 deploy).
5. **Orphan artifacts cleaned** — dropped manually-created tables and `state_alias_map` view. All tables now created exclusively by the bundle job.

### Session 7 context (workspace migration)
- Old workspace `dbc-842dd1eb-38c2` (free edition) dead — hit daily SQL quota limit
- New workspace: `dbc-d744432c-1635`. Profile: `sj-wksp`. Warehouse ID: `38034fae49ef0da4`
- All config files updated across ~15 files. Raw data (`health_india`) re-created via UI upload.

### What was done session 6
1. **4 new API proxy routes** — `search-quick`, `audit`, `export`, `validate` — all proxy through Next.js to avoid CORS issues.
2. **Fixed search data flow** — SearchConsole now calls `/api/search-quick` (proxy) instead of direct backend.
3. **Tabbed navigation** — main page has Search | Map tabs + health status dot.
4. **Trust panel actions** — Validate and Export CSV buttons wired to proxy routes.
5. **New types** — `AggregateRowWithCI`, `ValidatorResult`, `ValidationFinding`, `ExportRequest`, `HealthCheck`.
6. **Evidence overflow fix** — wraps properly instead of overflowing.
7. **Facility card refinement** — inline layout, removed framer-motion hover wrapper.
8. **Map grid refinement** — verification percentage per state, national totals.
9. **MapView component** — extracted into reusable component for main page tabs.

### Verified endpoints (all need silver/gold tables to work — currently broken until ETL re-runs)
- GET /api/health → `{"status":"ok"/"degraded", "checks":{sql, vector_search}}`
- GET /api/facility/{hash} → full facility detail + capabilities + trust report
- GET /api/audit/{hash} → trust report with all flags + evidence quotes
- GET /api/map/aggregates?capability=has_nicu&level=state → state rollup data
- GET /api/map/aggregates/ci?capability=has_nicu&level=state → rollups + Wilson CI bounds
- POST /api/search → agent loop SSE streaming (needs vector search READY)
- GET /api/search-quick?q=... → text search fallback
- GET /api/traces/{run_id} → MLflow trace JSON
- POST /api/export → CSV/JSON export of selected facilities with trust audit
- GET /api/validate/{facility_id} → LLM second-pass validation against medical standards
- GET /api/search-nearby?place=&lat=&lng=&radius_km=&capability= → direct place/geo search without agent loop
- GET/POST/PATCH/DELETE /api/reviews → JSON-backed human review queue
- GET /api/data-health → governance/data health summary for frontend Data Health view

## Next actions (in order)
1. **Wait for VS index sync** — `databricks vector-search-indexes get-index workspace.default.facility_index --profile sj-wksp` → `ready: true`
2. **Frontend UX polish pass** — see §UX Roadmap below
3. **End-to-end smoke test deep search** — after Vector Search reports `ready: true`.

## UX Roadmap (Phase 6.6 — implement in next session)

### P0 — Must-have for demo

**1. AI Summary Header (streaming)**
When user searches, show a streaming LLM response bar above the search results that summarizes: "Based on your search for 'NICU Bihar', the highest-trust facility is X (score 100) in Y city. 3 of 5 results have verified NICU capabilities..." This gives immediate readable context while results load.
- **Backend**: new `GET /api/search-summary?q=...` SSE endpoint. Takes the top-5 search results, sends them to Llama 70b with a prompt like "Summarize these healthcare facilities for a user searching for: {query}". Stream tokens via SSE.
- **Frontend**: new `<SearchSummary>` component above the results list. Uses `EventSource` to stream text. Shows a typing indicator while streaming, then the full response. Collapsible after done.
- **Alternative simpler approach**: No LLM call — just compute the summary client-side from the search results (top facility, count by state, capability matches). Faster, no LLM latency. Better for demo timing.

**2. Auto-validate on facility select**
When user clicks a search result, automatically trigger validation (don't wait for button click). Show a skeleton/spinner in the trust panel's validation section while it runs. Keep the manual "Validate" button as a re-run option.
- Change: in `search-console.tsx`, after `handleSelect` fetches facility data, fire off the validate call immediately.
- Trust panel shows validation results as they arrive, not just after button click.

**3. Facility card density + evidence**
Cards are too sparse — mostly empty horizontal space. Tighten:
- Show description excerpt (first 80 chars) below the name
- Show capabilities_caption as a one-liner
- Evidence quotes (already added) fill the space
- Reduce card padding, make rows more compact

### P1 — High-impact polish

**4. Deep Search reasoning UI improvement**
Current: vertical list of "Reasoning step 1", "Reasoning step 2" text blocks.
Better agentic UI pattern:
- Collapsible step cards with tool name + icon (search, get_facility, audit_trust)
- Inline result preview for each tool call (e.g., "Found 5 facilities")
- Progress indicator: step count / estimated total
- Final answer card with distinct styling (green border, summary text)
- Reference: ChatGPT's tool-use display, Perplexity's source cards

**5. Contradiction detection display**
Currently hidden unless R6 flag fires. Make it more prominent:
- When a facility has contradictions, show a red "Contradiction Detected" banner in the facility card itself (not just the trust panel)
- In the trust panel, show a visual "tug of war" between the supporting and contradicting evidence (ContradictionTug component exists but is underused)

**6. Confidence intervals on map**
`/api/map/aggregates/ci` endpoint exists but isn't used. Show CI bounds as error bars or opacity bands on the state bubbles. Small implementation but adds statistical credibility.

### P2 — Nice-to-have

**7. Clickable MLflow trace links**
Deep search returns `trace_id`. Make it a clickable link to the Databricks MLflow UI. Shows judges the full observability story.

**8. Filter sidebar**
Add filters: state dropdown, capability checkboxes, trust score range slider. These all map to existing backend query capabilities.

**9. Responsive mobile layout**
Trust panel is hidden on screens < lg. Add a slide-over or bottom sheet for mobile.

### UX implementation notes
- Keep the AI summary header as the #1 priority — it transforms the experience from "search engine" to "intelligent assistant"
- Auto-validate is easy (one function call moved) and makes the trust panel feel alive immediately
- Deep search UI can be improved incrementally — start with collapsible cards, then add icons
- All backend endpoints already exist — this is purely frontend work except for the optional summary endpoint

## Blockers / deferred
- ~~**Mapbox token**~~ — DONE. Token in `frontend/.env.local`.
- **VS index sync** — still in progress. Last checked session 10: `indexed_row_count=4050`, `ready=false`. Check: `databricks vector-search-indexes get-index workspace.default.facility_index --profile sj-wksp`
- ~~**VS index permission for app SP**~~ — DONE (session 10). App health reaches VS and now reports syncing status instead of permission failure.
- **GPT-5.5 rate-limited** — free tier blocks all GPT models. Llama 70b is working.
- ~~**Vercel deploy needs auth proxy**~~ — DONE (session 10). Uses OAuth M2M in the proxy, not a static PAT.

## Plan pointers
- Completed: PLAN.md §5 Phase 2, 3, 4, 4b, 5, 6, 6.2, 6.3, 6.4, 6.5
- Next: Phase 6.6 (UX polish — see roadmap above), then Phase 7 (Vercel deploy)
- Decision record: `docs/decisions.md`
- Code architecture: `docs/code-architecture.md`
- Frontend redesign brief: `docs/frontend-product-redesign-brief.md`
- Standalone UI-agent prompt: `docs/frontend-ui-agent-prompt.md`

## Manual UI tasks for the user (non-blocking)
1. ✅ Raw data uploaded to new workspace (health_india table created)
2. ✅ Enable Mosaic AI Vector Search on the new workspace
3. ✅ Enable Databricks Apps on the new workspace
4. ✅ Mapbox account + public access token → set as `NEXT_PUBLIC_MAPBOX_TOKEN`

## Phase log (append-only, one line per phase boundary)
- 2026-04-26 ~start → Phase 0 Step 0.0 done — opus/ initialized, .gitignore committed
- 2026-04-26 → Phase 0 done — repo spine, Next.js frontend, FastAPI backend, databricks bundle, 9 docs, code-architecture.md
- 2026-04-26 → Phase 1 done — silver_facility 4/4 assertions pass (10K rows, 34 states canonical, pincodes valid, top-15 coverage), 169 state aliases, 559 specialty labels
- 2026-04-26 → Phase 2 done — gold_facility_capabilities 10K/10K (100% parse rate via ai_query)
- 2026-04-26 → Phase 3 done — gold_facility_trust: 9,956 high, 44 mid, Agasthiyar Siddha R6 confirmed
- 2026-04-26 → Phase 4 done — state/pincode aggregates, vector search endpoint + index created
- 2026-04-26 → Phase 5 done — backend API: 6 endpoints, all verified against live Databricks
- 2026-04-26 → Phase 6 done — frontend UI: SearchConsole + 8 components + SSE hook + route handlers
- 2026-04-26 → Phase 6.2 done — backend hardening: evidence quotes, FM client fix, Llama 70b fallback, VS fix, deploy prep, eval framework
- 2026-04-26 → Phase 6.3 done — stretch features: F6 validator agent, F7 confidence intervals, F8 NGO export
- 2026-04-26 → Phase 6.4 done — frontend wiring: proxy routes, tabbed layout, trust panel actions, evidence overflow fix, card/map refinement
- 2026-04-26 → Phase 6.5 done (code) — Mapbox map + deploy prep
- 2026-04-26 → Session 7: workspace migration to dbc-d744432c-1635 (profile sj-wksp). All config updated. ETL must re-run.
- 2026-04-26 → Session 8: ETL complete via bundle job (12 min). ctrl char fix, alias CTE inlined, all 5 tables rebuilt. Vector Search next.
- 2026-04-26 → Session 9: Phase 4b done — VS endpoint + index created (syncing). Backend deployed to Databricks Apps (RUNNING). 10K facility map dots, evidence quotes in cards, multi-word search fix, demo pills fix. UX roadmap written.
- 2026-04-26 → Session 10: Phase 7 frontend deploy done — Vercel production alias live at `https://trustmap-india.vercel.app`; OAuth M2M proxy auth working; deployed search/map/facility flows smoke-tested. VS still syncing.
- 2026-04-26 → Session 11: user-facing rename to TrueCare Atlas; frontend redesign brief + standalone UI-agent prompt added; backend added direct geo/place search, JSON-backed review queue, and Data Health/Governance API. Verified locally; not deployed yet.
