import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_BODY_BYTES,
  collectRequest,
} from "../edge-functions/_lib/collect.js";
import {
  decodeSketch,
  encodeSketch,
} from "../edge-functions/_lib/hll.js";

const INSTALL_ID = "6f1f0d6a-1f5c-4c19-9a4e-0d2b6a4f9c11";
const SERVER_DAY = "2026-11-05";

function installEvent(overrides = {}) {
  return {
    schema: 1,
    event: "install",
    installId: INSTALL_ID,
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

function heartbeatEvent(overrides = {}) {
  const { firstLaunchDay, ...rest } = installEvent(overrides);
  return { ...rest, event: "heartbeat" };
}

class MemoryKv {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values));
    this.writes = [];
    this.failPut = false;
  }

  async get(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  async put(key, value) {
    if (this.failPut) throw new Error("KV unavailable");
    this.values.set(key, value);
    this.writes.push(key);
  }
}

function makeRequest(payload, options = {}) {
  const body =
    typeof payload === "string" ? payload : JSON.stringify(payload);
  return new Request("https://metrics.example.com/v1/collect", {
    method: options.method || "POST",
    headers: {
      "content-type": "application/json",
      "x-test-client-ip": "203.0.113.9",
      ...options.headers,
    },
    body: options.method === "GET" ? undefined : body,
  });
}

function makeContext(kv, overrides = {}) {
  const { env: envOverrides, ...contextOverrides } = overrides;
  return {
    request: undefined,
    env: {
      DISABLED: "0",
      MAINTENANCE_TOKEN: "secret-token",
      METRICS_KV: kv,
      ...envOverrides,
    },
    ...contextOverrides,
  };
}

async function handle(payload, options = {}) {
  const kv = options.kv || new MemoryKv();
  const request = makeRequest(payload, options);
  const context = makeContext(kv, { ...options, request });
  const response = await collectRequest(context, {
    serverDay: SERVER_DAY,
    now: () => Date.parse(`${SERVER_DAY}T00:00:00Z`),
  });
  return { kv, request, response };
}

