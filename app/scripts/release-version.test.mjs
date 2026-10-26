import { execFile, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import {
  parseVersion,
  readTomlPackageVersion,
  replaceCargoLockVersion,
  replaceJsonVersion,
  replaceTomlPackageVersion,
  verifyVersions,
} from "./release-version.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("./release-version.mjs", import.meta.url),
);

describe("release script argument forwarding", () => {
  it("keeps native arguments separate under Windows PowerShell 5", () => {
    const source = readFileSync(
      new URL("./release.ps1", import.meta.url),
      "utf8",
    );
    const match = /function Invoke-Native \{[\s\S]*?\n\}/.exec(source);
    if (!match) {
      throw new Error("Could not find Invoke-Native in release.ps1.");
    }

    const probe = [
      match[0].replace(
        "& $Command @Arguments",
        [
          "$script:forwarded = @($Arguments)",
          "& $Command @Arguments",
          "$global:LASTEXITCODE = 0",
        ].join("\n    "),
      ),
      `Invoke-Native git @("--version")`,
      "$script:forwarded | ForEach-Object -Begin { $index = 0 } -Process {",
      '  Write-Output "$($index)|<$_>"',
      "  $index++",
      "}",
    ].join("\n");
    const encoded = Buffer.from(probe, "utf16le").toString("base64");
    const result = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-EncodedCommand", encoded],
      { encoding: "utf8" },
    );
    const forwarded = result.stdout
      .trim()
      .split(/\r?\n/)
      .filter((line) => line.includes("|"));

    expect(result.status, result.stderr).toBe(0);
    expect(forwarded).toEqual(["0|<--version>"]);
  });
});

describe("release asset names", () => {
  it.each([
    ["nsis", "BreakTimer-new_v0.1.0_x64-setup.exe"],
    ["portable", "BreakTimer-new_v0.1.0_x64-portable.zip"],
  ])(
    "emits the %s asset name with a v-prefixed version",
    async (kind, name) => {
      const { stdout } = await execFileAsync(process.execPath, [
        scriptPath,
        "asset-name",
        kind,
        "v0.1.0",
      ]);

      expect(stdout.trim()).toBe(name);
    },
  );
});

describe("parseVersion", () => {
  it.each(["0.1.0", "v1.2.3"])("accepts %s", (value) => {
    expect(parseVersion(value)).toBe(value.replace(/^v/, ""));
  });

  it.each(["1.2", "v01.2.3", "1.2.3-beta.1", "release-1.2.3", ""])(
    "rejects %s",
    (value) => {
      expect(() => parseVersion(value)).toThrow("Invalid release version");
    },
  );
});

describe("replaceTomlPackageVersion", () => {
  it("updates only the package version", () => {
    const source = [
      "[package]",
      'name = "breaktimer-new"',
      'version = "0.1.0"',
      "",
      "[dependencies]",
      'tauri = { version = "2" }',
      "",
    ].join("\n");

    const updated = replaceTomlPackageVersion(source, "1.2.3");

    expect(updated).toContain('version = "1.2.3"');
    expect(updated).toContain('tauri = { version = "2" }');
  });

  it("fails when the package section has no version", () => {
    expect(() =>
      replaceTomlPackageVersion('[package]\nname = "missing"\n', "1.2.3"),
    ).toThrow("Cargo [package]");
  });
});

describe("readTomlPackageVersion", () => {
  it("does not fall through to dependency versions", () => {
    const source = [
      "[package]",
      'name = "breaktimer-new"',
      "",
      "[dependencies]",
      'tauri = { version = "2" }',
      "",
    ].join("\n");

    expect(() => readTomlPackageVersion(source)).toThrow("Cargo [package]");
  });
});

describe("replaceJsonVersion", () => {
  it("changes only the top-level version and preserves formatting", () => {
    const source = [
      "{",
      '  "name": "breaktimer-new",',
      '  "version": "0.1.0",',
      '  "nested": { "version": "9.9.9" }',
      "}",
      "",
    ].join("\n");

    const updated = replaceJsonVersion(source, "1.2.3");

    expect(updated).toContain('"version": "1.2.3"');
    expect(updated).toContain('"nested": { "version": "9.9.9" }');
    expect(updated).not.toContain('"version": "0.1.0"');
  });

  it("fails when the top-level version is missing", () => {
    expect(() => replaceJsonVersion('{"name":"missing"}', "1.2.3")).toThrow(
      "top-level string version",
    );
  });
});

describe("replaceCargoLockVersion", () => {
  const source = [
    "[[package]]",
    'name = "breaktimer-new"',
    'version = "0.1.0"',
    "",
    "[[package]]",
    'name = "other"',
    'version = "0.1.0"',
    "",
  ].join("\n");

  it("updates only the BreakTimer-new package", () => {
    const updated = replaceCargoLockVersion(source, "1.2.3");

    expect(updated).toContain('name = "breaktimer-new"\nversion = "1.2.3"');
    expect(updated).toContain('name = "other"\nversion = "0.1.0"');
  });

  it("fails when Cargo.lock has no BreakTimer-new package", () => {
    expect(() => replaceCargoLockVersion('name = "other"\n', "1.2.3")).toThrow(
      "breaktimer-new",
    );
  });
});

describe("verifyVersions", () => {
  it("accepts four matching versions", () => {
    expect(() =>
      verifyVersions("0.1.0", {
        package: "0.1.0",
        tauri: "0.1.0",
        cargo: "0.1.0",
        lock: "0.1.0",
      }),
    ).not.toThrow();
  });

  it("lists every mismatched file", () => {
    expect(() =>
      verifyVersions("0.2.0", {
        package: "0.2.0",
        tauri: "0.1.0",
        cargo: "0.3.0",
        lock: "0.2.0",
      }),
    ).toThrow(/tauri: 0\.1\.0[\s\S]*cargo: 0\.3\.0/);
  });
});
