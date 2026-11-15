import assert from "node:assert/strict";
import test from "node:test";

import { collectRequest } from "../edge-functions/_lib/collect.js";
import { publicReportRequest } from "../edge-functions/_lib/public-report.js";

const SERVER_DAY = "2026-11-05";
const ID_A = "6f1f0d6a-1f5c-4c19-9a4e-0d2b6a4f9c11";
const ID_B = "34a3e9cf-7701-4b8c-8c5d-5ed3f8154b4e";

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

function event(installId, overrides = {}) {
  return {
    schema: 1,
    event: "install",
    installId,
    day: SERVER_DAY,
    firstLaunchDay: SERVER_DAY,
    version: "0.1.2",
    os: "windows-11",
    arch: "x64",
    locale: "zh-CN",
    channel: "installer",
    ...overrides,
  };
}

async function seededKv() {
  const kv = new MemoryKv();
  const events = [
    event(ID_A, { day: "2026-11-01", firstLaunchDay: "2026-11-01", version: "0.1.1" }),
    event(ID_A, {
      event: "heartbeat",
      day: "2026-11-03",
      firstLaunchDay: undefined,
      version: "0.1.2",
    }),
    event(ID_B, { day: "2026-11-05", firstLaunchDay: "2026-11-05" }),
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
      { serverDay: payload.day, now: () => Date.parse(`${payload.day}T00:00:00Z`) },
    );
    assert.equal(response.status, 204);
  }
  return kv;
}

async function buildPublicReport(kv, query = "", options = {}) {
  const request = new Request(
    `https://metrics.example.com/api/public-report${query ? `?${query}` : ""}`,
    {
      method: options.method || "GET",
      headers: options.headers || {},
    },
  );
  const response = await publicReportRequest(
    {
      request,
      env: options.env || { METRICS_KV: kv },
    },
    { now: () => Date.parse(`${options.nowDay || SERVER_DAY}T12:00:00Z`) },
  );
  return { response, text: await response.text() };
}

