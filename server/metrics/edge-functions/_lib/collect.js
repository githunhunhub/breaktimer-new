// Anonymous installation metrics collection (SPEC-0018, ADR-0023).
//
// Privacy rules enforced here:
//   * only the documented allowlist fields are accepted;
//   * client IP, GEO data and request bodies are never read into logs;
//   * KV values contain HLL registers, never the plaintext installId.

import { validateEventWindow } from "./validate.js";
import {
  createSketch,
  deserializeDimensions,
  deserializeSketch,
  deserializeVersionMap,
  fingerprint,
  mergeInto,
  mergeDimensions,
  serializeDimensions,
  serializeSketch,
  serializeVersionMap,
} from "./hll.js";
import {
  activeKey,
  newChannelKey,
  versionKey,
} from "./keys.js";
import { elapsedMs, errorText, loggerOf, writeLog } from "./log.js";
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
 * `text()` is tried first because EdgeOne buffers the payload for it while
 * still exposing a `ReadableStream` in `body` that yields no bytes at all;
 * reading that stream returns an empty string and looks like an empty request.
 * Other runtimes only provide a stream, a buffered string/Buffer or `json()`,
 * so every documented shape stays supported.
 */
async function readLimitedText(request, limit) {
  if (typeof request?.text === "function") {
    const text = await request.text();
    if (typeof text !== "string") return null;
    return text.length > limit ? null : text;
  }

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

async function mergeDimensionsKey(kv, key, payload, fingerprintValue) {
  const dimensions = deserializeDimensions(await kv.get(key));
  const incoming = {
    versions: { [payload.version]: createSketch() },
    channels: { [payload.channel]: createSketch() },
    os: { [payload.os]: createSketch() },
  };
  mergeInto(incoming.versions[payload.version], fingerprintValue);
  mergeInto(incoming.channels[payload.channel], fingerprintValue);
  mergeInto(incoming.os[payload.os], fingerprintValue);
  await kv.put(key, serializeDimensions(mergeDimensions([dimensions, incoming])));
}

async function mergeGroupKey(kv, key, group, fingerprintValue) {
  const map = deserializeVersionMap(await kv.get(key));
  const sketch = map[group] || createSketch();
  mergeInto(sketch, fingerprintValue);
  map[group] = sketch;
  await kv.put(key, serializeVersionMap(map));
}

/** Pure-ish request handler; the Edge Function route only supplies context. */
export async function collectRequest(context, options = {}) {
  const request = context?.request;
  const env = envOf(context);
  const now = options.now || Date.now;
  const startedAt = now();
  const logger = loggerOf(options);
  const log = (fields) =>
    writeLog(
      {
        service: "metrics",
        event: "collect",
        durationMs: elapsedMs(startedAt, now),
        ...fields,
      },
      logger,
    );

  if (request.method !== "POST") {
    log({ outcome: "rejected", stage: "method", status: 405 });
    return response(405, null, { ...NO_STORE, Allow: "POST" });
  }
  if (env.DISABLED === "1") {
    log({ outcome: "rejected", stage: "disabled", status: 410 });
    return response(410);
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    log({ outcome: "rejected", stage: "body_limit", status: 413 });
    return response(413);
  }

  let text;
  try {
    // Content-Length is client-controlled; cap the raw request stream too.
    text = await readLimitedText(request, MAX_BODY_BYTES);
  } catch (error) {
    log({
      outcome: "error",
      stage: "body_read",
      status: 400,
      error: errorText(error),
    });
    return response(400, "invalid JSON");
  }
  if (text === null) {
    log({ outcome: "rejected", stage: "body_limit", status: 413 });
    return response(413);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    log({
      outcome: "rejected",
      stage: "json_parse",
      status: 400,
      error: errorText(error),
    });
    return response(400, "invalid JSON");
  }

  const serverDay = options.serverDay || serverDayOf(now);
  const invalid = validateEventWindow(payload, serverDay);
  if (invalid) {
    log({
      outcome: "rejected",
      stage: "validate",
      status: 400,
      error: invalid,
    });
    return response(400, invalid);
  }

  const kv = getKv(context);
  if (!kv) {
    log({ outcome: "error", stage: "kv_binding", status: 500 });
    return response(500);
  }

  let fp;
  try {
    fp = await fingerprint(payload.installId);
  } catch (error) {
    log({
      outcome: "error",
      stage: "fingerprint",
      status: 500,
      error: errorText(error),
    });
    return response(500);
  }
  const shard = fp.shard;
  const day = payload.day;
  let writeCount = 0;
  let writeTarget = "active";

  try {
    await mergeSketchKey(kv, activeKey(day, shard), fp);
    writeCount += 1;
    writeTarget = "dimensions";
    await mergeDimensionsKey(kv, versionKey(day, shard), payload, fp);
    writeCount += 1;

    if (payload.event === "install") {
      const firstDay = payload.firstLaunchDay;
      writeTarget = "new_channel";
      await mergeGroupKey(
        kv,
        newChannelKey(firstDay, shard),
        payload.channel,
        fp,
      );
      writeCount += 1;
    }
  } catch (error) {
    log({
      outcome: "error",
      stage: "kv_write",
      status: 500,
      writeTarget,
      writeCount,
      error: errorText(error),
    });
    return response(500);
  }

  log({
    outcome: "ok",
    stage: "complete",
    status: 204,
    eventType: payload.event,
    version: payload.version,
    day,
    ...(payload.event === "install"
      ? { firstLaunchDay: payload.firstLaunchDay }
      : {}),
    writeCount,
  });
  return response(204);
}
