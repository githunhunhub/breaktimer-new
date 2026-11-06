import assert from "node:assert/strict";
import test from "node:test";

import {
  SHARD_COUNT,
  activeKeysForDay,
  globalKeys,
  isAllowedKey,
  keyDay,
  keyShard,
  newKeysForDay,
  versionKeysForDay,
} from "../edge-functions/_lib/keys.js";

test("all generated keys satisfy EdgeOne KV character restrictions", () => {
  const keys = [
    ...activeKeysForDay("2026-11-05"),
    ...newKeysForDay("2026-11-05"),
    ...versionKeysForDay("2026-11-05"),
    ...globalKeys(),
  ];
  assert.equal(SHARD_COUNT, 16);
  assert.equal(keys.length, 80);
  for (const key of keys) {
    assert.match(key, /^[A-Za-z0-9_]+$/, `${key} contains a forbidden character`);
    assert.equal(isAllowedKey(key), true);
  }
});

test("day keys encode a compact date and two-digit shard", () => {
  const key = "h_act_20261105_03";
  assert.equal(keyDay(key), "2026-11-05");
  assert.equal(keyShard(key), 3);
  assert.equal(keyDay("h_total_03"), null);
  assert.equal(keyShard("h_install_ver_15"), 15);
});

test("global keys keep total and install-version sketches per shard", () => {
  assert.equal(globalKeys().length, 32);
  assert.ok(globalKeys().includes("h_total_00"));
  assert.ok(globalKeys().includes("h_install_ver_15"));
});
