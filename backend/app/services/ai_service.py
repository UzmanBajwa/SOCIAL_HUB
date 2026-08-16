"""AI Assistant actions for the post composer.

No LLM API key exists in this project yet, so every action below is a deterministic,
rule-based stand-in -- never a garbled placeholder, just a modest heuristic improvement
so the feature is genuinely useful today. Each action is its own small async function
with the exact signature a real LLM-backed implementation would have, so swapping in a
provider later (Anthropic/OpenAI/etc.) means replacing a function body, not restructuring
the route, the response shape, or the frontend. AIActionResult.is_mock tells the frontend
to label output as a preview rather than implying it's a finished AI result.
"""
from __future__ import annotations

import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

TONES = {"friendly", "professional", "playful", "urgent", "formal"}


class UnsupportedAIActionError(ValueError):
    pass


@dataclass
class AIActionResult:
    text: str
    is_mock: bool = True


def _clean(text: str) -> str:
    return re.sub(r"[ \t]+", " ", text).strip()


async def improve_writing(text: str, options: dict) -> str:
    # PLACEHOLDER for a real LLM call, e.g.:
    #   resp = await anthropic_client.messages.create(model=..., messages=[...])
    #   return resp.content[0].text
    cleaned = _clean(text)
    if not cleaned:
        return cleaned
    cleaned = cleaned[0].upper() + cleaned[1:]
    if cleaned[-1] not in ".!?":
        cleaned += "."
    return cleaned


async def generate_caption(text: str, options: dict) -> str:
    topic = _clean(text) or "our latest update"
    return f"{topic}\n\nWant to know more? Drop a comment below! 👇"


async def rewrite(text: str, options: dict) -> str:
    cleaned = _clean(text)
    if not cleaned:
        return cleaned
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", cleaned) if s.strip()]
    if len(sentences) <= 1:
        return cleaned
    return " ".join([sentences[-1], *sentences[:-1]])


async def translate(text: str, options: dict) -> str:
    target_language = options.get("target_language", "English")
    cleaned = _clean(text)
    return f"[{target_language} translation pending real AI integration]\n{cleaned}"


async def generate_hashtags(text: str, options: dict) -> str:
    words = re.findall(r"[A-Za-z]{4,}", text)
    seen: list[str] = []
    for word in words:
        tag = f"#{word.lower()}"
        if tag not in seen:
            seen.append(tag)
        if len(seen) == 6:
            break
    if not seen:
        seen = ["#socialmedia", "#update"]
    return " ".join(seen)


async def change_tone(text: str, options: dict) -> str:
    tone = options.get("tone", "friendly")
    if tone not in TONES:
        raise UnsupportedAIActionError(f"Unknown tone: {tone}")
    cleaned = _clean(text)
    if not cleaned:
        return cleaned
    prefixes = {
        "friendly": "Hey! ",
        "professional": "",
        "playful": "😄 ",
        "urgent": "Important: ",
        "formal": "Please note: ",
    }
    return f"{prefixes[tone]}{cleaned}"


ActionHandler = Callable[[str, dict], Awaitable[str]]

ACTION_HANDLERS: dict[str, ActionHandler] = {
    "improve_writing": improve_writing,
    "generate_caption": generate_caption,
    "rewrite": rewrite,
    "translate": translate,
    "generate_hashtags": generate_hashtags,
    "change_tone": change_tone,
}


async def run_ai_action(action: str, text: str, options: dict | None = None) -> AIActionResult:
    handler = ACTION_HANDLERS.get(action)
    if handler is None:
        raise UnsupportedAIActionError(f"Unknown AI action: {action}")
    result_text = await handler(text, options or {})
    return AIActionResult(text=result_text)
