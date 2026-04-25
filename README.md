# TrustMap India

> Agentic healthcare intelligence — trust-score 10,000 Indian medical facilities in minutes, not weeks.

**Hack-Nation 2026 · Databricks Corporate Track**

TrustMap India turns 10,000 noisy Indian healthcare facility records into a trustworthy, agentic capability map. An NGO programme lead searching for verified NICU care in rural Bihar gets a ranked, cited, trust-scored answer in 11 minutes — replacing 6 weeks of manual triage.

## Stack

- **Data pipeline**: Databricks Lakeflow Jobs, Unity Catalog (Bronze → Silver → Gold)
- **AI**: Databricks Foundation Model Serving (GPT-5.5, Llama-3.3-70B, GTE-large-en), Mosaic AI Vector Search, MLflow 3 Tracing
- **Backend**: FastAPI on Databricks Apps (Modal failover)
- **Frontend**: Next.js 15, Vercel AI SDK, shadcn/ui, Tailwind v4, Mapbox GL JS, Framer Motion

## Quick Start

```bash
# Backend
cd backend
uv sync
uv run uvicorn app.main:app --reload

# Frontend
cd frontend
pnpm install && pnpm dev

# Databricks pipeline
databricks bundle deploy -t prod --profile siraj-workspace
databricks bundle run trustmap_pipeline -t prod --profile siraj-workspace
```

## Docs

See `docs/` for architecture, design system, engineering principles, evaluation results, and the demo-day run book.
