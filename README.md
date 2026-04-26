# TrueCare Atlas

> Agentic healthcare intelligence — trust-score 10,000 Indian medical facilities in minutes, not weeks.

**Hack-Nation 2026 · Databricks Corporate Track**

TrueCare Atlas turns 10,000 noisy Indian healthcare facility records into a trustworthy, agentic capability map. An NGO programme lead searching for verified NICU care in rural Bihar gets a ranked, cited, trust-scored answer in 11 minutes — replacing 6 weeks of manual triage.

## Stack

- **Data pipeline**: Databricks Lakeflow Jobs, Unity Catalog (Bronze → Silver → Gold)
- **AI**: Databricks Foundation Model Serving (GPT-5.5, Llama-3.3-70B, GTE-large-en), Mosaic AI Vector Search, MLflow 3 Tracing
- **Backend**: FastAPI on Databricks Apps (Modal failover)
- **Frontend**: Next.js 16, Vercel AI SDK, shadcn/ui, Tailwind v4, Mapbox GL JS, Framer Motion

## Quick Start (Local Dev)

```bash
# Backend
cd backend
uv sync
uv run uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
pnpm install && pnpm dev
# Open http://localhost:3000
```

## Deployment

### Backend → Databricks Apps

```bash
# First time: create the app
databricks apps create trustmap-india --profile sj-wksp

# Deploy (and on every push)
cd backend
databricks apps deploy trustmap-india --profile sj-wksp

# Check status
databricks apps get trustmap-india --profile sj-wksp
```

The app binds to `DATABRICKS_APP_PORT` automatically. Resources (SQL warehouse, model serving, vector search) are configured in `app.yaml`.

### Frontend → Vercel

```bash
cd frontend

# First time: link to Vercel project
pnpx vercel link

# Set env vars (once, or update when backend URL changes)
pnpx vercel env add BACKEND_URL                 # Databricks App URL
pnpx vercel env add DATABRICKS_HOST             # Workspace URL
pnpx vercel env add DATABRICKS_CLIENT_ID        # App/service principal client ID
pnpx vercel env add DATABRICKS_CLIENT_SECRET    # App/service principal OAuth secret
pnpx vercel env add NEXT_PUBLIC_MAPBOX_TOKEN    # Mapbox public token

# Deploy to production
pnpx vercel --prod

# Preview deploy (for testing)
pnpx vercel
```

### Redeploy on Changes

```bash
# Backend changes
cd backend && databricks apps deploy trustmap-india --profile sj-wksp

# Frontend changes
cd frontend && pnpx vercel --prod
```

### Environment Variables

| Variable | Where | Value |
|----------|-------|-------|
| `BACKEND_URL` | Vercel | `https://trustmap-india-7474646917144080.aws.databricksapps.com` |
| `DATABRICKS_HOST` | Vercel | `https://dbc-d744432c-1635.cloud.databricks.com` |
| `DATABRICKS_CLIENT_ID` | Vercel | Databricks app/service principal client ID |
| `DATABRICKS_CLIENT_SECRET` | Vercel | Databricks app/service principal OAuth secret |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Vercel + `.env.local` | Mapbox public access token |
| `DATABRICKS_WAREHOUSE_ID` | Databricks Apps (auto) | Injected via `app.yaml` `value_from` |
| `TM_WAREHOUSE_ID` | Databricks Apps (auto) | Same as above |

## Docs

See `docs/` for architecture, design system, engineering principles, evaluation results, and the demo-day run book.
