import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDashboardModel,
  reportPath,
} from "../public/dashboard/dashboard-core.js";

function sampleReport(overrides = {}) {
  return {
    approximate: true,
    method: "hll",
    consistency: "eventual_60s",
    range: "30d",
    granularity: "day",
    from: "2026-10-07",
    to: "2026-11-05",
    generatedDay: "2026-11-05",
    metrics: ["M1", "M3", "M5", "M7", "M8"],
    summary: {
      active: 12,
      newInstalls: 3,
      versionsActive: { "0.1.1": 4, "0.1.2": 8 },
    },
    totalInstalls: 40,
    installsByVersion: { "0.1.1": 15, "0.1.2": 25 },
    rows: [
      {
        date: "2026-11-04",
        active: 5,
        versionsActive: { "0.1.1": 2, "0.1.2": 3 },
        newInstalls: 1,
      },
      {
        date: "2026-11-05",
        active: 7,
        versionsActive: { "0.1.1": 2, "0.1.2": 5 },
        newInstalls: 2,
      },
    ],
    ...overrides,
  };
}

test("builds overview, trends and version rows from one public response", () => {
  const model = buildDashboardModel(sampleReport());

  assert.deepEqual(model.summary, {
    totalInstalls: 40,
    active: 12,
    newInstalls: 3,
    versionCount: 2,
  });
  assert.deepEqual(model.activeTrend, [
    { label: "2026-11-04", value: 5 },
    { label: "2026-11-05", value: 7 },
  ]);
  assert.deepEqual(model.newInstallsTrend, [
    { label: "2026-11-04", value: 1 },
    { label: "2026-11-05", value: 2 },
  ]);
  assert.deepEqual(model.versions, [
    { version: "0.1.1", totalInstalls: 15, active: 4 },
    { version: "0.1.2", totalInstalls: 25, active: 8 },
  ]);
  assert.deepEqual(model.rows, [
    {
      label: "2026-11-04",
      active: 5,
      newInstalls: 1,
      versionsActive: { "0.1.1": 2, "0.1.2": 3 },
    },
    {
      label: "2026-11-05",
      active: 7,
      newInstalls: 2,
      versionsActive: { "0.1.1": 2, "0.1.2": 5 },
    },
  ]);
  assert.equal(model.isEmpty, false);
});

test("empty reports do not turn zero rows into fake trends", () => {
  const model = buildDashboardModel(
    sampleReport({
      summary: { active: 0, newInstalls: 0, versionsActive: {} },
      totalInstalls: 0,
      installsByVersion: {},
      rows: [
        { date: "2026-11-04", active: 0, versionsActive: {}, newInstalls: 0 },
        { date: "2026-11-05", active: 0, versionsActive: {}, newInstalls: 0 },
      ],
    }),
  );

  assert.equal(model.isEmpty, true);
  assert.deepEqual(model.activeTrend, []);
  assert.deepEqual(model.newInstallsTrend, []);
  assert.deepEqual(model.versions, []);
  assert.equal(model.rows.length, 2);
});

test("monthly rows use the month label and preserve requested query parameters", () => {
  const model = buildDashboardModel(
    sampleReport({
      range: "90d",
      granularity: "month",
      metrics: ["M2", "M4", "M6", "M7", "M8"],
      rows: [
        {
          month: "2026-10",
          active: 9,
          versionsActive: { "0.1.1": 9 },
          newInstalls: 2,
        },
      ],
    }),
  );

  assert.equal(model.rows[0].label, "2026-10");
  assert.equal(model.activeTrend[0].label, "2026-10");
  assert.equal(
    reportPath("90d", "month"),
    "/api/public-report?range=90d&granularity=month",
  );
});
