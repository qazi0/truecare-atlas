"""POST /api/search — streams agent reasoning as SSE."""

import asyncio

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse, ServerSentEvent

from app.agent.loop import run_agent_loop
from app.schemas import SearchRequest, SSEEvent

router = APIRouter(tags=["search"])


@router.post("/search")
async def search(request: SearchRequest) -> EventSourceResponse:
    query = request.query
    queue: asyncio.Queue[SSEEvent | None] = asyncio.Queue()

    async def _emit(event: SSEEvent) -> None:
        await queue.put(event)

    async def event_generator():
        # Start the agent loop in a background task
        task = asyncio.create_task(_run_loop())
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield ServerSentEvent(data=item.model_dump_json())
        finally:
            # Ensure loop task is cleaned up if client disconnects
            task.cancel()

    async def _run_loop():
        try:
            await run_agent_loop(query=query, emit=_emit)
        finally:
            await queue.put(None)  # sentinel to close the generator

    return EventSourceResponse(event_generator())
