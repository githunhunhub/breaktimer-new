// Single-line structured diagnostics for EdgeOne log analysis (SPEC-0018).

export const LOG_PREFIX = "breaktimer-metrics";

const MAX_LOG_TEXT = 320;
const SENSITIVE_KEYS = new Set([
  "authorization",
  "body",
  "cookie",
  "environment",
  "geo",
  "headers",
  "installid",
  "ip",
  "maintenancetoken",
  "maintenance_token",
  "payload",
  "rawevents",
  "request",
  "requestheaders",
  "token",
]);

/** Redacts common sensitive patterns and keeps a value safe for one log line. */
export function sanitizeLogText(value, maxLength = MAX_LOG_TEXT) {
  let text = String(value ?? "")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      "[redacted-uuid]",
    )
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[redacted-ip]")
    .replace(
      /\b(?:[0-9a-f]{1,4}:){2,7}:?[0-9a-f]{0,4}\b/gi,
      "[redacted-ip]",
    )
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [redacted-token]")
    .replace(
      /((?:access_token|maintenance_token|token)=)[^&\s]+/gi,
      "$1[redacted]",
    )
    .replace(/[\u0000-\u001f\u007f]+/g, " ");

  if (text.length > maxLength) text = text.slice(0, maxLength);
  return text;
}

function sanitizeLogValue(value) {
  if (typeof value === "string") return sanitizeLogText(value);
  if (Array.isArray(value)) return value.map(sanitizeLogValue);
  if (value && typeof value === "object") {
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
      result[key] = sanitizeLogValue(child);
    }
    return result;
  }
  return value;
}

/** Writes one prefixed JSON line; diagnostics must never break a request. */
export function writeLog(fields, sink) {
  try {
    const line = `${LOG_PREFIX} ${JSON.stringify(sanitizeLogValue(fields))}`;
    if (typeof sink === "function") sink(line);
    else console.log(line);
  } catch {
    // Observability is best effort and must not change the route response.
  }
}

export function loggerOf(options) {
  return typeof options?.logger === "function" ? options.logger : undefined;
}

export function errorText(error) {
  return sanitizeLogText(error?.message || error || "unknown error");
}

export function elapsedMs(startedAt, now = Date.now) {
  return Math.max(0, now() - startedAt);
}
