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

function workingHours(enabled: boolean) {
  return { enabled, ranges: [{ fromMinutes: 540, toMinutes: 1080 }] };
}

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
    workingHoursMonday: workingHours(true),
    workingHoursTuesday: workingHours(true),
    workingHoursWednesday: workingHours(true),
    workingHoursThursday: workingHours(true),
    workingHoursFriday: workingHours(true),
    workingHoursSaturday: workingHours(false),
    workingHoursSunday: workingHours(false),
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
    playSoundPreview: vi.fn().mockResolvedValue(undefined),
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

  it("loads working hours and smart breaks into their groups", async () => {
    const client = makeClient(
      makeSettings({
        workingHoursEnabled: true,
        workingHoursSaturday: workingHours(false),
        idleResetEnabled: true,
        idleResetLengthSeconds: 300,
        idleResetNotification: true,
      }),
    );

    render(<SettingsWindow client={client} />);

    const globalSwitch = await screen.findByRole("switch", {
      name: "Restrict breaks to working hours",
    });
    expect(globalSwitch.getAttribute("aria-checked")).toBe("true");
    expect(
      screen
        .getByRole("switch", { name: "Monday" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen
        .getByRole("switch", { name: "Saturday" })
        .getAttribute("aria-checked"),
    ).toBe("false");
    expect(
      (screen.getByLabelText("Monday start 1") as HTMLInputElement).value,
    ).toBe("09:00");
    expect(
      (screen.getByLabelText("Monday end 1") as HTMLInputElement).value,
    ).toBe("18:00");
    expect(
      (screen.getByLabelText("Idle time in minutes") as HTMLInputElement).value,
    ).toBe("5");
    expect(
      (screen.getByLabelText("Idle time in seconds") as HTMLInputElement).value,
    ).toBe("0");
    expect(
      screen
        .getByRole("switch", {
          name: "Show notification when break automatically detected",
        })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("saves an edited working-hours range", async () => {
    const client = makeClient(makeSettings({ workingHoursEnabled: true }));
    render(<SettingsWindow client={client} />);

    const start = await screen.findByLabelText("Monday start 1");
    fireEvent.change(start, { target: { value: "10:00" } });
    expect((start as HTMLInputElement).value).toBe("10:00");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(client.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          workingHoursMonday: {
            enabled: true,
            ranges: [{ fromMinutes: 600, toMinutes: 1080 }],
          },
        }),
      );
    });
  });

  it("adds and removes working-hours ranges", async () => {
    const client = makeClient(makeSettings({ workingHoursEnabled: true }));
    render(<SettingsWindow client={client} />);

    const addButton = await screen.findByRole("button", {
      name: "Add Monday range",
    });
    fireEvent.click(addButton);

    expect(screen.getByLabelText("Monday start 2")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Monday range 1" }),
    );

    expect(screen.queryByLabelText("Monday start 2")).toBeNull();
    expect(screen.getByLabelText("Monday start 1")).toBeTruthy();
  });

  it("saves idle-reset duration and notification edits", async () => {
    const client = makeClient(
      makeSettings({ idleResetEnabled: true, idleResetLengthSeconds: 300 }),
    );
    render(<SettingsWindow client={client} />);

    const seconds = await screen.findByLabelText("Idle time in seconds");
    fireEvent.change(seconds, { target: { value: "30" } });
    fireEvent.click(
      screen.getByRole("switch", {
        name: "Show notification when break automatically detected",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(client.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          idleResetLengthSeconds: 330,
          idleResetNotification: true,
        }),
      );
    });
  });

  it("disables smart-break controls when idle reset is off", async () => {
    const client = makeClient(makeSettings({ idleResetEnabled: false }));
    render(<SettingsWindow client={client} />);

    const minutes = (await screen.findByLabelText(
      "Idle time in minutes",
    )) as HTMLInputElement;
    const notification = screen.getByRole("switch", {
      name: "Show notification when break automatically detected",
    });

    expect(minutes.disabled).toBe(true);
    expect(notification.hasAttribute("disabled")).toBe(true);
  });

  it("loads the break type, cadence, length and text", async () => {
    const client = makeClient(
      makeSettings({
        notificationType: "POPUP",
        breakFrequencySeconds: 1500,
        breakLengthSeconds: 90,
        breakTitle: "Stretch",
        breakMessage: "Stand up.",
      }),
    );
    render(<SettingsWindow client={client} />);

    const type = (await screen.findByLabelText(
      "Break type",
    )) as HTMLSelectElement;
    expect(type.value).toBe("POPUP");
    expect(
      (
        screen.getByRole("option", {
          name: "Notification",
        }) as HTMLOptionElement
      ).value,
    ).toBe("NOTIFICATION");
    expect(
      (screen.getByLabelText("Break frequency in minutes") as HTMLInputElement)
        .value,
    ).toBe("25");
    expect(
      (screen.getByLabelText("Break frequency in seconds") as HTMLInputElement)
        .value,
    ).toBe("0");
    expect(
      (screen.getByLabelText("Break length in minutes") as HTMLInputElement)
        .value,
    ).toBe("1");
    expect(
      (screen.getByLabelText("Break length in seconds") as HTMLInputElement)
        .value,
    ).toBe("30");
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      "Stretch",
    );
    expect(
      (screen.getByLabelText("Message") as HTMLTextAreaElement).value,
    ).toBe("Stand up.");
  });

  it("saves an edited break type and frequency", async () => {
    const client = makeClient(makeSettings({ notificationType: "POPUP" }));
    render(<SettingsWindow client={client} />);

    fireEvent.change(await screen.findByLabelText("Break type"), {
      target: { value: "NOTIFICATION" },
    });
    fireEvent.change(screen.getByLabelText("Break frequency in minutes"), {
      target: { value: "45" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(client.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationType: "NOTIFICATION",
          breakFrequencySeconds: 45 * 60,
        }),
      );
    });
  });

  it("disables the break length while in notification mode", async () => {
    const client = makeClient(
      makeSettings({ notificationType: "NOTIFICATION" }),
    );
    render(<SettingsWindow client={client} />);

    const length = (await screen.findByLabelText(
      "Break length in minutes",
    )) as HTMLInputElement;

    expect(length.disabled).toBe(true);
    expect(
      (screen.getByLabelText("Break frequency in minutes") as HTMLInputElement)
        .disabled,
    ).toBe(false);
  });

  it("previews the selected sound at the drafted volume", async () => {
    const client = makeClient(
      makeSettings({ soundType: "GONG", breakSoundVolume: 0.5 }),
    );
    render(<SettingsWindow client={client} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Preview break sound" }),
    );

    await waitFor(() => {
      expect(client.playSoundPreview).toHaveBeenCalledWith("GONG", 0.5);
    });
  });

  it("saves an edited volume and hides the preview when the sound is off", async () => {
    const client = makeClient(
      makeSettings({ soundType: "PING", breakSoundVolume: 1 }),
    );
    render(<SettingsWindow client={client} />);

    fireEvent.change(await screen.findByLabelText("Break sound volume"), {
      target: { value: "0.25" },
    });
    fireEvent.change(screen.getByLabelText("Break sound"), {
      target: { value: "NONE" },
    });

    expect(
      screen.queryByRole("button", { name: "Preview break sound" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(client.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          soundType: "NONE",
          breakSoundVolume: 0.25,
        }),
      );
    });
  });

  it("edits the menu bar text mode", async () => {
    const client = makeClient(
      makeSettings({
        trayTextEnabled: true,
        trayTextMode: "TIME_TO_NEXT_BREAK",
      }),
    );
    render(<SettingsWindow client={client} />);

    const mode = (await screen.findByLabelText("Text")) as HTMLSelectElement;
    expect(mode.disabled).toBe(false);

    fireEvent.change(mode, { target: { value: "TIME_SINCE_LAST_BREAK" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(client.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({ trayTextMode: "TIME_SINCE_LAST_BREAK" }),
      );
    });
  });

  it("enables the menu bar text selector with its switch", async () => {
    const client = makeClient(makeSettings({ trayTextEnabled: false }));
    render(<SettingsWindow client={client} />);

    expect(
      ((await screen.findByLabelText("Text")) as HTMLSelectElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole("switch", { name: "Show menu bar text" }));

    expect((screen.getByLabelText("Text") as HTMLSelectElement).disabled).toBe(
      false,
    );
  });
});
