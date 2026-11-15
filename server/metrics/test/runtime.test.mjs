import assert from "node:assert/strict";
import test from "node:test";

import { getKv } from "../edge-functions/_lib/runtime.js";

function fakeKv() {
  return { get: async () => null, put: async () => {} };
}

test("resolves a console binding from the global variable", () => {
  const kv = fakeKv();
  globalThis.METRICS_KV = kv;
  try {
    assert.equal(getKv({ env: {} }), kv);
    assert.equal(getKv(), kv);
  } finally {
    delete globalThis.METRICS_KV;
  }
});

test("falls back to context.env for the in-memory test KV", () => {
  const kv = fakeKv();
  assert.equal(getKv({ env: { METRICS_KV: kv } }), kv);
});

test("returns null when no namespace is bound", () => {
  assert.equal(getKv({ env: {} }), null);
  assert.equal(getKv({ env: { METRICS_KV: {} } }), null);
});
