// Public, fixed-range aggregate report for the dashboard (SPEC-0022, ADR-0029).
//
// This route deliberately has no maintenance-token path and never exposes
// request metadata. It lists the fixed metric prefixes and reads only the keys
// that exist in the requested range.

import {
  cardinality,
  deserializeSketch,
  deserializeVersionMap,
  mergeSketches,
  mergeVersionMaps,
  versionCardinalities,
} from "./hll.js";
import {
  activeKeysForDay,
  compactDay,
  installVersionKey,
  keyDay,
  newKeysForDay,
  SHARD_COUNT,
  totalKey,
  versionKeysForDay,
} from "./keys.js";
import { elapsedMs, errorText, loggerOf, writeLog } from "./log.js";
import { eachDay, monthsFor } from "./report.js";
import { getKv, response, serverDayOf } from "./runtime.js";

const RANGE_DAYS = new Map([
  ["7d", 7],
  ["30d", 30],
  ["90d", 90],
]);
const GRANULARITIES = new Set(["day", "month"]);
const QUERY_FIELDS = new Set(["range", "granularity"]);
const PUBLIC_KV_BATCH = 8;
const LIST_LIMIT = 256;
const PUBLIC_CACHE_NAME = "public-report-v1";
const PUBLIC_CACHE_TTL_MS = 60_000;
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

async function resolveCache(options, warn) {
  if (Object.prototype.hasOwnProperty.call(options, "cache")) {
    return options.cache || null;
  }
  const cacheStorage = globalThis.caches;
  if (!cacheStorage) return null;
  try {
    if (cacheStorage.default) return cacheStorage.default;
    if (typeof cacheStorage.open === "function") {
      return await cacheStorage.open(PUBLIC_CACHE_NAME);
    }
  } catch (error) {
    warn({ stage: "cache_open", status: 200, error: errorText(error) });
  }
  return null;
}

function cacheKeyFor(request, query) {
  const url = new URL(request.url);
  url.search = "";
  url.searchParams.set("range", query.range);
  url.searchParams.set("granularity", query.granularity);
  return new Request(url.toString(), { method: "GET" });
}

async function readCachedReport(cache, cacheKey, currentTime, warn) {
  if (!cache) return null;
  try {
    const cached = await cache.match(cacheKey);
    if (!cached) return null;
    const payload = JSON.parse(await cached.text());
    const age = currentTime - payload?.savedAt;
    if (
      !Number.isFinite(age) ||
      age < 0 ||
      age >= PUBLIC_CACHE_TTL_MS ||
      typeof payload?.body !== "string"
    ) {
      return null;
    }
    return payload.body;
  } catch (error) {
    warn({ stage: "cache_read", status: 200, error: errorText(error) });
    return null;
  }
}

async function writeCachedReport(cache, cacheKey, body, savedAt, warn) {
  if (!cache) return;
  try {
    await cache.put(
      cacheKey,
      new Response(JSON.stringify({ savedAt, body }), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }),
    );
  } catch (error) {
    warn({ stage: "cache_write", status: 200, error: errorText(error) });
  }
}

function queueCachedReport(context, cache, cacheKey, body, savedAt, warn) {
  const write = writeCachedReport(cache, cacheKey, body, savedAt, warn);
  if (typeof context?.waitUntil === "function") {
    try {
      context.waitUntil(write);
      return;
    } catch {
      // Fall back to awaiting the best-effort write when the host rejects it.
    }
  }
  return write;
}

function markKvStage(error, stage) {
  if (error && typeof error === "object" && !error.logStage) {
    try {
      error.logStage = stage;
    } catch {
      // Primitive or frozen errors still propagate without the stage tag.
    }
  }
  return error;
}

async function hasMetricKeys(kv, stats) {
  if (typeof kv.list !== "function") return true;
  stats.listPrefixCount += 1;
  stats.listPageCount += 1;
  let result;
  try {
    result = await kv.list({ prefix: "h_", limit: 1 });
  } catch (error) {
    throw markKvStage(error, "kv_list");
  }
  if (!result) throw new Error("invalid KV list response");
  if (Array.isArray(result.keys)) return result.keys.length > 0;
  // EdgeOne omits `keys` when the requested page contains no entries.
  if (result.complete === true) return false;
  throw new Error("invalid KV list response");
}

