# TrustMap India — Code Architecture

> Canonical reference for Phase 5 (backend) and Phase 6 (frontend) implementation.
> Any deviation from this document requires editing this file first.
> Source of truth for: module layout, function signatures, schemas, SSE protocol,
> component tree, type mirroring, data flow, naming, and error handling.

---

## 1. Engineering Principles (binding, from PLAN.md §0.2)

1. **Simple > clever.** A dict lookup or a 12-line for-loop is the answer if it works.
2. **Modern Python 3.11+, readable.** Type hints, Pydantic v2, StrEnum, async where I/O-bound. No metaclasses, no decorator stacks, no eval.
3. **One way to do each thing.** One config pattern (Pydantic Settings). One LLM client (`databricks-openai`). One SQL client (`databricks-sql-connector`). One streaming pattern (`sse-starlette`).
4. **Functions over classes.** Classes only when state accumulates (the agent loop is the one case).
5. **Pydantic schemas at every boundary.** Tool I/O, API request/response, LLM JSON output.
6. **Trace, don't print.** All observability through MLflow spans (`mlflow.openai.autolog()` + `@mlflow.trace`).
7. **Fail fast at boundaries, trust internals.** Validate at the edge; no defensive `if x is None` chains where the type says otherwise.
8. **Files stay small.** Soft cap: 300 lines Python, 200 lines React component.

---

## 2. Python Module Layout (`backend/app/`)

```
backend/app/
  __init__.py
  main.py              -- FastAPI app, lifespan (mlflow autolog), CORS, router mounts, exception handlers
  settings.py          -- Pydantic Settings: Databricks host/token/warehouse, model names, CORS origins
  schemas.py           -- All Pydantic v2 models shared across the backend (THE source of truth)
  deps.py              -- Singleton factories: SQL connection, DatabricksOpenAI client
  errors.py            -- Domain exception classes (FacilityNotFoundError, DatabricksQueryError, VectorSearchError)

  routers/
    __init__.py
    search.py          -- POST /api/search: accepts SearchRequest, streams SSE via agent loop
    facility.py        -- GET /api/facility/{facility_id}: returns FacilityFull JSON
    audit.py           -- GET /api/audit/{facility_id}: returns TrustReport JSON
    map_routes.py      -- GET /api/map/aggregates: returns list[AggregateRow] for choropleth
    traces.py          -- GET /api/traces/{run_id}: proxies MLflow trace JSON

  services/
    __init__.py
    databricks_sql.py  -- SQL query helpers: fetch facility rows, trust reports, aggregates, geo-range
    databricks_fm.py   -- Thin async wrapper over DatabricksOpenAI for chat completions
    databricks_vs.py   -- Vector Search similarity_search wrapper (async httpx)
    mlflow_tracing.py  -- Query MLflow traces by run_id or tags

  agent/
    __init__.py
    loop.py            -- Reasoning loop (<=200 LOC): LLM call -> tool dispatch -> SSE emit
    tools.py           -- 6 tool functions + TOOL_REGISTRY dict + OpenAI tool definitions
    prompts.py         -- System prompt for the reasoning agent (single string constant)
```

Every module has one responsibility. No module exceeds 300 lines.

---

## 3. Pydantic Schemas (`backend/app/schemas.py`)

### 3.1 Existing Domain Models (already written)

```python
class Confidence(StrEnum)          # HIGH | MEDIUM | LOW
class SourceField(StrEnum)         # DESCRIPTION | CAPABILITY | PROCEDURE | EQUIPMENT | SPECIALTIES | MULTIPLE
class Severity(StrEnum)            # RED | YELLOW | GREEN

class Capability(BaseModel)        # value: bool, evidence_quote: str|None, source_field, confidence
class FacilityCapabilities(BaseModel)  # 11 boolean Capability fields + capabilities_caption: str
class TrustFlag(BaseModel)         # rule_id, severity, label, evidence_quotes
class TrustReport(BaseModel)       # facility_id, score, flags
class FacilityHit(BaseModel)       # facility_id, name, city, state, pincode, lat, lng, type, trust_score, distance_km, capabilities
class FacilityFull(FacilityHit)    # + description, phone, address, specialties, procedures, equipment, capability_text, trust_report

class SSEEventType(StrEnum)        # STEP | TOOL_CALL | TOOL_RESULT | REASONING | RESULT | ERROR | DONE
class SSEEvent(BaseModel)          # type: SSEEventType, payload: dict
```

### 3.2 Tool Input Schemas (to add)

