import assert from "node:assert/strict";
import test from "node:test";

import { collectRequest } from "../edge-functions/_lib/collect.js";
import {
  fingerprint,
  createSketch,
  mergeInto,
} from "../edge-functions/_lib/hll.js";
import { publicReportRequest } from "../edge-functions/_lib/public-report.js";

const SERVER_DAY = "2026-11-05";
const ID_A = "6f1f0d6a-1f5c-4c19-9a4e-0d2b6a4f9c11";
const ID_B = "34a3e9cf-7701-4b8c-8c5d-5ed3f8154b4e";
const ID_C = "aeb1f0a5-c3cf-4b54-8b52-4ca0e2e1fc30";
const LOG_PREFIX = "breaktimer-metrics";

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

  async list({ prefix = "", limit = 256, cursor } = {}) {
    const all = [...this.values.keys()]
      .filter((key) => key.startsWith(prefix))
      .sort();
    const start = cursor ? Number(cursor) : 0;
    const page = all.slice(start, start + limit);
    const complete = start + limit >= all.length;
    return {
      complete,
      cursor: complete ? "" : String(start + limit),
      keys: page.map((key) => ({ key })),
    };
  }
}

class MemoryCache {
  constructor() {
    this.entries = new Map();
  }

  async match(request) {
    const response = this.entries.get(request.url);
    return response ? response.clone() : undefined;
  }

  async put(request, response) {
    this.entries.set(request.url, response.clone());
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
      channel: "installer",
    }),
    event(ID_A, {
      day: "2026-11-02",
      firstLaunchDay: "2026-11-01",
      version: "0.1.2",
      channel: "portable",
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
      channel: "portable",
    }),
    event(ID_C, {
      day: "2026-11-05",
      firstLaunchDay: "2026-11-05",
      version: "0.1.2",
      channel: "installer",
    }),
    event(ID_C, {
      event: "heartbeat",
      day: "2026-11-05",
      version: "0.1.2",
      channel: "installer",
    }),
  ];
  for (const payload of events) await seed(kv, payload);
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
  const handlerOptions = {
    now: () =>
      options.nowMs ??
      Date.parse(`${options.nowDay || SERVER_DAY}T12:00:00Z`),
    logger: options.logger || (() => {}),
  };
  if (Object.prototype.hasOwnProperty.call(options, "cache")) {
    handlerOptions.cache = options.cache;
  }
  const response = await publicReportRequest(
    {
      request,
      env: options.env || { METRICS_KV: kv },
      waitUntil: options.waitUntil,
    },
    handlerOptions,
  );
  return { response, text: await response.text() };
}

function parseLogs(lines) {
  return lines.map((line) => {
    assert.equal(line.startsWith(`${LOG_PREFIX} `), true);
    return JSON.parse(line.slice(LOG_PREFIX.length + 1));
  });
}

function actualV2Keys(kv) {
  return [...kv.values.keys()]
    .filter((key) => /^h_(?:act|ver|newch)_\d{8}_\d{2}$/.test(key))
    .sort();
}

test("defaults to a public 30-day V2 daily report without authentication", async () => {
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
  assert.deepEqual(report.summary, {
    activeAverage: 0.2,
    activePeak: 2,
    newClients: 3,
  });
  assert.equal(report.rows.length, 30);
  assert.equal("metrics" in report, false);
  assert.equal("totalInstalls" in report, false);
  assert.equal("installsByVersion" in report, false);
});

test("range is fixed to 7/30/90 days and month granularity is rejected", async () => {
  const kv = await seededKv();
  for (const range of ["7d", "30d", "90d"]) {
    const { response, text } = await buildPublicReport(kv, `range=${range}`);
    assert.equal(response.status, 200, range);
    const report = JSON.parse(text);
    assert.equal(report.range, range);
    assert.equal(report.granularity, "day");
  }
  for (const query of [
    "range=30d&granularity=month",
    "range=7d&granularity=week",
  ]) {
    const { response, text } = await buildPublicReport(kv, query);
    assert.equal(response.status, 400, query);
    assert.equal(text, "invalid request");
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
      "range=7d",
    );
    assert.equal(response.status, 200);
    const report = JSON.parse(text);
    assert.equal(report.range, "7d");
    assert.equal(report.granularity, "day");
    assert.deepEqual(report.summary, {
      activeAverage: 0,
      activePeak: 0,
      newClients: 0,
    });
  } finally {
    URLSearchParams.prototype[Symbol.iterator] = originalIterator;
  }
});

