// Anonymous client aggregate report (SPEC-0018, ADR-0023, ADR-0033).
//
// The private report reads fixed HLL keys only. It never lists arbitrary KV
// entries, never emits an installId and never reads IP/GEO request metadata.

import {
  cardinality,
  deserializeDimensions,
  deserializeSketch,
  deserializeVersionMap,
  mergeDimensions,
  mergeSketches,
  mergeVersionMaps,
  versionCardinalities,
  versionDimensionCardinalities,
} from "./hll.js";
import {
  activeKey,
  newChannelKey,
  versionKey,
  SHARD_COUNT,
} from "./keys.js";
import { elapsedMs, errorText, loggerOf, writeLog } from "./log.js";
import { dayDistance, isRealDay } from "./validate.js";
import { envOf, getKv, NO_STORE, response } from "./runtime.js";

const MAX_RANGE_DAYS = 366;
const DAY_BATCH = 7;

export function eachDay(from, to) {
  const result = [];
  const cursor = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let time = cursor; time <= end; time += 86_400_000) {
    result.push(new Date(time).toISOString().slice(0, 10));
  }
  return result;
}

async function readDay(kv, keyFactory, day) {
  return Promise.all(
    Array.from({ length: SHARD_COUNT }, (_, shard) =>
      kv.get(keyFactory(day, shard)),
    ),
  );
}

async function readDimension(kv, keyFactory, days, decoder, batchSize = DAY_BATCH) {
  const result = new Map();
  for (let start = 0; start < days.length; start += batchSize) {
    const batch = days.slice(start, start + batchSize);
    const fetched = await Promise.all(
      batch.map((day) => readDay(kv, keyFactory, day)),
    );
    batch.forEach((day, index) => {
      result.set(day, decoder(fetched[index]));
    });
  }
  return result;
}

function validateQuery(url, now) {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const granularity = url.searchParams.get("granularity") || "day";
  const format = url.searchParams.get("format") || "json";
  if (!isRealDay(from) || !isRealDay(to)) return { error: "invalid date" };
  if (granularity !== "day") return { error: "invalid granularity" };
  if (!["json", "csv"].includes(format)) return { error: "invalid format" };
  const distance = dayDistance(from, to);
  if (distance === null || distance < 0 || distance > MAX_RANGE_DAYS - 1) {
    return { error: "date range out of bounds" };
  }
  const serverDay = new Date(now()).toISOString().slice(0, 10);
  if (dayDistance(to, serverDay) < -1) return { error: "date range out of bounds" };
  return { from, to, granularity, format, serverDay };
}

function serializeGroups(map) {
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => `${name}:${count}`)
    .join("|");
}

function roundAverage(value) {
  return Math.round(value * 10) / 10;
}

function buildRows(days, active, versions, newChannels) {
  return days.map((day) => {
    const dimensions = versionDimensionCardinalities(
      versions.get(day) || { versions: {}, channels: {}, os: {} },
    );
    return {
      date: day,
      active: cardinality(active.get(day)),
      versionsActive: dimensions.versions,
      channelsActive: dimensions.channels,
      osActive: dimensions.os,
      newClientsByChannel: versionCardinalities(newChannels.get(day) || {}),
    };
  });
}

function buildSummary(days, active, newChannels) {
  const activeCounts = days.map((day) => cardinality(active.get(day)));
  const average =
    activeCounts.length === 0
      ? 0
      : activeCounts.reduce((sum, value) => sum + value, 0) /
        activeCounts.length;
  const newClientSketches = [];
  for (const channels of newChannels.values()) {
    for (const sketch of Object.values(channels)) newClientSketches.push(sketch);
  }
  return {
    activeAverage: roundAverage(average),
    activePeak: Math.max(0, ...activeCounts),
    newClients: cardinality(mergeSketches(newClientSketches)),
  };
}

function jsonReport(options, data) {
  return JSON.stringify({
    approximate: true,
    method: "hll",
    consistency: "eventual_60s",
    granularity: "day",
    from: options.from,
    to: options.to,
    generatedDay: options.serverDay,
    summary: data.summary,
    rows: data.rows,
  });
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvReport(data) {
  const columns = [
    "date",
    "active",
    "versions_active",
    "channels_active",
    "os_active",
    "new_clients_by_channel",
    "approximate",
    "method",
    "consistency",
  ];
  const lines = [columns.join(",")];
  for (const row of data.rows) {
    lines.push(
      [
        row.date,
        row.active,
        serializeGroups(row.versionsActive),
        serializeGroups(row.channelsActive),
        serializeGroups(row.osActive),
        serializeGroups(row.newClientsByChannel),
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

function reportLogFields(query, data) {
  return {
    from: query.from,
    to: query.to,
    granularity: "day",
    format: query.format,
    rowCount: data.rows.length,
    activeAverage: data.summary.activeAverage,
    activePeak: data.summary.activePeak,
    newClients: data.summary.newClients,
  };
}

/** Pure-ish request handler; the Edge Function route only supplies context. */
export async function reportRequest(context, options = {}) {
  const request = context?.request;
  const env = envOf(context);
  const now = options.now || Date.now;
  const startedAt = now();
  const logger = loggerOf(options);
  const log = (fields) =>
    writeLog(
      {
        service: "metrics",
        event: "report",
        durationMs: elapsedMs(startedAt, now),
        ...fields,
      },
      logger,
    );
  if (request.method !== "GET") {
    log({ outcome: "rejected", stage: "method", status: 405 });
    return response(405, null, { ...NO_STORE, Allow: "GET" });
  }
  const token = request.headers.get("authorization");
  const expectedToken = env.MAINTENANCE_TOKEN;
  if (!expectedToken) {
    log({ outcome: "error", stage: "auth_config", status: 503 });
    return response(503);
  }
  if (!token) {
    log({ outcome: "rejected", stage: "auth_missing", status: 401 });
    return response(401);
  }
  if (token !== `Bearer ${expectedToken}`) {
    log({ outcome: "rejected", stage: "auth_invalid", status: 403 });
    return response(403);
  }

  const query = validateQuery(new URL(request.url), now);
  if (query.error) {
    log({ outcome: "rejected", stage: "validate", status: 400 });
    return response(400, query.error);
  }

  const kv = getKv(context);
  if (!kv) {
    log({ outcome: "error", stage: "kv_binding", status: 500 });
    return response(500);
  }

  const days = eachDay(query.from, query.to);
  let active;
  let versions;
  let newChannels;
  try {
    [active, versions, newChannels] = await Promise.all([
      readDimension(kv, activeKey, days, (values) =>
        mergeSketches(values.map((value) => deserializeSketch(value))),
      ),
      readDimension(kv, versionKey, days, (values) =>
        mergeDimensions(values.map((value) => deserializeDimensions(value))),
      ),
      readDimension(kv, newChannelKey, days, (values) =>
        mergeVersionMaps(values.map((value) => deserializeVersionMap(value))),
      ),
    ]);
  } catch (error) {
    log({
      outcome: "error",
      stage: "kv_read",
      status: 500,
      error: errorText(error),
    });
    return response(500);
  }

  const data = {
    rows: buildRows(days, active, versions, newChannels),
    summary: buildSummary(days, active, newChannels),
  };
  log({
    outcome: "ok",
    stage: "complete",
    status: 200,
    ...reportLogFields(query, data),
  });

  if (query.format === "csv") {
    return response(200, csvReport(data), {
      ...NO_STORE,
      "Content-Type": "text/csv; charset=utf-8",
    });
  }
  return response(200, jsonReport(query, data), {
    ...NO_STORE,
    "Content-Type": "application/json; charset=utf-8",
  });
}
