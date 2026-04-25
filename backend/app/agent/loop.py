"""Reasoning loop: LLM call -> tool dispatch -> SSE emit. <= 200 LOC."""

import json
import time
from datetime import datetime, timezone
from typing import Awaitable, Callable

from pydantic import BaseModel

from app.agent.prompts import SYSTEM_PROMPT
from app.agent.tools import TOOL_DEFINITIONS, TOOL_REGISTRY, get_openai_tool_definitions
from app.schemas import FacilityHit, SSEEvent, SSEEventType
from app.services.databricks_fm import chat_completion

# Build a schema lookup once at import time
_SCHEMA_BY_NAME: dict[str, type] = {name: schema for name, _, schema in TOOL_DEFINITIONS}

MAX_STEPS = 10


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _serialize(obj: object) -> object:
    """Recursively convert Pydantic models/lists to JSON-safe dicts."""
    if isinstance(obj, BaseModel):
        return obj.model_dump()
    if isinstance(obj, list):
        return [_serialize(item) for item in obj]
    return obj


async def run_agent_loop(
    query: str,
    emit: Callable[[SSEEvent], Awaitable[None]],
    max_steps: int = MAX_STEPS,
) -> None:
    """
    Core agent loop. Emits SSE events via the `emit` callback.

    Flow per step:
      step -> (tool_call -> tool_result)* | (reasoning -> result) -> done
    """
    messages: list[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": query},
    ]
    tools = get_openai_tool_definitions()
    step_index = 0
    accumulated_facilities: list[FacilityHit] = []
    trace_id: str | None = None

    try:
        while step_index < max_steps:
            await emit(SSEEvent(
                type=SSEEventType.STEP,
                payload={
                    "step_index": step_index,
                    "description": f"Reasoning step {step_index + 1}",
                    "timestamp": _now(),
                },
            ))

            response = await chat_completion(messages=messages, tools=tools)
            choice = response["choices"][0]
            message = choice["message"]

            # Extract trace_id from response metadata if present
            if not trace_id and response.get("id"):
                trace_id = response["id"]

            # ----------------------------------------------------------------
            # Tool calls branch
            # ----------------------------------------------------------------
            tool_calls = message.get("tool_calls") or []
            if tool_calls:
                # Append assistant message with tool calls
                messages.append({
                    "role": "assistant",
                    "content": message.get("content"),
                    "tool_calls": tool_calls,
                })

                for tc in tool_calls:
                    tool_name = tc["function"]["name"]
                    raw_args = tc["function"]["arguments"]
                    try:
                        arguments = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                    except json.JSONDecodeError:
                        arguments = {}

                    await emit(SSEEvent(
                        type=SSEEventType.TOOL_CALL,
                        payload={
                            "step_index": step_index,
                            "tool_name": tool_name,
                            "arguments": arguments,
                        },
                    ))

                    t_start = time.monotonic()
                    tool_fn = TOOL_REGISTRY.get(tool_name)
                    if tool_fn is None:
                        result_obj: object = {"error": f"Unknown tool: {tool_name}"}
                    else:
                        schema_cls = _SCHEMA_BY_NAME.get(tool_name)
                        try:
                            parsed = schema_cls.model_validate(arguments) if schema_cls else arguments
                            result_obj = await tool_fn(parsed)
                        except Exception as tool_exc:
                            result_obj = {"error": str(tool_exc)}

                    duration_ms = int((time.monotonic() - t_start) * 1000)
                    serialized_result = _serialize(result_obj)

                    # Collect FacilityHit results for the final answer
                    if isinstance(result_obj, list):
                        for item in result_obj:
                            if isinstance(item, FacilityHit):
                                accumulated_facilities.append(item)
                    elif isinstance(result_obj, FacilityHit):
                        accumulated_facilities.append(result_obj)

                    await emit(SSEEvent(
                        type=SSEEventType.TOOL_RESULT,
                        payload={
                            "step_index": step_index,
                            "tool_name": tool_name,
                            "result": serialized_result,
                            "duration_ms": duration_ms,
                        },
                    ))

                    # Append tool result to messages for next LLM turn
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": json.dumps(serialized_result, default=str),
                    })

                step_index += 1
                continue

            # ----------------------------------------------------------------
            # Final answer branch — content without tool calls
            # ----------------------------------------------------------------
            content = message.get("content") or ""
            if content:
                await emit(SSEEvent(
                    type=SSEEventType.REASONING,
                    payload={"step_index": step_index, "text": content},
                ))

            # Deduplicate accumulated facilities (by facility_id, keep highest trust)
            seen: dict[str, FacilityHit] = {}
            for fac in accumulated_facilities:
                existing = seen.get(fac.facility_id)
                if existing is None or (fac.trust_score or 0) > (existing.trust_score or 0):
                    seen[fac.facility_id] = fac
            final_facilities = list(seen.values())[:20]

            await emit(SSEEvent(
                type=SSEEventType.RESULT,
                payload={
                    "facilities": [f.model_dump() for f in final_facilities],
                    "summary": content,
                    "trace_id": trace_id,
                },
            ))
            return

        # max_steps exceeded
        await emit(SSEEvent(
            type=SSEEventType.ERROR,
            payload={
                "message": f"Agent exceeded {max_steps} steps without reaching a final answer.",
                "step_index": step_index,
            },
        ))

    except Exception as exc:
        await emit(SSEEvent(
            type=SSEEventType.ERROR,
            payload={"message": str(exc), "step_index": step_index},
        ))
    finally:
        await emit(SSEEvent(
            type=SSEEventType.DONE,
            payload={"trace_id": trace_id},
        ))