test("empty KV returns V2 zero reports without reading HLL keys", async () => {
  const expectedRows = { "7d": 7, "30d": 30, "90d": 90 };

  for (const range of ["7d", "30d", "90d"]) {
    let getCalls = 0;
    let listCalls = 0;
    const kv = {
      async get() {
        getCalls += 1;
        throw new Error("empty namespace must not read sketches");
      },
      async list(options) {
        listCalls += 1;
        assert.deepEqual(options, { prefix: "h_act_", limit: 1 });
        return { complete: true, cursor: "" };
      },
    };

    const { response, text } = await buildPublicReport(kv, `range=${range}`);
    assert.equal(response.status, 200, range);
    assert.equal(listCalls, 1, range);
    assert.equal(getCalls, 0, range);

    const report = JSON.parse(text);
    assert.deepEqual(report.summary, {
      activeAverage: 0,
      activePeak: 0,
      newClients: 0,
    });
    assert.equal(report.rows.length, expectedRows[range], range);
    assert.equal(
      report.rows.every(
        (row) =>
          row.active === 0 &&
          Object.keys(row.versionsActive).length === 0 &&
          Object.keys(row.channelsActive).length === 0 &&
          Object.keys(row.osActive).length === 0 &&
          Object.keys(row.newClientsByChannel).length === 0,
      ),
      true,
      range,
    );
  }
});

test("sparse 90-day report reads only actual V2 keys in the range", async () => {
  const kv = await seededKv();
  const actualKeys = actualV2Keys(kv);
  const readKeys = [];
  const originalGet = kv.get.bind(kv);
  kv.get = async (key) => {
    readKeys.push(key);
    return originalGet(key);
  };

  const { response } = await buildPublicReport(kv, "range=90d");

  assert.equal(response.status, 200);
  assert.deepEqual([...new Set(readKeys)].sort(), actualKeys);
  assert.ok(readKeys.length < 64, `expected sparse reads, saw ${readKeys.length}`);
  assert.equal(readKeys.some((key) => key.startsWith("h_total_")), false);
  assert.equal(readKeys.some((key) => key.startsWith("h_install_ver_")), false);
  assert.equal(readKeys.some((key) => /^h_new_/.test(key)), false);
});

test("logs sparse V2 report reads with actual list and read counts", async () => {
  const kv = await seededKv();
  const logs = [];
  const { response } = await buildPublicReport(kv, "range=90d", {
    logger: (line) => logs.push(line),
  });

  assert.equal(response.status, 200);
  const entry = parseLogs(logs)[0];
  assert.equal(entry.service, "metrics");
  assert.equal(entry.event, "public_report");
  assert.equal(entry.outcome, "ok");
  assert.equal(entry.stage, "complete");
  assert.equal(entry.status, 200);
  assert.equal(entry.range, "90d");
  assert.equal(entry.granularity, "day");
  assert.equal(entry.cache, "bypass");
  assert.equal(entry.emptyNamespace, false);
  assert.equal(entry.listPrefixCount, 271);
  assert.equal(entry.listPageCount, 271);
  assert.equal(entry.listedKeyCount, actualV2Keys(kv).length);
  assert.equal(entry.readKeyCount, actualV2Keys(kv).length);
  assert.equal(entry.activeAverage, 0.1);
  assert.equal(entry.activePeak, 2);
  assert.equal(entry.newClients, 3);
  assert.equal(entry.rowCount, 90);
  assert.equal(typeof entry.durationMs, "number");
});

test("logs an empty namespace after the single h_act_ probe", async () => {
  const logs = [];
  const kv = {
    async get() {
      throw new Error("empty namespace must not read sketches");
    },
    async list(options) {
      assert.deepEqual(options, { prefix: "h_act_", limit: 1 });
      return { complete: true, cursor: "" };
    },
  };

  const { response } = await buildPublicReport(kv, "range=7d", {
    logger: (line) => logs.push(line),
  });

  assert.equal(response.status, 200);
  const entry = parseLogs(logs)[0];
  assert.equal(entry.event, "public_report");
  assert.equal(entry.cache, "bypass");
  assert.equal(entry.emptyNamespace, true);
  assert.equal(entry.listPrefixCount, 1);
  assert.equal(entry.listPageCount, 1);
  assert.equal(entry.listedKeyCount, 0);
  assert.equal(entry.readKeyCount, 0);
  assert.equal(entry.activeAverage, 0);
  assert.equal(entry.activePeak, 0);
  assert.equal(entry.newClients, 0);
  assert.equal(entry.rowCount, 7);
});

