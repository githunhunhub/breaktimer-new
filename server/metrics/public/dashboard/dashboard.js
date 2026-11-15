// Same-origin public dashboard renderer (SPEC-0022, ADR-0029).

import { buildDashboardModel, reportPath } from "./dashboard-core.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const numberFormat = new Intl.NumberFormat("zh-CN");

const state = {
  range: "30d",
  granularity: "day",
  controller: null,
};

const elements = {
  content: document.querySelector("#dashboard-content"),
  loading: document.querySelector("#loading-state"),
  empty: document.querySelector("#empty-state"),
  error: document.querySelector("#error-state"),
  dataUpdated: document.querySelector("#data-updated"),
  dataWindow: document.querySelector("#data-window"),
  total: document.querySelector("#metric-total"),
  active: document.querySelector("#metric-active"),
  newInstalls: document.querySelector("#metric-new"),
  versions: document.querySelector("#metric-versions"),
  activeChart: document.querySelector("#active-chart"),
  newChart: document.querySelector("#new-chart"),
  versionBody: document.querySelector("#version-table-body"),
  detailBody: document.querySelector("#detail-table-body"),
  periodHeading: document.querySelector("#period-heading"),
  activeMetricTag: document.querySelector("#active-metric-tag"),
  newMetricTag: document.querySelector("#new-metric-tag"),
  detailMetricTag: document.querySelector("#detail-metric-tag"),
};

function setVisibleState(view) {
  elements.loading.hidden = view !== "loading";
  elements.empty.hidden = view !== "empty";
  elements.error.hidden = view !== "error";
  elements.content.hidden = view !== "content";
}

function updateControls() {
  for (const button of document.querySelectorAll("[data-range]")) {
    button.setAttribute("aria-pressed", String(button.dataset.range === state.range));
  }
  for (const button of document.querySelectorAll("[data-granularity]")) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.granularity === state.granularity),
    );
  }
}

function formatCount(value) {
  return numberFormat.format(value);
}

function addSvg(parent, name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, String(value));
  }
  parent.append(node);
  return node;
}

