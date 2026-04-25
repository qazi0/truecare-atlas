# TrustMap India — Decision Record

> Log every data analysis query, experimental result, and architectural decision with the reasoning behind it. Future sessions read this to avoid re-running experiments.

---

## D001: ai_query canary — Branch A confirmed (2026-04-26)

**Context**: Phase 2 Step 2.0 requires a 50-row canary to determine whether `ai_query` SQL function works with `databricks-meta-llama-3-3-70b-instruct` for structured JSON extraction, or if we need the Pandas UDF fallback.

**Query 1 — Basic ai_query sanity (1 row)**:
```sql
SELECT facility_id, ai_query('databricks-meta-llama-3-3-70b-instruct',
  CONCAT('Classify this facility type in one word: ', name, ' - ', COALESCE(description, 'no description'))
) AS result FROM workspace.default.silver_facility LIMIT 1
```
**Result**: Returned `"Dental"` for facility `a92d28258fbda1f9b68be64f76d3ee4f` (1000 Smiles Dental Clinic). Basic ai_query works.

**Query 2 — STRUCT responseFormat test**:
Attempted `responseFormat => 'STRUCT<has_icu:STRUCT<value:BOOLEAN, ...>, ...>'` with 7 top-level fields.
**Result**: `AI_FUNCTION_UNSUPPORTED_RESPONSE_FORMAT.DDL_STRING` — "Only one field is allowed on the top-level."
**Decision**: Use plain STRING return and strip markdown fences with `REGEXP_REPLACE`, then parse with `from_json`.

**Query 3 — 2-row JSON extraction test**:
Returned valid JSON wrapped in ` ```json ... ``` ` markdown fences. All 13 keys present. Parsing works after stripping fences.

**Query 4 — 50-row stratified canary** (10 per facility_type_id partition):
```sql
-- Stratified sample: ROW_NUMBER() OVER (PARTITION BY facility_type_id ORDER BY RAND(42)) AS rn, WHERE rn <= 10
-- REGEXP_REPLACE to strip markdown fences, then JSON parse validation
```
**Result**: 50 rows returned, **49/50 parsed OK**, **49/50 all 13 keys present**.
**Conclusion**: **Branch A confirmed** — proceed with SQL ai_query path. 98% parse rate exceeds the 90% threshold.

**Query 5 — 200-row stratified sample** (1 per facility_type_id × state_canon):
**Result**: 155 rows returned (stratification yielded 155 unique combos), **155/155 parsed OK (100%)**.
Capability distribution: 15 has_24x7, 13 has_maternity, 6 has_oncology, 1 has_icu.
**Conclusion**: Parse reliability confirmed at scale. Distribution looks plausible vs PLAN.md §1.6 proportions.

---

## D002: Cost estimate for full 10K extraction (2026-04-26)

**Calculation** (from `budget.py`):
- Llama 3.3 70B rates: ~$0.90/1M input, ~$0.90/1M output
- Est. 800 input tokens + 250 output tokens per row
- 10,000 rows × 1,050 tokens = 10.5M tokens
- **Estimated cost: $9.45** — well under $25 ceiling

**Decision**: Proceed with full 10K extraction.

---

## D003: responseFormat approach — STRING + from_json (2026-04-26)

**Options considered**:
1. `STRUCT` DDL responseFormat — rejected, Databricks limits to 1 top-level field
2. JSON schema responseFormat (`{"type":"json_schema",...}`) — not tested, unsure if supported in `ai_query` SQL
3. STRING return + REGEXP_REPLACE + `from_json` — tested and working

**Decision**: Option 3. The model consistently returns valid JSON (with markdown fences). Stripping fences via `REGEXP_REPLACE('(?s)^\\s*```json\\s*|\\s*```\\s*$', '')` and parsing with `from_json` gives 98-100% success rate.