test("lists only the three V2 daily prefixes in range", async () => {
  const kv = await seededKv();
  const prefixes = [];
  const originalList = kv.list.bind(kv);
  kv.list = async (options) => {
    prefixes.push(options.prefix);
    return originalList(options);
  };

  const { response } = await buildPublicReport(kv, "range=7d");

  assert.equal(response.status, 200);
  const days = [
    "20261030",
    "20261031",
    "20261101",
    "20261102",
    "20261103",
    "20261104",
    "20261105",
  ];
  const expected = [
    "h_act_",
    ...days.flatMap((day) => [
      `h_act_${day}_`,
      `h_ver_${day}_`,
      `h_newch_${day}_`,
    ]),
  ];
  assert.deepEqual([...new Set(prefixes)].sort(), [...new Set(expected)].sort());
  assert.equal(prefixes.some((prefix) => prefix.startsWith("h_new_")), false);
  assert.equal(prefixes.some((prefix) => prefix.startsWith("h_total_")), false);
});

test("reads EdgeOne KV list entries from the key field", async () => {
  const kv = await seededKv();
  const { response, text } = await buildPublicReport(kv, "range=7d");

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(text).summary, {
    activeAverage: 0.7,
    activePeak: 2,
    newClients: 3,
  });
});

test("follows KV list cursors for non-empty metric pages", async () => {
  const kv = await seededKv();
  const prefix = "h_act_20261103_";
  const originalList = kv.list.bind(kv);
  const allKeys = (await originalList({ prefix, limit: 256 })).keys;
  assert.ok(allKeys.length > 0);
  const listCalls = [];
  const logs = [];

  kv.list = async (options) => {
    if (options.prefix !== prefix) return originalList(options);
    listCalls.push(options);
    if (!options.cursor) {
      return {
        complete: false,
        cursor: "next-page",
        keys: [{ key: `${prefix}99` }],
      };
    }
    assert.equal(options.cursor, "next-page");
    return {
      complete: true,
      cursor: "",
      keys: allKeys,
    };
  };

  const { response } = await buildPublicReport(kv, "range=7d", {
    logger: (line) => logs.push(line),
  });

  assert.equal(response.status, 200);
  assert.equal(listCalls.length, 2);
  const entry = parseLogs(logs)[0];
  assert.equal(entry.listPrefixCount, 22);
  assert.equal(entry.listPageCount, 23);
  assert.equal(entry.listedKeyCount, actualV2Keys(kv).length);
  assert.equal(entry.readKeyCount, actualV2Keys(kv).length);
});

test("opts into the public-report-v2 Cache API namespace", async () => {
  const kv = await seededKv();
  const opened = [];
  const originalCaches = globalThis.caches;
  globalThis.caches = {
    async open(name) {
      opened.push(name);
      return new MemoryCache();
    },
  };

  try {
    const { response } = await buildPublicReport(kv, "range=7d");
    assert.equal(response.status, 200);
    assert.deepEqual(opened, ["public-report-v2"]);
  } finally {
    globalThis.caches = originalCaches;
  }
});

test("reuses a successful V2 report from the normalized cache without KV access", async () => {
  const kv = await seededKv();
  const cache = new MemoryCache();
  let kvCalls = 0;
  for (const method of ["get", "list"]) {
    const original = kv[method].bind(kv);
    kv[method] = async (...args) => {
      kvCalls += 1;
      return original(...args);
    };
  }

  const first = await buildPublicReport(kv, "range=30d", { cache });
  assert.equal(first.response.status, 200);
  assert.ok(kvCalls > 0);
  const callsAfterFirst = kvCalls;

  const second = await buildPublicReport(null, "", { cache, env: {} });
  assert.equal(second.response.status, 200);
  assert.equal(second.text, first.text);
  assert.equal(kvCalls, callsAfterFirst);
  assert.match(second.response.headers.get("cache-control"), /max-age=60/);
});