test("defaults to a public 30-day daily report without authentication", async () => {
  const kv = await seededKv();
  const { response, text } = await buildPublicReport(kv, "", {
    headers: {
      authorization: "Bearer ignored-by-public-endpoint",
      cookie: "not-used=1",
    },
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.match(response.headers.get("cache-control"), /public/);
  assert.match(response.headers.get("cache-control"), /max-age=60/);
  assert.match(response.headers.get("cache-control"), /s-maxage=60/);
  assert.equal(response.headers.get("access-control-allow-origin"), null);

  const report = JSON.parse(text);
  assert.equal(report.approximate, true);
  assert.equal(report.method, "hll");
  assert.equal(report.consistency, "eventual_60s");
  assert.equal(report.range, "30d");
  assert.equal(report.granularity, "day");
  assert.equal(report.from, "2026-10-07");
  assert.equal(report.to, SERVER_DAY);
  assert.equal(report.generatedDay, SERVER_DAY);
  assert.deepEqual(report.metrics, ["M1", "M3", "M5", "M7", "M8"]);
  assert.deepEqual(report.summary, {
    active: 2,
    newInstalls: 2,
    versionsActive: { "0.1.1": 1, "0.1.2": 2 },
  });
});

test("range and granularity are fixed to the public allowlist", async () => {
  const kv = await seededKv();
  for (const query of [
    "range=7d&granularity=day",
    "range=90d&granularity=day",
    "range=30d&granularity=month",
  ]) {
    const { response, text } = await buildPublicReport(kv, query);
    assert.equal(response.status, 200, query);
    const report = JSON.parse(text);
    assert.equal(`range=${report.range}`, `range=${query.match(/range=([^&]+)/)[1]}`);
    assert.equal(
      `granularity=${report.granularity}`,
      `granularity=${query.match(/granularity=([^&]+)/)[1]}`,
    );
  }
});

test("parses query without URLSearchParams entry iteration", async () => {
  const originalIterator = URLSearchParams.prototype[Symbol.iterator];
  URLSearchParams.prototype[Symbol.iterator] = () => {
    throw new TypeError("entry iteration unavailable");
  };

  try {
    const { response, text } = await buildPublicReport(
      new MemoryKv(),
      "range=7d&granularity=day",
    );
    assert.equal(response.status, 200);
    const report = JSON.parse(text);
    assert.equal(report.range, "7d");
    assert.equal(report.granularity, "day");
    assert.equal(report.totalInstalls, 0);
    assert.equal(report.summary.active, 0);
  } finally {
    URLSearchParams.prototype[Symbol.iterator] = originalIterator;
  }
});

test("rejects methods and every unbounded or ambiguous query shape", async () => {
  const kv = await seededKv();
  for (const method of ["POST", "PUT", "DELETE", "OPTIONS", "HEAD"]) {
    const { response } = await buildPublicReport(kv, "", { method });
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.get("allow"), "GET");
    assert.equal(response.headers.get("cache-control"), "no-store");
  }

  for (const query of [
    "range=14d",
    "range=",
    "range=7d&range=30d",
    "granularity=week",
    "granularity=day&granularity=month",
    "from=2026-11-01&to=2026-11-05",
    "format=json",
    "format=csv",
    "unknown=1",
    "range=7d&unknown=",
  ]) {
    const { response, text } = await buildPublicReport(kv, query);
    assert.equal(response.status, 400, query);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(text, "invalid request");
  }
});

test("month rows merge daily HLLs and summary deduplicates across the range", async () => {
  const kv = await seededKv();
  const { response, text } = await buildPublicReport(
    kv,
    "range=30d&granularity=month",
  );
  assert.equal(response.status, 200);
  const report = JSON.parse(text);
  assert.deepEqual(report.metrics, ["M2", "M4", "M6", "M7", "M8"]);
  assert.deepEqual(report.summary, {
    active: 2,
    newInstalls: 2,
    versionsActive: { "0.1.1": 1, "0.1.2": 2 },
  });
  assert.equal(report.rows.length, 2);
  const november = report.rows.find((row) => row.month === "2026-11");
  assert.equal(november.active, 2);
  assert.equal(november.newInstalls, 2);
  assert.deepEqual(november.versionsActive, { "0.1.1": 1, "0.1.2": 2 });
});

test("public response is an aggregate-only whitelist", async () => {
  const kv = await seededKv();
  const { response, text } = await buildPublicReport(kv, "range=7d&granularity=day");
  assert.equal(response.status, 200);
  const report = JSON.parse(text);

  assert.deepEqual(Object.keys(report).sort(), [
    "approximate",
    "consistency",
    "from",
    "generatedDay",
    "granularity",
    "installsByVersion",
    "method",
    "metrics",
    "range",
    "rows",
    "summary",
    "to",
    "totalInstalls",
  ]);
  assert.deepEqual(Object.keys(report.summary).sort(), [
    "active",
    "newInstalls",
    "versionsActive",
  ]);
  for (const row of report.rows) {
    assert.deepEqual(Object.keys(row).sort(), [
      "active",
      "date",
      "newInstalls",
      "versionsActive",
    ]);
  }
  for (const banned of [
    "authorization",
    "bearer",
    "cookie",
    "installId",
    "clientIp",
    "requestHeaders",
    "rawEvents",
    "environment",
    "maintenanceToken",
  ]) {
    assert.equal(text.toLowerCase().includes(banned.toLowerCase()), false, banned);
  }
});

test("public report returns generic no-store errors when KV is unavailable", async () => {
  const missing = await buildPublicReport(null, "", { env: {} });
  assert.equal(missing.response.status, 503);
  assert.equal(missing.response.headers.get("cache-control"), "no-store");
  assert.equal(missing.text, "service unavailable");

  const brokenKv = {
    get: async () => {
      throw new Error("internal KV detail must not leak");
    },
  };
  const broken = await buildPublicReport(brokenKv);
  assert.equal(broken.response.status, 503);
  assert.equal(broken.response.headers.get("cache-control"), "no-store");
  assert.equal(broken.text, "service unavailable");
});

test("public source never reads authorization, cookies or request metadata", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../edge-functions/_lib/public-report.js", import.meta.url),
    "utf8",
  );
  for (const banned of [
    "authorization",
    "cookie",
    "clientIp",
    "request.eo",
    "console.log",
    "MAINTENANCE_TOKEN",
  ]) {
    assert.equal(source.toLowerCase().includes(banned.toLowerCase()), false, banned);
  }
});
