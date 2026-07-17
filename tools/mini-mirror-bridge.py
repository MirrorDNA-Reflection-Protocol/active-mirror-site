#!/usr/bin/env python3
"""Tiny Active Mirror model bridge for the Mac mini.

This service sits behind bridge.activemirror.ai -> 127.0.0.1:8082 and calls the
configured model route. Cloudflare Worker keeps the public boundary/rate/kernel
logic; this bridge only supplies a model-shaped mirror candidate.
"""

from __future__ import annotations

import hmac
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit


HOST = os.environ.get("MINI_MIRROR_BRIDGE_HOST", "127.0.0.1")
PORT = int(os.environ.get("MINI_MIRROR_BRIDGE_PORT", "8082"))
TOKEN = os.environ.get("MINI_MIRROR_BRIDGE_TOKEN", "")
PROVIDER = os.environ.get("MIRROR_PROVIDER", "ollama").lower()
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.4-mini")
OPENAI_URL = os.environ.get("OPENAI_URL", "https://api.openai.com/v1/responses")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/generate")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "mirrorstudent:latest")
EXPECTED_PROVIDER_ERRORS = (
    TimeoutError,
    urllib.error.URLError,
    json.JSONDecodeError,
    UnicodeError,
)


SYSTEM = """You are Active Mirror. Return valid JSON only:
{
  "reflection": "1-2 compact sentences with honest pushback, no flattery",
  "question": "one sharper question ending with ?",
  "move": "one small concrete next move under 110 characters, not a list",
  "receipt": {
    "why": "short reason",
    "context_used": "what was used",
    "context_excluded": "what stayed out",
    "route": "local mirror bridge",
    "memory_decision": "nothing saved unless accepted"
  },
  "visual": null
}
No markdown. No prose outside JSON.
Avoid generic product-management advice. Do not invent customers, data, product A, ROI, or market facts.
Stay inside the user's sentence. Use direct language: "you", "the work", "the next move"."""


OPENAI_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["reflection", "question", "move", "receipt", "visual"],
    "properties": {
        "reflection": {"type": "string"},
        "question": {"type": "string"},
        "move": {"type": "string"},
        "receipt": {
            "type": "object",
            "additionalProperties": False,
            "required": ["why", "context_used", "context_excluded", "route", "memory_decision"],
            "properties": {
                "why": {"type": "string"},
                "context_used": {"type": "string"},
                "context_excluded": {"type": "string"},
                "route": {"type": "string"},
                "memory_decision": {"type": "string"},
            },
        },
        "visual": {
            "anyOf": [
                {"type": "null"},
                {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["kind", "title", "items"],
                    "properties": {
                        "kind": {"type": "string", "enum": ["choice", "plan", "sources", "boundary"]},
                        "title": {"type": "string"},
                        "items": {"type": "array", "maxItems": 5, "items": {"type": "string"}},
                    },
                },
            ]
        },
    },
}


def audit_event(event: str, **fields: object) -> None:
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "event": event,
        **fields,
    }
    print(json.dumps(record, sort_keys=True), file=sys.stderr, flush=True)


def safe_text(value: object, fallback: str, limit: int) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return (text or fallback)[:limit]


def extract_json(text: str) -> dict:
    raw = text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?", "", raw).strip()
        raw = re.sub(r"```$", "", raw).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            return json.loads(raw[start : end + 1])
        raise


def normalize_mirror(candidate: dict) -> dict:
    receipt = candidate.get("receipt") if isinstance(candidate.get("receipt"), dict) else {}
    question = safe_text(candidate.get("question"), "What is the smallest honest next step?", 170)
    if not question.endswith("?"):
        question = question.rstrip(".! ") + "?"
    return {
        "reflection": safe_text(
            candidate.get("reflection"),
            "You may need one testable move more than another round of thinking.",
            360,
        ),
        "question": question,
        "move": safe_text(candidate.get("move"), "Write the smallest version you can test today.", 120),
        "receipt": {
            "why": safe_text(receipt.get("why"), "A local model generated a bounded reflection.", 220),
            "context_used": safe_text(receipt.get("context_used"), "Only the current prompt.", 220),
            "context_excluded": safe_text(receipt.get("context_excluded"), "Private context was not provided.", 220),
            "route": "local mirror bridge",
            "memory_decision": safe_text(receipt.get("memory_decision"), "Nothing saved unless accepted.", 220),
        },
        "visual": None,
    }


def generate_ollama(prompt: str) -> dict:
    body = {
        "model": OLLAMA_MODEL,
        "prompt": f"{SYSTEM}\n\nReflect on this governed prompt:\n{prompt}",
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.25, "num_predict": 360},
    }
    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=45) as res:
        data = json.loads(res.read().decode("utf-8"))
    return normalize_mirror(extract_json(data.get("response", "")))


def extract_openai_text(data: dict) -> str:
    if isinstance(data.get("output_text"), str):
        return data["output_text"]
    chunks: list[str] = []
    for item in data.get("output") or []:
        for part in item.get("content") or []:
            if isinstance(part.get("text"), str):
                chunks.append(part["text"])
    return "".join(chunks).strip()


