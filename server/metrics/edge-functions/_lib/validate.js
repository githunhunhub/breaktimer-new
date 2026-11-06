// Strict allowlist validation for anonymous installation metrics (SPEC-0018).
//
// Unknown fields are rejected instead of ignored: a future client change must
// pass through a spec/privacy review before anything new can be stored.

export const ALLOWED_FIELDS = new Set([
  "schema",
  "event",
  "installId",
  "day",
  "firstLaunchDay",
  "version",
  "os",
  "arch",
  "locale",
  "channel",
]);

export const MAX_FIRST_LAUNCH_BACKLOG_DAYS = 730;

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const LOCALE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const OS = new Set(["windows-10", "windows-11", "windows", "macos", "linux"]);
const ARCH = new Set(["x64", "arm64", "x86"]);
const CHANNEL = new Set(["installer", "portable"]);
const EVENT = new Set(["install", "heartbeat"]);

export function isRealDay(value) {
  if (typeof value !== "string" || !DAY.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Days from `a` to `b`, both `YYYY-MM-DD`; `null` when either is invalid. */
export function dayDistance(a, b) {
  if (!isRealDay(a) || !isRealDay(b)) return null;
  const toUtc = (value) => Date.parse(`${value}T00:00:00Z`);
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/**
 * Client clocks and time zones legitimately differ from UTC, so event days
 * accept today plus or minus one day. The first-launch day has its own
 * offline-backlog rule in validateEventWindow().
 */
export function isRecentDay(day, serverDay) {
  const distance = dayDistance(day, serverDay);
  return distance !== null && distance >= -1 && distance <= 1;
}

/** Returns an error message, or `null` when the payload is acceptable. */
export function validateEvent(payload) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return "payload must be an object";
  }

  for (const key of Object.keys(payload)) {
    if (!ALLOWED_FIELDS.has(key)) return `unexpected field: ${key}`;
  }

  if (payload.schema !== 1) return "unsupported schema";
  if (!EVENT.has(payload.event)) return "invalid event";
  if (typeof payload.installId !== "string" || !UUID_V4.test(payload.installId)) {
    return "invalid installId";
  }
  if (!isRealDay(payload.day)) return "invalid day";
  if (payload.event === "install" && !isRealDay(payload.firstLaunchDay)) {
    return "invalid firstLaunchDay";
  }
  if (payload.event === "heartbeat" && payload.firstLaunchDay !== undefined) {
    return "unexpected firstLaunchDay";
  }
  if (typeof payload.version !== "string" || !VERSION.test(payload.version)) {
    return "invalid version";
  }
  if (!OS.has(payload.os)) return "invalid os";
  if (!ARCH.has(payload.arch)) return "invalid arch";
  if (typeof payload.locale !== "string" || !LOCALE.test(payload.locale)) {
    return "invalid locale";
  }
  if (!CHANNEL.has(payload.channel)) return "invalid channel";

  return null;
}

/** Applies the server-day acceptance window after shape validation. */
export function validateEventWindow(payload, serverDay) {
  const invalid = validateEvent(payload);
  if (invalid) return invalid;
  if (!isRecentDay(payload.day, serverDay)) return "day out of range";

  if (payload.event === "install") {
    const age = dayDistance(payload.firstLaunchDay, serverDay);
    const afterEvent = dayDistance(payload.firstLaunchDay, payload.day);
    if (
      age === null ||
      afterEvent === null ||
      age < 0 ||
      age > MAX_FIRST_LAUNCH_BACKLOG_DAYS ||
      afterEvent < 0
    ) {
      return "firstLaunchDay out of range";
    }
  }
  return null;
}
