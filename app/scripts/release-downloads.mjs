#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

export function parseDownloads(value) {
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

export function renderDownloadSection(config) {
  const links = parseDownloads(config);
  if (!links.baidu && !links.quark) {
    return "";
  }

  const lines = ["", "## 下载方式", ""];

  if (links.baidu) {
    const code = links.baiduCode ? `（提取码：${links.baiduCode}）` : "";
    lines.push(`- [百度网盘](${links.baidu})${code}`);
  }
  if (links.quark) {
    lines.push(`- [夸克网盘](${links.quark})`);
  }

  const marker = {};
  if (links.baidu) marker.baidu = links.baidu;
  if (links.quark) marker.quark = links.quark;
  if (links.baiduCode) marker.baiduCode = links.baiduCode;
  lines.push("", `<!-- breaktimer-downloads ${JSON.stringify(marker)} -->`, "");

  return lines.join("\n");
}

export function appendDownloadSection(body, config) {
  const section = renderDownloadSection(config);
  return section ? `${body.trimEnd()}\n${section}` : body;
}

async function readJsonIfPresent(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return {};
    throw error;
  }
}

async function main() {
  const [bodyFile, configFile, outputFile] = process.argv.slice(2);
  if (!bodyFile || !configFile) {
    throw new Error(
      "Usage: release-downloads.mjs <body-file> <config-file> [output-file]",
    );
  }

  const body = await readFile(bodyFile, "utf8");
  const config = await readJsonIfPresent(configFile);
  const next = appendDownloadSection(body, config);

  if (outputFile) {
    await writeFile(outputFile, next, "utf8");
  } else {
    process.stdout.write(next);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