```python
class AggregateLevel(StrEnum):
    STATE = "state"
    DISTRICT = "district"
    PINCODE = "pincode"

class FacilityFilters(BaseModel):
    state: str | None = None
    district: str | None = None
    pincode: str | None = None
    facility_type: str | None = None
    min_trust_score: int | None = None

class GeoSearchInput(BaseModel):
    lat: float
    lng: float
    radius_km: float = 30.0
    filters: FacilityFilters | None = None

class VectorSearchInput(BaseModel):
    query: str
    filters: FacilityFilters | None = None
    k: int = 20

class CapabilityFilterInput(BaseModel):
    flags: list[str]   # e.g. ["has_icu", "has_nicu", "has_blood_bank"]
    filters: FacilityFilters | None = None
    k: int = 20

class GetFacilityInput(BaseModel):
    facility_id: str

class AuditTrustInput(BaseModel):
    facility_id: str

class AggregateByInput(BaseModel):
    level: AggregateLevel
    capability: str    # e.g. "has_nicu"
```

### 3.3 Tool Output / API Response Schemas (to add)

```python
class AggregateRow(BaseModel):
    region_name: str
    region_level: AggregateLevel
    capability: str
    claimed_count: int
    verified_count: int
    population: int | None = None
    per_100k: float | None = None

class SearchRequest(BaseModel):
    query: str
    session_id: str | None = None

class SearchResult(BaseModel):
    facilities: list[FacilityHit]
    summary: str
    trace_id: str | None = None

class MapAggregateParams(BaseModel):
    capability: str = "has_nicu"
    level: AggregateLevel = AggregateLevel.STATE
```

---

## 4. Agent Tool Function Signatures

All 6 tools live in `backend/app/agent/tools.py`. Each is async, takes a Pydantic input, returns a Pydantic output. Each is decorated with `@mlflow.trace`.

```python
@mlflow.trace(name="tool.geo_search", span_type="tool")
async def geo_search(params: GeoSearchInput) -> list[FacilityHit]:
    """Haversine-bounded SQL query against gold tables.
    Returns facilities within radius_km of (lat, lng), ordered by distance."""

@mlflow.trace(name="tool.vector_search", span_type="tool")
async def vector_search(params: VectorSearchInput) -> list[FacilityHit]:
    """Hybrid BM25+dense search against Mosaic AI Vector Search index.
    Applies metadata filters (state, pincode, facility_type, capability flags)."""

@mlflow.trace(name="tool.capability_filter", span_type="tool")
async def capability_filter(params: CapabilityFilterInput) -> list[FacilityHit]:
    """SQL query filtering gold_facility_capabilities by boolean flag columns.
    Returns up to k facilities matching ALL requested capability flags."""

@mlflow.trace(name="tool.get_facility", span_type="tool")
async def get_facility(params: GetFacilityInput) -> FacilityFull:
    """Single-row lookup by facility_id. Returns full facility record
    with capabilities and trust report joined from gold tables."""

@mlflow.trace(name="tool.audit_trust", span_type="tool")
async def audit_trust(params: AuditTrustInput) -> TrustReport:
    """Fetches pre-computed trust report from gold_facility_trust.
    Returns score + all flags with evidence quotes."""

@mlflow.trace(name="tool.aggregate_by", span_type="tool")
async def aggregate_by(params: AggregateByInput) -> list[AggregateRow]:
    """Reads pre-computed rollups from gold_{state,district,pincode}_aggregates.
    Returns rows for the requested capability at the requested geographic level."""
```

### 4.1 Tool Registry

```python
TOOL_REGISTRY: dict[str, Callable] = {
    "geo_search": geo_search,
    "vector_search": vector_search,
    "capability_filter": capability_filter,
    "get_facility": get_facility,
    "audit_trust": audit_trust,
    "aggregate_by": aggregate_by,
}
```

### 4.2 OpenAI-Compatible Tool Definitions

Derived from Pydantic input schemas via `.model_json_schema()`:

```python
TOOL_DEFINITIONS: list[tuple[str, Callable, type[BaseModel]]] = [
    ("geo_search", geo_search, GeoSearchInput),
    ("vector_search", vector_search, VectorSearchInput),
    ("capability_filter", capability_filter, CapabilityFilterInput),
    ("get_facility", get_facility, GetFacilityInput),
    ("audit_trust", audit_trust, AuditTrustInput),
    ("aggregate_by", aggregate_by, AggregateByInput),
]

def get_openai_tool_definitions() -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": name,
                "description": fn.__doc__,
                "parameters": schema.model_json_schema(),
            },
        }
        for name, fn, schema in TOOL_DEFINITIONS
    ]
```

---

## 5. SSE Event Schema

### 5.1 Event Types and Payload Shapes

