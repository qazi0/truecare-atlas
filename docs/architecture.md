# Architecture — TrustMap India

## Layered Overview

```
┌────────────────────────────────────────────────────────────────┐
│ Frontend: Next.js 15 + Vercel AI SDK + shadcn + Mapbox         │
│   - Search Console (streaming SSE)                             │
│   - Facility Card + Trust Panel                                │
│   - India Desert Map (choropleth, pre-rendered GeoJSON)        │
└──────────────────────────┬─────────────────────────────────────┘
                           │ Next.js Route Handler proxies SSE
                           ▼
┌────────────────────────────────────────────────────────────────┐
│ Backend: FastAPI + Pydantic, deployed as a Databricks App      │
│   - /api/search        (agent loop, SSE)                       │
│   - /api/facility/{id} (gold lookup)                           │
│   - /api/audit/{id}    (trust breakdown)                       │
│   - /api/map/aggregates?capability=...&level=state|pincode     │
│   - /api/traces/{run_id} → MLflow trace JSON                   │
└──────────────────────────┬─────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────────────┐
        ▼                  ▼                          ▼
┌──────────────────┐ ┌──────────────────┐  ┌────────────────────┐
│ Databricks SQL   │ │ Mosaic AI Vector │  │ Foundation Model   │
│ Warehouse        │ │ Search Endpoint  │  │ Serving (chat+emb) │
│ (Gold tables)    │ │ + Index (Delta)  │  │ + MLflow 3 Tracing │
└──────────────────┘ └──────────────────┘  └────────────────────┘
        ▲                                           ▲
        │                                           │
┌────────────────────────────────────────────────────────────────┐
│ Lakeflow Job: bronze → silver → gold                           │
│ - clean (state/pincode/array normalization)                    │
│ - extract (LLM capability extraction, batched)                 │
│ - score (rules + LLM-judge trust scoring)                      │
│ - aggregate (per-state/pincode rollups for map)                │
│ - index_sync (vector search index)                             │
└────────────────────────────────────────────────────────────────┘
```

## Backend: FastAPI on Databricks Apps

- **Primary**: Databricks Apps with auto-authenticated service principal
- **Failover**: Same FastAPI image on Modal (60-second deploy)
- Pydantic v2 for every request/response model
- SSE streaming via `sse-starlette`
- Async `httpx` to all Databricks endpoints

## Frontend: Next.js 15 + Vercel AI SDK + Mapbox

- App Router with Vercel AI SDK `useChat`
- shadcn/ui + Tailwind v4 + Framer Motion
- Mapbox GL JS choropleth with cluster-based facility points
- Custom `useStream` hook for 200ms-batched SSE events

## Data Layer

- **Bronze**: `workspace.default.health_india` (read-only source)
- **Silver**: `workspace.default.silver_facility` (cleaned)
- **Gold**: `gold_facility_capabilities`, `gold_facility_trust`, `gold_pincode_aggregates`, `gold_state_aggregates`

## LLM Pipeline

- **Extraction**: `databricks-meta-llama-3-3-70b-instruct` via `ai_query` SQL
- **Reasoning agent**: `databricks-gpt-5-5` (GPT-5.5 routed via Databricks)
- **Embeddings**: `databricks-gte-large-en` (1024-dim)
- All calls via Databricks Foundation Model Serving (no external keys)

## Vector Search

- Endpoint: `tm_endpoint` (STANDARD)
- Index: `workspace.default.facility_index` (DELTA_SYNC, HYBRID)
- Filterable columns: state, pincode, facility_class, all capability booleans, trust_score_bucket