def generate_openai(prompt: str) -> dict:
    body = {
        "model": OPENAI_MODEL,
        "input": f"{SYSTEM}\n\nReflect on this governed prompt:\n{prompt}",
        "store": False,
        "reasoning": {"effort": "low"},
        "text": {
            "format": {
                "type": "json_schema",
                "name": "active_mirror_bridge_turn",
                "strict": True,
                "schema": OPENAI_SCHEMA,
            }
        },
        "max_output_tokens": 650,
    }
    req = urllib.request.Request(
        OPENAI_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {OPENAI_API_KEY}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=35) as res:
        data = json.loads(res.read().decode("utf-8"))
    return normalize_mirror(extract_json(extract_openai_text(data)))


def generate(prompt: str) -> tuple[dict, str]:
    if PROVIDER == "openai" and OPENAI_API_KEY:
        try:
            return generate_openai(prompt), "openai"
        except urllib.error.HTTPError as exc:
            audit_event("provider_http_error", provider="openai", status=exc.code)
            if exc.code != 429 and not 500 <= exc.code < 600:
                raise
            audit_event(
                "provider_fallback",
                from_provider="openai",
                to_provider="ollama",
                error_type=type(exc).__name__,
                status=exc.code,
            )
            return generate_ollama(prompt), "local-fallback"
        except EXPECTED_PROVIDER_ERRORS as exc:
            # Keep the public route alive if the hosted route blips. The Worker
            # still owns privacy/rate/receipt gates, and the response marks the
            # private bridge route rather than exposing provider details.
            audit_event(
                "provider_fallback",
                from_provider="openai",
                to_provider="ollama",
                error_type=type(exc).__name__,
            )
            return generate_ollama(prompt), "local-fallback"
    return generate_ollama(prompt), "local"


class Handler(BaseHTTPRequestHandler):
    server_version = "ActiveMirrorMiniBridge/0.1"

    def send_json(self, status: int, payload: dict) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
        if self.path != "/health" or status >= 400:
            audit_event(
                "http_response",
                method=self.command,
                path=urlsplit(self.path).path,
                status=status,
            )

    def do_GET(self) -> None:
        if self.path == "/health":
            self.send_json(
                200,
                {
                    "ok": True,
                    "service": "active-mirror-mini-bridge",
                    "provider": "hosted" if PROVIDER == "openai" and OPENAI_API_KEY else "local",
                    "fallback": "local",
                },
            )
            return
        self.send_json(404, {"ok": False, "error": f"not_found_{self.path}"})

    def do_POST(self) -> None:
        # Accept any POST path so the public Worker can use this as a narrow
        # origin bridge without path coupling. Auth still gates the endpoint.
        if not TOKEN:
            self.send_json(503, {"ok": False, "error": "bridge_token_missing"})
            return
        supplied_token = self.headers.get("X-Active-Mirror-Bridge", "")
        if not hmac.compare_digest(supplied_token.encode("utf-8"), TOKEN.encode("utf-8")):
            self.send_json(401, {"ok": False, "error": "unauthorized"})
            return
        try:
            content_length = self.headers.get("Content-Length")
            if content_length is None:
                self.send_json(411, {"ok": False, "error": "content_length_required"})
                return
            try:
                size = int(content_length)
            except ValueError:
                self.send_json(400, {"ok": False, "error": "invalid_content_length"})
                return
            if size <= 0:
                self.send_json(400, {"ok": False, "error": "empty_payload"})
                return
            if size > 24000:
                self.send_json(413, {"ok": False, "error": "payload_too_large"})
                return
            try:
                payload = json.loads(self.rfile.read(size).decode("utf-8"))
            except (json.JSONDecodeError, UnicodeError):
                self.send_json(400, {"ok": False, "error": "invalid_json"})
                return
            prompt = safe_text(payload.get("prompt"), "", 16000)
            if len(prompt) < 12:
                self.send_json(400, {"ok": False, "error": "prompt_too_short"})
                return
            mirror, provider = generate(prompt)
            self.send_json(200, {"ok": True, "model": provider, "mirror": mirror})
        except urllib.error.HTTPError as exc:
            audit_event("provider_rejected", error_type=type(exc).__name__, status=exc.code)
            self.send_json(503, {"ok": False, "error": "provider_rejected"})
        except EXPECTED_PROVIDER_ERRORS as exc:
            audit_event("provider_unavailable", error_type=type(exc).__name__)
            self.send_json(503, {"ok": False, "error": "provider_unavailable"})
        except Exception as exc:
            audit_event("bridge_error", error_type=type(exc).__name__)
            self.send_json(500, {"ok": False, "error": "bridge_error"})

    def log_message(self, fmt: str, *args: object) -> None:
        return


class BridgeServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 64


if __name__ == "__main__":
    audit_event(
        "bridge_start",
        host=HOST,
        port=PORT,
        provider="openai" if PROVIDER == "openai" and OPENAI_API_KEY else "ollama",
        token_configured=bool(TOKEN),
    )
    BridgeServer((HOST, PORT), Handler).serve_forever()
