import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const UTF8_BOM = [0xef, 0xbb, 0xbf];

describe("PowerShell script encoding", () => {
  it("saves scripts with non-ASCII characters as UTF-8 with BOM", async () => {
    const entries = await readdir(scriptsDir);
    const scripts = entries.filter((name) => name.endsWith(".ps1"));
    expect(scripts.length).toBeGreaterThan(0);

    const missingBom = [];
    for (const name of scripts) {
      const bytes = await readFile(path.join(scriptsDir, name));
      const hasNonAscii = bytes.some((byte) => byte > 0x7f);
      if (!hasNonAscii) {
        continue;
      }
      const hasBom = UTF8_BOM.every((byte, index) => bytes[index] === byte);
      if (!hasBom) {
        missingBom.push(name);
      }
    }

    // Windows PowerShell 5.1 decodes BOM-less scripts as ANSI, which turns
    // Chinese literals such as `chore(release): 发布` into mojibake.
    expect(missingBom).toEqual([]);
  });
});
