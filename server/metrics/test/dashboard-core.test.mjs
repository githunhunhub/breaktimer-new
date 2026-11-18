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
    summary: {
      activeAverage: 6.2,
      activePeak: 7,
      newClients: 3,
    },
    rows: [
      {
        date: "2026-11-04",
        active: 5,
        versionsActive: { "0.1.1": 2, "0.1.2": 3 },
        channelsActive: { installer: 4, portable: 1 },
        osActive: { "windows-10": 1, "windows-11": 4 },
        newClientsByChannel: { installer: 1 },
      },
      {
        date: "2026-11-05",
        active: 7,
        versionsActive: { "0.1.1": 2, "0.1.2": 5 },
        channelsActive: { installer: 5, portable: 2 },
        osActive: { "windows-11": 7 },
        newClientsByChannel: { installer: 2, portable: 1 },
      },
    ],
    ...overrides,
  };
}

test("builds V2 overview, trends, latest distributions and daily rows", () => {
  const model = buildDashboardModel(sampleReport());

  assert.deepEqual(model.summary, {
    activeAverage: 6.2,
    activePeak: 7,
    newClients: 3,
  });
  assert.deepEqual(model.activeTrend, [
    { label: "2026-11-04", value: 5 },
    { label: "2026-11-05", value: 7 },
  ]);
  assert.deepEqual(model.newClientsTrend, [
    { label: "2026-11-04", value: 1 },
    { label: "2026-11-05", value: 3 },
  ]);
  assert.deepEqual(model.latest, {
    date: "2026-11-05",
    versions: [
      { name: "0.1.1", count: 2 },
      { name: "0.1.2", count: 5 },
    ],
    channels: [
      { name: "installer", count: 5 },
      { name: "portable", count: 2 },
    ],
    os: [{ name: "windows-11", count: 7 }],
  });
  assert.deepEqual(model.newClientChannels, [
    { name: "installer", count: 3 },
    { name: "portable", count: 1 },
  ]);
  assert.deepEqual(model.rows, [
    {
      label: "2026-11-04",
      active: 5,
      newClients: 1,
      versionsActive: { "0.1.1": 2, "0.1.2": 3 },
      channelsActive: { installer: 4, portable: 1 },
      osActive: { "windows-10": 1, "windows-11": 4 },
      newClientsByChannel: { installer: 1 },
    },
    {
      label: "2026-11-05",
      active: 7,
      newClients: 3,
      versionsActive: { "0.1.1": 2, "0.1.2": 5 },
      channelsActive: { installer: 5, portable: 2 },
      osActive: { "windows-11": 7 },
      newClientsByChannel: { installer: 2, portable: 1 },
    },
  ]);
  assert.equal(model.isEmpty, false);
});

test("empty reports do not turn zero rows into fake trends", () => {
  const model = buildDashboardModel(
    sampleReport({
      summary: { activeAverage: 0, activePeak: 0, newClients: 0 },
      rows: [
        {
          date: "2026-11-04",
          active: 0,
          versionsActive: {},
          channelsActive: {},
          osActive: {},
          newClientsByChannel: {},
        },
        {
          date: "2026-11-05",
          active: 0,
          versionsActive: {},
          channelsActive: {},
          osActive: {},
          newClientsByChannel: {},
        },
      ],
    }),
  );

  assert.equal(model.isEmpty, true);
  assert.deepEqual(model.activeTrend, []);
  assert.deepEqual(model.newClientsTrend, []);
  assert.deepEqual(model.latest.versions, []);
  assert.deepEqual(model.latest.channels, []);
  assert.deepEqual(model.latest.os, []);
  assert.deepEqual(model.newClientChannels, []);
  assert.equal(model.rows.length, 2);
});

test("latest distributions skip trailing zero rows and keep V2 range parameters", () => {
  const report = sampleReport({
    range: "90d",
    rows: [
      {
        date: "2026-11-04",
        active: 2,
        versionsActive: { "0.1.2": 2 },
        channelsActive: { installer: 2 },
        osActive: { "windows-11": 2 },
        newClientsByChannel: {},
      },
      {
        date: "2026-11-05",
        active: 0,
        versionsActive: {},
        channelsActive: {},
        osActive: {},
        newClientsByChannel: {},
      },
    ],
  });
  const model = buildDashboardModel(report);

  assert.equal(model.latest.date, "2026-11-04");
  assert.deepEqual(model.latest.versions, [{ name: "0.1.2", count: 2 }]);
  assert.equal(reportPath("90d"), "/api/public-report?range=90d&granularity=day");
});

test("malformed maps become empty objects and never produce NaN", () => {
  const model = buildDashboardModel(
    sampleReport({
      rows: [
        {
          date: "2026-11-05",
          active: "not-a-number",
          versionsActive: [],
          channelsActive: null,
          osActive: { "windows-11": "bad" },
          newClientsByChannel: { installer: "2" },
        },
      ],
    }),
  );
  assert.equal(model.rows[0].active, 0);
  assert.deepEqual(model.rows[0].versionsActive, {});
  assert.deepEqual(model.rows[0].channelsActive, {});
  assert.deepEqual(model.rows[0].osActive, { "windows-11": 0 });
  assert.equal(model.rows[0].newClients, 2);
});
