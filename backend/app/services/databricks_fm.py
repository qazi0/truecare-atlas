"""Foundation Model service — thin async wrapper over DatabricksOpenAI."""

import asyncio
from typing import Any

from app.deps import get_fm_client
from app.settings import settings


async def chat_completion(
    messages: list[dict],
    tools: list[dict] | None = None,
) -> dict:
    """Call the Foundation Model and return the raw response as a dict.

    Runs the sync DatabricksOpenAI call in the default executor so it does
    not block the event loop.
    """
    client = get_fm_client()

    def _call() -> Any:
        kwargs: dict = dict(model=settings.chat_model, messages=messages)
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"
        return client.chat.completions.create(**kwargs)

    loop = asyncio.get_running_loop()
    response = await loop.run_in_executor(None, _call)
    # Return as a plain dict so the agent loop can inspect it without
    # depending on the openai SDK model classes directly.
    return response.model_dump()
