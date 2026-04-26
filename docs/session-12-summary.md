# Session 12 Summary — Lovable Frontend Migration And Local Verification

Date: 2026-04-26

## Outputs

- Migrated the Lovable TrueCare Atlas experience into the production Next.js `frontend/` app instead of deploying or depending on the Vite reference app.
- Added the architecture/feature mapping document: `docs/lovable-frontend-architecture-feature-map.md`.
- Added/extended backend contracts for the migrated UI:
  - richer `FacilityHit` status fields,
  - capability source/confidence evidence,
  - map facility filters,
  - map region summaries,
  - generated review candidates,
  - recent trace listing.
- Added Next proxy routes for the new frontend surface:
  - `data-health`,
  - `reviews`,
  - `search-nearby`,
  - `map/aggregates/ci`,
  - `map/region-summary`,
  - `traces`.
- Rebuilt the frontend routes:
  - `/`,
  - `/command`,
  - `/map`,
  - `/facility/[id]`,
  - `/shortlist`,
  - `/review`,
  - `/data-health`,
  - `/trace/[id]`.
- Added Atlas UI primitives, frontend adapters, and short-lived client cache helper.
- Fixed Mission Control search visibility and animated placeholder behavior.
- Fixed Command:
  - no default `NICU Bihar` search when opening `/command` without `q`,
  - fast search ranking/fallback,
  - deep answer formatting,
  - validation loading/highlight state,
  - toasts,
  - selected-facility loading skeleton.
- Fixed Map:
  - real Mapbox base map visible behind dots,
  - city/facility dot overlays,
  - resize observer to avoid blank map canvas,
  - local region-summary fallback to avoid browser 404s.
- Fixed Review:
  - grouped task cards by facility,
  - kept R1/R3 issue actions task-specific,
  - Phone now moves issues to `phone_verification` and remains visible in default `Open work`,
  - Add note now prompts and displays latest note,
  - generated review IDs no longer dominate the UI.

## Important Commands

Local frontend:
```bash
cd frontend
npm run dev
npm run lint
npm run build
```

Local backend:
```bash
cd backend
PYTHONPATH=. .venv/bin/python -m compileall app
```

Check running local ports:
```bash
lsof -iTCP:3000 -sTCP:LISTEN -n -P
lsof -iTCP:8000 -sTCP:LISTEN -n -P
```

Restart stale Next dev server if new App Router routes 404 despite building:
```bash
kill <node-pid-on-3000>
cd frontend && npm run dev
```

Verify key local API route:
```bash
curl -s -o /tmp/region-summary.out -w '%{http_code}' \
  'http://localhost:3000/api/map/region-summary?region=Bihar&capability=has_nicu'
```

Databricks review-rule distribution check:
```bash
PYTHONPATH=backend backend/.venv/bin/python - <<'PY'
from app.services.databricks_sql import _execute
rows = _execute("""
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN flag_count > 0 THEN 1 ELSE 0 END) AS any_flags,
  SUM(CASE WHEN r1_anesthesia_gap THEN 1 ELSE 0 END) AS r1,
  SUM(CASE WHEN r3_cancer_specialty_gap THEN 1 ELSE 0 END) AS r3,
  SUM(CASE WHEN r1_anesthesia_gap AND r3_cancer_specialty_gap THEN 1 ELSE 0 END) AS both_r1_r3
FROM workspace.default.gold_facility_trust
""")
print(rows[0])
PY
```

Observed result on 2026-04-26:
```text
total=10000, any_flags=2623, r1=323, r3=157, both_r1_r3=133
```

Playwright wrapper pattern:
```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
sh "$PWCLI" open http://localhost:3000/map
sh "$PWCLI" snapshot
sh "$PWCLI" screenshot --filename output/playwright/map-focused-fix.png
```

## Things Not To Repeat

- Do not deploy backend or frontend before explicit user approval.
- Do not commit `truecare-frontend-lovable/`; it is a local reference and contains a nested `.git` plus `node_modules`.
- Do not commit Playwright screenshots/output, `.playwright-cli`, `.playwright-mcp`, MLflow local files, or local MCP/editor artifacts.
- Do not assume App Router routes are live in a stale Next dev process; restart the dev server if a freshly built route still returns 404.
- Do not treat generated review task pairs as frontend duplicates. They are one task per facility/rule.
- Do not cache mutating review workflow state without explicit invalidation after PATCH.
