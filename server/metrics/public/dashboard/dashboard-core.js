// Pure transformations shared by the dashboard and its Node tests (SPEC-0022).

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function countMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, count]) => [key, numeric(count)]),
  );
}

function sumMap(map) {
  return Object.values(map).reduce((sum, value) => sum + value, 0);
}

function distribution(map) {
  return Object.entries(map)
    .sort(([left], [right]) =>
      left.localeCompare(right, undefined, { numeric: true }),
    )
    .map(([name, count]) => ({ name, count }));
}

export function reportPath(range) {
  return `/api/public-report?range=${range}&granularity=day`;
}

export function buildDashboardModel(report) {
  const rows = Array.isArray(report?.rows) ? report.rows : [];
  const normalizedRows = rows.map((row) => {
    const newClientsByChannel = countMap(row?.newClientsByChannel);
    return {
      label: String(row?.date || ""),
      active: numeric(row?.active),
      newClients: sumMap(newClientsByChannel),
      versionsActive: countMap(row?.versionsActive),
      channelsActive: countMap(row?.channelsActive),
      osActive: countMap(row?.osActive),
      newClientsByChannel,
    };
  });

  const hasDistribution = (row) =>
    Object.keys(row.versionsActive).length > 0 ||
    Object.keys(row.channelsActive).length > 0 ||
    Object.keys(row.osActive).length > 0;
  const latestRow = [...normalizedRows]
    .reverse()
    .find((row) => row.active > 0 || hasDistribution(row));

  const newClientChannels = {};
  for (const row of normalizedRows) {
    for (const [channel, count] of Object.entries(row.newClientsByChannel)) {
      newClientChannels[channel] = (newClientChannels[channel] || 0) + count;
    }
  }

  const isEmpty =
    numeric(report?.summary?.activePeak) === 0 &&
    numeric(report?.summary?.newClients) === 0 &&
    normalizedRows.every(
      (row) => row.active === 0 && row.newClients === 0 && !hasDistribution(row),
    );

  return {
    summary: {
      activeAverage: numeric(report?.summary?.activeAverage),
      activePeak: numeric(report?.summary?.activePeak),
      newClients: numeric(report?.summary?.newClients),
    },
    activeTrend: isEmpty
      ? []
      : normalizedRows.map(({ label, active }) => ({ label, value: active })),
    newClientsTrend: isEmpty
      ? []
      : normalizedRows.map(({ label, newClients }) => ({
          label,
          value: newClients,
        })),
    latest: {
      date: latestRow?.label || "",
      versions: isEmpty ? [] : distribution(latestRow?.versionsActive || {}),
      channels: isEmpty ? [] : distribution(latestRow?.channelsActive || {}),
      os: isEmpty ? [] : distribution(latestRow?.osActive || {}),
    },
    newClientChannels: isEmpty ? [] : distribution(newClientChannels),
    rows: normalizedRows,
    isEmpty,
    range: report?.range || "30d",
    from: report?.from || "",
    to: report?.to || "",
    generatedDay: report?.generatedDay || "",
  };
}