test("logs a cache hit with zero list and read counts", async () => {
  const kv = await seededKv();
  const cache = new MemoryCache();
  const first = await buildPublicReport(kv, "range=7d", { cache });
  assert.equal(first.response.status, 200);

  const logs = [];
  const cached = await buildPublicReport(null, "range=7d", {
    cache,
    env: {},
    logger: (line) => logs.push(line),
  });

  assert.equal(cached.response.status, 200);
  const entry = parseLogs(logs)[0];
  assert.equal(entry.event, "public_report");
  assert.equal(entry.cache, "hit");
  assert.equal(entry.emptyNamespace, null);
  assert.equal(entry.listPrefixCount, 0);
  assert.equal(entry.listPageCount, 0);
  assert.equal(entry.listedKeyCount, 0);
  assert.equal(entry.readKeyCount, 0);
  assert.equal(entry.activeAverage, 0.7);
  assert.equal(entry.activePeak, 2);
  assert.equal(entry.newClients, 3);
  assert.equal(entry.rowCount, 7);
});

test("expires a cached report after 60 seconds", async () => {
  const kv = await seededKv();
  const cache = new MemoryCache();
  let kvCalls = 0;
  for (const method of ["get", "list"]) {
    const original = kv[method].bind(kv);
    kv[method] = async (...args) => {
      kvCalls += 1;
      return original(...args);
    };
  }
  const requestedAt = Date.parse(`${SERVER_DAY}T12:00:00Z`);

  const first = await buildPublicReport(kv, "range=7d", {
    cache,
    nowMs: requestedAt,
  });
  assert.equal(first.response.status, 200);
  const callsAfterFirst = kvCalls;

  const stillFresh = await buildPublicReport(null, "range=7d", {
    cache,
    env: {},
    nowMs: requestedAt + 59_999,
  });
  assert.equal(stillFresh.response.status, 200);
  assert.equal(kvCalls, callsAfterFirst);

  const expired = await buildPublicReport(kv, "range=7d", {
    cache,
    nowMs: requestedAt + 60_000,
  });
  assert.equal(expired.response.status, 200);
  assert.ok(kvCalls > callsAfterFirst);
});

test("does not cache KV failures", async () => {
  const cache = new MemoryCache();
  const brokenKv = {
    async list() {
      throw new Error("KV unavailable");
    },
  };

  const failed = await buildPublicReport(brokenKv, "range=7d", { cache });
  assert.equal(failed.response.status, 503);
  assert.equal(failed.text, "service unavailable");

  const kv = await seededKv();
  const recovered = await buildPublicReport(kv, "range=7d", { cache });
  assert.equal(recovered.response.status, 200);

  const cached = await buildPublicReport(null, "range=7d", {
    cache,
    env: {},
  });
  assert.equal(cached.response.status, 200);
  assert.equal(cached.text, recovered.text);
});

test("cache API failures fall back to the live report", async () => {
  const kv = await seededKv();
  const logs = [];
  const cache = {
    async match() {
      throw new Error("cache read failed");
    },
    async put() {
      throw new Error("cache write failed");
    },
  };

  const { response, text } = await buildPublicReport(kv, "range=7d", {
    cache,
    logger: (line) => logs.push(line),
  });

  assert.equal(response.status, 200);
  const warningStages = parseLogs(logs)
    .filter((entry) => entry.outcome === "warning")
    .map((entry) => entry.stage)
    .sort();
  assert.deepEqual(warningStages, ["cache_read", "cache_write"]);
  assert.deepEqual(JSON.parse(text).summary, {
    activeAverage: 0.7,
    activePeak: 2,
    newClients: 3,
  });
});

test("defers cache writes through waitUntil when the host provides it", async () => {
  const kv = await seededKv();
  const cache = new MemoryCache();
  const pending = [];

  const { response } = await buildPublicReport(kv, "range=7d", {
    cache,
    waitUntil(promise) {
      pending.push(promise);
    },
  });

  assert.equal(response.status, 200);
  assert.equal(pending.length, 1);
  await Promise.all(pending);
  assert.equal(cache.entries.size, 1);
});

