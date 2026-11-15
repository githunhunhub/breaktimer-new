// Pure transformations shared by the dashboard and its Node tests (SPEC-0022).

function numeric(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function countMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, count]) => [key, numeric(count)]),
  );
}

export function reportPath(range, granularity) {
  return `/api/public-report?range=${range}&granularity=${granularity}`;
}

export function buildDashboardModel(report) {
  const rows = Array.isArray(report?.rows) ? report.rows : [];
  const installsByVersion = countMap(report?.installsByVersion);
  const versionsActive = countMap(report?.summary?.versionsActive);
  const versionNames = [
    ...new Set([...Object.keys(installsByVersion), ...Object.keys(versionsActive)]),
  ].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  const isEmpty =
    numeric(report?.totalInstalls) === 0 &&
    numeric(report?.summary?.active) === 0 &&
    numeric(report?.summary?.newInstalls) === 0 &&
    rows.every(
      (row) => numeric(row?.active) === 0 && numeric(row?.newInstalls) === 0,
    );

  const normalizedRows = rows.map((row) => ({
    label: String(row?.date || row?.month || ""),
    active: numeric(row?.active),
    newInstalls: numeric(row?.newInstalls),
    versionsActive: countMap(row?.versionsActive),
  }));

  return {
    summary: {
      totalInstalls: numeric(report?.totalInstalls),
      active: numeric(report?.summary?.active),
      newInstalls: numeric(report?.summary?.newInstalls),
      versionCount: Object.keys(installsByVersion).length,
    },
    activeTrend: isEmpty
      ? []
      : normalizedRows.map(({ label, active }) => ({ label, value: active })),
    newInstallsTrend: isEmpty
      ? []
      : normalizedRows.map(({ label, newInstalls }) => ({
          label,
          value: newInstalls,
        })),
    versions: isEmpty
      ? []
      : versionNames.map((version) => ({
          version,
          totalInstalls: installsByVersion[version] || 0,
          active: versionsActive[version] || 0,
        })),
    rows: normalizedRows,
    isEmpty,
    range: report?.range || "30d",
    granularity: report?.granularity || "day",
    from: report?.from || "",
    to: report?.to || "",
    generatedDay: report?.generatedDay || "",
  };
}
