// Anonymous aggregate report (SPEC-0018, ADR-0023).
//
// The report reads fixed HLL keys only. It never lists arbitrary KV entries,
// never emits an installId and never reads IP/GEO request metadata.

import {
  cardinality,
  mergeSketches,
  mergeVersionMaps,
  versionCardinalities,
  deserializeSketch,
  deserializeVersionMap,
} from "./hll.js";
import {
  activeKey,
  installVersionKey,
  newKey,
  totalKey,
  versionKey,
  SHARD_COUNT,
} from "./keys.js";
import { dayDistance, isRealDay } from "./validate.js";
import { envOf, getKv, NO_STORE, response } from "./runtime.js";

const MAX_RANGE_DAYS = 366;

function eachDay(from, to) {
  const result = [];
  const cursor = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let time = cursor; time <= end; time += 86_400_000) {
    result.push(new Date(time).toISOString().slice(0, 10));
  }
  return result;
}

function monthsFor(days) {
  const result = new Map();
  for (const day of days) {
    const month = day.slice(0, 7);
    if (!result.has(month)) result.set(month, []);
    result.get(month).push(day);
  }
  return result;
}

async function readSketch(kv, key) {
  return deserializeSketch(await kv.get(key));
}

async function readDimension(kv, keyFactory, days, versioned = false) {
  const result = new Map();
  for (const day of days) {
    const values = [];
    for (let shard = 0; shard < SHARD_COUNT; shard += 1) {
      const value = await kv.get(keyFactory(day, shard));
      values.push(versioned ? deserializeVersionMap(value) : deserializeSketch(value));
    }
    result.set(day, versioned ? mergeVersionMaps(values) : mergeSketches(values));
  }
  return result;
}

async function readGlobal(kv) {
  const totals = [];
  const versionMaps = [];
  for (let shard = 0; shard < SHARD_COUNT; shard += 1) {
    totals.push(await readSketch(kv, totalKey(shard)));
    versionMaps.push(deserializeVersionMap(await kv.get(installVersionKey(shard))));
  }
  return {
    totalInstalls: cardinality(mergeSketches(totals)),
    installsByVersion: versionCardinalities(mergeVersionMaps(versionMaps)),
  };
}

function validateQuery(url, now) {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const granularity = url.searchParams.get("granularity") || "day";
  const format = url.searchParams.get("format") || "json";
  if (!isRealDay(from) || !isRealDay(to)) return { error: "invalid date" };
  if (!["day", "month"].includes(granularity)) return { error: "invalid granularity" };
  if (!["json", "csv"].includes(format)) return { error: "invalid format" };
  const distance = dayDistance(from, to);
  if (distance === null || distance < 0 || distance > MAX_RANGE_DAYS - 1) {
    return { error: "date range out of bounds" };
  }
  const serverDay = new Date(now()).toISOString().slice(0, 10);
  if (dayDistance(to, serverDay) < -1) return { error: "date range out of bounds" };
  return { from, to, granularity, format, serverDay };
}

function serializeVersions(map) {
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([version, count]) => `${version}:${count}`)
    .join("|");
}

function jsonReport(options, data) {
  const metrics =
    options.granularity === "day"
      ? ["M1", "M3", "M5", "M7", "M8"]
      : ["M2", "M4", "M6", "M7", "M8"];
  const rows = [];
  for (const period of data.periods) {
    const row =
      options.granularity === "day"
        ? {
            date: period.label,
            active: cardinality(period.active),
            versionsActive: versionCardinalities(period.versions),
            newInstalls: cardinality(period.newInstalls),
          }
        : {
            month: period.label,
            active: cardinality(period.active),
            versionsActive: versionCardinalities(period.versions),
            newInstalls: cardinality(period.newInstalls),
          };
    rows.push(row);
  }
  return JSON.stringify({
    approximate: true,
    method: "hll",
    consistency: "eventual_60s",
    granularity: options.granularity,
    from: options.from,
    to: options.to,
    generatedDay: options.serverDay,
    metrics,
    totalInstalls: data.totalInstalls,
    installsByVersion: data.installsByVersion,
    rows,
  });
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvReport(options, data) {
  const columns = [
    options.granularity === "day" ? "date" : "month",
    "active",
    "new_installs",
    "versions_active",
    "total_installs",
    "installs_by_version",
    "approximate",
    "method",
    "consistency",
  ];
  const lines = [columns.join(",")];
  for (const period of data.periods) {
    lines.push(
      [
        period.label,
        cardinality(period.active),
        cardinality(period.newInstalls),
        serializeVersions(versionCardinalities(period.versions)),
        data.totalInstalls,
        serializeVersions(data.installsByVersion),
        "true",
        "hll",
        "eventual_60s",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** Pure-ish request handler; the Edge Function route only supplies context. */
export async function reportRequest(context, options = {}) {
  const request = context?.request;
  const env = envOf(context);
  const now = options.now || Date.now;
  if (request.method !== "GET") {
    return response(405, null, { ...NO_STORE, Allow: "GET" });
  }
  const token = request.headers.get("authorization");
  const expectedToken = env.MAINTENANCE_TOKEN;
  if (!expectedToken) return response(503);
  if (!token) return response(401);
  if (token !== `Bearer ${expectedToken}`) return response(403);

  const query = validateQuery(new URL(request.url), now);
  if (query.error) return response(400, query.error);

  const kv = getKv(context);
  if (!kv) return response(500);

  const days = eachDay(query.from, query.to);
  const [active, versions, newInstalls, global] = await Promise.all([
    readDimension(kv, activeKey, days),
    readDimension(kv, versionKey, days, true),
    readDimension(kv, newKey, days),
    readGlobal(kv),
  ]);

  let periods;
  if (query.granularity === "day") {
    periods = days.map((day) => ({
      label: day,
      active: active.get(day),
      versions: versions.get(day),
      newInstalls: newInstalls.get(day),
    }));
  } else {
    periods = [...monthsFor(days)].map(([month, monthDays]) => ({
      label: month,
      active: mergeSketches(monthDays.map((day) => active.get(day))),
      versions: mergeVersionMaps(monthDays.map((day) => versions.get(day))),
      newInstalls: mergeSketches(monthDays.map((day) => newInstalls.get(day))),
    }));
  }
  const data = { periods, ...global };

  if (query.format === "csv") {
    return response(200, csvReport(query, data), {
      ...NO_STORE,
      "Content-Type": "text/csv; charset=utf-8",
    });
  }
  return response(200, jsonReport(query, data), {
    ...NO_STORE,
    "Content-Type": "application/json; charset=utf-8",
  });
}