test("caps public KV operations at eight in flight", async () => {
  const kv = await seededKv();
  let inFlight = 0;
  let maxInFlight = 0;
  let calls = 0;
  for (const method of ["get", "list"]) {
    const original = kv[method].bind(kv);
    kv[method] = async (...args) => {
      calls += 1;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return await original(...args);
      } finally {
        inFlight -= 1;
      }
    };
  }

  const { response } = await buildPublicReport(kv, "range=90d");

  assert.equal(response.status, 200);
  assert.ok(calls > 100, `expected many bounded operations, saw ${calls}`);
  assert.ok(maxInFlight > 1, "expected concurrent KV operations");
  assert.ok(maxInFlight <= 8, `expected at most 8 in flight, saw ${maxInFlight}`);
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
    "granularity=day&granularity=day",
    "granularity=month",
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

test("logs public method, query and missing-binding failures", async () => {
  const methodLogs = [];
  const method = await buildPublicReport(null, "", {
    method: "POST",
    logger: (line) => methodLogs.push(line),
  });
  assert.equal(method.response.status, 405);
  assert.equal(parseLogs(methodLogs)[0].stage, "method");

  const queryLogs = [];
  const query = await buildPublicReport(null, "range=14d", {
    logger: (line) => queryLogs.push(line),
  });
  assert.equal(query.response.status, 400);
  assert.equal(parseLogs(queryLogs)[0].stage, "validate");

  const bindingLogs = [];
  const binding = await buildPublicReport(null, "", {
    env: {},
    logger: (line) => bindingLogs.push(line),
  });
  assert.equal(binding.response.status, 503);
  const bindingEntry = parseLogs(bindingLogs)[0];
  assert.equal(bindingEntry.stage, "kv_binding");
  assert.equal(bindingEntry.cache, "bypass");
});

test("public response is an aggregate-only V2 whitelist", async () => {
  const kv = await seededKv();
  const { response, text } = await buildPublicReport(kv, "range=7d");
  assert.equal(response.status, 200);
  const report = JSON.parse(text);

  assert.deepEqual(Object.keys(report).sort(), [
    "approximate",
    "consistency",
    "from",
    "generatedDay",
    "granularity",
    "method",
    "range",
    "rows",
    "summary",
    "to",
  ]);
  assert.deepEqual(Object.keys(report.summary).sort(), [
    "activeAverage",
    "activePeak",
    "newClients",
  ]);
  for (const row of report.rows) {
    assert.deepEqual(Object.keys(row).sort(), [
      "active",
      "channelsActive",
      "date",
      "newClientsByChannel",
      "osActive",
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
    "totalInstalls",
    "installsByVersion",
  ]) {
    assert.equal(text.toLowerCase().includes(banned.toLowerCase()), false, banned);
  }
});

test("range new clients use a union rather than summing channel estimates", async () => {
  const kv = new MemoryKv();
  await seed(
    kv,
    event(ID_A, {
      day: "2026-11-05",
      firstLaunchDay: "2026-11-05",
      channel: "installer",
    }),
  );
  await seed(
    kv,
    event(ID_A, {
      day: "2026-11-05",
      firstLaunchDay: "2026-11-05",
      channel: "portable",
    }),
  );
  const { text } = await buildPublicReport(kv, "range=7d");
  const report = JSON.parse(text);
  const day = report.rows.find((row) => row.date === "2026-11-05");
  assert.deepEqual(day.newClientsByChannel, { installer: 1, portable: 1 });
  assert.equal(report.summary.newClients, 1);
});

test("public report returns generic no-store errors when KV is unavailable", async () => {
  const missing = await buildPublicReport(null, "", { env: {} });
  assert.equal(missing.response.status, 503);
  assert.equal(missing.response.headers.get("cache-control"), "no-store");
  assert.equal(missing.text, "service unavailable");

  const brokenKv = {
    list: async () => {
      throw new Error("internal KV detail must not leak");
    },
  };
  const broken = await buildPublicReport(brokenKv);
  assert.equal(broken.response.status, 503);
  assert.equal(broken.response.headers.get("cache-control"), "no-store");
  assert.equal(broken.text, "service unavailable");
});

test("logs public KV failures without leaking internal values", async () => {
  const logs = [];
  const brokenKv = {
    async get() {
      throw new Error("KV get must not run");
    },
    async list() {
      throw new Error(`KV unavailable for ${ID_A} from 203.0.113.9`);
    },
  };

  const { response } = await buildPublicReport(brokenKv, "range=7d", {
    logger: (line) => logs.push(line),
  });

  assert.equal(response.status, 503);
  const entry = parseLogs(logs)[0];
  assert.equal(entry.event, "public_report");
  assert.equal(entry.outcome, "error");
  assert.equal(entry.stage, "kv_list");
  assert.equal(entry.status, 503);
  assert.match(entry.error, /KV unavailable/);
  assert.equal(JSON.stringify(entry).includes(ID_A), false);
  assert.equal(JSON.stringify(entry).includes("203.0.113.9"), false);
});

test("public source never reads authorization, cookies, request metadata or globals", async () => {
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
    "MAINTENANCE_TOKEN",
    "h_total_",
    "h_install_ver_",
    "public-report-v1",
    "monthsFor",
  ]) {
    assert.equal(source.toLowerCase().includes(banned.toLowerCase()), false, banned);
  }
});
