import assert from "node:assert/strict";
import test from "node:test";

import {
  SHARD_COUNT,
  activeKeysForDay,
  isAllowedKey,
  keyDay,
  keyShard,
  newChannelKey,
  newChannelKeysForDay,
  versionKeysForDay,
} from "../edge-functions/_lib/keys.js";

test("all generated keys satisfy EdgeOne KV character restrictions", () => {
  const keys = [
    ...activeKeysForDay("2026-11-05"),
    ...newChannelKeysForDay("2026-11-05"),
    ...versionKeysForDay("2026-11-05"),
  ];
  assert.equal(SHARD_COUNT, 16);
  assert.equal(keys.length, 48);
  for (const key of keys) {
    assert.match(key, /^[A-Za-z0-9_]+$/, `${key} contains a forbidden character`);
    assert.equal(isAllowedKey(key), true);
  }
});

test("day keys encode a compact date and two-digit shard", () => {
  const key = "h_act_20261105_03";
  assert.equal(keyDay(key), "2026-11-05");
  assert.equal(keyShard(key), 3);
  assert.equal(keyDay("h_newch_20261105_15"), "2026-11-05");
  assert.equal(keyDay("h_total_03"), null);
  assert.equal(newChannelKey("2026-11-05", 15), "h_newch_20261105_15");
});

test("V2 has only three daily dimensions and no global keys", () => {
  const keys = [
    ...activeKeysForDay("2026-11-05"),
    ...versionKeysForDay("2026-11-05"),
    ...newChannelKeysForDay("2026-11-05"),
  ];
  assert.equal(keys.some((key) => key.startsWith("h_total_")), false);
  assert.equal(keys.some((key) => key.startsWith("h_install_ver_")), false);
  assert.equal(keys.some((key) => /^h_new_/.test(key)), false);
});
