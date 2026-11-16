import assert from "node:assert/strict";
import test from "node:test";

import { collectRequest } from "../edge-functions/_lib/collect.js";
import {
  HLL_P,
  createSketch,
  encodeSketch,
  fingerprint,
  mergeInto,
} from "../edge-functions/_lib/hll.js";
import {
  activeKeysForDay,
  globalKeys,
  newKeysForDay,
  versionKeysForDay,
} from "../edge-functions/_lib/keys.js";
import { reportRequest } from "../edge-functions/_lib/report.js";

const SERVER_DAY = "2026-11-05";
const TOKEN = "secret-token";
const LOG_PREFIX = "breaktimer-metrics";
const IDS = [
  "6f1f0d6a-1f5c-4c19-9a4e-0d2b6a4f9c11",
  "34a3e9cf-7701-4b8c-8c5d-5ed3f8154b4e",
  "aeb1f0a5-c3cf-4b54-8b52-4ca0e2e1fc30",
];

class MemoryKv {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values));
  }

  async get(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  async put(key, value) {
    this.values.set(key, value);
  }
}

function event(id, overrides = {}) {
  return {
    schema: 1,
    event: "install",
    installId: id,
    day: SERVER_DAY,
    firstLaunchDay: "2026-11-01",
    version: "0.1.1",
    os: "windows-11",
    arch: "x64",
    locale: "zh-CN",
    channel: "installer",
    ...overrides,
  };
}

function makeContext(kv, url, options = {}) {
  return {
    request: new Request(url, {
      headers: options.headers || {},
    }),
    env: {
      DISABLED: "0",
      MAINTENANCE_TOKEN: TOKEN,
      METRICS_KV: kv,
      ...options.env,
    },
  };
}

async function seededKv() {
  const kv = new MemoryKv();
  const events = [
    event(IDS[0]),
    event(IDS[1], { version: "0.1.2" }),
    event(IDS[2], { day: "2026-12-03", firstLaunchDay: "2026-12-01", version: "0.1.2" }),
    { ...event(IDS[0], { day: "2026-12-03" }), event: "heartbeat", firstLaunchDay: undefined },
  ];
  for (const payload of events) {
    if (payload.event === "heartbeat") delete payload.firstLaunchDay;
    const request = new Request("https://metrics.example.com/v1/collect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const response = await collectRequest(
      { request, env: { DISABLED: "0", METRICS_KV: kv } },
      {
        serverDay: payload.day,
        now: () => Date.parse(`${payload.day}T00:00:00Z`),
        logger: () => {},
      },
    );
    assert.equal(response.status, 204);
  }
  return kv;
}

async function addManualHistory(kv) {
  // A historical sketch outside the report range proves M7/M8 are global.
  const fingerprintValue = await fingerprint("older-install-id");
  const shard = String(fingerprintValue.shard).padStart(2, "0");
  const key = `h_total_${shard}`;
  const sketch = createSketch();
  mergeInto(sketch, fingerprintValue);
  kv.values.set(key, JSON.stringify({ p: HLL_P, data: encodeSketch(sketch) }));
}

async function buildReport(kv, params, options = {}) {
  const query = new URLSearchParams(params);
  const url = `https://metrics.example.com/api/report?${query}`;
  const response = await reportRequest(
    makeContext(kv, url, {
      headers: options.token === null ? {} : { authorization: `Bearer ${options.token || TOKEN}` },
      env: options.env,
    }),
    {
      now: () => Date.parse(`${options.nowDay || SERVER_DAY}T00:00:00Z`),
      logger: options.logger || (() => {}),
    },
  );
  return { response, text: await response.text() };
}

function parseLogs(lines) {
  return lines.map((line) => {
    assert.equal(line.startsWith(`${LOG_PREFIX} `), true);
    return JSON.parse(line.slice(LOG_PREFIX.length + 1));
  });
}

test("rejects missing or incorrect maintenance tokens", async () => {
  const kv = new MemoryKv();
  const params = {
    from: "2026-11-01",
    to: "2026-11-30",
    granularity: "day",
    format: "json",
  };
  assert.equal((await buildReport(kv, params, { token: null })).response.status, 401);
  assert.equal((await buildReport(kv, params, { token: "wrong" })).response.status, 403);
  assert.equal(
    (await buildReport(kv, params, { env: { MAINTENANCE_TOKEN: "" } })).response.status,
    503,
  );
});

