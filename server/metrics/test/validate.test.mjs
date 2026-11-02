import assert from "node:assert/strict";
import test from "node:test";

import {
  dayDistance,
  isRecentDay,
  validateEvent,
} from "../src/validate.js";

const INSTALL_ID = "6f1f0d6a-1f5c-4c19-9a4e-0d2b6a4f9c11";

function installEvent(overrides = {}) {
  return {
    schema: 1,
    event: "install",
    installId: INSTALL_ID,
    day: "2026-11-02",
    firstLaunchDay: "2026-10-30",
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

test("accepts an install event with the allowlisted fields", () => {
  assert.equal(validateEvent(installEvent()), null);
});

test("accepts a heartbeat without firstLaunchDay", () => {
  assert.equal(validateEvent(heartbeatEvent()), null);
});

test("rejects unknown fields instead of ignoring them", () => {
  assert.match(
    validateEvent(installEvent({ ip: "203.0.113.9" })),
    /unexpected field: ip/,
  );
});

test("rejects heartbeat events that carry firstLaunchDay", () => {
  assert.match(
    validateEvent(installEvent({ event: "heartbeat" })),
    /unexpected firstLaunchDay/,
  );
});

test("rejects a missing firstLaunchDay on install", () => {
  const { firstLaunchDay, ...rest } = installEvent();
  assert.match(validateEvent(rest), /invalid firstLaunchDay/);
});

test("rejects non-v4 install ids and bad enums", () => {
  assert.match(
    validateEvent(installEvent({ installId: "not-a-uuid" })),
    /invalid installId/,
  );
  assert.match(
    validateEvent(installEvent({ installId: "6f1f0d6a-1f5c-1c19-9a4e-0d2b6a4f9c11" })),
    /invalid installId/,
  );
  assert.match(validateEvent(installEvent({ os: "windows-12" })), /invalid os/);
  assert.match(
    validateEvent(installEvent({ channel: "zip" })),
    /invalid channel/,
  );
  assert.match(
    validateEvent(installEvent({ locale: "zh_CN" })),
    /invalid locale/,
  );
  assert.match(
    validateEvent(installEvent({ version: "v0.1.1" })),
    /invalid version/,
  );
});

test("rejects impossible calendar days", () => {
  assert.match(validateEvent(installEvent({ day: "2026-02-30" })), /invalid day/);
  assert.match(validateEvent(installEvent({ day: "2026-11-2" })), /invalid day/);
});

test("accepts only yesterday, today and tomorrow for the server day", () => {
  assert.equal(isRecentDay("2026-11-01", "2026-11-02"), true);
  assert.equal(isRecentDay("2026-11-02", "2026-11-02"), true);
  assert.equal(isRecentDay("2026-11-03", "2026-11-02"), true);
  assert.equal(isRecentDay("2026-10-31", "2026-11-02"), false);
  assert.equal(isRecentDay("2026-11-10", "2026-11-02"), false);
});

test("dayDistance handles month and year boundaries", () => {
  assert.equal(dayDistance("2026-12-31", "2027-01-01"), 1);
  assert.equal(dayDistance("2026-11-02", "2026-11-02"), 0);
  assert.equal(dayDistance("bad", "2026-11-02"), null);
});

test("rejects non-object payloads", () => {
  assert.match(validateEvent(null), /must be an object/);
  assert.match(validateEvent([]), /must be an object/);
});
