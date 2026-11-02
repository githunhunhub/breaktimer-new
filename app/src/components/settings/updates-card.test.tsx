// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n";
import type { Settings } from "@/types/settings";
import type { UpdateCheckResult } from "@/types/updates";

import type { SettingsClient } from "./settings-window";
import { UpdatesCard } from "./updates-card";

afterEach(cleanup);

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    language: null,
    checkForUpdates: true,
    analyticsEnabled: true,
    autoLaunch: false,
    breaksEnabled: true,
    trayTextEnabled: false,
    trayTextMode: "TIME_TO_NEXT_BREAK",
    notificationType: "POPUP",
    breakFrequencySeconds: 1200,
    breakLengthSeconds: 20,
    postponeLengthSeconds: 300,
    postponeLimit: 3,
    workingHoursEnabled: false,
    workingHoursMonday: { enabled: true, ranges: [] },
    workingHoursTuesday: { enabled: true, ranges: [] },
    workingHoursWednesday: { enabled: true, ranges: [] },
    workingHoursThursday: { enabled: true, ranges: [] },
    workingHoursFriday: { enabled: true, ranges: [] },
    workingHoursSaturday: { enabled: false, ranges: [] },
    workingHoursSunday: { enabled: false, ranges: [] },
    idleResetEnabled: true,
    idleResetLengthSeconds: 300,
    idleResetNotification: false,
    soundType: "NONE",
    breakSoundVolume: 1,
    breakTitle: "Time for a break",
    breakMessage: "Look away from the screen.",
    backgroundColor: "#16a085",
    textColor: "#ffffff",
    showBackdrop: true,
    backdropOpacity: 0.7,
    endBreakEnabled: true,
    skipBreakEnabled: true,
    postponeBreakEnabled: true,
    immediatelyStartBreaks: false,
    ...overrides,
  };
}

function availableUpdate(): UpdateCheckResult {
  return {
    status: "available",
    currentVersion: "0.1.1",
    latestVersion: "0.1.2",
    releaseUrl:
      "https://github.com/githunhunhub/breaktimer-new/releases/tag/v0.1.2",
    publishedAt: "2026-11-02T00:00:00Z",
    checkedAt: 1_700_000_000,
    error: null,
    downloads: {
      quark: "https://pan.quark.cn/s/abc",
      baidu: "https://pan.baidu.com/s/def",
      baiduCode: "abcd",
    },
  };
}

function makeClient(
  result: UpdateCheckResult,
  portable = false,
): SettingsClient {
  return {
    getSettings: vi.fn().mockResolvedValue(makeSettings()),
    setSettings: vi.fn().mockResolvedValue(undefined),
    getAppInfo: vi.fn().mockResolvedValue({
      name: "BreakTimer-new",
      version: "0.1.1",
      settingsPath: "settings.json",
      portable,
    }),
    getUpdateStatus: vi.fn().mockResolvedValue(null),
    checkForUpdate: vi.fn().mockResolvedValue(result),
    openUpdateLink: vi.fn().mockResolvedValue(undefined),
    onUpdateStatus: vi.fn().mockResolvedValue(() => {}),
  };
}

describe("UpdatesCard", () => {
  it("checks manually and orders Baidu and Quark downloads", async () => {
    const client = makeClient(availableUpdate());
    const onPatch = vi.fn();

    render(
      <I18nProvider>
        <UpdatesCard
          settings={makeSettings()}
          onPatch={onPatch}
          client={client}
        />
      </I18nProvider>,
    );

    expect(await screen.findByText("Current version: 0.1.1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Check for updates" }));

    await waitFor(() => {
      expect(client.checkForUpdate).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("Version 0.1.2 is available.")).toBeTruthy();

    const downloadSection = screen.getByText("Download").parentElement;
    expect(downloadSection).not.toBeNull();
    expect(
      within(downloadSection as HTMLElement)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Baidu Drive", "Quark Drive"]);
    expect(
      screen.queryByRole("button", { name: "GitHub Releases" }),
    ).toBeNull();
    expect(screen.getByText("Extraction code: abcd")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Quark Drive" }));
    await waitFor(() => {
      expect(client.openUpdateLink).toHaveBeenCalledWith("quark");
    });
  });

  it("shows a hint instead of the GitHub entry when no net disk link is configured", async () => {
    const client = makeClient({
      ...availableUpdate(),
      downloads: {
        quark: null,
        baidu: null,
        baiduCode: null,
      },
    });

    render(
      <I18nProvider>
        <UpdatesCard
          settings={makeSettings()}
          onPatch={vi.fn()}
          client={client}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Check for updates" }));

    expect(
      await screen.findByText(
        "Download links are not configured yet. Please try again later.",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "GitHub Releases" }),
    ).toBeNull();
  });

  it("shows the portable replacement steps and preserves the data folder", async () => {
    const client = makeClient(availableUpdate(), true);

    render(
      <I18nProvider>
        <UpdatesCard
          settings={makeSettings()}
          onPatch={vi.fn()}
          client={client}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Check for updates" }));

    expect(
      await screen.findByText("Updating the portable version"),
    ).toBeTruthy();
    expect(
      screen.getByText(/Do not delete or replace the data\\ folder/),
    ).toBeTruthy();
    expect(screen.queryByText(/Download the NSIS installer/)).toBeNull();
  });

  it("reports a failed check without claiming the app is up to date", async () => {
    const client = makeClient({
      status: "unavailable",
      currentVersion: "0.1.1",
      latestVersion: null,
      releaseUrl: null,
      publishedAt: null,
      checkedAt: 1_700_000_000,
      error: "network",
      downloads: { quark: null, baidu: null, baiduCode: null },
    });

    render(
      <I18nProvider>
        <UpdatesCard
          settings={makeSettings()}
          onPatch={vi.fn()}
          client={client}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Check for updates" }));

    expect(
      await screen.findByText(
        "Unable to check for updates. Network unavailable.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("You're up to date.")).toBeNull();
  });

  it("patches the automatic-check setting", async () => {
    const client = makeClient(availableUpdate());
    const onPatch = vi.fn();

    render(
      <I18nProvider>
        <UpdatesCard
          settings={makeSettings({ checkForUpdates: true })}
          onPatch={onPatch}
          client={client}
        />
      </I18nProvider>,
    );

    fireEvent.click(
      screen.getByRole("switch", { name: "Check for updates automatically" }),
    );

    expect(onPatch).toHaveBeenCalledWith({ checkForUpdates: false });
  });
});
