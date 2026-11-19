#!/usr/bin/env node

// Renders the shared SVG brand source into every raster icon required by the
// desktop app and the static site. Uses an installed Chromium-based browser.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const source = path.join(repoRoot, "app", "assets", "logo.svg");
const appPublic = path.join(repoRoot, "app", "public");
const assetsDir = path.join(repoRoot, "app", "assets");
const siteAssets = path.join(repoRoot, "site", "assets");
const tauriIcons = path.join(repoRoot, "app", "src-tauri", "icons");
const icoPath = path.join(tauriIcons, "icon.ico");

const browserCandidates = [
  process.env.BREAKTIMER_EDGE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

const browser = browserCandidates.find((candidate) => {
  return existsSync(candidate);
});

if (!browser) {
  throw new Error("No Chromium-based browser found; set BREAKTIMER_EDGE_PATH.");
}

const svg = await readFile(source, "utf8");
if (!svg.includes("<svg") || !svg.includes("viewBox=")) {
  throw new Error(`Unexpected SVG source: ${source}`);
}

const outputs = [
  [assetsDir, "logo.svg"],
  [appPublic, "favicon.svg"],
  [siteAssets, "logo.svg"],
  [siteAssets, "favicon.svg"],
];

const rasterSizes = new Map();
function rasterize(directory, name, size) {
  outputs.push([directory, name]);
  const key = path.join(directory, name);
  rasterSizes.set(key, size);
}

rasterize(siteAssets, "icon.png", 512);
rasterize(siteAssets, "icon-64.png", 64);
rasterize(appPublic, "icon.png", 256);
for (const name of await readdir(tauriIcons)) {
  const match = /^(\d+)x\1(?:@(\d+)x)?\.png$/.exec(name);
  if (!match) {
    continue;
  }
  const base = Number(match[1]);
  const scale = match[2] ? Number(match[2]) : 1;
  rasterize(tauriIcons, name, base * scale);
}
const fixedSizes = new Map([
  ["Square107x107Logo.png", 107],
  ["Square142x142Logo.png", 142],
  ["Square150x150Logo.png", 150],
  ["Square284x284Logo.png", 284],
  ["Square30x30Logo.png", 30],
  ["Square310x310Logo.png", 310],
  ["Square44x44Logo.png", 44],
  ["Square71x71Logo.png", 71],
  ["Square89x89Logo.png", 89],
  ["StoreLogo.png", 50],
  ["icon.png", 512],
]);
for (const [name, size] of fixedSizes) {
  rasterize(tauriIcons, name, size);
}

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function replaceIcoPngEntries(ico, renders) {
  if (ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) {
    throw new Error(`Unexpected ICO header: ${icoPath}`);
  }
  const count = ico.readUInt16LE(4);
  const entries = [];
  for (let i = 0; i < count; i += 1) {
    const offset = 6 + i * 16;
    entries.push({
      width: ico[offset] || 256,
      planes: ico.readUInt16LE(offset + 4),
      bitCount: ico.readUInt16LE(offset + 6),
    });
  }

  const pngByName = new Map(renders.map((render) => [render.name, render.png]));
  const bySize = new Map([
    [16, "32x32.png"],
    [24, "32x32.png"],
    [32, "32x32.png"],
    [48, "64x64.png"],
    [64, "64x64.png"],
    [256, "128x128@2x.png"],
  ]);
  const payloads = entries.map((entry) => {
    const name = bySize.get(entry.width);
    const payload = name && pngByName.get(name);
    if (!payload) {
      throw new Error(`No rendered PNG for ICO size ${entry.width}`);
    }
    return payload;
  });

  const headerSize = 6 + count * 16;
  let cursor = headerSize;
  const located = payloads.map((payload) => {
    const offset = cursor;
    cursor += payload.length;
    return offset;
  });
  const output = Buffer.alloc(cursor);
  ico.copy(output, 0, 0, 6);
  entries.forEach((entry, i) => {
    const payload = payloads[i];
    const offset = 6 + i * 16;
    output[offset] = entry.width === 256 ? 0 : entry.width;
    output[offset + 1] = entry.width === 256 ? 0 : entry.width;
    output[offset + 2] = entry.width === 256 ? 0 : entry.width;
    output[offset + 3] = entry.width === 256 ? 0 : entry.width;
    output.writeUInt16LE(entry.planes, offset + 4);
    output.writeUInt16LE(entry.bitCount, offset + 6);
    output.writeUInt32LE(payload.length, offset + 8);
    output.writeUInt32LE(located[i], offset + 12);
    payload.copy(output, located[i]);
  });
  return output;
}

function patchIcns(original) {
  const signature = original.toString("ascii", 0, 4);
  if (signature !== "icns") {
    throw new Error(`Unexpected ICNS header: ${signature}`);
  }
  const entries = new Map();
  let offset = 8;
  while (offset + 8 <= original.length) {
    const type = original.toString("ascii", offset, offset + 4);
    const length = original.readUInt32BE(offset + 4);
    if (
      length < 8 ||
      offset + length > original.length ||
      !/^[\x20-\x7e]{4}$/.test(type)
    ) {
      throw new Error(`Malformed ICNS entry: ${type}`);
    }
    entries.set(type, original.subarray(offset + 8, offset + length));
    offset += length;
  }

  const sizes = [
    ["ic10", 2048],
    ["ic09", 1024],
    ["ic13", 256],
    ["ic14", 512],
    ["ic08", 512],
    ["ic11", 32],
    ["ic12", 64],
    ["ic07", 128],
  ];
  const replacements = [];
  for (const [type, size] of sizes) {
    if (!entries.has(type)) {
      continue;
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    const scanlines = Buffer.alloc((size * 4 + 1) * size);
    for (let y = 0; y < size; y += 1) {
      scanlines[y * (size * 4 + 1)] = 0;
    }
    const namedPng = renderResults.find((render) => render.size === size)?.png;
    const scaledPng =
      namedPng ??
      (size >= 512
        ? renderResults.find((render) => render.name === "icon.png")?.png
        : undefined);
    const png =
      scaledPng ??
      Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", ihdr),
        chunk("IDAT", deflateSync(scanlines)),
        chunk("IEND", Buffer.alloc(0)),
      ]);
    replacements.push([type, png]);
  }
  for (const [type, png] of replacements) {
    entries.set(type, png);
  }

  const parts = [original.subarray(0, 8)];
  let total = 8;
  for (const [type, data] of entries) {
    const header = Buffer.alloc(8);
    header.write(type, 0, 4, "ascii");
    header.writeUInt32BE(data.length + 8, 4);
    parts.push(header, data);
    total += header.length + data.length;
  }
  const output = Buffer.concat(parts);
  output.writeUInt32BE(total, 4);
  return output;
}

