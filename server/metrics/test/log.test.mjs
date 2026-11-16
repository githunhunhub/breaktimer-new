import assert from "node:assert/strict";
import test from "node:test";

import { LOG_PREFIX, writeLog } from "../edge-functions/_lib/log.js";

const INSTALL_ID = "6f1f0d6a-1f5c-4c19-9a4e-0d2b6a4f9c11";

function parseLine(line) {
  assert.equal(line.startsWith(`${LOG_PREFIX} `), true);
  return JSON.parse(line.slice(LOG_PREFIX.length + 1));
}

test("writes one-line JSON and redacts sensitive values", () => {
  const lines = [];

  writeLog(
    {
      service: "metrics",
      event: "collect",
      stage: "kv_write",
      durationMs: 12,
      installId: INSTALL_ID,
      error:
        `install ${INSTALL_ID} from 203.0.113.9 and 2001:db8::1\n` +
        "Authorization: Bearer secret-value token=another-secret",
    },
    (line) => lines.push(line),
  );

  assert.equal(lines.length, 1);
  assert.equal(lines[0].includes("\n"), false);
  const entry = parseLine(lines[0]);
  assert.equal(entry.service, "metrics");
  assert.equal(entry.event, "collect");
  assert.equal(entry.stage, "kv_write");
  assert.equal(entry.durationMs, 12);
  assert.equal("installId" in entry, false);
  assert.equal(
    entry.error,
    "install [redacted-uuid] from [redacted-ip] and [redacted-ip] " +
      "Authorization: Bearer [redacted-token] token=[redacted]",
  );
});

test("logger failure does not escape into the request path", () => {
  assert.doesNotThrow(() => {
    writeLog(
      { event: "collect", stage: "complete", outcome: "ok" },
      () => {
        throw new Error("logger unavailable");
      },
    );
  });
});

test("redacts sensitive object keys regardless of casing", () => {
  const lines = [];

  writeLog(
    {
      event: "public_report",
      rawEvents: [{ installId: INSTALL_ID }],
      requestHeaders: { authorization: "Bearer secret-value" },
    },
    (line) => lines.push(line),
  );

  const entry = parseLine(lines[0]);
  assert.equal("rawEvents" in entry, false);
  assert.equal("requestHeaders" in entry, false);
  assert.equal(lines[0].includes(INSTALL_ID), false);
  assert.equal(lines[0].includes("secret-value"), false);
});
