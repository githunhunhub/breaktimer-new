#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_REPO = "githunhunhub/breaktimer-new";
const API_ROOT = "https://api.github.com";

function downloadPattern(kind) {
  return new RegExp(
    `(<!--\\s*release-download:${kind}\\s*-->[\\s\\S]*?<a\\b[^>]*?\\bhref=")[^"]*(")`,
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function selectReleaseAssets(assets) {
  const installers = assets.filter((asset) => asset.name.endsWith("-setup.exe"));
  const portables = assets.filter((asset) => asset.name.endsWith("-portable.zip"));

  if (installers.length !== 1) {
    throw new Error(`Expected exactly one *-setup.exe asset, found ${installers.length}.`);
  }
  if (portables.length !== 1) {
    throw new Error(`Expected exactly one *-portable.zip asset, found ${portables.length}.`);
  }

  return {
    installer: installers[0],
    portable: portables[0],
  };
}

export function applyReleaseLinks(html, release) {
  const { installer, portable } = selectReleaseAssets(release.assets);
  const links = [
    ["nsis", installer.browser_download_url],
    ["portable", portable.browser_download_url],
  ];

  let result = html;
  for (const [kind, url] of links) {
    const pattern = downloadPattern(kind);
    if (!pattern.test(result)) {
      throw new Error(`Missing release-download:${kind} placeholder.`);
    }
    result = result.replace(pattern, `$1${url}$2`);
  }

  const versionPattern =
    /(<([a-z][a-z0-9-]*)\b[^>]*\bdata-release-version\b[^>]*>)[\s\S]*?(<\/\2>)/i;
  if (!versionPattern.test(result)) {
    throw new Error("Missing data-release-version placeholder.");
  }
  result = result.replace(versionPattern, `$1${escapeHtml(release.tag_name)}$3`);

  return result;
}

export async function fetchLatestRelease({ repo = DEFAULT_REPO, token, fetchImpl = fetch }) {
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
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
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
  console.log(`Resolved ${release.tag_name} download links in ${siteDir}.`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