| Type          | When emitted                       | Payload shape                                                          |
|---------------|------------------------------------|------------------------------------------------------------------------|
| `step`        | Agent begins a new reasoning step  | `{ "step_index": int, "description": str, "timestamp": str }`         |
| `tool_call`   | Agent decides to invoke a tool     | `{ "step_index": int, "tool_name": str, "arguments": dict }`          |
| `tool_result` | Tool function returns              | `{ "step_index": int, "tool_name": str, "result": any, "duration_ms": int }` |
| `reasoning`   | Agent emits intermediate reasoning | `{ "step_index": int, "text": str }`                                  |
| `result`      | Final answer assembled             | `{ "facilities": FacilityHit[], "summary": str, "trace_id": str }`    |
| `error`       | Unrecoverable error in the loop    | `{ "message": str, "step_index": int or null }`                       |
| `done`        | Stream is complete                 | `{ "trace_id": str }`                                                 |

### 5.2 Event Ordering

```
step(0) -> tool_call(0) -> tool_result(0) ->
step(1) -> reasoning(1) -> tool_call(1) -> tool_result(1) ->
...
step(N) -> reasoning(N) ->
result ->
done
```

Invariants:
- `step` always precedes `tool_call` or `reasoning` within that step.
- `tool_result` always follows its `tool_call` (matched by `step_index`).
- `result` emitted exactly once, immediately before `done`.
- `done` always final. Emitted even after `error`.
- `error` can appear at any point. Next event after `error` is `done`.

### 5.3 Serialization

```python
from sse_starlette.sse import EventSourceResponse, ServerSentEvent

async def event_generator():
    yield ServerSentEvent(data=SSEEvent(type=..., payload={...}).model_dump_json())

return EventSourceResponse(event_generator())
```

---

## 6. FastAPI Router → Service → External-API Layering

### 6.1 Layer Responsibilities

```
Router (routers/*.py)      — HTTP: path/query params, request validation, response type
Service (services/*.py)    — Business logic: SQL, result mapping, client calls. Pydantic in/out.
Agent (agent/*.py)         — Orchestration: LLM loop, tool dispatch, SSE emission
Deps (deps.py)             — Singleton client factories. No business logic.
```

### 6.2 Concrete Call Chains

**POST /api/search** (SSE):
```
routers/search.py -> EventSourceResponse(event_generator)
  -> agent/loop.py :: run_agent_loop(query, emit)
     -> deps.get_fm_client() for chat completions
     -> agent/tools.py :: TOOL_REGISTRY[tool_name](parsed_input)
        -> services/databricks_sql.py :: query_facilities_by_geo(...)
        -> services/databricks_vs.py :: similarity_search(...)
```

**GET /api/facility/{facility_id}**:
```
routers/facility.py -> services/databricks_sql.py :: query_facility_by_id(id) -> FacilityFull
```

**GET /api/audit/{facility_id}**:
```
routers/audit.py -> services/databricks_sql.py :: query_trust_report(id) -> TrustReport
```

**GET /api/map/aggregates**:
```
routers/map_routes.py -> services/databricks_sql.py :: query_aggregates(level, cap) -> list[AggregateRow]
```

### 6.3 Service Function Signatures

```python
# services/databricks_sql.py (sync — runs in executor pool)
def query_facilities_by_geo(lat, lng, radius_km, filters) -> list[FacilityHit]
def query_facilities_by_capability(flags, filters, k) -> list[FacilityHit]
def query_facility_by_id(facility_id) -> FacilityFull
def query_trust_report(facility_id) -> TrustReport
def query_aggregates(level, capability) -> list[AggregateRow]

# services/databricks_vs.py (async — httpx)
async def similarity_search(query, filters, k) -> list[FacilityHit]

# services/databricks_fm.py (async — DatabricksOpenAI)
async def chat_completion(messages, tools=None) -> dict

# services/mlflow_tracing.py (sync)
def fetch_trace(run_id) -> dict
```

---

## 7. Agent Reasoning Loop (`backend/app/agent/loop.py`)

Single async function, ≤200 LOC, no framework dependency.

```python
async def run_agent_loop(
    query: str,
    emit: Callable[[SSEEvent], Awaitable[None]],
    max_steps: int = 10,
) -> None:
    """
    1. Build messages = [system_prompt, user message]
    2. Loop (up to max_steps):
       a. Call LLM with messages + tool definitions
       b. If tool_calls: emit step -> tool_call -> dispatch -> tool_result -> append messages
       c. If content only: emit reasoning -> parse as final answer -> emit result -> break
       d. If max_steps exceeded: emit error -> break
    3. emit done (always, in finally block)
    """
```

