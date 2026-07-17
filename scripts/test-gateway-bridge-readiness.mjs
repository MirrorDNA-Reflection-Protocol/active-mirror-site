#!/usr/bin/env node
import assert from "node:assert/strict";

import { safeError, validateHealthPayload } from "./gateway-bridge-readiness.mjs";


assert.deepEqual(
  validateHealthPayload(
    { ok: true, service: "active-mirror-mini-bridge" },
    "active-mirror-mini-bridge",
    "test",
  ),
  { ok: true, service: "active-mirror-mini-bridge" },
);

assert.throws(
  () => validateHealthPayload(
    { ok: false, service: "active-mirror-mini-bridge" },
    "active-mirror-mini-bridge",
    "test",
  ),
  /ok was not true/,
);

assert.throws(
  () => validateHealthPayload(
    { ok: true, service: "wrong-service" },
    "active-mirror-mini-bridge",
    "test",
  ),
  /service was wrong-service/,
);

assert.equal(safeError(new Error("line one\n  line two")), "line one line two");
assert.equal(safeError(new Error("x".repeat(300))).length, 240);

console.log("gateway bridge readiness contract: PASS");
