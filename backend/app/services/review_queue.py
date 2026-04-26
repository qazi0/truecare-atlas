"""Review queue persistence.

Uses Supabase when configured; falls back to the local JSON file for hackathon
local runs.
"""

import json
import os
import threading
import uuid
from datetime import datetime, timezone

import httpx

from app.schemas import ReviewNote, ReviewStatus, ReviewTask, ReviewTaskCreate, ReviewTaskUpdate
from app.services.databricks_sql import query_generated_review_candidates
from app.settings import settings

_LOCK = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _supabase_configured() -> bool:
    return bool(settings.supabase_url and settings.supabase_service_role_key)


def _supabase_headers(prefer: str | None = None) -> dict[str, str]:
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def _supabase_table_url() -> str:
    base = settings.supabase_url.rstrip("/")
    if base.endswith("/rest/v1"):
        return f"{base}/review_tasks"
    return f"{base}/rest/v1/review_tasks"


def _read_supabase(
    status: ReviewStatus | None = None,
    facility_id: str | None = None,
) -> list[ReviewTask] | None:
    if not _supabase_configured():
        return None
    params: dict[str, str] = {"select": "*", "order": "updated_at.desc"}
    if status:
        params["status"] = f"eq.{status.value}"
    if facility_id:
        params["facility_id"] = f"eq.{facility_id}"
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(_supabase_table_url(), headers=_supabase_headers(), params=params)
        if resp.status_code >= 400:
            return None
        return [ReviewTask.model_validate(item) for item in resp.json()]
    except Exception:
        return None


def _insert_supabase(task: ReviewTask) -> ReviewTask | None:
    if not _supabase_configured():
        return None
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(
                _supabase_table_url(),
                headers=_supabase_headers("return=representation"),
                json=task.model_dump(mode="json"),
            )
        if resp.status_code >= 400:
            return None
        rows = resp.json()
        return ReviewTask.model_validate(rows[0]) if rows else task
    except Exception:
        return None


def _patch_supabase(task_id: str, patch: dict) -> ReviewTask | None:
    if not _supabase_configured():
        return None
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.patch(
                _supabase_table_url(),
                headers=_supabase_headers("return=representation"),
                params={"id": f"eq.{task_id}"},
                json=patch,
            )
        if resp.status_code >= 400:
            return None
        rows = resp.json()
        return ReviewTask.model_validate(rows[0]) if rows else None
    except Exception:
        return None


def _delete_supabase(task_id: str) -> bool | None:
    if not _supabase_configured():
        return None
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.delete(
                _supabase_table_url(),
                headers=_supabase_headers(),
                params={"id": f"eq.{task_id}"},
            )
        if resp.status_code >= 400:
            return None
        return True
    except Exception:
        return None


def _read_all() -> list[ReviewTask]:
    path = settings.review_queue_path
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    return [ReviewTask.model_validate(item) for item in raw]


def _write_all(tasks: list[ReviewTask]) -> None:
    path = settings.review_queue_path
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)
    tmp_path = f"{path}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump([t.model_dump() for t in tasks], f, indent=2)
    os.replace(tmp_path, path)


def list_review_tasks(
    status: ReviewStatus | None = None,
    facility_id: str | None = None,
) -> list[ReviewTask]:
    tasks = _read_supabase(status=status, facility_id=facility_id)
    if tasks is None:
        with _LOCK:
            tasks = _read_all()
    persisted_ids = {t.id for t in tasks}
    try:
        generated = [
            ReviewTask(
                **item,
                status=ReviewStatus.PENDING,
                owner=None,
                notes=[],
                created_at=_now(),
                updated_at=_now(),
            )
            for item in query_generated_review_candidates()
            if item["id"] not in persisted_ids
        ]
        tasks = tasks + generated
    except Exception:
        pass
    if tasks is None:
        tasks = []
    if status:
        tasks = [t for t in tasks if t.status == status]
    if facility_id:
        tasks = [t for t in tasks if t.facility_id == facility_id]
    return sorted(tasks, key=lambda t: t.updated_at, reverse=True)


def create_review_task(payload: ReviewTaskCreate) -> ReviewTask:
    now = _now()
    task = ReviewTask(
        id=f"rev_{uuid.uuid4().hex[:12]}",
        facility_id=payload.facility_id,
        facility_name=payload.facility_name,
        capability=payload.capability,
        claim=payload.claim,
        reason=payload.reason,
        severity=payload.severity,
        evidence_for=payload.evidence_for,
        evidence_against=payload.evidence_against,
        source=payload.source,
        created_at=now,
        updated_at=now,
    )
    created = _insert_supabase(task)
    if created is not None:
        return created
    with _LOCK:
        tasks = _read_all()
        tasks.append(task)
        _write_all(tasks)
    return task


def update_review_task(task_id: str, payload: ReviewTaskUpdate) -> ReviewTask | None:
    existing = _read_supabase()
    if existing is not None:
        task = next((item for item in existing if item.id == task_id), None)
        if task is None:
            return None
        updated = task.model_copy(deep=True)
        if payload.status is not None:
            updated.status = payload.status
        if payload.owner is not None:
            updated.owner = payload.owner
        if payload.note:
            updated.notes.append(ReviewNote(text=payload.note, created_at=_now()))
        updated.updated_at = _now()
        return _patch_supabase(task_id, {
            "status": updated.status.value,
            "owner": updated.owner,
            "notes": [note.model_dump(mode="json") for note in updated.notes],
            "updated_at": updated.updated_at,
        })

    with _LOCK:
        tasks = _read_all()
        for idx, task in enumerate(tasks):
            if task.id != task_id:
                continue
            updated = task.model_copy(deep=True)
            if payload.status is not None:
                updated.status = payload.status
            if payload.owner is not None:
                updated.owner = payload.owner
            if payload.note:
                updated.notes.append(ReviewNote(text=payload.note, created_at=_now()))
            updated.updated_at = _now()
            tasks[idx] = updated
            _write_all(tasks)
            return updated
    return None


def persist_generated_review_task(task_id: str, payload: ReviewTaskUpdate) -> ReviewTask | None:
    base = next((task for task in list_review_tasks() if task.id == task_id), None)
    if base is None:
        return None
    updated = base.model_copy(deep=True)
    if payload.status is not None:
        updated.status = payload.status
    if payload.owner is not None:
        updated.owner = payload.owner
    if payload.note:
        updated.notes.append(ReviewNote(text=payload.note, created_at=_now()))
    updated.updated_at = _now()
    inserted = _insert_supabase(updated)
    if inserted is not None:
        return inserted
    with _LOCK:
        tasks = [t for t in _read_all() if t.id != task_id]
        tasks.append(updated)
        _write_all(tasks)
    return updated


def delete_review_task(task_id: str) -> bool:
    deleted = _delete_supabase(task_id)
    if deleted is not None:
        return deleted
    with _LOCK:
        tasks = _read_all()
        remaining = [t for t in tasks if t.id != task_id]
        if len(remaining) == len(tasks):
            return False
        _write_all(remaining)
    return True
