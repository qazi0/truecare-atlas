# Engineering Principles — TrustMap India

These rules sit above every other plan section. If a future decision contradicts them, these win.

1. **Simple, reliable algorithm > clever architecture.** If a `dict` lookup, a `sorted(...)` call, or a 12-line for-loop solves the problem reliably, that is the answer.

2. **Modern Python 3.11+ but readable.** Type hints, dataclasses, Pydantic v2, `match`, `pathlib`, `enum.StrEnum`, async/await where I/O-bound. No metaclasses, descriptor magic, monkey-patching, `eval`/`exec`, or complex decorator stacks.

3. **One way to do each thing.** One config pattern (Pydantic Settings). One LLM client (`databricks-openai`). One SQL client (`databricks-sql-connector`). One streaming pattern (SSE via `sse-starlette` → AI-SDK protocol).

4. **Functions over classes by default.** Reach for a class when state genuinely accumulates. Modules + pure functions otherwise.

5. **Pydantic schemas at every boundary.** Every tool input/output, every API request/response, every LLM JSON output.

6. **Trace, don't print.** All observability goes through MLflow spans.

7. **Fail fast at boundaries, trust internals.** Validate user input and external API responses with Pydantic. Don't add defensive checks inside our own code where the type system guarantees correctness.

8. **No backwards-compat shims.** This is a 36-hour build. If we change a schema, we change every callsite.

9. **Comments explain why, not what.** Skip obvious comments. Add a comment only when a future reader would otherwise be confused.

10. **Tests are integration tests by default.** Hit the real Silver table, the real vector index, the real Foundation Model endpoint where reasonable.

11. **Files stay small.** Soft cap: ≤300 lines per Python file, ≤200 lines per React component file.

12. **No new dependencies without one-line justification.**

13. **Empirical-verification rule.** Never make a claim that is not empirically verified. Verify before claiming. Treat subagent outputs as "claims to verify". Hedge precisely.
