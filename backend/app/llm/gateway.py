"""Gateway modes (docs/05 §6): off -> template; recorded -> replay by request hash; live -> provider call.

request hash = sha256(canonical JSON of {prompt_id, prompt_version, input}).
live: OpenAI-compatible POST {base_url}/chat/completions, 8 s timeout, 1 retry; any failure -> caller's template.
"""
from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass, field
from pathlib import Path

import httpx

from .registry import get_prompt

ROOT = Path(__file__).resolve().parents[3]
RECORDED_DIR = ROOT / "fixtures" / "llm" / "recorded"
CAPTURE_DIR = ROOT / "work" / "llm" / "captured"   # live responses land here for review before commit
MODES = ("off", "recorded", "live")


def canonical(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def request_hash(prompt_id: str, prompt_version: str, payload) -> str:
    return hashlib.sha256(canonical({"prompt_id": prompt_id, "prompt_version": prompt_version,
                                     "input": payload}).encode("utf-8")).hexdigest()


@dataclass
class GatewayResult:
    output: dict | None          # parsed JSON output, None when the template must be used
    mode: str                    # "live" | "recorded" | "template"
    model: str | None = None
    attempts: int = 0
    degraded: bool = False       # configured mode failed (miss, timeout, bad JSON)
    error: str | None = None
    request_hash: str | None = None


@dataclass
class LLMGateway:
    mode: str = "off"
    recorded_dir: Path = RECORDED_DIR
    base_url: str | None = None
    model: str | None = None
    api_key: str | None = field(default=None, repr=False)
    timeout_s: float = 8.0
    retries: int = 1
    capture_dir: Path | None = CAPTURE_DIR
    transport: httpx.BaseTransport | None = None   # tests inject httpx.MockTransport

    def __post_init__(self):
        if self.mode not in MODES:
            raise ValueError(f"AEGIS_LLM_MODE must be one of {MODES}, got {self.mode!r}")

    def complete(self, prompt_id: str, payload) -> GatewayResult:
        prompt = get_prompt(prompt_id)
        h = request_hash(prompt_id, prompt["version"], payload)
        if self.mode == "off":
            return GatewayResult(None, "template", request_hash=h)
        if self.mode == "recorded":
            path = Path(self.recorded_dir) / prompt_id / f"{h}.json"
            if not path.exists():
                return GatewayResult(None, "template", degraded=True, error="RECORDED_MISS", request_hash=h)
            rec = json.loads(path.read_text(encoding="utf-8"))
            return GatewayResult(rec["output"], "recorded", model=rec.get("model"), attempts=1, request_hash=h)
        return self._live(prompt, payload, h)

    def _live(self, prompt: dict, payload, h: str) -> GatewayResult:
        if not self.base_url or not self.model:
            return GatewayResult(None, "template", degraded=True, error="LIVE_NOT_CONFIGURED", request_hash=h)
        body = {"model": self.model, "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [{"role": "system", "content": prompt["system"]},
                             {"role": "user", "content": canonical(payload)}]}
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        error, attempts = None, 0
        for _ in range(1 + self.retries):
            attempts += 1
            try:
                with httpx.Client(timeout=self.timeout_s, transport=self.transport) as c:
                    r = c.post(self.base_url.rstrip("/") + "/chat/completions", json=body, headers=headers)
                r.raise_for_status()
                out = json.loads(r.json()["choices"][0]["message"]["content"])
                if not isinstance(out, dict):
                    raise ValueError("output is not a JSON object")
                self._capture(prompt, payload, h, out)
                return GatewayResult(out, "live", model=self.model, attempts=attempts, request_hash=h)
            except Exception as e:  # network, HTTP, JSON: never propagate, never hide the attempt count
                error = type(e).__name__
        return GatewayResult(None, "template", attempts=attempts, degraded=True, error=error, request_hash=h)

    def _capture(self, prompt, payload, h, out):
        if self.capture_dir is None:
            return
        d = Path(self.capture_dir) / prompt["prompt_id"]
        d.mkdir(parents=True, exist_ok=True)
        (d / f"{h}.json").write_text(json.dumps(
            {"prompt_id": prompt["prompt_id"], "prompt_version": prompt["version"], "request_hash": h,
             "input": payload, "output": out, "model": self.model, "origin": "live_capture"},
            indent=2, ensure_ascii=False), encoding="utf-8")


def gateway_from_env(mode: str | None = None) -> LLMGateway:
    return LLMGateway(mode=mode or os.getenv("AEGIS_LLM_MODE", "off"),
                      base_url=os.getenv("AEGIS_LLM_BASE_URL"), model=os.getenv("AEGIS_LLM_MODEL"),
                      api_key=os.getenv("AEGIS_LLM_API_KEY"))
