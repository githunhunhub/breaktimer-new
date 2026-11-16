import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const config = JSON.parse(
  readFileSync(
    new URL("../src-tauri/tauri.conf.json", import.meta.url),
    "utf8",
  ),
);
const nsisConfig = config.bundle.windows.nsis;

describe("NSIS installer language configuration", () => {
  it("uses English as the fallback and supports Simplified Chinese", () => {
    expect(nsisConfig.languages).toEqual(["English", "SimpChinese"]);
  });

  it("uses the system language without showing a language selector", () => {
    expect(nsisConfig.displayLanguageSelector).toBe(false);
  });
});
