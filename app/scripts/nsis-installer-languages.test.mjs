import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const config = JSON.parse(
  readFileSync(
    new URL("../src-tauri/tauri.conf.json", import.meta.url),
    "utf8",
  ),
);
const nsisConfig = config.bundle.windows.nsis;

function readLanguageFile(language) {
  const relativePath = nsisConfig.customLanguageFiles?.[language];
  if (!relativePath) {
    throw new Error(`Missing custom NSIS language file for ${language}`);
  }

  return readFileSync(
    new URL(`../src-tauri/${relativePath}`, import.meta.url),
    "utf8",
  );
}

function readLanguageString(language, name) {
  const content = readLanguageFile(language);
  const match = content.match(
    new RegExp(
      `^LangString\\s+${name}\\s+\\$\\{LANG_\\w+\\}\\s+"([^"]*)"`,
      "m",
    ),
  );
  if (!match) {
    throw new Error(`Missing ${name} in ${language}.nsh`);
  }

  return match[1];
}

describe("NSIS installer language configuration", () => {
  it("uses English as the fallback and supports Simplified Chinese", () => {
    expect(nsisConfig.languages).toEqual(["English", "SimpChinese"]);
  });

  it("uses the system language without showing a language selector", () => {
    expect(nsisConfig.displayLanguageSelector).toBe(false);
  });

  it("uses custom language files for every supported installer language", () => {
    expect(nsisConfig.customLanguageFiles).toEqual({
      English: "nsis/English.nsh",
      SimpChinese: "nsis/SimpChinese.nsh",
    });
  });

  it.each(["English", "SimpChinese"])(
    "preserves Tauri installer messages in the %s custom language file",
    (language) => {
      const content = readLanguageFile(language);
      const expectedMessages = [
        "addOrReinstall",
        "alreadyInstalled",
        "alreadyInstalledLong",
        "appRunning",
        "appRunningOkKill",
        "chooseMaintenanceOption",
        "choowHowToInstall",
        "createDesktop",
        "dontUninstall",
        "dontUninstallDowngrade",
        "failedToKillApp",
        "installingWebview2",
        "newerVersionInstalled",
        "older",
        "olderOrUnknownVersionInstalled",
        "silentDowngrades",
        "unableToUninstall",
        "uninstallApp",
        "uninstallBeforeInstalling",
        "unknown",
        "webview2AbortError",
        "webview2DownloadError",
        "webview2DownloadSuccess",
        "webview2Downloading",
        "webview2InstallError",
        "webview2InstallSuccess",
        "deleteAppData",
      ];

      for (const message of expectedMessages) {
        expect(content).toMatch(
          new RegExp(
            `^LangString\\s+${message}\\s+\\$\\{LANG_\\w+\\}\\s+"`,
            "m",
          ),
        );
      }
    },
  );

  it("does not mention closing other programs or restarting in the Simplified Chinese welcome page", () => {
    const text = readLanguageString(
      "SimpChinese",
      "MUI_TEXT_WELCOME_INFO_TEXT",
    );

    expect(text).toContain("退出正在运行的 $(^NameDA)");
    expect(text).not.toContain("无需关闭其他程序");
    expect(text).not.toContain("无需重启计算机");
    expect(text).not.toContain("关闭其他所有应用程序");
    expect(text).not.toContain("避免在安装后重新启动计算机");
  });

  it("does not mention closing other applications or restarting in the English welcome page", () => {
    const text = readLanguageString("English", "MUI_TEXT_WELCOME_INFO_TEXT");

    expect(text).toContain("quit any running instance of $(^NameDA)");
    expect(text).not.toContain("You do not need to close other applications");
    expect(text).not.toContain("restart your computer");
    expect(text).not.toContain("close all other applications");
    expect(text).not.toContain("avoid a reboot after installation");
  });
});
