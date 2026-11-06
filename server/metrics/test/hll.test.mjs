import assert from "node:assert/strict";
import test from "node:test";

import {
  HLL_P,
  cardinality,
  createSketch,
  decodeSketch,
  encodeSketch,
  fingerprint,
  installShard,
  mergeInto,
  mergeSketches,
} from "../edge-functions/_lib/hll.js";
import { SHARD_COUNT } from "../edge-functions/_lib/keys.js";

const ID_A = "6f1f0d6a-1f5c-4c19-9a4e-0d2b6a4f9c11";
const ID_B = "34a3e9cf-7701-4b8c-8c5d-5ed3f8154b4e";

test("HLL precision is 14 and register count is 16384", () => {
  assert.equal(HLL_P, 14);
  assert.equal(createSketch().registers.length, 16_384);
});

test("fingerprints and shards are deterministic and stable", async () => {
  const a = await fingerprint(ID_A);
  const again = await fingerprint(ID_A);
  assert.deepEqual(a, again);
  assert.equal(installShard(a), installShard(again));
  assert.ok(installShard(a) >= 0 && installShard(a) < 16);
  assert.equal(SHARD_COUNT, 16);
  assert.notEqual((await fingerprint(ID_B)).hllWord, a.hllWord);
});

test("a fingerprint has a valid register index and rank", async () => {
  const { index, rank } = await fingerprint(ID_A);
  assert.ok(index >= 0 && index < 16_384);
  assert.ok(rank >= 1 && rank <= 19);
});

test("encode/decode round trips a sparse sketch as 5-bit packed hex", () => {
  const sketch = createSketch();
  sketch.registers[0] = 31;
  sketch.registers[1] = 17;
  sketch.registers[16_383] = 8;
  const encoded = encodeSketch(sketch);
  assert.match(encoded, /^[0-9a-f]+$/);
  assert.equal(encoded.length, 20_480);
  assert.deepEqual(decodeSketch(encoded).registers, sketch.registers);
});

test("decode rejects malformed sketches", () => {
  assert.throws(() => decodeSketch("nope"), /invalid sketch/);
  assert.throws(() => decodeSketch("a".repeat(20_479)), /invalid sketch/);
});

test("adding the same install twice does not change the estimate", async () => {
  const sketch = createSketch();
  const a = await fingerprint(ID_A);
  mergeInto(sketch, a);
  const first = cardinality(sketch);
  mergeInto(sketch, a);
  assert.equal(cardinality(sketch), first);
});

test("merging disjoint sketches produces a union estimate", async () => {
  const left = createSketch();
  const right = createSketch();
  mergeInto(left, await fingerprint(ID_A));
  mergeInto(right, await fingerprint(ID_B));
  const union = mergeSketches([left, right]);
  assert.ok(cardinality(union) > cardinality(left));
  assert.equal(cardinality(mergeSketches([left, left])), cardinality(left));
});

test("estimates 1000 synthetic installs within HLL tolerance", async () => {
  const sketch = createSketch();
  for (let i = 0; i < 1000; i += 1) {
    mergeInto(sketch, await fingerprint(`synthetic-install-${i}`));
  }
  const estimate = cardinality(sketch);
  assert.ok(estimate >= 900 && estimate <= 1100, `estimate was ${estimate}`);
});
