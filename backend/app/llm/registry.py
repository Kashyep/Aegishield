"""Prompt registry: prompts/<prompt_id>.md with a JSON front block (between ```json fences)."""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

PROMPTS = Path(__file__).resolve().parent / "prompts"
_BLOCK = re.compile(r"```json\n(.*?)\n```", re.S)


class UnknownPrompt(KeyError):
    pass


@lru_cache(maxsize=None)
def get_prompt(prompt_id: str) -> dict:
    path = PROMPTS / f"{prompt_id}.md"
    if not path.exists():
        raise UnknownPrompt(prompt_id)
    text = path.read_text(encoding="utf-8")
    meta = json.loads(_BLOCK.search(text).group(1))
    system = text.split("## System", 1)[1].strip() if "## System" in text else ""
    assert meta["prompt_id"] == prompt_id, f"{path.name}: prompt_id mismatch"
    return {**meta, "system": system}


def list_prompts() -> list[str]:
    return sorted(p.stem for p in PROMPTS.glob("*.md"))
