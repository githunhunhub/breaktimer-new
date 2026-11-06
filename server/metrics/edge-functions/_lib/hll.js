import { SHARD_COUNT } from "./keys.js";

// HyperLogLog sketches for approximate installation metrics (SPEC-0018).
//
// A SHA-256 fingerprint of installId is the only input. The KV values contain
// packed registers, never the installId or any reconstructable detail.

export const HLL_P = 14;
export const HLL_M = 1 << HLL_P;

const REGISTER_BITS = 5;
const REGISTERS_PER_GROUP = 8;
const BITS_PER_GROUP = REGISTER_BITS * REGISTERS_PER_GROUP;
const PACKED_BYTES = (HLL_M / REGISTERS_PER_GROUP) * (BITS_PER_GROUP / 8);
const PACKED_HEX_LENGTH = PACKED_BYTES * 2;
const ALPHA = 0.7213 / (1 + 1.079 / HLL_M);

/** Derives a stable shard and HLL register/rank from the anonymous ID. */
export async function fingerprint(installId) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(installId),
  );
  const view = new DataView(digest);
  const low = view.getUint32(24, false);
  const hllWord = view.getUint32(20, false);
  const index = hllWord & (HLL_M - 1);
  const remaining = hllWord >>> HLL_P;
  const rank = remaining === 0 ? 19 : Math.clz32(remaining) - 13;
  return {
    shard: low % SHARD_COUNT,
    hllWord,
    index,
    rank: Math.min(31, Math.max(1, rank)),
  };
}

export function installShard(fingerprintValue) {
  return fingerprintValue.shard;
}

export function createSketch() {
  return { p: HLL_P, registers: new Uint8Array(HLL_M) };
}

/**
 * Packs 5-bit registers into 5-byte groups (8 registers each).
 * The resulting hex string format is stable across EdgeOne and Node.js.
 */
export function encodeSketch(sketch) {
  if (sketch.p !== HLL_P || sketch.registers.length !== HLL_M) {
    throw new Error("invalid sketch");
  }
  const bytes = new Uint8Array(PACKED_BYTES);
  for (let start = 0; start < HLL_M; start += REGISTERS_PER_GROUP) {
    let accumulator = 0n;
    for (let offset = 0; offset < REGISTERS_PER_GROUP; offset += 1) {
      const value = BigInt(sketch.registers[start + offset] & 31);
      accumulator = (accumulator << 5n) | value;
    }
    const byteStart = (start / REGISTERS_PER_GROUP) * 5;
    for (let byte = 4; byte >= 0; byte -= 1) {
      bytes[byteStart + byte] = Number(accumulator & 0xffn);
      accumulator >>= 8n;
    }
  }
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

export function decodeSketch(hex) {
  if (typeof hex !== "string" || !/^[0-9a-f]+$/.test(hex) || hex.length !== PACKED_HEX_LENGTH) {
    throw new Error("invalid sketch");
  }
  const sketch = createSketch();
  const registerCount = HLL_M / REGISTERS_PER_GROUP;
  for (let group = 0; group < registerCount; group += 1) {
    let accumulator = 0n;
    const byteStart = group * 5;
    for (let byte = 0; byte < 5; byte += 1) {
      accumulator = (accumulator << 8n) | BigInt(parseInt(hex.slice((byteStart + byte) * 2, (byteStart + byte) * 2 + 2), 16));
    }
    for (let offset = REGISTERS_PER_GROUP - 1; offset >= 0; offset -= 1) {
      sketch.registers[group * REGISTERS_PER_GROUP + offset] = Number(accumulator & 31n);
      accumulator >>= 5n;
    }
  }
  return sketch;
}

export function serializeSketch(sketch) {
  return JSON.stringify({ p: HLL_P, data: encodeSketch(sketch) });
}

export function deserializeSketch(value) {
  if (value === null || value === undefined || value === "") return createSketch();
  let object = value;
  if (typeof value === "string") {
    try {
      object = JSON.parse(value);
    } catch {
      throw new Error("invalid sketch");
    }
  }
  if (!object || object.p !== HLL_P || typeof object.data !== "string") {
    throw new Error("invalid sketch");
  }
  return decodeSketch(object.data);
}

export function mergeInto(sketch, fingerprintValue) {
  const { index, rank } = fingerprintValue;
  if (rank > sketch.registers[index]) sketch.registers[index] = rank;
  return sketch;
}

export function mergeSketches(sketches) {
  const result = createSketch();
  for (const sketch of sketches) {
    if (!sketch || sketch.p !== HLL_P) continue;
    for (let index = 0; index < HLL_M; index += 1) {
      if (sketch.registers[index] > result.registers[index]) {
        result.registers[index] = sketch.registers[index];
      }
    }
  }
  return result;
}

/** Standard HLL estimate with small-range linear counting correction. */
export function cardinality(sketch) {
  let sum = 0;
  let zero = 0;
  for (const register of sketch.registers) {
    sum += 2 ** -register;
    if (register === 0) zero += 1;
  }
  const raw = (ALPHA * HLL_M * HLL_M) / sum;
  if (zero > 0) {
    const linear = HLL_M * Math.log(HLL_M / zero);
    return linear <= 2.5 * HLL_M ? Math.round(linear) : Math.round(raw);
  }
  return Math.round(raw);
}

export function serializeVersionMap(map) {
  const result = {};
  for (const [version, sketch] of Object.entries(map).sort(([a], [b]) => a.localeCompare(b))) {
    result[version] = serializeSketch(sketch);
  }
  return JSON.stringify(result);
}

export function deserializeVersionMap(value) {
  if (value === null || value === undefined || value === "") return {};
  let object = value;
  if (typeof value === "string") {
    try {
      object = JSON.parse(value);
    } catch {
      throw new Error("invalid version map");
    }
  }
  const result = {};
  for (const [version, sketchValue] of Object.entries(object || {})) {
    result[version] = deserializeSketch(sketchValue);
  }
  return result;
}

export function mergeVersionMaps(maps) {
  const versions = new Set();
  for (const map of maps) {
    for (const version of Object.keys(map || {})) versions.add(version);
  }
  const result = {};
  for (const version of [...versions].sort()) {
    result[version] = mergeSketches(maps.map((map) => map?.[version]).filter(Boolean));
  }
  return result;
}

export function versionCardinalities(map) {
  const result = {};
  for (const [version, sketch] of Object.entries(map).sort(([a], [b]) => a.localeCompare(b))) {
    result[version] = cardinality(sketch);
  }
  return result;
}
