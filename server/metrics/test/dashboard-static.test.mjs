import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const METRICS_ROOT = path.resolve(TEST_DIR, "..");
const DASHBOARD_ROOT = path.join(METRICS_ROOT, "public", "dashboard");

async function readText(file) {
  return readFile(path.join(DASHBOARD_ROOT, file), "utf8");
}

test("dashboard ships the required local page, styles, scripts and graphic", async () => {
  const files = [
    "index.html",
    "dashboard.css",
    "dashboard.js",
    "dashboard-core.js",
    "mark.svg",
  ];
  for (const file of files) {
    assert.equal((await stat(path.join(DASHBOARD_ROOT, file))).isFile(), true, file);
  }

  const html = await readText("index.html");
  for (const id of [
    "range-7d",
    "range-30d",
    "range-90d",
    "granularity-day",
    "granularity-month",
    "refresh-button",
    "loading-state",
    "empty-state",
    "error-state",
    "retry-button",
    "dashboard-content",
    "metric-total",
    "metric-active",
    "metric-new",
    "metric-versions",
    "active-chart",
    "new-chart",
    "version-table-body",
    "detail-table-body",
    "data-updated",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(html, /<script[^>]+src="\/dashboard\/dashboard\.js"[^>]*><\/script>/);
  assert.match(html, /<link[^>]+href="\/dashboard\/dashboard\.css"/);
  assert.match(html, /<img[^>]+src="\/dashboard\/mark\.svg"/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)/i);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /\bstyle\s*=/i);

  for (const file of files.filter((name) => /\.(?:html|css|js|svg)$/.test(name))) {
    const text = await readText(file);
    const withoutSvgNamespace = text.replace(
      "http://www.w3.org/2000/svg",
      "",
    );
    assert.doesNotMatch(
      withoutSvgNamespace,
      /https?:\/\//i,
      `${file} contains a remote URL`,
    );
    assert.doesNotMatch(text, /\bAuthorization\b/i, `${file} contains authorization`);
    assert.doesNotMatch(text, /MAINTENANCE_TOKEN/, `${file} contains a token`);
  }

  const css = await readText("dashboard.css");
  assert.doesNotMatch(css, /@import\b/i);
  assert.doesNotMatch(css, /url\(\s*['"]?(?:https?:)?\/\//i);

  for (const [file, resource] of [
    ["index.html", "/dashboard/dashboard.js"],
    ["index.html", "/dashboard/dashboard.css"],
    ["index.html", "/dashboard/mark.svg"],
  ]) {
    const text = await readText(file);
    assert.equal(text.includes(resource), true, `${file} -> ${resource}`);
    assert.equal(
      (await stat(path.join(DASHBOARD_ROOT, path.basename(resource)))).isFile(),
      true,
      resource,
    );
  }
});

test("EdgeOne headers isolate dashboard security and cache policies", async () => {
  const config = JSON.parse(
    await readFile(path.join(METRICS_ROOT, "edgeone.json"), "utf8"),
  );
  const bySource = new Map();
  for (const entry of config.headers || []) {
    bySource.set(
      entry.source,
      new Map((entry.headers || []).map(({ key, value }) => [key.toLowerCase(), value])),
    );
  }

  for (const source of ["/dashboard", "/dashboard/*"]) {
    const dashboard = bySource.get(source);
    assert.ok(dashboard, `missing ${source} header rule`);
    const csp = dashboard.get("content-security-policy");
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self'/);
    assert.match(csp, /style-src 'self'/);
    assert.match(csp, /connect-src 'self'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /base-uri 'none'/);
    assert.match(csp, /form-action 'none'/);
    assert.equal(dashboard.get("referrer-policy"), "no-referrer");
    assert.equal(dashboard.get("x-content-type-options"), "nosniff");
    assert.equal(dashboard.get("x-frame-options"), "DENY");
    assert.match(dashboard.get("permissions-policy"), /camera=\(\)/);
    assert.match(dashboard.get("cache-control"), /max-age=60/);
  }

  const common = bySource.get("/*");
  assert.ok(common, "missing common header rule");
  assert.equal(common.get("x-content-type-options"), "nosniff");
  assert.equal(common.get("referrer-policy"), "no-referrer");

  for (const source of ["/api/report", "/v1/collect"]) {
    const rule = bySource.get(source);
    assert.ok(rule, `missing ${source} header rule`);
    assert.equal(rule.get("cache-control"), "no-store");
  }
  assert.equal(bySource.has("/api/public-report"), true);
});

test("dashboard script uses one same-origin API and renders states separately", async () => {
  const script = await readText("dashboard.js");
  const core = await readText("dashboard-core.js");
  assert.match(`${script}\n${core}`, /\/api\/public-report/);
  assert.doesNotMatch(script, /fetch\([^)]*https?:/i);
  assert.match(script, /AbortController/);
  assert.match(script, /loading-state/);
  assert.match(script, /empty-state/);
  assert.match(script, /error-state/);
  assert.match(script, /retry-button/);
});
