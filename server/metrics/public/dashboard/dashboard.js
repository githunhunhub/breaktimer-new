// Same-origin public dashboard renderer (SPEC-0022, ADR-0029, ADR-0033).

import { buildDashboardModel, reportPath } from "./dashboard-core.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const numberFormat = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 1,
});

const state = {
  range: "30d",
  controller: null,
};

const elements = {
  content: document.querySelector("#dashboard-content"),
  loading: document.querySelector("#loading-state"),
  empty: document.querySelector("#empty-state"),
  error: document.querySelector("#error-state"),
  dataUpdated: document.querySelector("#data-updated"),
  dataWindow: document.querySelector("#data-window"),
  average: document.querySelector("#metric-average"),
  peak: document.querySelector("#metric-peak"),
  newClients: document.querySelector("#metric-new"),
  activeChart: document.querySelector("#active-chart"),
  newChart: document.querySelector("#new-chart"),
  distributionDate: document.querySelector("#distribution-date"),
  versionBody: document.querySelector("#version-table-body"),
  channelBody: document.querySelector("#channel-table-body"),
  osBody: document.querySelector("#os-table-body"),
  newChannelBody: document.querySelector("#new-channel-table-body"),
  detailBody: document.querySelector("#detail-table-body"),
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
  const padding = { top: 18, right: 18, bottom: 38, left: 48 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const xAt = (index) =>
    padding.left +
    (points.length <= 1
      ? plotWidth / 2
      : (index / (points.length - 1)) * plotWidth);
  const yAt = (value) =>
    padding.top + plotHeight - (value / maxValue) * plotHeight;

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

  const indexes = [
    ...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]),
  ];
  for (const index of indexes) {
    const text = addSvg(svg, "text", {
      x: xAt(index),
      y: height - 12,
      "text-anchor":
        index === 0
          ? "start"
          : index === points.length - 1
            ? "end"
            : "middle",
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

function codeCell(text, label) {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  const code = document.createElement("code");
  code.textContent = text;
  cell.append(code);
  return cell;
}

function countCell(value, maxValue, label, className) {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  const count = document.createElement("span");
  count.textContent = formatCount(value);
  cell.append(count);
  const progress = document.createElement("progress");
  progress.className = `table-progress ${className}`;
  progress.max = Math.max(1, maxValue);
  progress.value = value;
  progress.setAttribute("aria-label", `${label}: ${formatCount(value)}`);
  cell.append(progress);
  return cell;
}

function mapText(map) {
  const entries = Object.entries(map);
  return entries.length
    ? entries.map(([name, count]) => `${name}: ${formatCount(count)}`).join(" · ")
    : "—";
}

function renderDistribution(container, items, emptyText, countLabel, className) {
  container.replaceChildren();
  if (!items.length) {
    const row = document.createElement("tr");
    const cell = textCell(emptyText, "内容");
    cell.colSpan = 2;
    row.append(cell);
    container.append(row);
    return;
  }
  const maxValue = Math.max(1, ...items.map((item) => item.count));
  for (const item of items) {
    const row = document.createElement("tr");
    row.append(
      codeCell(item.name, "名称"),
      countCell(item.count, maxValue, countLabel, className),
    );
    container.append(row);
  }
}

function renderRows(model) {
  elements.detailBody.replaceChildren();
  for (const row of model.rows) {
    const tableRow = document.createElement("tr");
    tableRow.append(
      textCell(row.label, "日期"),
      textCell(formatCount(row.active), "活跃"),
      textCell(formatCount(row.newClients), "新增"),
      textCell(mapText(row.versionsActive), "版本"),
      textCell(mapText(row.channelsActive), "渠道"),
      textCell(mapText(row.osActive), "系统"),
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

  elements.average.textContent = formatCount(model.summary.activeAverage);
  elements.peak.textContent = formatCount(model.summary.activePeak);
  elements.newClients.textContent = formatCount(model.summary.newClients);
  elements.dataUpdated.textContent = `数据生成日 ${model.generatedDay} · 页面读取 ${new Date().toLocaleString("zh-CN")}`;
  elements.dataWindow.textContent = `${model.from} 至 ${model.to} · 按日`;
  elements.distributionDate.textContent = model.latest.date
    ? `${model.latest.date} 活跃分布`
    : "当前范围暂无分布";

  elements.activeChart.replaceChildren(
    trendSvg(model.activeTrend, "active", `日活跃客户端趋势，${model.from} 至 ${model.to}`),
  );
  elements.newChart.replaceChildren(
    trendSvg(
      model.newClientsTrend,
      "new",
      `日新增客户端趋势，${model.from} 至 ${model.to}`,
    ),
  );
  renderDistribution(
    elements.versionBody,
    model.latest.versions,
    "最新日暂无版本分布",
    "活跃客户端",
    "progress-teal",
  );
  renderDistribution(
    elements.channelBody,
    model.latest.channels,
    "最新日暂无渠道分布",
    "活跃客户端",
    "progress-teal",
  );
  renderDistribution(
    elements.osBody,
    model.latest.os,
    "最新日暂无系统分布",
    "活跃客户端",
    "progress-teal",
  );
  renderDistribution(
    elements.newChannelBody,
    model.newClientChannels,
    "当前范围暂无新增渠道数据",
    "新增客户端",
    "progress-amber",
  );
  renderRows(model);
  setVisibleState("content");
}

async function loadReport() {
  state.controller?.abort();
  state.controller = new AbortController();
  setVisibleState("loading");

  try {
    const response = await fetch(reportPath(state.range), {
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

document.querySelector("#refresh-button").addEventListener("click", loadReport);
document.querySelector("#retry-button").addEventListener("click", loadReport);

updateControls();
loadReport();