State is held in local variables (messages list, step_index counter). No class needed.

---

## 8. React Component Tree (`frontend/components/`)

### 8.1 Hierarchy

```
app/page.tsx (Search Console)
  <SearchConsole>
    <ReasoningTrace steps={steps} isStreaming={bool}>
      <ReasoningStep step={step} isLatest={bool} />
    </ReasoningTrace>
    <FacilityCard facility={hit} isSelected={bool} onSelect={fn} />
    <TrustPanel facility={selected} report={report} isLoading={bool}>
      <TrustRing score={number} />
      <EvidenceQuote flag={flag} index={number} />
      <ContradictionTug supportingQuote={str} contradictingQuote={str} ruleId={str} label={str} />
    </TrustPanel>

app/map/page.tsx
  <DesertMap aggregates={rows} capability={str} level={level} onRegionClick={fn} />

app/facility/[id]/page.tsx
  <FacilityDetail>
    <TrustPanel ... />
  </FacilityDetail>
```

### 8.2 Component Prop Interfaces

```typescript
interface ReasoningTraceProps { steps: StreamStep[]; isStreaming: boolean; }
interface ReasoningStepProps  { step: StreamStep; isLatest: boolean; }
interface FacilityCardProps   { facility: FacilityHit; isSelected: boolean; onSelect: (id: string) => void; }
interface TrustPanelProps     { facility: FacilityFull | null; report: TrustReport | null; isLoading: boolean; }
interface TrustRingProps      { score: number; size?: number; strokeWidth?: number; }
interface EvidenceQuoteProps  { flag: TrustFlag; index: number; }
interface ContradictionTugProps { supportingQuote: string; contradictingQuote: string; ruleId: string; label: string; }
interface DesertMapProps      { aggregates: AggregateRow[]; capability: string; level: AggregateLevel; onRegionClick: (name: string, level: AggregateLevel) => void; }
interface ErrorBannerProps    { message: string; onRetry: () => void; onDismiss: () => void; }
```

---

## 9. Shared TypeScript Types (`frontend/lib/types.ts`)

**Source of truth: `backend/app/schemas.py` (Python).** TS types mirror Python schemas. JSON wire format uses snake_case (Pydantic v2 default), so TS fields are also snake_case.

```typescript
type Confidence = "high" | "medium" | "low";
type SourceField = "description" | "capability" | "procedure" | "equipment" | "specialties" | "multiple";
type Severity = "red" | "yellow" | "green";
type AggregateLevel = "state" | "district" | "pincode";
type SSEEventType = "step" | "tool_call" | "tool_result" | "reasoning" | "result" | "error" | "done";

interface Capability { value: boolean; evidence_quote: string | null; source_field: SourceField | null; confidence: Confidence; }
interface FacilityCapabilities { has_icu: Capability; has_nicu: Capability; /* ... all 11 flags */; capabilities_caption: string; }
interface TrustFlag { rule_id: string; severity: Severity; label: string; evidence_quotes: string[]; }
interface TrustReport { facility_id: string; score: number; flags: TrustFlag[]; }
interface FacilityHit { facility_id: string; name: string; city: string | null; state: string | null; pincode: string | null; latitude: number | null; longitude: number | null; facility_type: string | null; trust_score: number | null; distance_km: number | null; capabilities: FacilityCapabilities | null; }
interface FacilityFull extends FacilityHit { description: string | null; phone: string | null; address: string | null; specialties: string[]; procedures: string[]; equipment: string[]; capability_text: string[]; trust_report: TrustReport | null; }
interface AggregateRow { region_name: string; region_level: AggregateLevel; capability: string; claimed_count: number; verified_count: number; population: number | null; per_100k: number | null; }
interface SSEEvent { type: SSEEventType; payload: Record<string, unknown>; }

// Frontend-only derived state
interface StreamStep { step_index: number; description: string; timestamp: string; tool_call: { tool_name: string; arguments: Record<string, unknown> } | null; tool_result: { result: unknown; duration_ms: number } | null; reasoning_text: string; }
interface SearchStreamState { steps: StreamStep[]; facilities: FacilityHit[]; summary: string; trace_id: string | null; error: string | null; is_streaming: boolean; }
```

---

## 10. Data Flow: SSE Event → useStream Hook → Component Render

