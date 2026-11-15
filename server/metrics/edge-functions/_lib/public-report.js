// Public, fixed-range aggregate report for the dashboard (SPEC-0022, ADR-0029).
//
// This route deliberately has no maintenance-token path and never exposes
// request metadata. It reuses the fixed-key HLL readers from the private report.

import {
  cardinality,
  mergeSketches,
  mergeVersionMaps,
  versionCardinalities,
} from "./hll.js";
import { activeKey, newKey, versionKey } from "./keys.js";
import {
  eachDay,
  monthsFor,
  readDimension,
  readGlobal,
} from "./report.js";
import { getKv, response, serverDayOf } from "./runtime.js";

const RANGE_DAYS = new Map([
  ["7d", 7],
  ["30d", 30],
  ["90d", 90],
]);
const GRANULARITIES = new Set(["day", "month"]);
const QUERY_FIELDS = new Set(["range", "granularity"]);
const PUBLIC_DAY_BATCH = 30;
const NO_STORE = { "Cache-Control": "no-store" };
const PUBLIC_CACHE = {
  "Cache-Control": "public, max-age=60, s-maxage=60",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

function addDays(day, offset) {
  const time = Date.parse(`${day}T00:00:00Z`) + offset * 86_400_000;
  return new Date(time).toISOString().slice(0, 10);
}

function validateQuery(url) {
  const seen = new Set();
  // EdgeOne supports keys()/get() but not entry iteration on URLSearchParams.
  for (const key of url.searchParams.keys()) {
    if (!QUERY_FIELDS.has(key) || seen.has(key) || url.searchParams.get(key) === "") {
      return { error: true };
    }
    seen.add(key);
  }

  const range = url.searchParams.get("range") || "30d";
  const granularity = url.searchParams.get("granularity") || "day";
  if (!RANGE_DAYS.has(range) || !GRANULARITIES.has(granularity)) {
    return { error: true };
  }
  return { range, granularity };
}

async function hasMetricKeys(kv) {
  if (typeof kv.list !== "function") return true;
  const result = await kv.list({ prefix: "h_", limit: 1 });
  if (!result || !Array.isArray(result.keys)) {
    throw new Error("invalid KV list response");
  }
  return result.keys.length > 0;
}

function buildRows(query, days, active, versions, newInstalls) {
  if (query.granularity === "day") {
    return days.map((day) => ({
      date: day,
      active: active.has(day) ? cardinality(active.get(day)) : 0,
      versionsActive: versionCardinalities(versions.get(day) || {}),
      newInstalls: newInstalls.has(day) ? cardinality(newInstalls.get(day)) : 0,
    }));
  }

  return [...monthsFor(days)].map(([month, monthDays]) => ({
    month,
    active: cardinality(mergeSketches(monthDays.map((day) => active.get(day)))),
    versionsActive: versionCardinalities(
      mergeVersionMaps(monthDays.map((day) => versions.get(day))),
    ),
    newInstalls: cardinality(
      mergeSketches(monthDays.map((day) => newInstalls.get(day))),
    ),
  }));
}

function jsonReport(query, days, active, versions, newInstalls, global) {
  const metrics =
    query.granularity === "day"
      ? ["M1", "M3", "M5", "M7", "M8"]
      : ["M2", "M4", "M6", "M7", "M8"];
  return JSON.stringify({
    approximate: true,
    method: "hll",
    consistency: "eventual_60s",
    range: query.range,
    granularity: query.granularity,
    from: query.from,
    to: query.to,
    generatedDay: query.generatedDay,
    metrics,
    summary: {
      active: cardinality(mergeSketches(days.map((day) => active.get(day)))),
      newInstalls: cardinality(
        mergeSketches(days.map((day) => newInstalls.get(day))),
      ),
      versionsActive: versionCardinalities(
        mergeVersionMaps(days.map((day) => versions.get(day))),
      ),
    },
    totalInstalls: global.totalInstalls,
    installsByVersion: global.installsByVersion,
    rows: buildRows(query, days, active, versions, newInstalls),
  });
}

/** Edge Function request handler for GET /api/public-report. */
export async function publicReportRequest(context, options = {}) {
  const request = context?.request;
  if (!request || request.method !== "GET") {
    return response(405, null, { ...NO_STORE, Allow: "GET" });
  }

  let query;
  try {
    query = validateQuery(new URL(request.url));
  } catch {
    return response(400, "invalid request", NO_STORE);
  }
  if (query.error) return response(400, "invalid request", NO_STORE);

  const kv = getKv(context);
  if (!kv) return response(503, "service unavailable", NO_STORE);

  const now = options.now || Date.now;
  const generatedDay = serverDayOf(now);
  const to = generatedDay;
  const from = addDays(to, -(RANGE_DAYS.get(query.range) - 1));
  query = { ...query, from, to, generatedDay };
  const days = eachDay(from, to);

  try {
    if (!(await hasMetricKeys(kv))) {
      return response(
        200,
        jsonReport(
          query,
          days,
          new Map(),
          new Map(),
          new Map(),
          { totalInstalls: 0, installsByVersion: {} },
        ),
        PUBLIC_CACHE,
      );
    }

    const [active, versions, newInstalls, global] = await Promise.all([
      readDimension(kv, activeKey, days, false, PUBLIC_DAY_BATCH),
      readDimension(kv, versionKey, days, true, PUBLIC_DAY_BATCH),
      readDimension(kv, newKey, days, false, PUBLIC_DAY_BATCH),
      readGlobal(kv),
    ]);
    return response(
      200,
      jsonReport(query, days, active, versions, newInstalls, global),
      PUBLIC_CACHE,
    );
  } catch {
    return response(503, "service unavailable", NO_STORE);
  }
}
