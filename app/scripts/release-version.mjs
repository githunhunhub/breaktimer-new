#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");

const versionFiles = {
  packageJson: path.join(appRoot, "package.json"),
  tauriConfig: path.join(appRoot, "src-tauri", "tauri.conf.json"),
  cargoToml: path.join(appRoot, "src-tauri", "Cargo.toml"),
  cargoLock: path.join(appRoot, "src-tauri", "Cargo.lock"),
};

export function parseVersion(value) {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(
    String(value).trim(),
  );
  if (!match) {
    throw new Error(`Invalid release version: ${value}. Expected vX.Y.Z.`);
  }
  return match.slice(1).join(".");
}

export function releaseAssetName(kind, rawVersion) {
  const version = parseVersion(rawVersion);
  if (kind === "nsis") {
    return `BreakTimer-new_v${version}_x64-setup.exe`;
  }
  if (kind === "portable") {
    return `BreakTimer-new_v${version}_x64-portable.zip`;
  }
  throw new Error(
    `Unknown release asset kind: ${kind}. Expected nsis or portable.`,
  );
}

export function replaceTomlPackageVersion(source, version) {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/);
  let inPackage = false;
  let replaced = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "[package]") {
      inPackage = true;
      continue;
    }
    if (inPackage && /^\[.*\]$/.test(line.trim())) {
      break;
    }
    if (inPackage && /^version\s*=/.test(line)) {
      lines[index] = `version = "${version}"`;
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    throw new Error("Could not find version in the Cargo [package] section.");
  }
  return lines.join(newline);
}

export function replaceJsonVersion(source, version) {
  const parsed = JSON.parse(source);
  if (typeof parsed.version !== "string") {
    throw new Error("Missing top-level string version in JSON.");
  }

  const pattern = /^(\s*"version"\s*:\s*")[^"]+(")/m;
  if (!pattern.test(source)) {
    throw new Error("Could not find the top-level JSON version.");
  }
  return source.replace(pattern, `$1${version}$2`);
}

export function replaceCargoLockVersion(source, version) {
  const pattern =
    /(\[\[package\]\]\r?\nname = "breaktimer-new"\r?\nversion = ")[^"]+(")/;
  if (!pattern.test(source)) {
    throw new Error(
      'Could not find the "breaktimer-new" package in Cargo.lock.',
    );
  }
  return source.replace(pattern, `$1${version}$2`);
}

export function readTomlPackageVersion(source) {
  const lines = source.split(/\r?\n/);
  let inPackage = false;

  for (const line of lines) {
    if (line.trim() === "[package]") {
      inPackage = true;
      continue;
    }
    if (inPackage && /^\[.*\]$/.test(line.trim())) {
      break;
    }
    if (inPackage) {
      const match = /^version\s*=\s*"([^"]+)"/.exec(line);
      if (match) {
        return match[1];
      }
    }
  }

  throw new Error("Could not find version in the Cargo [package] section.");
}

export function verifyVersions(expected, versions) {
  const mismatches = Object.entries(versions).filter(
    ([, actual]) => actual !== expected,
  );
  if (mismatches.length > 0) {
    const details = mismatches
      .map(([file, actual]) => `  ${file}: ${actual}`)
      .join("\n");
    throw new Error(`Release version ${expected} does not match:\n${details}`);
  }
}

function cargoLockVersion(source) {
  const match =
    /\[\[package\]\]\r?\nname = "breaktimer-new"\r?\nversion = "([^"]+)"/.exec(
      source,
    );
  if (!match) {
    throw new Error(
      'Could not find the "breaktimer-new" package in Cargo.lock.',
    );
  }
  return match[1];
}

async function readJsonVersion(file) {
  const parsed = JSON.parse(await readFile(file, "utf8"));
  if (typeof parsed.version !== "string") {
    throw new Error(
      `Missing string version in ${path.relative(appRoot, file)}.`,
    );
  }
  return parsed.version;
}

async function readVersions() {
  const [cargoToml, cargoLock] = await Promise.all([
    readFile(versionFiles.cargoToml, "utf8"),
    readFile(versionFiles.cargoLock, "utf8"),
  ]);

  return {
    "app/package.json": await readJsonVersion(versionFiles.packageJson),
    "app/src-tauri/tauri.conf.json": await readJsonVersion(
      versionFiles.tauriConfig,
    ),
    "app/src-tauri/Cargo.toml": readTomlPackageVersion(cargoToml),
    "app/src-tauri/Cargo.lock": cargoLockVersion(cargoLock),
  };
}

async function checkVersion(rawVersion) {
  const version = parseVersion(rawVersion);
  const versions = await readVersions();
  verifyVersions(version, versions);
  for (const file of Object.keys(versions)) {
    console.log(`${file}: ${version}`);
  }
  console.log(`Release version ${version} is consistent.`);
}

async function setVersion(rawVersion) {
  const version = parseVersion(rawVersion);
  const [
    packageJsonSource,
    tauriConfigSource,
    cargoTomlSource,
    cargoLockSource,
  ] = await Promise.all([
    readFile(versionFiles.packageJson, "utf8"),
    readFile(versionFiles.tauriConfig, "utf8"),
    readFile(versionFiles.cargoToml, "utf8"),
    readFile(versionFiles.cargoLock, "utf8"),
  ]);

  const packageJson = replaceJsonVersion(packageJsonSource, version);
  const tauriConfig = replaceJsonVersion(tauriConfigSource, version);
  const cargoToml = replaceTomlPackageVersion(cargoTomlSource, version);
  const cargoLock = replaceCargoLockVersion(cargoLockSource, version);

  await Promise.all([
    writeFile(versionFiles.packageJson, packageJson),
    writeFile(versionFiles.tauriConfig, tauriConfig),
    writeFile(versionFiles.cargoToml, cargoToml),
    writeFile(versionFiles.cargoLock, cargoLock),
  ]);

  await checkVersion(version);
  console.log(`Updated four release version files to ${version}.`);
}

async function main() {
  const [command, first, second] = process.argv.slice(2);
  if (command === "asset-name") {
    if (!first || !second) {
      throw new Error(
        "Usage: release-version.mjs asset-name <nsis|portable> <version>",
      );
    }
    console.log(releaseAssetName(first, second));
    return;
  }
  if (!first) {
    throw new Error("Usage: release-version.mjs <check|set> <version>");
  }
  if (command === "check") {
    await checkVersion(first);
    return;
  }
  if (command === "set") {
    await setVersion(first);
    return;
  }
  throw new Error(
    `Unknown command: ${command}. Expected check, set, or asset-name.`,
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
