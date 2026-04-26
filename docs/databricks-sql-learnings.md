# Databricks SQL Learnings — Write Correct Queries First Try

> Accumulated from Phase 1-2 query failures. Read this before writing any new SQL for this workspace.

---

## ai_query function

### responseFormat only supports 1 top-level field in DDL mode
```sql
-- FAILS: "Only one field is allowed on the top-level, but found 7 fields"
ai_query('model', prompt,
  responseFormat => 'STRUCT<has_icu:STRUCT<value:BOOLEAN>, has_nicu:STRUCT<value:BOOLEAN>, ...>')

-- FAILS: PARSE_SYNTAX_ERROR with OBJECT() syntax
ai_query('model', prompt,
  responseFormat => 'OBJECT(has_icu STRUCT<value BOOLEAN>, ...)')

-- WORKS: omit responseFormat, get STRING back, parse with from_json
ai_query('model', prompt)  -- returns STRING
```

### ai_query returns markdown-fenced JSON
The model wraps JSON output in ` ```json ... ``` ` fences. Always strip:
```sql
TRIM(REGEXP_REPLACE(
  ai_query('model', prompt),
  '(?s)^\\s*```json\\s*|\\s*```\\s*$', ''
)) AS clean_json
```
Then parse with `from_json(clean_json, 'STRUCT<...>')`.

### ai_query prompt must say "no markdown fences"
Adding `"Return ONLY raw JSON, no markdown fences, no explanation."` to the prompt reduces but doesn't eliminate fences. Always apply the REGEXP_REPLACE regardless.

### ai_query handles batching internally
No need for Pandas UDFs or concurrency tuning. Databricks internally batches, retries, and rate-limits. A single `SELECT ai_query(...) FROM table` over 10K rows just works (took ~30 min on Serverless Starter Warehouse).

---

## Column naming and schema discovery

### Always run discover-schema before writing queries
```bash
databricks experimental aitools tools discover-schema workspace.default.<table> --profile sj-wksp
```
Column names in the actual table often differ from what you'd guess. Example: the silver table has `facility_type_id` not `facility_class`, `capabilities` not `capability_text`.

### Array columns need CAST to STRING for CONCAT
```sql
-- FAILS in CONCAT: array<string> can't be concatenated directly
CONCAT('SPECS: ', specialties)

-- WORKS:
CONCAT('SPECS: ', COALESCE(CAST(specialties AS STRING), 'N/A'))
```

### COALESCE everything in CONCAT
A single NULL in CONCAT makes the entire result NULL:
```sql
-- BAD: if description is NULL, entire prompt is NULL
CONCAT('DESC: ', description)

-- GOOD:
CONCAT('DESC: ', COALESCE(description, 'N/A'))
```

### CASE WHEN for optional fields in CONCAT
```sql
-- Conditionally append only if value exists:
CASE WHEN capacity IS NOT NULL
  THEN CONCAT(' | BEDS: ', CAST(capacity AS STRING))
  ELSE ''
END
```

---

## from_json parsing

### Schema must exactly match JSON keys
```sql
-- The STRUCT field names must match the JSON keys exactly:
from_json(json_str, 'STRUCT<has_icu: STRUCT<value: BOOLEAN, evidence_quote: STRING, confidence: STRING>>')
```

### from_json returns NULL on parse failure (doesn't error)
Use this for soft failure handling:
```sql
CASE WHEN from_json(raw, schema) IS NOT NULL THEN true ELSE false END AS extraction_success
```

---

## Array operations

### FILTER with lambda for array element checks
```sql
-- Filter array elements matching a condition:
FILTER(equipment, x -> LOWER(x) LIKE '%image%' OR LOWER(x) LIKE '%photo%')

-- Count matching elements:
SIZE(FILTER(equipment, x -> LOWER(x) LIKE '%image%'))
```

### SIZE() on NULL arrays returns NULL, not 0
```sql
-- Use COALESCE:
COALESCE(SIZE(equipment), 0) > 2
-- Or guard with a NULL check:
CASE WHEN equipment IS NOT NULL AND SIZE(equipment) > 2 THEN ...
```

---

## General Databricks SQL

### String literal `"null"` vs SQL NULL
The source table (`health_india`) uses the literal string `"null"` everywhere. The Silver cleaning pass normalizes these to real SQL NULLs. But if querying Bronze directly:
```sql
CASE WHEN column = 'null' OR column IS NULL THEN NULL ELSE column END
```

### Stratified sampling pattern
```sql
WITH sample AS (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY facility_type_id ORDER BY RAND(42)
  ) AS rn
  FROM workspace.default.silver_facility
)
SELECT * FROM sample WHERE rn <= 10  -- 10 per type
```

### REGEXP_REPLACE uses Java regex syntax
Databricks uses Java regex (not Python). Key differences:
- Use `\\s` not `\s` (double-escape in SQL strings)
- `(?s)` enables DOTALL mode (dot matches newlines)
- Backticks need escaping in certain contexts

### Query output through CLI can be large
Always pipe through `| head -N` or use `LIMIT` in SQL:
```bash
databricks experimental aitools tools query "SELECT ... LIMIT 5" --profile sj-wksp 2>&1 | head -20
```

---

## Databricks CLI flags

### `--json` flag is exclusive with positional arguments
When using `--json`, ALL parameters must be in the JSON body — no positional args allowed:
```bash
# FAILS: positional args + --json
databricks vector-search-indexes create-index workspace.default.idx tm_endpoint fac_id DELTA_SYNC --json '{...}'

# WORKS: everything in JSON
databricks vector-search-indexes create-index --json '{"name": "...", "endpoint_name": "...", ...}'
```

---

## Vector Search

### DELTA_SYNC index requires pipeline_type
Must specify `"pipeline_type": "TRIGGERED"` or `"CONTINUOUS"` in the `delta_sync_index_spec`.

### Source table must have Change Data Feed enabled
Before creating a DELTA_SYNC index:
```sql
ALTER TABLE workspace.default.my_table SET TBLPROPERTIES (delta.enableChangeDataFeed = true)
```

### Unsupported column types in Vector Search sync
`decimal(N,M)` is NOT supported. Supported types: string, boolean, int, bigint, smallint, tinyint, float, double, date, timestamp, array&lt;string&gt;, array&lt;int&gt;, etc.
Workaround: exclude decimal columns from `columns_to_sync` and join them back via SQL in the application layer.

### `flags` column (ARRAY&lt;STRING&gt;) is NOT included in VS by default
It was excluded from our index because ARRAY columns sometimes cause issues. The backend should look up flags from the trust table directly.