const tempDir = await mkdtemp(path.join(os.tmpdir(), "breaktimer-logo-"));
const htmlPath = path.join(tempDir, "render.html");
const screenshotPath = path.join(tempDir, "render.png");
const renderResults = [];

try {
  for (const [directory, name] of outputs) {
    if (name.endsWith(".svg")) {
      await writeFile(path.join(directory, name), svg);
      continue;
    }

    const size = rasterSizes.get(path.join(directory, name));
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style></head><body><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"></body></html>`;
    await writeFile(htmlPath, html, "utf8");
    await rm(screenshotPath, { force: true });
    execFileSync(
      browser,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        `--screenshot=${screenshotPath}`,
        `--window-size=${size},${size}`,
        "--default-background-color=00000000",
        `file:///${htmlPath.replaceAll("\\", "/")}`,
      ],
      { stdio: "ignore" },
    );
    const png = await readFile(screenshotPath);
    await writeFile(path.join(directory, name), png);
    renderResults.push({ name, png, size });
  }

  const ico = await readFile(icoPath);
  await writeFile(icoPath, replaceIcoPngEntries(ico, renderResults));

  const icnsPath = path.join(tauriIcons, "icon.icns");
  const icns = await readFile(icnsPath);
  await writeFile(icnsPath, patchIcns(icns));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log(
  `Rendered ${outputs.length + 2} brand assets from app/assets/logo.svg.`,
);