test("DISABLED returns 410 before reading the request", async () => {
  const kv = new MemoryKv();
  const { response } = await handle(installEvent(), {
    kv,
    env: { DISABLED: "1" },
  });
  assert.equal(response.status, 410);
  assert.equal(kv.writes.length, 0);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("rejects non-POST, malformed JSON and oversize content-length", async () => {
  assert.equal((await handle(installEvent(), { method: "GET" })).response.status, 405);
  assert.equal((await handle("{bad json")).response.status, 400);
  const oversize = await handle(installEvent(), {
    headers: { "content-length": String(MAX_BODY_BYTES + 1) },
  });
  assert.equal(oversize.response.status, 413);
  assert.equal(
    (await handle("x".repeat(MAX_BODY_BYTES + 1), {
      headers: { "content-length": "0" },
    })).response.status,
    413,
  );
});

test("accepts every request-body shape an EdgeOne isolate may expose", async () => {
  const json = JSON.stringify(installEvent());
  const shapes = {
    "web stream": () =>
      new Request("https://metrics.example.com/v1/collect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: json,
      }),
    string: () => ({
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      body: json,
    }),
    "node buffer": () => ({
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      body: Buffer.from(json),
    }),
    "byte array": () => ({
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      body: Array.from(Buffer.from(json)),
    }),
    "parsed object": () => ({
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      body: installEvent(),
    }),
    "text() accessor": () => ({
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => json,
    }),
    "json() accessor": () => ({
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => installEvent(),
    }),
  };

  for (const [name, build] of Object.entries(shapes)) {
    const kv = new MemoryKv();
    const context = makeContext(kv, { request: build() });
    const response = await collectRequest(context, {
      serverDay: SERVER_DAY,
      now: () => Date.parse(`${SERVER_DAY}T00:00:00Z`),
    });
    assert.equal(response.status, 204, `${name} body should be accepted`);
    assert.equal(kv.writes.length, 5, `${name} body should write sketches`);
  }
});

test("caps buffered bodies that arrive without a stream", async () => {
  const context = makeContext(new MemoryKv(), {
    request: {
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      body: "x".repeat(MAX_BODY_BYTES + 1),
    },
  });
  const response = await collectRequest(context, { serverDay: SERVER_DAY });
  assert.equal(response.status, 413);
});

test("prefers text() over an empty body stream like EdgeOne does", async () => {
  const json = JSON.stringify(installEvent());
  const kv = new MemoryKv();
  const context = makeContext(kv, {
    request: {
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      body: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
      text: async () => json,
    },
  });
  const response = await collectRequest(context, {
    serverDay: SERVER_DAY,
    now: () => Date.parse(`${SERVER_DAY}T00:00:00Z`),
  });
  assert.equal(response.status, 204);
  assert.equal(kv.writes.length, 5);
});

test("caps text() bodies too", async () => {
  const context = makeContext(new MemoryKv(), {
    request: {
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => "x".repeat(MAX_BODY_BYTES + 1),
    },
  });
  const response = await collectRequest(context, { serverDay: SERVER_DAY });
  assert.equal(response.status, 413);
});

test("rejects unknown fields and an offline firstLaunchDay outside the cap", async () => {
  assert.equal((await handle(installEvent({ ip: "203.0.113.9" }))).response.status, 400);
  assert.equal(
    (await handle(installEvent({ firstLaunchDay: "2024-01-01" }))).response.status,
    400,
  );
});

test("install writes active, version, new, total and install-version sketches", async () => {
  const { kv, response } = await handle(installEvent());
  assert.equal(response.status, 204);
  assert.equal(kv.writes.length, 5);
  assert.ok(kv.writes.some((key) => key.startsWith("h_act_20261105_")));
  assert.ok(kv.writes.some((key) => key.startsWith("h_ver_20261105_")));
  assert.ok(kv.writes.some((key) => key.startsWith("h_new_20261101_")));
  assert.ok(kv.writes.some((key) => key.startsWith("h_total_")));
  assert.ok(kv.writes.some((key) => key.startsWith("h_install_ver_")));

  for (const key of kv.writes) {
    assert.equal(kv.values.get(key).includes(INSTALL_ID), false);
    assert.equal(kv.values.get(key).includes("203.0.113.9"), false);
  }
  const versionKey = kv.writes.find((key) => key.startsWith("h_ver_"));
  assert.deepEqual(Object.keys(JSON.parse(kv.values.get(versionKey))), ["0.1.1"]);
});

test("heartbeat writes only active and version sketches", async () => {
  const { kv, response } = await handle(heartbeatEvent());
  assert.equal(response.status, 204);
  assert.equal(kv.writes.length, 2);
  for (const key of kv.writes) {
    assert.ok(key.startsWith("h_act_") || key.startsWith("h_ver_"));
  }
});

test("replaying the same event does not increase the sketch estimate", async () => {
  const kv = new MemoryKv();
  await handle(installEvent(), { kv });
  const key = kv.writes.find((entry) => entry.startsWith("h_total_"));
  const before = kv.values.get(key);
  await handle(installEvent(), { kv });
  assert.equal(kv.values.get(key), before);
});

test("writes from an old sketch value are merged instead of overwritten", async () => {
  const { fingerprint, installShard, createSketch, mergeInto, encodeSketch } =
    await import("../edge-functions/_lib/hll.js");
  const fingerprintValue = await fingerprint(INSTALL_ID);
  const shard = String(installShard(fingerprintValue)).padStart(2, "0");
  const key = `h_total_${shard}`;
  const existing = createSketch();
  mergeInto(existing, await fingerprint("another-install-id"));
  const kv = new MemoryKv({ [key]: JSON.stringify({ p: 14, data: encodeSketch(existing) }) });
  await handle(installEvent(), { kv });
  const stored = JSON.parse(kv.values.get(key));
  const registers = decodeSketch(stored.data).registers;
  assert.ok(registers[fingerprintValue.index] >= fingerprintValue.rank);
});

test("KV write failure returns 500 so the client can retry", async () => {
  const kv = new MemoryKv();
  kv.failPut = true;
  const { response } = await handle(installEvent(), { kv });
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("collect has no IP/geo/body logging calls", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../edge-functions/_lib/collect.js", import.meta.url),
    "utf8",
  );
  for (const banned of ["clientIp", "request.eo", "console.log", "JSON.stringify(payload)"]) {
    assert.equal(source.includes(banned), false, `collect source contains ${banned}`);
  }
});
