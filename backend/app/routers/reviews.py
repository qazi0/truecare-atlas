"""Review queue endpoints for human verification workflow."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.schemas import (
    AutoReviewBucket,
    AutoReviewResult,
    AutoReviewRunResponse,
    AutoReviewSummary,
    ReviewStatus,
    ReviewTask,
    ReviewTaskCreate,
    ReviewTaskUpdate,
    Severity,
)
from app.services.review_queue import (
    create_review_task,
    delete_review_task,
    list_review_tasks,
    persist_generated_review_task,
    update_review_task,
)
from app.services.databricks_sql import query_generated_review_candidates

router = APIRouter(tags=["reviews"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/reviews", response_model=list[ReviewTask])
def get_reviews(
    status: ReviewStatus | None = Query(default=None),
    facility_id: str | None = Query(default=None),
) -> list[ReviewTask]:
    return list_review_tasks(status=status, facility_id=facility_id)


@router.get("/reviews/summary", response_model=AutoReviewSummary)
def get_review_summary() -> AutoReviewSummary:
    tasks = list_review_tasks()
    buckets = {
        "phone_verify": 0,
        "field_visit_required": 0,
        "specialist_review": 0,
        "auto_verified_low_risk": 0,
        "reject_or_low_confidence": 0,
    }
    for task in tasks:
        bucket = _bucket_for_task(task.severity, task.reason, task.evidence_for, task.evidence_against)
        buckets[bucket.value] += 1
    return AutoReviewSummary(
        total_candidates=len(tasks),
        buckets=buckets,
        human_review_required=len(tasks) - buckets["auto_verified_low_risk"],
        updated_at=_now(),
    )


@router.post("/reviews/auto-run", response_model=AutoReviewRunResponse)
def auto_run_reviews(limit: int = Query(default=50, ge=1, le=100)) -> AutoReviewRunResponse:
    candidates = query_generated_review_candidates(limit=limit)[:limit]
    results: list[AutoReviewResult] = []
    for item in candidates:
        bucket = _bucket_for_task(item["severity"], item["reason"], item.get("evidence_for", []), item.get("evidence_against", []))
        result = AutoReviewResult(
            facility_id=item["facility_id"],
            facility_name=item.get("facility_name"),
            bucket=bucket,
            severity=item["severity"],
            reason=item["reason"],
            evidence_for=item.get("evidence_for", []),
            evidence_against=item.get("evidence_against", []),
            recommended_next_action=_next_action(bucket),
            human_override_state=None,
        )
        results.append(result)
    summary = get_review_summary()
    return AutoReviewRunResponse(limit=limit, processed=len(results), created=0, summary=summary, results=results)


@router.post("/reviews", response_model=ReviewTask)
def post_review(payload: ReviewTaskCreate) -> ReviewTask:
    return create_review_task(payload)


@router.patch("/reviews/{task_id}", response_model=ReviewTask)
def patch_review(task_id: str, payload: ReviewTaskUpdate) -> ReviewTask:
    task = update_review_task(task_id, payload)
    if task is None and task_id.startswith("gen_"):
        task = persist_generated_review_task(task_id, payload)
    if task is None:
        raise HTTPException(status_code=404, detail=f"Review task not found: {task_id}")
    return task


@router.delete("/reviews/{task_id}")
def remove_review(task_id: str) -> dict:
    deleted = delete_review_task(task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Review task not found: {task_id}")
    return {"deleted": True, "id": task_id}


def _bucket_for_task(
    severity: Severity,
    reason: str,
    evidence_for: list[str],
    evidence_against: list[str],
) -> AutoReviewBucket:
    text = f"{reason} {' '.join(evidence_for)} {' '.join(evidence_against)}".lower()
    if severity == Severity.RED and ("contradiction" in text or "modality" in text):
        return AutoReviewBucket.SPECIALIST_REVIEW
    if severity == Severity.RED:
        return AutoReviewBucket.FIELD_VISIT_REQUIRED
    if "sparse" in text or "weak" in text or not evidence_for:
        return AutoReviewBucket.PHONE_VERIFY
    return AutoReviewBucket.AUTO_VERIFIED_LOW_RISK


def _next_action(bucket: AutoReviewBucket) -> str:
    return {
        AutoReviewBucket.AUTO_VERIFIED_LOW_RISK: "Confirm in batch; no immediate field work.",
        AutoReviewBucket.PHONE_VERIFY: "Call facility before using in referrals.",
        AutoReviewBucket.FIELD_VISIT_REQUIRED: "Schedule field verification.",
        AutoReviewBucket.SPECIALIST_REVIEW: "Send to clinical reviewer.",
        AutoReviewBucket.REJECT_OR_LOW_CONFIDENCE: "Keep out of recommendations until resolved.",
    }[bucket]
