#!/usr/bin/env node

import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const siteDir = path.resolve(process.argv[2] ?? "site");
const pages = ["index.html", path.join("en", "index.html"), "404.html"];
const errors = [];

function isExternal(value) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value) && !value.startsWith("/breaktimer-new/");
}

function targetFor(page, value) {
  const clean = value.split(/[?#]/, 1)[0];
  if (!clean) {
    return null;
  }
  if (clean.startsWith("/breaktimer-new/")) {
    return path.join(siteDir, clean.slice("/breaktimer-new/".length));
  }
  if (clean.startsWith("/")) {
    errors.push(`${page}: root-absolute path is not subpath-safe: ${value}`);
    return null;
  }
  return path.resolve(path.dirname(path.join(siteDir, page)), clean);
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function checkPage(page) {
  const file = path.join(siteDir, page);
  const html = await readFile(file, "utf8");

  if (/<script\b/i.test(html)) {
    errors.push(`${page}: unexpected <script>; the landing page must stay script-free.`);
  }

  const resourceAttributes = [
    ["script", "src"],
    ["img", "src"],
    ["source", "src"],
    ["video", "src"],
    ["audio", "src"],
    ["iframe", "src"],
  ];

  for (const [tag, attribute] of resourceAttributes) {
    const pattern = new RegExp(`<${tag}\\b[^>]*\\b${attribute}="([^"]+)"`, "gi");
    for (const match of html.matchAll(pattern)) {
      if (isExternal(match[1])) {
        errors.push(`${page}: remote resource in <${tag} ${attribute}>: ${match[1]}`);
      }
    }
  }

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/\brel="(?:stylesheet|icon|apple-touch-icon|manifest|preload|modulepreload)"/i.test(tag)) {
      continue;
    }
    const href = /\bhref="([^"]+)"/i.exec(tag);
    if (href && isExternal(href[1])) {
      errors.push(`${page}: remote resource in <link>: ${href[1]}`);
    }
  }

  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/gi)) {
    const value = match[1];
    if (value.startsWith("#") || value.startsWith("mailto:") || isExternal(value)) {
      continue;
    }
    const target = targetFor(page, value);
    if (!target) {
      continue;
    }
    const resolved = target.endsWith(path.sep) || value.endsWith("/") ? path.join(target, "index.html") : target;
    if (!(await exists(resolved))) {
      errors.push(`${page}: missing local target: ${value}`);
    }
  }
}

async function checkCss() {
  const assetsDir = path.join(siteDir, "assets");
  const files = (await readdir(assetsDir)).filter((file) => file.endsWith(".css"));
  for (const file of files) {
    const css = await readFile(path.join(assetsDir, file), "utf8");
    for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      if (isExternal(match[1])) {
        errors.push(`assets/${file}: remote url(): ${match[1]}`);
      }
    }
    for (const match of css.matchAll(/@import\s+(?:url\()?["']?([^"')\s;]+)/gi)) {
      if (isExternal(match[1])) {
        errors.push(`assets/${file}: remote @import: ${match[1]}`);
      }
    }
  }
}

for (const page of pages) {
  await checkPage(page);
  if (page !== "404.html") {
    const html = await readFile(path.join(siteDir, page), "utf8");
    for (const marker of [
      "release-download:baidu",
      "release-download:quark",
      "data-download-fallback",
    ]) {
      if (!html.includes(marker)) {
        errors.push(`${page}: missing ${marker} placeholder.`);
      }
    }
  }
}
await checkCss();

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  process.exitCode = 1;
} else {
  console.log("Static site checks passed: local resources only, no broken internal links.");
}
