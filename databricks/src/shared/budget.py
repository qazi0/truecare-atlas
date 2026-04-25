"""Pre-run cost guard for LLM extraction passes."""

# Llama 3.3 70B pay-per-token rates on Databricks (approximate, 2026-04)
LLAMA_70B_INPUT_PER_1M = 0.90   # $/1M input tokens
LLAMA_70B_OUTPUT_PER_1M = 0.90  # $/1M output tokens

# Estimated tokens per facility row
EST_INPUT_TOKENS_PER_ROW = 800
EST_OUTPUT_TOKENS_PER_ROW = 250

HARD_CEILING_USD = 25.0


def estimate_extraction_cost(row_count: int) -> dict:
    input_cost = (row_count * EST_INPUT_TOKENS_PER_ROW / 1_000_000) * LLAMA_70B_INPUT_PER_1M
    output_cost = (row_count * EST_OUTPUT_TOKENS_PER_ROW / 1_000_000) * LLAMA_70B_OUTPUT_PER_1M
    total = input_cost + output_cost
    return {
        "row_count": row_count,
        "est_input_tokens": row_count * EST_INPUT_TOKENS_PER_ROW,
        "est_output_tokens": row_count * EST_OUTPUT_TOKENS_PER_ROW,
        "est_input_cost_usd": round(input_cost, 2),
        "est_output_cost_usd": round(output_cost, 2),
        "est_total_cost_usd": round(total, 2),
        "under_ceiling": total <= HARD_CEILING_USD,
    }


if __name__ == "__main__":
    for n in [50, 200, 1000, 10000]:
        est = estimate_extraction_cost(n)
        status = "OK" if est["under_ceiling"] else "OVER BUDGET"
        print(f"{n:>6} rows: ${est['est_total_cost_usd']:>6.2f} [{status}]")
