import assert from "node:assert/strict";
import test from "node:test";

import { collectRequest } from "../edge-functions/_lib/collect.js";
import {
  createSketch,
  fingerprint,
  mergeInto,
  serializeDimensions,
  serializeSketch,
} from "../edge-functions/_lib/hll.js";
import {
  activeKeysForDay,
  newChannelKeysForDay,
  versionKeysForDay,
} from "../edge-functions/_lib/keys.js";
import { reportRequest } from "../edge-functions/_lib/report.js";

const SERVER_DAY = "2026-11-05";
const TOKEN = "secret-token";
const LOG_PREFIX = "breaktimer-metrics";
const ID_A = "6f1f0d6a-1f5c-4c19-9a4e-0d2b6a4f9c11";
const ID_B = "34a3e9cf-7701-4b8c-8c5d-5ed3f8154b4e";
const ID_C = "aeb1f0a5-c3cf-4b54-8b52-4ca0e2e1fc30";

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
    version: "0.1.2",
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

async function seed(kv, payload) {
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

async function seededKv() {
  const kv = new MemoryKv();
  const events = [
    event(ID_A, {
      day: "2026-11-01",
      firstLaunchDay: "2026-11-01",
      version: "0.1.1",
      os: "windows-11",
      channel: "installer",
    }),
    event(ID_B, {
      day: "2026-11-01",
      firstLaunchDay: "2026-11-01",
      version: "0.1.2",
      os: "windows-10",
      channel: "portable",
    }),
    event(ID_A, {
      event: "heartbeat",
      day: "2026-11-03",
      version: "0.1.2",
      os: "windows-11",
      channel: "installer",
    }),
    event(ID_C, {
      day: "2026-11-05",
      firstLaunchDay: "2026-11-05",
      version: "0.1.2",
      os: "windows-11",
      channel: "installer",
    }),
    event(ID_C, {
      event: "heartbeat",
      day: "2026-11-05",
      version: "0.1.2",
      os: "windows-11",
      channel: "installer",
    }),
  ];
  for (const payload of events) await seed(kv, payload);
  return kv;
}

async function buildReport(kv, params, options = {}) {
  const query = new URLSearchParams(params);
  const url = `https://metrics.example.com/api/report?${query}`;
  const response = await reportRequest(
    makeContext(kv, url, {
      headers:
        options.token === null
          ? {}
          : { authorization: `Bearer ${options.token || TOKEN}` },
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
    format: "json",
  };
  assert.equal((await buildReport(kv, params, { token: null })).response.status, 401);
  assert.equal((await buildReport(kv, params, { token: "wrong" })).response.status, 403);
  assert.equal(
    (await buildReport(kv, params, { env: { MAINTENANCE_TOKEN: "" } })).response.status,
    503,
  );
});

test("rejects invalid dates, month granularity, format and ranges", async () => {
  const kv = new MemoryKv();
  const base = { from: "2026-11-01", to: "2026-11-30", format: "json" };
  for (const overrides of [
    { from: "2026-02-30" },
    { from: "2026-12-01" },
    { to: "2024-01-01" },
    { granularity: "month" },
    { granularity: "week" },
    { format: "xml" },
  ]) {
    const { response } = await buildReport(kv, { ...base, ...overrides });
    assert.equal(response.status, 400, JSON.stringify(overrides));
  }
});

test("daily report returns V2 client metrics and fixed metadata", async () => {
  const kv = await seededKv();
  const { response, text } = await buildReport(kv, {
    from: "2026-11-01",
    to: "2026-11-05",
    format: "json",
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const report = JSON.parse(text);
  assert.equal(report.approximate, true);
  assert.equal(report.method, "hll");
  assert.equal(report.consistency, "eventual_60s");
  assert.equal(report.granularity, "day");
  assert.deepEqual(report.summary, {
    activeAverage: 0.8,
    activePeak: 2,
    newClients: 3,
  });

  const first = report.rows.find((row) => row.date === "2026-11-01");
  assert.deepEqual(first, {
    date: "2026-11-01",
    active: 2,
    versionsActive: { "0.1.1": 1, "0.1.2": 1 },
    channelsActive: { installer: 1, portable: 1 },
    osActive: { "windows-10": 1, "windows-11": 1 },
    newClientsByChannel: { installer: 1, portable: 1 },
  });
  const fifth = report.rows.find((row) => row.date === "2026-11-05");
  assert.deepEqual(fifth, {
    date: "2026-11-05",
    active: 1,
    versionsActive: { "0.1.2": 1 },
    channelsActive: { installer: 1 },
    osActive: { "windows-11": 1 },
    newClientsByChannel: { installer: 1 },
  });
  assert.equal(JSON.stringify(report).includes(ID_A), false);
  assert.equal(JSON.stringify(report).includes("installId"), false);
});

test("legacy bare version maps remain readable and missing dimensions stay empty", async () => {
  const kv = new MemoryKv();
  const fp = await fingerprint("legacy-version-only");
  const shard = String(fp.shard).padStart(2, "0");
  const sketch = createSketch();
  mergeInto(sketch, fp);
  kv.values.set(
    `h_ver_20261104_${shard}`,
    JSON.stringify({ "0.0.9": JSON.parse(serializeSketch(sketch)) }),
  );

  const { response, text } = await buildReport(kv, {
    from: "2026-11-04",
    to: "2026-11-04",
    format: "json",
  });
  assert.equal(response.status, 200);
  const report = JSON.parse(text);
  assert.deepEqual(report.rows[0], {
    date: "2026-11-04",
    active: 0,
    versionsActive: { "0.0.9": 1 },
    channelsActive: {},
    osActive: {},
    newClientsByChannel: {},
  });
});

test("CSV output exposes V2 aggregate columns and no per-client rows", async () => {
  const kv = await seededKv();
  const { response, text } = await buildReport(kv, {
    from: "2026-11-01",
    to: "2026-11-05",
    format: "csv",
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/csv/);
  const lines = text.trim().split("\r\n");
  assert.equal(
    lines[0],
    "date,active,versions_active,channels_active,os_active,new_clients_by_channel,approximate,method,consistency",
  );
  assert.match(lines[1], /^2026-11-01,2,/);
  assert.equal(text.includes(ID_A), false);
  assert.equal(text.includes("total_installs"), false);
});

test("private report blind-reads exactly 3 dimensions × 16 shards per day", async () => {
  const kv = await seededKv();
  const readKeys = [];
  const originalGet = kv.get.bind(kv);
  kv.get = async (key) => {
    readKeys.push(key);
    return originalGet(key);
  };
  const { response } = await buildReport(kv, {
    from: "2026-11-01",
    to: "2026-11-05",
    format: "json",
  });
  assert.equal(response.status, 200);

  const allowed = new Set();
  for (let day = 1; day <= 5; day += 1) {
    const date = `2026-11-0${day}`;
    for (const key of [
      ...activeKeysForDay(date),
      ...versionKeysForDay(date),
      ...newChannelKeysForDay(date),
    ]) {
      allowed.add(key);
    }
  }
  assert.equal(readKeys.length, 5 * 3 * 16);
  assert.equal(readKeys.every((key) => allowed.has(key)), true);
  assert.equal(readKeys.some((key) => key.startsWith("h_total_")), false);
  assert.equal(readKeys.some((key) => key.startsWith("h_install_ver_")), false);
  assert.equal(readKeys.some((key) => /^h_new_/.test(key)), false);
});

test("logs successful report queries with V2 aggregate counts and no credentials", async () => {
  const kv = await seededKv();
  const logs = [];
  const { response } = await buildReport(
    kv,
    {
      from: "2026-11-01",
      to: "2026-11-05",
      format: "json",
    },
    { logger: (line) => logs.push(line) },
  );

  assert.equal(response.status, 200);
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
  assert.equal(entry.activeAverage, 0.8);
  assert.equal(entry.activePeak, 2);
  assert.equal(entry.newClients, 3);
  assert.equal(typeof entry.durationMs, "number");
  assert.equal(JSON.stringify(entry).includes(TOKEN), false);
  assert.equal(JSON.stringify(entry).includes("Bearer"), false);
});

test("logs authentication failures without maintenance credentials", async () => {
  const kv = new MemoryKv();
  const params = {
    from: "2026-11-01",
    to: "2026-11-30",
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
  const [missingEntry, invalidEntry] = parseLogs(logs);
  assert.equal(missingEntry.stage, "auth_missing");
  assert.equal(invalidEntry.stage, "auth_invalid");
  const output = JSON.stringify([missingEntry, invalidEntry]);
  assert.equal(output.includes(TOKEN), false);
  assert.equal(output.includes("wrong-secret"), false);
  assert.equal(output.includes("Bearer"), false);
  assert.equal(output.includes("authorization"), false);
});

test("logs KV failures with sanitized values and returns 500", async () => {
  const kv = new MemoryKv();
  kv.get = async () => {
    throw new Error(`KV unavailable for ${ID_A} from 203.0.113.9`);
  };
  const logs = [];
  const { response } = await buildReport(
    kv,
    {
      from: "2026-11-01",
      to: "2026-11-05",
      format: "json",
    },
    { logger: (line) => logs.push(line) },
  );

  assert.equal(response.status, 500);
  const entry = parseLogs(logs)[0];
  assert.equal(entry.outcome, "error");
  assert.equal(entry.stage, "kv_read");
  assert.equal(entry.status, 500);
  assert.match(entry.error, /KV unavailable/);
  assert.equal(JSON.stringify(entry).includes(ID_A), false);
  assert.equal(JSON.stringify(entry).includes("203.0.113.9"), false);
});

test("report source does not list keys or read request metadata", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../edge-functions/_lib/report.js", import.meta.url),
    "utf8",
  );
  for (const banned of [
    "clientIp",
    "request.eo",
    ".list(",
    "h_total_",
    "h_install_ver_",
  ]) {
    assert.equal(source.includes(banned), false, `report source contains ${banned}`);
  }
});

test("report aggregates channel estimates only through the serialized dimensions helper", async () => {
  const kv = await seededKv();
  const { text } = await buildReport(kv, {
    from: "2026-11-01",
    to: "2026-11-01",
    format: "json",
  });
  const row = JSON.parse(text).rows[0];
  assert.deepEqual(row.channelsActive, { installer: 1, portable: 1 });
  assert.equal(JSON.stringify(row).includes("sketch"), false);
});

test("serialized legacy dimensions fixture remains valid JSON", async () => {
  const sketch = createSketch();
  mergeInto(sketch, await fingerprint("fixture"));
  const encoded = serializeDimensions({
    versions: { "0.1.0": sketch },
    channels: {},
    os: {},
  });
  assert.equal(typeof JSON.parse(encoded).versions["0.1.0"], "string");
});