async function listKeys(kv, prefix, stats) {
  const keys = [];
  let cursor;
  stats.listPrefixCount += 1;

  while (true) {
    stats.listPageCount += 1;
    let result;
    try {
      result = await kv.list({
        prefix,
        limit: LIST_LIMIT,
        ...(cursor ? { cursor } : {}),
      });
    } catch (error) {
      throw markKvStage(error, "kv_list");
    }
    if (!result || typeof result.complete !== "boolean") {
      throw new Error("invalid KV list response");
    }
    if (result.keys === undefined) {
      if (result.complete) return keys;
      throw new Error("invalid KV list response");
    }
    if (!Array.isArray(result.keys)) {
      throw new Error("invalid KV list response");
    }

    keys.push(
      ...result.keys.map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry.key === "string") return entry.key;
        throw new Error("invalid KV list response");
      }),
    );

    if (result.complete) return keys;
    if (typeof result.cursor !== "string" || !result.cursor) {
      throw new Error("invalid KV list response");
    }
    if (result.cursor === cursor) {
      throw new Error("invalid KV list response");
    }
    cursor = result.cursor;
  }
}

async function mapInBatches(items, batchSize, callback) {
  const result = [];
  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize);
    result.push(...(await Promise.all(batch.map(callback))));
  }
  return result;
}

function shardedGlobalKeys(keyFactory) {
  return new Set(
    Array.from({ length: SHARD_COUNT }, (_, shard) => keyFactory(shard)),
  );
}

function listingsForDay(day) {
  const compact = compactDay(day);
  return [
    { prefix: `h_act_${compact}_`, expected: new Set(activeKeysForDay(day)) },
    { prefix: `h_new_${compact}_`, expected: new Set(newKeysForDay(day)) },
    { prefix: `h_ver_${compact}_`, expected: new Set(versionKeysForDay(day)) },
  ];
}

async function listExistingMetricKeys(kv, days, stats) {
  const listings = [
    ...days.flatMap(listingsForDay),
    { prefix: "h_total_", expected: shardedGlobalKeys(totalKey) },
    {
      prefix: "h_install_ver_",
      expected: shardedGlobalKeys(installVersionKey),
    },
  ];
  const listed = await mapInBatches(
    listings,
    PUBLIC_KV_BATCH,
    async ({ prefix, expected }) =>
      (await listKeys(kv, prefix, stats)).filter((key) => expected.has(key)),
  );
  const uniqueKeys = [...new Set(listed.flat())];
  stats.listedKeyCount += uniqueKeys.length;
  return uniqueKeys;
}

