"""Review queue endpoints for human verification workflow."""

from fastapi import APIRouter, HTTPException, Query

from app.schemas import ReviewStatus, ReviewTask, ReviewTaskCreate, ReviewTaskUpdate
from app.services.review_queue import (
    create_review_task,
    delete_review_task,
    list_review_tasks,
    persist_generated_review_task,
    update_review_task,
)

router = APIRouter(tags=["reviews"])


@router.get("/reviews", response_model=list[ReviewTask])
def get_reviews(
    status: ReviewStatus | None = Query(default=None),
    facility_id: str | None = Query(default=None),
) -> list[ReviewTask]:
    return list_review_tasks(status=status, facility_id=facility_id)


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