test("rejects invalid dates, granularity, format and ranges", async () => {
  const kv = new MemoryKv();
  const base = { from: "2026-11-01", to: "2026-11-30", granularity: "day", format: "json" };
  for (const overrides of [
    { from: "2026-02-30" },
    { from: "2026-12-01" },
    { to: "2024-01-01" },
    { granularity: "week" },
    { format: "xml" },
  ]) {
    const { response } = await buildReport(kv, { ...base, ...overrides });
    assert.equal(response.status, 400, JSON.stringify(overrides));
  }
});

test("day report contains M1, M3, M5 and approximate metadata", async () => {
  const kv = await seededKv();
  const { response, text } = await buildReport(kv, {
    from: "2026-11-01",
    to: "2026-11-05",
    granularity: "day",
    format: "json",
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const report = JSON.parse(text);
  assert.equal(report.approximate, true);
  assert.equal(report.method, "hll");
  assert.equal(report.consistency, "eventual_60s");
  assert.equal(report.metrics.includes("M1"), true);
  assert.equal(report.metrics.includes("M3"), true);
  assert.equal(report.metrics.includes("M5"), true);
  assert.equal(report.metrics.includes("M7"), true);
  assert.equal(report.metrics.includes("M8"), true);
  const activeDay = report.rows.find((row) => row.date === "2026-11-05");
  assert.equal(activeDay.active, 2);
  assert.deepEqual(activeDay.versionsActive, { "0.1.1": 1, "0.1.2": 1 });
  const newDay = report.rows.find((row) => row.date === "2026-11-01");
  assert.equal(newDay.newInstalls, 2);
  assert.ok(report.totalInstalls >= 2);
  assert.equal(JSON.stringify(report).includes(IDS[0]), false);
  assert.equal(JSON.stringify(report).includes("installId"), false);
});

test("month report merges daily HLLs instead of summing daily active values", async () => {
  const kv = await seededKv();
  const { response, text } = await buildReport(kv, {
    from: "2026-01-01",
    to: "2026-12-31",
    granularity: "month",
    format: "json",
  }, { nowDay: "2027-01-01" });
  assert.equal(response.status, 200);
  const report = JSON.parse(text);
  assert.equal(report.metrics.includes("M2"), true);
  assert.equal(report.metrics.includes("M4"), true);
  assert.equal(report.metrics.includes("M6"), true);
  const november = report.rows.find((row) => row.month === "2026-11");
  assert.equal(november.active, 2);
  assert.equal(november.newInstalls, 2);
  const december = report.rows.find((row) => row.month === "2026-12");
  assert.equal(december.active, 2);
  assert.equal(december.newInstalls, 1);
});

test("CSV output exposes aggregate columns and no per-install rows", async () => {
  const kv = await seededKv();
  const { response, text } = await buildReport(kv, {
    from: "2026-11-01",
    to: "2026-11-05",
    granularity: "day",
    format: "csv",
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/csv/);
  const lines = text.trim().split("\r\n");
  assert.match(lines[0], /^date,/);
  assert.match(lines[0], /active/);
  assert.match(lines[0], /new_installs/);
  assert.match(lines[0], /versions_active/);
  assert.match(lines[0], /total_installs/);
  assert.match(lines[0], /installs_by_version/);
  assert.equal(text.includes(IDS[0]), false);
});

test("report reads only fixed keys and does not list arbitrary KV entries", async () => {
  const kv = await seededKv();
  await addManualHistory(kv);
  const readKeys = [];
  const originalGet = kv.get.bind(kv);
  kv.get = async (key) => {
    readKeys.push(key);
    return originalGet(key);
  };
  const { response } = await buildReport(kv, {
    from: "2026-11-01",
    to: "2026-11-05",
    granularity: "day",
    format: "json",
  });
  assert.equal(response.status, 200);
  const allowed = new Set(globalKeys());
  for (let day = 1; day <= 5; day += 1) {
    const date = `2026-11-0${day}`;
    for (const key of [
      ...activeKeysForDay(date),
      ...newKeysForDay(date),
      ...versionKeysForDay(date),
    ]) {
      allowed.add(key);
    }
  }
  assert.equal(readKeys.every((key) => allowed.has(key)), true);
  assert.equal(readKeys.length, 5 * 3 * 16 + 32);
  assert.equal(readKeys.some((key) => key.includes(IDS[0])), false);
});

test("logs successful report queries with aggregate counts and no credentials", async () => {
  const kv = await seededKv();
  const logs = [];
  const { response } = await buildReport(
    kv,
    {
      from: "2026-11-01",
      to: "2026-11-05",
      granularity: "day",
      format: "json",
    },
    { logger: (line) => logs.push(line) },
  );

  assert.equal(response.status, 200);
  assert.equal(logs.length, 1);
  const entry = parseLogs(logs)[0];
  assert.equal(entry.service, "metrics");
  assert.equal(entry.event, "report");
  assert.equal(entry.outcome, "ok");
  assert.equal(entry.stage, "complete");
  assert.equal(entry.status, 200);
  assert.equal(entry.from, "2026-11-01");
  assert.equal(entry.to, "2026-11-05");
  assert.equal(entry.granularity, "day");
  assert.equal(entry.format, "json");
  assert.equal(entry.rowCount, 5);
  assert.equal(entry.activeInstalls, 2);
  assert.equal(entry.newInstalls, 2);
  assert.equal(entry.totalInstalls, 3);
  assert.equal(entry.versionCount, 2);
  assert.equal(typeof entry.durationMs, "number");
  assert.equal(JSON.stringify(entry).includes(TOKEN), false);
  assert.equal(JSON.stringify(entry).includes("Bearer"), false);
});

test("logs authentication failures without maintenance credentials", async () => {
  const kv = new MemoryKv();
  const params = {
    from: "2026-11-01",
    to: "2026-11-30",
    granularity: "day",
    format: "json",
  };
  const logs = [];

  const missing = await buildReport(kv, params, {
    token: null,
    logger: (line) => logs.push(line),
  });
  const invalid = await buildReport(kv, params, {
    token: "wrong-secret",
    logger: (line) => logs.push(line),
  });

  assert.equal(missing.response.status, 401);
  assert.equal(invalid.response.status, 403);
  assert.equal(logs.length, 2);
  const [missingEntry, invalidEntry] = parseLogs(logs);
  assert.equal(missingEntry.stage, "auth_missing");
  assert.equal(missingEntry.status, 401);
  assert.equal(invalidEntry.stage, "auth_invalid");
  assert.equal(invalidEntry.status, 403);
  const output = JSON.stringify([missingEntry, invalidEntry]);
  assert.equal(output.includes(TOKEN), false);
  assert.equal(output.includes("wrong-secret"), false);
  assert.equal(output.includes("Bearer"), false);
  assert.equal(output.includes("authorization"), false);
});

test("logs KV read failures with a sanitized error and returns 500", async () => {
  const kv = new MemoryKv();
  kv.get = async () => {
    throw new Error(`KV unavailable for ${IDS[0]} from 203.0.113.9`);
  };
  const logs = [];

  const { response } = await buildReport(
    kv,
    {
      from: "2026-11-01",
      to: "2026-11-05",
      granularity: "day",
      format: "json",
    },
    { logger: (line) => logs.push(line) },
  );

  assert.equal(response.status, 500);
  assert.equal(logs.length, 1);
  const entry = parseLogs(logs)[0];
  assert.equal(entry.event, "report");
  assert.equal(entry.outcome, "error");
  assert.equal(entry.stage, "kv_read");
  assert.equal(entry.status, 500);
  assert.match(entry.error, /KV unavailable/);
  const output = JSON.stringify(entry);
  assert.equal(output.includes(IDS[0]), false);
  assert.equal(output.includes("203.0.113.9"), false);
});

test("report source does not read IP, geo or raw request bodies", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../edge-functions/_lib/report.js", import.meta.url),
    "utf8",
  );
  for (const banned of ["clientIp", "request.eo", ".list("]) {
    assert.equal(source.includes(banned), false, `report source contains ${banned}`);
  }
});