function addToMap(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function mergeDaySketches(valuesByDay) {
  return new Map(
    [...valuesByDay].map(([day, values]) => [
      day,
      mergeSketches(values.map((value) => deserializeSketch(value))),
    ]),
  );
}

function mergeDayVersions(valuesByDay) {
  return new Map(
    [...valuesByDay].map(([day, values]) => [
      day,
      mergeVersionMaps(values.map((value) => deserializeVersionMap(value))),
    ]),
  );
}

async function readExistingMetrics(kv, days, stats) {
  const keys = await listExistingMetricKeys(kv, days, stats);
  stats.readKeyCount += keys.length;
  let values;
  try {
    values = await mapInBatches(keys, PUBLIC_KV_BATCH, (key) => kv.get(key));
  } catch (error) {
    throw markKvStage(error, "kv_read");
  }
  const activeValues = new Map();
  const versionValues = new Map();
  const newInstallValues = new Map();
  const totalValues = [];
  const installVersionValues = [];

  keys.forEach((key, index) => {
    const value = values[index];
    if (key.startsWith("h_act_")) {
      addToMap(activeValues, keyDay(key), value);
    } else if (key.startsWith("h_ver_")) {
      addToMap(versionValues, keyDay(key), value);
    } else if (key.startsWith("h_new_")) {
      addToMap(newInstallValues, keyDay(key), value);
    } else if (key.startsWith("h_total_")) {
      totalValues.push(value);
    } else if (key.startsWith("h_install_ver_")) {
      installVersionValues.push(value);
    }
  });

  return {
    active: mergeDaySketches(activeValues),
    versions: mergeDayVersions(versionValues),
    newInstalls: mergeDaySketches(newInstallValues),
    global: {
      totalInstalls: totalValues.length
        ? cardinality(
            mergeSketches(totalValues.map((value) => deserializeSketch(value))),
          )
        : 0,
      installsByVersion: versionCardinalities(
        mergeVersionMaps(
          installVersionValues.map((value) => deserializeVersionMap(value)),
        ),
      ),
    },
  };
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

function reportLogFields(body) {
  try {
    const report = JSON.parse(body);
    return {
      from: report.from,
      to: report.to,
      range: report.range,
      granularity: report.granularity,
      format: "json",
      rowCount: Array.isArray(report.rows) ? report.rows.length : 0,
      summaryActive: report.summary?.active ?? 0,
      summaryNewInstalls: report.summary?.newInstalls ?? 0,
      totalInstalls: report.totalInstalls ?? 0,
      versionCount: Object.keys(report.installsByVersion || {}).length,
    };
  } catch {
    return {};
  }
}

/** Edge Function request handler for GET /api/public-report. */
export async function publicReportRequest(context, options = {}) {
  const request = context?.request;
  const now = options.now || Date.now;
  const startedAt = now();
  const logger = loggerOf(options);
  const log = (fields) =>
    writeLog(
      {
        service: "metrics",
        event: "public_report",
        durationMs: elapsedMs(startedAt, now),
        ...fields,
      },
      logger,
    );
  const warn = (fields) => log({ outcome: "warning", ...fields });
  const stats = {
    listPrefixCount: 0,
    listPageCount: 0,
    listedKeyCount: 0,
    readKeyCount: 0,
  };

  if (!request || request.method !== "GET") {
    log({
      outcome: "rejected",
      stage: "method",
      status: 405,
      method: request?.method || "unknown",
    });
    return response(405, null, { ...NO_STORE, Allow: "GET" });
  }

  let query;
  try {
    query = validateQuery(new URL(request.url));
  } catch {
    log({ outcome: "rejected", stage: "validate", status: 400 });
    return response(400, "invalid request", NO_STORE);
  }
  if (query.error) {
    log({ outcome: "rejected", stage: "validate", status: 400 });
    return response(400, "invalid request", NO_STORE);
  }

  const requestedAt = now();
  const cache = await resolveCache(options, warn);
  const cacheKey = cache ? cacheKeyFor(request, query) : null;
  const cachedBody = await readCachedReport(
    cache,
    cacheKey,
    requestedAt,
    warn,
  );
  const cacheState = cache ? (cachedBody !== null ? "hit" : "miss") : "bypass";
  if (cachedBody !== null) {
    log({
      outcome: "ok",
      stage: "complete",
      status: 200,
      cache: cacheState,
      emptyNamespace: null,
      ...stats,
      ...reportLogFields(cachedBody),
    });
    return response(200, cachedBody, PUBLIC_CACHE);
  }

  const kv = getKv(context);
  if (!kv) {
    log({
      outcome: "error",
      stage: "kv_binding",
      status: 503,
      cache: cacheState,
      emptyNamespace: null,
      ...stats,
    });
    return response(503, "service unavailable", NO_STORE);
  }

  const generatedDay = serverDayOf(() => requestedAt);
  const to = generatedDay;
  const from = addDays(to, -(RANGE_DAYS.get(query.range) - 1));
  query = { ...query, from, to, generatedDay };
  const days = eachDay(from, to);
  let emptyNamespace = null;

  try {
    let body;
    try {
      emptyNamespace = !(await hasMetricKeys(kv, stats));
    } catch (error) {
      throw markKvStage(error, "kv_list");
    }
    if (emptyNamespace) {
      body = jsonReport(
        query,
        days,
        new Map(),
        new Map(),
        new Map(),
        { totalInstalls: 0, installsByVersion: {} },
      );
    } else {
      const { active, versions, newInstalls, global } =
        await readExistingMetrics(kv, days, stats);
      body = jsonReport(
        query,
        days,
        active,
        versions,
        newInstalls,
        global,
      );
    }

    await queueCachedReport(
      context,
      cache,
      cacheKey,
      body,
      requestedAt,
      warn,
    );
    log({
      outcome: "ok",
      stage: "complete",
      status: 200,
      cache: cacheState,
      emptyNamespace,
      ...stats,
      ...reportLogFields(body),
    });
    return response(200, body, PUBLIC_CACHE);
  } catch (error) {
    log({
      outcome: "error",
      stage: error?.logStage || "kv_read",
      status: 503,
      cache: cacheState,
      emptyNamespace,
      ...stats,
      error: errorText(error),
    });
    return response(503, "service unavailable", NO_STORE);
  }
}
