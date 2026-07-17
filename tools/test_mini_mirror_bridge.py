#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import http.client
import json
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).with_name("mini-mirror-bridge.py")
SPEC = importlib.util.spec_from_file_location("mini_mirror_bridge", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot load {MODULE_PATH}")
BRIDGE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BRIDGE)


class FakeResponse:
    def __init__(self, payload: dict) -> None:
        self.body = json.dumps(payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_args) -> None:
        return None

    def read(self, _limit: int = -1) -> bytes:
        return self.body


class MiniMirrorBridgeContractTest(unittest.TestCase):
    token_lock = threading.Lock()

    @classmethod
    def setUpClass(cls) -> None:
        cls.server = BRIDGE.BridgeServer(("127.0.0.1", 0), BRIDGE.Handler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def request(
        self,
        path: str,
        *,
        token: str | None = None,
        body: bytes | None = None,
    ) -> tuple[int, dict]:
        headers = {"Content-Type": "application/json"}
        if token is not None:
            headers["X-Active-Mirror-Bridge"] = token
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}{path}",
            data=body or json.dumps({"prompt": "This request must not reach a provider."}).encode(),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=2) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as exc:
            return exc.code, json.loads(exc.read())

    def test_health_is_provider_independent(self) -> None:
        with urllib.request.urlopen(f"http://127.0.0.1:{self.port}/health", timeout=2) as response:
            payload = json.loads(response.read())
        self.assertEqual(response.status, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["service"], "active-mirror-mini-bridge")

    def test_missing_token_configuration_fails_closed(self) -> None:
        with self.token_lock:
            original = BRIDGE.TOKEN
            BRIDGE.TOKEN = ""
            try:
                status, payload = self.request("/reflect")
            finally:
                BRIDGE.TOKEN = original
        self.assertEqual(status, 503)
        self.assertEqual(payload["error"], "bridge_token_missing")

    def test_wrong_token_is_rejected(self) -> None:
        with self.token_lock:
            original = BRIDGE.TOKEN
            BRIDGE.TOKEN = "expected-token"
            try:
                with patch.object(BRIDGE, "generate") as generate:
                    status, payload = self.request("/reflect", token="wrong-token")
                generate.assert_not_called()
            finally:
                BRIDGE.TOKEN = original
        self.assertEqual(status, 401)
        self.assertEqual(payload["error"], "unauthorized")

    def test_authorized_request_reaches_bounded_generator(self) -> None:
        mirror = {
            "reflection": "A bounded reflection.",
            "question": "What evidence changes the decision?",
            "move": "Run one bounded check.",
            "receipt": {},
            "visual": None,
        }
        with self.token_lock:
            original = BRIDGE.TOKEN
            BRIDGE.TOKEN = "expected-token"
            try:
                with patch.object(BRIDGE, "generate", return_value=(mirror, "test-provider")) as generate:
                    status, payload = self.request("/reflect", token="expected-token")
            finally:
                BRIDGE.TOKEN = original
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["model"], "test-provider")
        self.assertEqual(payload["mirror"], mirror)
        generate.assert_called_once_with("This request must not reach a provider.")

    def test_compare_digest_is_used_for_authorization(self) -> None:
        with self.token_lock:
            original = BRIDGE.TOKEN
            BRIDGE.TOKEN = "expected-token"
            try:
                with patch.object(BRIDGE.hmac, "compare_digest", return_value=False) as compare:
                    status, _ = self.request("/reflect", token="supplied-token")
            finally:
                BRIDGE.TOKEN = original
        self.assertEqual(status, 401)
        compare.assert_called_once_with(b"supplied-token", b"expected-token")

    def test_short_prompt_is_rejected_before_generation(self) -> None:
        with self.token_lock:
            original = BRIDGE.TOKEN
            BRIDGE.TOKEN = "expected-token"
            try:
                with patch.object(BRIDGE, "generate") as generate:
                    status, payload = self.request(
                        "/reflect",
                        token="expected-token",
                        body=json.dumps({"prompt": "short"}).encode(),
                    )
                generate.assert_not_called()
            finally:
                BRIDGE.TOKEN = original
        self.assertEqual(status, 400)
        self.assertEqual(payload["error"], "prompt_too_short")

    def test_malformed_json_is_a_bounded_client_error(self) -> None:
        with self.token_lock:
            original = BRIDGE.TOKEN
            BRIDGE.TOKEN = "expected-token"
            try:
                status, payload = self.request(
                    "/reflect",
                    token="expected-token",
                    body=b"{not-json",
                )
            finally:
                BRIDGE.TOKEN = original
        self.assertEqual(status, 400)
        self.assertEqual(payload["error"], "invalid_json")
        self.assertNotIn("detail", payload)

    def test_oversized_payload_is_rejected_without_reading_provider_input(self) -> None:
        with self.token_lock:
            original = BRIDGE.TOKEN
            BRIDGE.TOKEN = "expected-token"
            try:
                with patch.object(BRIDGE, "generate") as generate:
                    status, payload = self.request(
                        "/reflect",
                        token="expected-token",
                        body=b"x" * 24001,
                    )
                generate.assert_not_called()
            finally:
                BRIDGE.TOKEN = original
        self.assertEqual(status, 413)
        self.assertEqual(payload["error"], "payload_too_large")

    def test_expected_hosted_failure_falls_back_and_programmer_error_does_not(self) -> None:
        mirror = {"reflection": "local"}
        original_provider = BRIDGE.PROVIDER
        original_key = BRIDGE.OPENAI_API_KEY
        BRIDGE.PROVIDER = "openai"
        BRIDGE.OPENAI_API_KEY = "configured-for-test"
        try:
            with (
                patch.object(BRIDGE, "generate_openai", side_effect=urllib.error.URLError("offline")),
                patch.object(BRIDGE, "generate_ollama", return_value=mirror) as local,
            ):
                result, route = BRIDGE.generate("A sufficiently long prompt")
            self.assertEqual((result, route), (mirror, "local-fallback"))
            local.assert_called_once()

            with (
                patch.object(BRIDGE, "generate_openai", side_effect=RuntimeError("code defect")),
                patch.object(BRIDGE, "generate_ollama") as local,
            ):
                with self.assertRaises(RuntimeError):
                    BRIDGE.generate("A sufficiently long prompt")
            local.assert_not_called()
        finally:
            BRIDGE.PROVIDER = original_provider
            BRIDGE.OPENAI_API_KEY = original_key

    def test_hosted_auth_rejection_does_not_fall_back(self) -> None:
        original_provider = BRIDGE.PROVIDER
        original_key = BRIDGE.OPENAI_API_KEY
        BRIDGE.PROVIDER = "openai"
        BRIDGE.OPENAI_API_KEY = "configured-for-test"
        rejection = urllib.error.HTTPError(
            "https://provider.invalid",
            401,
            "unauthorized",
            {},
            None,
        )
        try:
            with (
                patch.object(BRIDGE, "generate_openai", side_effect=rejection),
                patch.object(BRIDGE, "generate_ollama") as local,
            ):
                with self.assertRaises(urllib.error.HTTPError):
                    BRIDGE.generate("A sufficiently long prompt")
            local.assert_not_called()
        finally:
            BRIDGE.PROVIDER = original_provider
            BRIDGE.OPENAI_API_KEY = original_key

    def test_invalid_content_length_is_a_bounded_client_error(self) -> None:
        with self.token_lock:
            original = BRIDGE.TOKEN
            BRIDGE.TOKEN = "expected-token"
            try:
                connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=2)
                connection.putrequest("POST", "/reflect")
                connection.putheader("X-Active-Mirror-Bridge", "expected-token")
                connection.putheader("Content-Type", "application/json")
                connection.putheader("Content-Length", "not-an-integer")
                connection.endheaders()
                response = connection.getresponse()
                payload = json.loads(response.read())
                connection.close()
            finally:
                BRIDGE.TOKEN = original
        self.assertEqual(response.status, 400)
        self.assertEqual(payload["error"], "invalid_content_length")

    def test_provider_adapters_parse_bounded_json_without_network(self) -> None:
        candidate = {
            "reflection": "One bounded reflection.",
            "question": "What evidence changes this?",
            "move": "Run one check.",
            "receipt": {
                "why": "test",
                "context_used": "prompt",
                "context_excluded": "private context",
                "route": "test",
                "memory_decision": "nothing saved",
            },
            "visual": None,
        }
        ollama_response = FakeResponse({"response": json.dumps(candidate)})
        with patch.object(BRIDGE.urllib.request, "urlopen", return_value=ollama_response) as request:
            ollama = BRIDGE.generate_ollama("A sufficiently long prompt")
        self.assertEqual(ollama["reflection"], candidate["reflection"])
        sent = json.loads(request.call_args.args[0].data)
        self.assertEqual(sent["model"], BRIDGE.OLLAMA_MODEL)
        self.assertFalse(sent["stream"])

        openai_response = FakeResponse({"output_text": json.dumps(candidate)})
        with patch.object(BRIDGE.urllib.request, "urlopen", return_value=openai_response) as request:
            openai = BRIDGE.generate_openai("A sufficiently long prompt")
        self.assertEqual(openai["question"], candidate["question"])
        self.assertEqual(request.call_args.args[0].method, "POST")

    def test_json_extraction_and_normalization_are_deterministic(self) -> None:
        raw = '```json\n{"reflection":" x ","question":"why","move":"go"}\n```'
        extracted = BRIDGE.extract_json(raw)
        normalized = BRIDGE.normalize_mirror(extracted)
        self.assertEqual(normalized["reflection"], "x")
        self.assertEqual(normalized["question"], "why?")
        self.assertEqual(normalized["move"], "go")
        self.assertIsNone(normalized["visual"])


if __name__ == "__main__":
    unittest.main()
