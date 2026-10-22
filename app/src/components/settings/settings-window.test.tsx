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

async function openSettingsTab(name: string) {
  fireEvent.click(await screen.findByRole("tab", { name }));
}

describe("SettingsWindow", () => {
  it("shows the four settings tabs and opens General by default", async () => {
    const client = makeClient(makeSettings());

    render(<SettingsWindow client={client} />);

    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "General",
      "Working Hours",
      "Customization",
      "System",
    ]);
    expect(
      screen
        .getByRole("tab", { name: "General" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByRole("switch", { name: "Breaks enabled" })).toBeTruthy();
    expect(
      screen.queryByRole("switch", {
        name: "Restrict breaks to working hours",
      }),
    ).toBeNull();
  });

  it("orders General groups and keeps Breaks enabled in the Breaks header", async () => {
    const client = makeClient(makeSettings());

    render(<SettingsWindow client={client} />);

    await screen.findByLabelText("Break type");
    const groups = Array.from(
      document.querySelectorAll<HTMLElement>("[data-settings-group]"),
    );

    expect(groups.map((group) => group.dataset.settingsGroup)).toEqual([
      "Breaks",
      "Smart Breaks",
      "Snooze",
      "Skip",
      "Advanced",
    ]);
    const breaksHeader = within(groups[0])
      .getByText("Breaks")
      .closest('[data-slot="card-header"]');
    expect(breaksHeader).not.toBeNull();
    expect(
      within(breaksHeader as HTMLElement).getByRole("switch", {
        name: "Breaks enabled",
      }),
    ).toBeTruthy();
  });

  it("loads Snooze, Skip and Advanced with legacy dependency states", async () => {
    const client = makeClient(
      makeSettings({
        postponeLengthSeconds: 450,
        postponeLimit: 0,
        postponeBreakEnabled: false,
        skipBreakEnabled: true,
        immediatelyStartBreaks: true,
        endBreakEnabled: false,
      }),
    );

    render(<SettingsWindow client={client} />);

    const snoozeSwitch = await screen.findByRole("switch", {
      name: "Snooze enabled",
    });
    const skipSwitch = screen.getByRole("switch", {
      name: "Allow skipping breaks",
    });
    const snoozeMinutes = screen.getByLabelText(
      "Snooze length in minutes",
    ) as HTMLInputElement;
    const snoozeSeconds = screen.getByLabelText(
      "Snooze length in seconds",
    ) as HTMLInputElement;
    const snoozeLimit = screen.getByLabelText(
      "Snooze limit",
    ) as HTMLSelectElement;
    const immediatelyStart = screen.getByRole("switch", {
      name: "Immediately start breaks",
    });
    const endBreak = screen.getByRole("switch", {
      name: "Allow ending break early",
    });

    expect(snoozeSwitch.getAttribute("aria-checked")).toBe("false");
    expect(snoozeSwitch.hasAttribute("disabled")).toBe(true);
    expect(skipSwitch.getAttribute("aria-checked")).toBe("false");
    expect(skipSwitch.hasAttribute("disabled")).toBe(true);
    expect(snoozeMinutes.value).toBe("7");
    expect(snoozeMinutes.disabled).toBe(true);
    expect(snoozeSeconds.value).toBe("30");
    expect(snoozeSeconds.disabled).toBe(true);
    expect(snoozeLimit.value).toBe("0");
    expect(snoozeLimit.disabled).toBe(true);
    expect(immediatelyStart.getAttribute("aria-checked")).toBe("true");
    expect(immediatelyStart.hasAttribute("disabled")).toBe(false);
    expect(endBreak.getAttribute("aria-checked")).toBe("false");
  });

  it("saves Snooze, Skip and Advanced edits in the General draft", async () => {
    const client = makeClient(makeSettings());
    render(<SettingsWindow client={client} />);

    fireEvent.change(await screen.findByLabelText("Snooze length in minutes"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText("Snooze limit"), {
      target: { value: "5" },
    });
    fireEvent.click(
      screen.getByRole("switch", { name: "Allow skipping breaks" }),
    );
    fireEvent.click(
      screen.getByRole("switch", { name: "Immediately start breaks" }),
    );
    fireEvent.click(
      screen.getByRole("switch", { name: "Allow ending break early" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(client.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          postponeLengthSeconds: 10 * 60,
          postponeLimit: 5,
          skipBreakEnabled: false,
          immediatelyStartBreaks: true,
          endBreakEnabled: false,
        }),
      );
    });
  });

  it("preserves edits across tabs and saves the whole draft once", async () => {
    const client = makeClient(makeSettings());
    render(<SettingsWindow client={client} />);

    fireEvent.change(
      await screen.findByLabelText("Break frequency in minutes"),
      { target: { value: "45" } },
    );

    await openSettingsTab("System");
    fireEvent.click(screen.getByRole("switch", { name: "Launch at login" }));

    await openSettingsTab("General");
    expect(
      (screen.getByLabelText("Break frequency in minutes") as HTMLInputElement)
        .value,
    ).toBe("45");
    expect(
      screen.getByRole("button", { name: "Save" }).hasAttribute("disabled"),
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(client.setSettings).toHaveBeenCalledTimes(1);
      expect(client.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          autoLaunch: true,
          breakFrequencySeconds: 45 * 60,
        }),
      );
    });
  });

  it("switches settings tabs with the arrow keys", async () => {
    const client = makeClient(makeSettings());
    render(<SettingsWindow client={client} />);

    const general = await screen.findByRole("tab", { name: "General" });
    general.focus();
    fireEvent.keyDown(general, { key: "ArrowRight" });

    const workingHours = screen.getByRole("tab", { name: "Working Hours" });
    await waitFor(() => {
      expect(workingHours.getAttribute("aria-selected")).toBe("true");
      expect(document.activeElement).toBe(workingHours);
    });
    expect(
      screen.getByRole("switch", {
        name: "Restrict breaks to working hours",
      }),
    ).toBeTruthy();
  });

  it("loads settings into the general controls", async () => {
    const client = makeClient(
      makeSettings({ breaksEnabled: false, autoLaunch: true }),
    );

    render(<SettingsWindow client={client} />);

    const breaksSwitch = await screen.findByRole("switch", {
      name: "Breaks enabled",
    });
    await openSettingsTab("System");
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

    await openSettingsTab("Working Hours");
    const globalSwitch = screen.getByRole("switch", {
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

    await openSettingsTab("General");
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

  it("uses compact native time inputs and omits removal for the only range", async () => {
    const client = makeClient(makeSettings({ workingHoursEnabled: true }));
    render(<SettingsWindow client={client} />);

    await openSettingsTab("Working Hours");
    const start = screen.getByLabelText("Monday start 1") as HTMLInputElement;
    const end = screen.getByLabelText("Monday end 1") as HTMLInputElement;

    expect(start.type).toBe("time");
    expect(end.type).toBe("time");
    expect(start.step).toBe("60");
    expect(end.step).toBe("60");
    expect(start.value).toBe("09:00");
    expect(end.value).toBe("18:00");
    expect(
      screen.queryByRole("button", { name: "Remove Monday range 1" }),
    ).toBeNull();
  });

  it("hides time controls when a weekday is disabled", async () => {
    const client = makeClient(
      makeSettings({
        workingHoursEnabled: true,
        workingHoursSaturday: workingHours(false),
      }),
    );
    render(<SettingsWindow client={client} />);

    await openSettingsTab("Working Hours");

    expect(screen.getByRole("switch", { name: "Saturday" })).toBeTruthy();
    expect(screen.queryByLabelText("Saturday start 1")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Add Saturday range" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Copy Saturday ranges" }),
    ).toBeNull();
  });

  it("adds a working-hours range from an icon-only button", async () => {
    const client = makeClient(makeSettings({ workingHoursEnabled: true }));
    render(<SettingsWindow client={client} />);

    await openSettingsTab("Working Hours");
    const addButton = screen.getByRole("button", {
      name: "Add Monday range",
    });
    expect(addButton.textContent).toBe("");

    fireEvent.click(addButton);

    expect(screen.getByLabelText("Monday start 2")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Remove Monday range 1" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Remove Monday range 2" }),
    ).toBeTruthy();
  });

  it("copies all Monday ranges to selected weekdays", async () => {
    const client = makeClient(
      makeSettings({
        workingHoursEnabled: true,
        workingHoursMonday: {
          enabled: true,
          ranges: [
            { fromMinutes: 540, toMinutes: 720 },
            { fromMinutes: 780, toMinutes: 1020 },
          ],
        },
        workingHoursTuesday: {
          enabled: true,
          ranges: [{ fromMinutes: 600, toMinutes: 660 }],
        },
      }),
    );
    render(<SettingsWindow client={client} />);

    await openSettingsTab("Working Hours");
    fireEvent.click(screen.getByRole("button", { name: "Copy Monday ranges" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Tuesday" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(
      (screen.getByLabelText("Tuesday start 1") as HTMLInputElement).value,
    ).toBe("09:00");
    expect(
      (screen.getByLabelText("Tuesday end 1") as HTMLInputElement).value,
    ).toBe("12:00");
    expect(
      (screen.getByLabelText("Tuesday start 2") as HTMLInputElement).value,
    ).toBe("13:00");
    expect(
      (screen.getByLabelText("Tuesday end 2") as HTMLInputElement).value,
    ).toBe("17:00");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(client.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          workingHoursTuesday: {
            enabled: true,
            ranges: [
              { fromMinutes: 540, toMinutes: 720 },
              { fromMinutes: 780, toMinutes: 1020 },
            ],
          },
        }),
      );
    });
  });

  it("saves an edited working-hours range", async () => {
    const client = makeClient(makeSettings({ workingHoursEnabled: true }));
    render(<SettingsWindow client={client} />);

    await openSettingsTab("Working Hours");
    const start = screen.getByLabelText("Monday start 1");
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

    await openSettingsTab("Working Hours");
    const addButton = screen.getByRole("button", {
      name: "Add Monday range",
    });
    fireEvent.click(addButton);

    expect(screen.getByLabelText("Monday start 2")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Monday range 2" }),
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

  it("labels break type, frequency and length consistently", async () => {
    const client = makeClient(makeSettings());
    render(<SettingsWindow client={client} />);

    await screen.findByLabelText("Break type");
    const breaksGroup = document.querySelector<HTMLElement>(
      '[data-settings-group="Breaks"]',
    );
    expect(breaksGroup).not.toBeNull();

    const group = within(breaksGroup as HTMLElement);
    const typeLabel = group.getByText("Break type").closest("label");
    const frequencyLabel = group.getByText("Frequency").closest("label");
    const lengthLabel = group.getByText("Length").closest("label");

    expect(typeLabel).not.toBeNull();
    expect(frequencyLabel).not.toBeNull();
    expect(lengthLabel).not.toBeNull();
    expect(frequencyLabel?.className).toBe(typeLabel?.className);
    expect(lengthLabel?.className).toBe(typeLabel?.className);
  });

  it("renders two-digit duration seconds without native number spinners", async () => {
    const client = makeClient(
      makeSettings({
        breakFrequencySeconds: 20 * 60 + 34,
        breakLengthSeconds: 59,
      }),
    );
    render(<SettingsWindow client={client} />);

    const frequencySeconds = (await screen.findByLabelText(
      "Break frequency in seconds",
    )) as HTMLInputElement;
    const lengthSeconds = screen.getByLabelText(
      "Break length in seconds",
    ) as HTMLInputElement;

    expect(frequencySeconds.type).toBe("text");
    expect(frequencySeconds.inputMode).toBe("numeric");
    expect(frequencySeconds.value).toBe("34");
    expect(lengthSeconds.type).toBe("text");
    expect(lengthSeconds.inputMode).toBe("numeric");
    expect(lengthSeconds.value).toBe("59");
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

    await openSettingsTab("Customization");
    fireEvent.click(
      screen.getByRole("button", { name: "Preview break sound" }),
    );

    await waitFor(() => {
      expect(client.playSoundPreview).toHaveBeenCalledWith("GONG", 0.5);
    });
  });

  it("orders Customization as Theme, Audio and Backdrop", async () => {
    const client = makeClient(makeSettings());
    render(<SettingsWindow client={client} />);

    await openSettingsTab("Customization");
    const titles = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-slot="card"] [data-slot="card-title"]',
      ),
    ).map((title) => title.textContent);

    expect(titles).toEqual(["Theme", "Audio", "Backdrop"]);
  });

  it("loads and saves Theme and Backdrop edits in one draft", async () => {
    const client = makeClient(
      makeSettings({
        backgroundColor: "#123456",
        textColor: "#fedcba",
        showBackdrop: true,
        backdropOpacity: 0.45,
      }),
    );
    render(<SettingsWindow client={client} />);

    await openSettingsTab("Customization");
    const primary = screen.getByLabelText("Primary color") as HTMLInputElement;
    const text = screen.getByLabelText("Text color") as HTMLInputElement;
    const opacity = screen.getByLabelText(
      "Backdrop opacity",
    ) as HTMLInputElement;

    expect(primary.value).toBe("#123456");
    expect(text.value).toBe("#fedcba");
    expect(opacity.min).toBe("0.2");
    expect(opacity.max).toBe("1");
    expect(opacity.step).toBe("0.05");
    expect(opacity.value).toBe("0.45");

    fireEvent.change(primary, { target: { value: "#234567" } });
    fireEvent.change(text, { target: { value: "#abcdef" } });
    fireEvent.change(opacity, { target: { value: "0.6" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(client.setSettings).toHaveBeenCalledTimes(1);
      expect(client.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          backgroundColor: "#234567",
          textColor: "#abcdef",
          backdropOpacity: 0.6,
        }),
      );
    });
  });

  it("resets Theme colors and backdrop opacity together", async () => {
    const client = makeClient(
      makeSettings({
        backgroundColor: "#123456",
        textColor: "#abcdef",
        backdropOpacity: 0.25,
      }),
    );
    render(<SettingsWindow client={client} />);

    await openSettingsTab("Customization");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(
      (screen.getByLabelText("Primary color") as HTMLInputElement).value,
    ).toBe("#16a085");
    expect(
      (screen.getByLabelText("Text color") as HTMLInputElement).value,
    ).toBe("#ffffff");
    expect(
      (screen.getByLabelText("Backdrop opacity") as HTMLInputElement).value,
    ).toBe("0.7");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(client.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          backgroundColor: "#16a085",
          textColor: "#ffffff",
          backdropOpacity: 0.7,
        }),
      );
    });
  });

  it("previews drafted Theme colors on the whole card", async () => {
    const client = makeClient(
      makeSettings({
        backgroundColor: "#123456",
        textColor: "#fedcba",
      }),
    );
    render(<SettingsWindow client={client} />);

    await openSettingsTab("Customization");
    const themeCard = document.querySelector<HTMLElement>(
      '[data-settings-group="Theme"]',
    );
    const primary = screen.getByLabelText("Primary color");
    const text = screen.getByLabelText("Text color");
    const reset = screen.getByRole("button", { name: "Reset" });

    expect(themeCard).not.toBeNull();
    expect(getComputedStyle(themeCard as HTMLElement).backgroundColor).toBe(
      "rgb(18, 52, 86)",
    );
    expect(getComputedStyle(themeCard as HTMLElement).color).toBe(
      "rgb(254, 220, 186)",
    );

    fireEvent.change(primary, { target: { value: "#234567" } });
    fireEvent.change(text, { target: { value: "#abcdef" } });

    expect(getComputedStyle(themeCard as HTMLElement).backgroundColor).toBe(
      "rgb(35, 69, 103)",
    );
    expect(getComputedStyle(themeCard as HTMLElement).color).toBe(
      "rgb(171, 205, 239)",
    );
    expect((reset as HTMLElement).style.color).toBe("rgb(171, 205, 239)");

    fireEvent.click(reset);

    expect(getComputedStyle(themeCard as HTMLElement).backgroundColor).toBe(
      "rgb(22, 160, 133)",
    );
    expect(getComputedStyle(themeCard as HTMLElement).color).toBe(
      "rgb(255, 255, 255)",
    );
  });

  it("disables Backdrop controls outside Popup mode", async () => {
    const client = makeClient(
      makeSettings({ notificationType: "NOTIFICATION", showBackdrop: true }),
    );
    render(<SettingsWindow client={client} />);

    await openSettingsTab("Customization");
    const backdropSwitch = screen.getByRole("switch", {
      name: "Show backdrop",
    });
    const opacity = screen.getByLabelText(
      "Backdrop opacity",
    ) as HTMLInputElement;

    expect(backdropSwitch.hasAttribute("disabled")).toBe(true);
    expect(opacity.disabled).toBe(true);
  });

  it("keeps the Backdrop switch available while its opacity is disabled", async () => {
    const client = makeClient(
      makeSettings({ notificationType: "POPUP", showBackdrop: false }),
    );
    render(<SettingsWindow client={client} />);

    await openSettingsTab("Customization");
    const backdropSwitch = screen.getByRole("switch", {
      name: "Show backdrop",
    });
    const opacity = screen.getByLabelText(
      "Backdrop opacity",
    ) as HTMLInputElement;

    expect(backdropSwitch.hasAttribute("disabled")).toBe(false);
    expect(opacity.disabled).toBe(true);
  });

  it("saves an edited volume and hides the preview when the sound is off", async () => {
    const client = makeClient(
      makeSettings({ soundType: "PING", breakSoundVolume: 1 }),
    );
    render(<SettingsWindow client={client} />);

    await openSettingsTab("Customization");
    fireEvent.change(screen.getByLabelText("Break sound volume"), {
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

    await openSettingsTab("System");
    const mode = screen.getByLabelText("Text") as HTMLSelectElement;
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

    await openSettingsTab("System");
    expect((screen.getByLabelText("Text") as HTMLSelectElement).disabled).toBe(
      true,
    );

    fireEvent.click(screen.getByRole("switch", { name: "Show menu bar text" }));

    expect((screen.getByLabelText("Text") as HTMLSelectElement).disabled).toBe(
      false,
    );
  });
});