```
User types query
  -> SearchConsole calls submit(query)
  -> useStream POSTs to /api/search (Next.js route handler)
  -> app/api/search/route.ts proxies to BACKEND_URL/api/search
  -> Backend returns EventSourceResponse (agent loop emits SSEEvents)
  -> Next.js route handler passes through the stream body
  -> useStream reads ReadableStream, parses data: lines as SSEEvent
  -> Batches in 200ms windows (setTimeout + requestAnimationFrame)
  -> Reduces into SearchStreamState
  -> React re-renders: ReasoningTrace, FacilityCards, TrustPanel
```

### useStream Hook (`hooks/use-stream.ts`)

```typescript
function useStream(): { state: SearchStreamState; submit: (query: string) => void; reset: () => void; }
```

Reducer: `step` → append StreamStep; `tool_call` → set on latest step; `tool_result` → set on latest step; `reasoning` → append text; `result` → set facilities/summary/trace_id; `error` → set error; `done` → set is_streaming=false.

---

## 11. Naming Conventions

| Context          | Convention    | Examples                                    |
|------------------|---------------|---------------------------------------------|
| Python files     | snake_case    | `databricks_sql.py`, `map_routes.py`        |
| Python functions | snake_case    | `query_facility_by_id`, `run_agent_loop`    |
| Python classes   | PascalCase    | `FacilityHit`, `GeoSearchInput`             |
| Python constants | UPPER_SNAKE   | `TOOL_REGISTRY`, `MAX_STEPS`                |
| Pydantic fields  | snake_case    | `facility_id`, `trust_score`                |
| JSON wire format | snake_case    | Pydantic v2 default serialization           |
| TS files         | kebab-case    | `use-stream.ts`, `types.ts`                 |
| TS interfaces    | PascalCase    | `FacilityHit`, `SearchStreamState`          |
| TS variables     | camelCase     | `facilityId`, `trustScore`, `isStreaming`    |
| React components | PascalCase    | `SearchConsole`, `TrustPanel`               |
| React files      | kebab-case    | `search-console.tsx`, `trust-panel.tsx`     |
| CSS variables    | kebab-case    | `--color-trust`, `--color-alert`            |
| API routes       | kebab-case    | `/api/search`, `/api/facility/{id}`         |
| SSE event types  | snake_case    | `tool_call`, `tool_result`                  |
| MLflow spans     | dot-separated | `tool.geo_search`, `agent.loop`             |
| Git commits      | `phase-N:...` | `phase-5: backend agent loop + 6 tools`     |

---

## 12. Error Handling Convention

### 12.1 Backend

**Principle: Pydantic validates at boundaries. Exceptions bubble to FastAPI handlers.**

```python
# backend/app/errors.py
class FacilityNotFoundError(Exception): ...   # -> 404
class DatabricksQueryError(Exception): ...    # -> 502
class VectorSearchError(Exception): ...       # -> 502
```

- Routers: no try/except. Pydantic auto-validates (422).
- Services: raise domain exceptions on expected failures.
- Agent loop: catches tool/LLM errors → emits SSE error event → emits done (always in finally).
- Exception handlers registered in `main.py` via `@app.exception_handler`.

### 12.2 Frontend

**Principle: show a recoverable banner, never crash the page.**

- `useStream`: SSE error event or fetch failure → sets `state.error`.
- Components: if `state.error`, render `<ErrorBanner>` (dismissible, retry button).
- Non-SSE fetches: try/catch → local error state → banner.
- Top-level `ErrorBoundary` in layout catches render-time exceptions.

---

## 13. Phase 5 Build Sequence (Backend)

1. Add tool input/output schemas to `schemas.py`
2. Create `errors.py`
3. Add exception handlers to `main.py`
4. Implement `services/databricks_sql.py` (5 query functions)
5. Implement `services/databricks_vs.py` (similarity_search)
6. Implement `services/databricks_fm.py` (chat_completion)
7. Implement `services/mlflow_tracing.py` (fetch_trace)
8. Implement `agent/prompts.py`, `agent/tools.py`, `agent/loop.py`
9. Implement all 5 routers
10. Write integration tests
11. Verify: `curl -N -X POST localhost:8000/api/search` streams SSE ending in `done`

## 14. Phase 6 Build Sequence (Frontend)

1. Create `lib/types.ts`, `lib/api.ts`, `lib/motion.ts`
2. Create `hooks/use-stream.ts`, `hooks/use-trace.ts`
3. Implement route handlers (search, facility, map proxies)
4. Implement SearchConsole, ReasoningTrace, ReasoningStep
5. Implement FacilityCard, TrustPanel, TrustRing (Wow 1), EvidenceQuote
6. Implement ContradictionTug (Wow 3), DesertMap (Wow 2)
7. Implement ErrorBanner, wire up all three pages
8. Verify: full golden demo path, wow-moments at 60fps, mobile breakpoint
