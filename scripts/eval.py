"""TrueCare Atlas — Eval script for the "18/20" pitch slide.

Runs three eval suites:
  1. Capability extraction: P/R on 30 hand-labeled facilities
  2. Trust scorer: caught/false-positive on 20 facilities (10 flagged, 10 clean)
  3. Retrieval: recall@10 on 15 geo queries via the agent's vector_search tool

Usage: cd backend && uv run python ../scripts/eval.py
"""

import json
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "eval"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from app.services.databricks_sql import (
    query_facility_by_id,
    query_trust_report,
    query_facilities_by_text,
)


def eval_trust_scorer() -> dict:
    """10 known-flagged + 10 known-clean facilities."""
    labels = [json.loads(line) for line in (DATA_DIR / "trust_gold.jsonl").read_text().splitlines() if line.strip()]
    tp = fp = tn = fn = 0
    for label in labels:
        fid = label["facility_id"]
        expected_low = label["expected_low_trust"]
        report = query_trust_report(fid)
        predicted_low = report.score < 80
        if expected_low and predicted_low:
            tp += 1
        elif expected_low and not predicted_low:
            fn += 1
        elif not expected_low and predicted_low:
            fp += 1
        else:
            tn += 1
    total = tp + fp + tn + fn
    return {
        "total": total,
        "true_positive": tp,
        "false_positive": fp,
        "true_negative": tn,
        "false_negative": fn,
        "caught_rate": f"{tp}/{tp + fn}" if (tp + fn) > 0 else "N/A",
        "false_positive_rate": f"{fp}/{fp + tn}" if (fp + tn) > 0 else "N/A",
    }


def eval_capabilities() -> dict:
    """30 facilities × ~6 capability flags = ~180 binary judgments."""
    labels = [json.loads(line) for line in (DATA_DIR / "capability_gold.jsonl").read_text().splitlines() if line.strip()]
    cap_cols = [
        "has_icu", "has_nicu", "has_dialysis", "has_oncology",
        "has_emergency_surgery", "has_24x7", "has_maternity",
        "has_blood_bank", "has_anesthesia", "has_trauma", "has_cardiac_cath_lab",
    ]
    tp = fp = tn = fn = 0
    for label in labels:
        fid = label["facility_id"]
        facility = query_facility_by_id(fid)
        caps = facility.capabilities
        if not caps:
            continue
        for col in cap_cols:
            expected = bool(label.get(col))
            predicted = getattr(caps, col, None)
            actual = predicted.value if predicted else False
            if expected and actual:
                tp += 1
            elif expected and not actual:
                fn += 1
            elif not expected and actual:
                fp += 1
            else:
                tn += 1
    total = tp + fp + tn + fn
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    return {
        "total_judgments": total,
        "true_positive": tp,
        "false_positive": fp,
        "true_negative": tn,
        "false_negative": fn,
        "precision": round(precision * 100, 1),
        "recall": round(recall * 100, 1),
    }


def eval_retrieval() -> dict:
    """15 queries using capability_filter + state filters. Check recall@10."""
    from app.schemas import FacilityFilters
    from app.services.databricks_sql import query_facilities_by_capability

    queries: list[tuple[list[str], str, str]] = [
        (["has_icu"], "Delhi", "Delhi"),
        (["has_nicu"], "Maharashtra", "Maharashtra"),
        (["has_oncology"], "Tamil Nadu", "Tamil Nadu"),
        (["has_trauma"], "Karnataka", "Karnataka"),
        (["has_dialysis"], "Kerala", "Kerala"),
        (["has_maternity"], "West Bengal", "West Bengal"),
        (["has_blood_bank"], "Maharashtra", "Maharashtra"),
        (["has_24x7"], "Telangana", "Telangana"),
        (["has_emergency_surgery"], "Punjab", "Punjab"),
        (["has_icu"], "Rajasthan", "Rajasthan"),
        (["has_cardiac_cath_lab"], "Gujarat", "Gujarat"),
        (["has_icu"], "Uttar Pradesh", "Uttar Pradesh"),
        (["has_oncology"], "Kerala", "Kerala"),
        (["has_trauma"], "Maharashtra", "Maharashtra"),
        (["has_icu"], "Tamil Nadu", "Tamil Nadu"),
    ]
    correct = 0
    for cap_flags, state_filter, expected_state in queries:
        results = query_facilities_by_capability(
            flags=cap_flags,
            filters=FacilityFilters(state=state_filter),
            k=10,
        )
        found = any(
            r.state and expected_state.lower() in r.state.lower()
            for r in results
        )
        if found:
            correct += 1
    return {
        "total_queries": len(queries),
        "correct": correct,
        "recall_at_10": f"{correct}/{len(queries)}",
    }


def main():
    print("=" * 60)
    print("TrueCare Atlas — Eval Suite")
    print("=" * 60)

    print("\n1. Trust Scorer Eval (10 flagged + 10 clean)")
    trust = eval_trust_scorer()
    print(f"   Caught: {trust['caught_rate']}")
    print(f"   False positives: {trust['false_positive_rate']}")

    print("\n2. Capability Extraction Eval (30 facilities)")
    caps = eval_capabilities()
    print(f"   Precision: {caps['precision']}%")
    print(f"   Recall: {caps['recall']}%")
    print(f"   ({caps['total_judgments']} binary judgments)")

    print("\n3. Retrieval Eval (15 geo queries, recall@10)")
    retrieval = eval_retrieval()
    print(f"   Recall@10: {retrieval['recall_at_10']}")

    print("\n" + "=" * 60)
    print("SLIDE LINE:")
    print(f'  "30-facility audit: capability extraction '
          f'P={caps["precision"]}% R={caps["recall"]}%. '
          f'Trust scorer: {trust["caught_rate"]} known contradictions caught, '
          f'{trust["false_positive"]} false positives. '
          f'Retrieval: {retrieval["recall_at_10"]} correct geography in top-10."')
    print("=" * 60)

    results = {"trust": trust, "capabilities": caps, "retrieval": retrieval}
    out_path = DATA_DIR / "eval_results.json"
    out_path.write_text(json.dumps(results, indent=2))
    print(f"\nResults saved to {out_path}")


if __name__ == "__main__":
    main()
