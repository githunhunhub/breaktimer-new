// Anonymous installation metrics collection (SPEC-0018, ADR-0023).
//
// Privacy rules enforced here:
//   * only the documented allowlist fields are accepted;
//   * client IP, GEO data and request bodies are never read into logs;
//   * KV values contain HLL registers, never the plaintext installId.

import { validateEventWindow } from "./validate.js";
import {
  createSketch,
  deserializeSketch,
  deserializeVersionMap,
  fingerprint,
  mergeInto,
  serializeSketch,
  serializeVersionMap,
} from "./hll.js";
import {
  activeKey,
  installVersionKey,
  newKey,
  totalKey,
  versionKey,
} from "./keys.js";
import { envOf, getKv, NO_STORE, response, serverDayOf } from "./runtime.js";

export const MAX_BODY_BYTES = 2048;

/** Reads at most `limit` bytes without buffering an oversized request body. */
async function readLimitedText(request, limit) {
  if (!request.body) return request.text();

  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk =
        value instanceof Uint8Array ? value : Uint8Array.from(value);
      length += chunk.byteLength;
      if (length > limit) {
        try {
          await reader.cancel();
        } catch {
          // The response does not depend on whether the stream can be cancelled.
        }
        return null;
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function mergeSketchKey(kv, key, fingerprintValue) {
  const sketch = deserializeSketch(await kv.get(key));
  mergeInto(sketch, fingerprintValue);
  await kv.put(key, serializeSketch(sketch));
}

async function mergeVersionKey(kv, key, version, fingerprintValue) {
  const map = deserializeVersionMap(await kv.get(key));
  const sketch = map[version] || createSketch();
  mergeInto(sketch, fingerprintValue);
  map[version] = sketch;
  await kv.put(key, serializeVersionMap(map));
}

/** Pure-ish request handler; the Edge Function route only supplies context. */
export async function collectRequest(context, options = {}) {
  const request = context?.request;
  const env = envOf(context);
  const now = options.now || Date.now;

  if (request.method !== "POST") {
    return response(405, null, { ...NO_STORE, Allow: "POST" });
  }
  if (env.DISABLED === "1") return response(410);

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) return response(413);

  let payload;
  try {
    // Content-Length is client-controlled; cap the raw request stream too.
    const text = await readLimitedText(request, MAX_BODY_BYTES);
    if (text === null) return response(413);
    payload = JSON.parse(text);
  } catch {
    return response(400, "invalid JSON");
  }

  const serverDay = options.serverDay || serverDayOf(now);
  const invalid = validateEventWindow(payload, serverDay);
  if (invalid) return response(400, invalid);

  const kv = getKv(context);
  if (!kv) return response(500);

  const fp = await fingerprint(payload.installId);
  const shard = fp.shard;
  const day = payload.day;

  try {
    await mergeSketchKey(kv, activeKey(day, shard), fp);
    await mergeVersionKey(kv, versionKey(day, shard), payload.version, fp);

    if (payload.event === "install") {
      const firstDay = payload.firstLaunchDay;
      await mergeSketchKey(kv, newKey(firstDay, shard), fp);
      await mergeSketchKey(kv, totalKey(shard), fp);
      await mergeVersionKey(
        kv,
        installVersionKey(shard),
        payload.version,
        fp,
      );
    }
  } catch {
    return response(500);
  }

  return response(204);
}
