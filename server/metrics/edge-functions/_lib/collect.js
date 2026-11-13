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

/** Decodes UTF-8 even when the isolate builds without `TextDecoder`. */
function decodeUtf8(bytes) {
  if (typeof TextDecoder === "function") return new TextDecoder().decode(bytes);
  let text = "";
  for (let index = 0; index < bytes.length; index += 1) {
    text += String.fromCharCode(bytes[index]);
  }
  return text;
}

/** Normalises buffer-like bodies; `null` when the value is not byte shaped. */
function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return Uint8Array.from(value);
  if (value && typeof value === "object" && typeof value.length === "number") {
    const bytes = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      bytes[index] = Number(value[index]) || 0;
    }
    return bytes;
  }
  return null;
}

/** Reads a web `ReadableStream` body, aborting once `limit` bytes are seen. */
async function readStreamText(stream, limit) {
  const reader = stream.getReader();
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
  return decodeUtf8(bytes);
}

/**
 * Reads at most `limit` bytes of the request body as UTF-8 text; `null` when the
 * body is larger than `limit`.
 *
 * Edge Functions do not all expose the body the same way: web `Request`
 * instances provide a `ReadableStream`, some runtimes hand over an already
 * buffered string/Buffer, and others only offer `text()`/`json()`. Reading the
 * body as a stream whenever possible keeps the size cap independent of
 * `Content-Length`.
 */
async function readLimitedText(request, limit) {
  const body = request?.body;

  if (body && typeof body.getReader === "function") {
    return readStreamText(body, limit);
  }
  if (typeof body === "string") return body.length > limit ? null : body;

  const bytes = toBytes(body);
  if (bytes) return bytes.byteLength > limit ? null : decodeUtf8(bytes);

  // Already-parsed objects: nothing to consume, so re-serialise for validation.
  if (body && typeof body === "object") {
    const text = JSON.stringify(body);
    return text.length > limit ? null : text;
  }
  if (typeof request?.text === "function") {
    const text = await request.text();
    return text.length > limit ? null : text;
  }
  if (typeof request?.json === "function") {
    const text = JSON.stringify(await request.json());
    return text.length > limit ? null : text;
  }

  return "";
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
  } catch (error) {
    return response(400, `invalid JSON [diag ${error?.name}: ${error?.message}]`);
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
