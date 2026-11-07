#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_REPO = "githunhunhub/breaktimer-new";
const API_ROOT = "https://api.github.com";
const MARKER_PATTERN = /<!--\s*breaktimer-downloads([\s\S]*?)-->/;
const QUARK_HOST = "pan.quark.cn";
const BAIDU_HOST = "pan.baidu.com";

function stringOrNull(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function httpsHost(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.hostname : null;
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toggleHidden(tag, hidden) {
  const visible = tag.replace(/\s+hidden(?:="[^"]*")?(?=[\s>])/i, "");
  return hidden ? visible.replace(/>$/, " hidden>") : visible;
}

/**
 * Validates the parsed `breaktimer-downloads` marker payload.
 * Empty, null or missing values mean "not configured yet".
 */
export function validateDownloadLinks(value) {
  const source = value && typeof value === "object" ? value : {};
  const quark = stringOrNull(source.quark);
  const baidu = stringOrNull(source.baidu);

  if (quark && httpsHost(quark) !== QUARK_HOST) {
    throw new Error(
      `Quark download link must use https://${QUARK_HOST}/...: ${quark}`,
    );
  }
  if (baidu && httpsHost(baidu) !== BAIDU_HOST) {
    throw new Error(
      `Baidu download link must use https://${BAIDU_HOST}/...: ${baidu}`,
    );
  }

  return {
    quark,
    baidu,
    baiduCode: baidu ? stringOrNull(source.baiduCode) : null,
  };
}

/**
 * Reads the hidden `<!-- breaktimer-downloads {...} -->` marker that
 * `app/scripts/release-downloads.mjs` appends to every release body.
 */
export function parseDownloadMetadata(body) {
  const match = MARKER_PATTERN.exec(typeof body === "string" ? body : "");
  if (!match) {
    return { quark: null, baidu: null, baiduCode: null };
  }

  let payload;
  try {
    payload = JSON.parse(match[1].trim());
  } catch {
    throw new Error(
      "Release body has an invalid breaktimer-downloads marker: expected JSON.",
    );
  }

  return validateDownloadLinks(payload);
}

function replaceDownloadLink(html, kind, url) {
  const pattern = new RegExp(
    `<!--\\s*release-download:${kind}\\s*-->[\\s\\S]*?<a\\b[^>]*?\\bhref="[^"]*"`,
    "i",
  );
  if (!pattern.test(html)) {
    throw new Error(`Missing release-download:${kind} placeholder.`);
  }
  if (!url) {
    return html;
  }

  return html.replace(pattern, (block) =>
    block.replace(/href="[^"]*"$/, `href="${escapeHtml(url)}"`),
  );
}

function setCardHidden(html, kind, hidden) {
  const pattern = new RegExp(
    `<article\\b[^>]*\\bdata-download-card="${kind}"[^>]*>`,
    "i",
  );
  if (!pattern.test(html)) {
    throw new Error(`Missing data-download-card="${kind}" placeholder.`);
  }

  return html.replace(pattern, (tag) => toggleHidden(tag, hidden));
}

function applyBaiduCode(html, code) {
  const paragraph = /<([a-z][a-z0-9-]*)\b[^>]*\bdata-download-code\b[^>]*>/i;
  if (!paragraph.test(html)) {
    if (code) {
      throw new Error("Missing data-download-code placeholder.");
    }
    return html;
  }

  let result = html.replace(paragraph, (tag) => toggleHidden(tag, !code));
  if (!code) {
    return result;
  }

  const value =
    /(<([a-z][a-z0-9-]*)\b[^>]*\bdata-baidu-code\b[^>]*>)[\s\S]*?(<\/\2>)/i;
  if (!value.test(result)) {
    throw new Error("Missing data-baidu-code placeholder.");
  }

  return result.replace(value, `$1${escapeHtml(code)}$3`);
}

function applyFallback(html, showFallback) {
  const pattern = /<([a-z][a-z0-9-]*)\b[^>]*\bdata-download-fallback\b[^>]*>/i;
  if (!pattern.test(html)) {
    throw new Error("Missing data-download-fallback placeholder.");
  }

  return html.replace(pattern, (tag) => toggleHidden(tag, !showFallback));
}

function applyVersion(html, tagName) {
  if (typeof tagName !== "string" || tagName.trim() === "") {
    throw new Error("Release is missing tag_name.");
  }

  const pattern =
    /(<([a-z][a-z0-9-]*)\b[^>]*\bdata-release-version\b[^>]*>)[\s\S]*?(<\/\2>)/i;
  if (!pattern.test(html)) {
    throw new Error("Missing data-release-version placeholder.");
  }

  return html.replace(pattern, `$1${escapeHtml(tagName.trim())}$3`);
}

export function applyReleaseLinks(html, release) {
  const links = parseDownloadMetadata(release?.body ?? "");
  const hasAnyLink = Boolean(links.baidu || links.quark);

  let result = html;
  result = replaceDownloadLink(result, "baidu", links.baidu);
  result = replaceDownloadLink(result, "quark", links.quark);
  result = setCardHidden(result, "baidu", !links.baidu);
  result = setCardHidden(result, "quark", !links.quark);
  result = applyBaiduCode(result, links.baiduCode);
  result = applyFallback(result, !hasAnyLink);

  return applyVersion(result, release?.tag_name);
}

export async function fetchLatestRelease({
  repo = DEFAULT_REPO,
  token,
  fetchImpl = fetch,
} = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "breaktimer-new-pages",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetchImpl(`${API_ROOT}/repos/${repo}/releases/latest`, {
    headers,
  });
  if (!response.ok) {
    throw new Error(
      `GitHub API request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

export async function resolveSiteDownloads(siteDir, release) {
  const pages = ["index.html", path.join("en", "index.html")];
  for (const page of pages) {
    const file = path.join(siteDir, page);
    const html = await readFile(file, "utf8");
    await writeFile(file, applyReleaseLinks(html, release), "utf8");
  }
}

async function main() {
  const siteDir = path.resolve(process.argv[2] ?? "_site");
  const repo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO;
  const release = await fetchLatestRelease({
    repo,
    token: process.env.GITHUB_TOKEN,
  });
  await resolveSiteDownloads(siteDir, release);

  const links = parseDownloadMetadata(release.body ?? "");
  const configured = [
    links.baidu ? "baidu" : null,
    links.quark ? "quark" : null,
  ].filter(Boolean);
  console.log(
    configured.length > 0
      ? `Resolved ${release.tag_name} download links (${configured.join(", ")}) in ${siteDir}.`
      : `Resolved ${release.tag_name}: no netdisk links configured, pages fall back to GitHub Releases.`,
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
