// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Settings } from "@/types/settings";

import { SettingsWindow, type SettingsClient } from "./settings-window";

afterEach(cleanup);

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
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

function makeClient(settings: Settings): SettingsClient {
  return {
    getSettings: vi.fn().mockResolvedValue(settings),
    setSettings: vi.fn().mockResolvedValue(undefined),
  };
}

describe("SettingsWindow", () => {
  it("loads settings into the general controls", async () => {
    const client = makeClient(
      makeSettings({ breaksEnabled: false, autoLaunch: true }),
    );

    render(<SettingsWindow client={client} />);

    const breaksSwitch = await screen.findByRole("switch", {
      name: "Breaks enabled",
    });
    const autoLaunchSwitch = screen.getByRole("switch", {
      name: "Launch at login",
    });
    const saveButton = screen.getByRole("button", { name: "Save" });

    expect(breaksSwitch.getAttribute("aria-checked")).toBe("false");
    expect(autoLaunchSwitch.getAttribute("aria-checked")).toBe("true");
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves the edited draft once and clears the dirty state", async () => {
    const client = makeClient(makeSettings());
    render(<SettingsWindow client={client} />);

    const breaksSwitch = await screen.findByRole("switch", {
      name: "Breaks enabled",
    });
    const saveButton = screen.getByRole("button", {
      name: "Save",
    }) as HTMLButtonElement;

    fireEvent.click(breaksSwitch);

    expect(breaksSwitch.getAttribute("aria-checked")).toBe("false");
    expect(saveButton.disabled).toBe(false);

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(client.setSettings).toHaveBeenCalledTimes(1);
    });
    expect(client.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ breaksEnabled: false }),
    );
    await waitFor(() => {
      expect(saveButton.disabled).toBe(true);
    });
  });

  it("keeps the draft and reports an error when saving fails", async () => {
    const client = makeClient(makeSettings());
    client.setSettings = vi.fn().mockRejectedValue(new Error("disk full"));
    render(<SettingsWindow client={client} />);

    const breaksSwitch = await screen.findByRole("switch", {
      name: "Breaks enabled",
    });
    const saveButton = screen.getByRole("button", {
      name: "Save",
    }) as HTMLButtonElement;

    fireEvent.click(breaksSwitch);
    fireEvent.click(saveButton);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "disk full",
    );
    expect(breaksSwitch.getAttribute("aria-checked")).toBe("false");
    expect(saveButton.disabled).toBe(false);
  });
});