function trendSvg(points, kind, label) {
  const width = 640;
  const height = 230;
  const padding = { top: 18, right: 18, bottom: 38, left: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const xAt = (index) =>
    padding.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const yAt = (value) => padding.top + plotHeight - (value / maxValue) * plotHeight;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  svg.classList.add("trend-chart");

  const title = addSvg(svg, "title");
  title.textContent = label;

  for (let line = 0; line <= 3; line += 1) {
    const y = padding.top + (plotHeight / 3) * line;
    addSvg(svg, "line", {
      x1: padding.left,
      x2: width - padding.right,
      y1: y,
      y2: y,
      class: "chart-grid-line",
    });
    const value = Math.round(maxValue - (maxValue / 3) * line);
    const text = addSvg(svg, "text", {
      x: padding.left - 8,
      y: y + 4,
      "text-anchor": "end",
      class: "chart-axis-label",
    });
    text.textContent = formatCount(value);
  }

  const coordinates = points.map((point, index) => ({
    x: xAt(index),
    y: yAt(point.value),
    ...point,
  }));
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  addSvg(svg, "path", {
    d: linePath,
    class: kind === "new" ? "chart-line chart-line-new" : "chart-line",
  });

  coordinates.forEach((point) => {
    const circle = addSvg(svg, "circle", {
      cx: point.x,
      cy: point.y,
      r: 4,
      class: kind === "new" ? "chart-point chart-point-new" : "chart-point",
    });
    const pointTitle = addSvg(circle, "title");
    pointTitle.textContent = `${point.label}: ${formatCount(point.value)}`;
  });

  const indexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  for (const index of indexes) {
    const text = addSvg(svg, "text", {
      x: xAt(index),
      y: height - 12,
      "text-anchor": index === 0 ? "start" : index === points.length - 1 ? "end" : "middle",
      class: "chart-axis-label",
    });
    text.textContent = points[index].label;
  }

  return svg;
}

function textCell(text, label) {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  cell.textContent = text;
  return cell;
}

function versionCell(version) {
  const cell = document.createElement("td");
  cell.dataset.label = "版本";
  const code = document.createElement("code");
  code.textContent = version;
  cell.append(code);
  return cell;
}

function countCell(value, maxValue, label, className = "") {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  const count = document.createElement("span");
  count.textContent = formatCount(value);
  cell.append(count);
  const progress = document.createElement("progress");
  progress.className = `table-progress ${className}`.trim();
  progress.max = Math.max(1, maxValue);
  progress.value = value;
  progress.setAttribute("aria-label", `${label}: ${formatCount(value)}`);
  cell.append(progress);
  return cell;
}

function versionsText(versions) {
  const entries = Object.entries(versions);
  return entries.length
    ? entries.map(([version, count]) => `${version}: ${formatCount(count)}`).join(" · ")
    : "—";
}

function renderVersions(versions) {
  elements.versionBody.replaceChildren();
  if (!versions.length) {
    const row = document.createElement("tr");
    const cell = textCell("当前范围暂无版本数据", "版本");
    cell.colSpan = 3;
    row.append(cell);
    elements.versionBody.append(row);
    return;
  }

  const maxTotal = Math.max(1, ...versions.map((item) => item.totalInstalls));
  const maxActive = Math.max(1, ...versions.map((item) => item.active));
  for (const item of versions) {
    const row = document.createElement("tr");
    row.append(
      versionCell(item.version),
      countCell(item.totalInstalls, maxTotal, "累计装机", "progress-teal"),
      countCell(item.active, maxActive, "范围活跃", "progress-amber"),
    );
    elements.versionBody.append(row);
  }
}

function renderRows(model) {
  elements.detailBody.replaceChildren();
  const monthly = model.granularity === "month";
  elements.periodHeading.textContent = monthly ? "月份" : "日期";
  elements.activeMetricTag.textContent = monthly ? "M2" : "M1";
  elements.newMetricTag.textContent = monthly ? "M6" : "M5";
  elements.detailMetricTag.textContent = monthly ? "M2 · M4 · M6" : "M1 · M3 · M5";

  for (const row of model.rows) {
    const tableRow = document.createElement("tr");
    tableRow.append(
      textCell(row.label, monthly ? "月份" : "日期"),
      textCell(formatCount(row.active), "活跃"),
      textCell(formatCount(row.newInstalls), "新增"),
      textCell(versionsText(row.versionsActive), "活跃版本"),
    );
    elements.detailBody.append(tableRow);
  }
}

function render(report) {
  const model = buildDashboardModel(report);
  if (model.isEmpty) {
    elements.dataUpdated.textContent = `数据生成日 ${model.generatedDay || "未知"}`;
    elements.dataWindow.textContent = `${model.from || "—"} 至 ${model.to || "—"}`;
    setVisibleState("empty");
    return;
  }

  elements.total.textContent = formatCount(model.summary.totalInstalls);
  elements.active.textContent = formatCount(model.summary.active);
  elements.newInstalls.textContent = formatCount(model.summary.newInstalls);
  elements.versions.textContent = formatCount(model.summary.versionCount);
  elements.dataUpdated.textContent = `数据生成日 ${model.generatedDay} · 页面读取 ${new Date().toLocaleString("zh-CN")}`;
  elements.dataWindow.textContent = `${model.from} 至 ${model.to} · ${model.granularity === "day" ? "按日" : "按月"}`;

  elements.activeChart.replaceChildren(
    trendSvg(model.activeTrend, "active", `活跃装机趋势，${model.from} 至 ${model.to}`),
  );
  elements.newChart.replaceChildren(
    trendSvg(
      model.newInstallsTrend,
      "new",
      `新增装机趋势，${model.from} 至 ${model.to}`,
    ),
  );
  renderVersions(model.versions);
  renderRows(model);
  setVisibleState("content");
}

async function loadReport() {
  state.controller?.abort();
  state.controller = new AbortController();
  setVisibleState("loading");

  try {
    const response = await fetch(reportPath(state.range, state.granularity), {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      cache: "default",
      signal: state.controller.signal,
    });
    if (!response.ok) throw new Error("public report request failed");
    render(await response.json());
  } catch (error) {
    if (error?.name === "AbortError") return;
    setVisibleState("error");
  }
}

for (const button of document.querySelectorAll("[data-range]")) {
  button.addEventListener("click", () => {
    state.range = button.dataset.range;
    updateControls();
    loadReport();
  });
}

for (const button of document.querySelectorAll("[data-granularity]")) {
  button.addEventListener("click", () => {
    state.granularity = button.dataset.granularity;
    updateControls();
    loadReport();
  });
}

document.querySelector("#refresh-button").addEventListener("click", loadReport);
document.querySelector("#retry-button").addEventListener("click", loadReport);

updateControls();
loadReport();
