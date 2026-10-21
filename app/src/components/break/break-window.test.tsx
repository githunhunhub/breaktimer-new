// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BreakStatus } from "@/types/breaks";
import type { Settings } from "@/types/settings";

import { BreakWindow, type BreakClient } from "./break-window";

afterEach(cleanup);

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    autoLaunch: false,
    breaksEnabled: true,
    trayTextEnabled: false,
    trayTextMode: "TIME_TO_NEXT_BREAK",
    notificationType: "POPUP",
    breakFrequencySeconds: 1200,
    breakLengthSeconds: 60,
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

function makePromptStatus(now = Date.now()): BreakStatus {
  return {
    phase: "ON_BREAK",
    breakStartedAt: null,
    breakEndAt: null,
    nextBreakAt: null,
    promptStartedAt: now,
    promptDeadlineAt: now + 120_000,
    timeSinceLastBreakSeconds: 1200,
    allowPostpone: true,
    startedFromTray: false,
  };
}

function makeBreakStatus(now = Date.now()): BreakStatus {
  return {
    phase: "ON_BREAK",
    breakStartedAt: now - 10_000,
    breakEndAt: now + 50_000,
    nextBreakAt: null,
    promptStartedAt: null,
    promptDeadlineAt: null,
    timeSinceLastBreakSeconds: 1200,
    allowPostpone: true,
    startedFromTray: false,
  };
}

function makeClient(settings: Settings, status: BreakStatus): BreakClient {
  return {
    getSettings: vi.fn().mockResolvedValue(settings),
    getBreakStatus: vi.fn().mockResolvedValue(status),
    beginBreak: vi.fn().mockResolvedValue(makeBreakStatus()),
    endBreak: vi.fn().mockResolvedValue({
      ...status,
      phase: "WORKING",
      breakStartedAt: null,
      breakEndAt: null,
    }),
    postponeBreak: vi.fn().mockResolvedValue({
      ...status,
      phase: "POSTPONED",
      promptStartedAt: null,
      promptDeadlineAt: null,
    }),
    skipBreak: vi.fn().mockResolvedValue({
      ...status,
      phase: "WORKING",
      promptStartedAt: null,
      promptDeadlineAt: null,
    }),
    onBreakStatus: vi.fn().mockResolvedValue(vi.fn()),
  };
}

describe("BreakWindow", () => {
  it("shows the prompt and starts the break on request", async () => {
    const client = makeClient(makeSettings(), makePromptStatus());

    render(<BreakWindow client={client} />);

    expect(
      await screen.findByText("Start your break when ready..."),
    ).toBeTruthy();
    expect(screen.getByText("20m since last break")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(client.beginBreak).toHaveBeenCalledTimes(1);
    });
  });

  it("shows the countdown phase and respects disabled actions", async () => {
    const now = Date.now();
    const status = {
      ...makePromptStatus(now - 61_000),
      allowPostpone: false,
    };
    const client = makeClient(
      makeSettings({ postponeBreakEnabled: false, skipBreakEnabled: false }),
      status,
    );

    render(<BreakWindow client={client} />);

    expect(await screen.findByText("Break starting in 59s...")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Snooze" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
  });

  it("shows break progress and ends the active break", async () => {
    const client = makeClient(makeSettings(), makeBreakStatus());

    render(<BreakWindow client={client} />);

    expect(await screen.findByText("Time for a break")).toBeTruthy();
    expect(screen.getByText("Look away from the screen.")).toBeTruthy();
    expect(screen.getByText("00:50")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel Break" }));

    await waitFor(() => {
      expect(client.endBreak).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps the cancel action and a centred card without a visual backdrop", async () => {
    const now = Date.now();
    const client = makeClient(
      makeSettings({
        showBackdrop: false,
        endBreakEnabled: true,
      }),
      {
        ...makeBreakStatus(now),
        breakStartedAt: now - 40_000,
        breakEndAt: now + 20_000,
      },
    );

    render(<BreakWindow client={client} />);

    const title = await screen.findByText("Time for a break");
    const card = title.closest("section");

    expect(screen.getByRole("button", { name: "Cancel Break" })).toBeTruthy();
    expect(card?.className).toContain("max-w-[500px]");
    expect(card?.className).not.toContain("h-full");
  });
});
