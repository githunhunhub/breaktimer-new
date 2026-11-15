// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n";
import type { I18nClient } from "@/types/i18n";
import type { BreakStatus } from "@/types/breaks";
import type { Settings } from "@/types/settings";

import { BreakWindow, type BreakClient } from "./break-window";
import { PROGRESS_CIRCUMFERENCE } from "./utils";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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
    breakCardShape: "RECTANGLE",
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
    promptDeadlineAt: now + 60_000,
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

function makeLocaleClient(): I18nClient {
  return {
    getI18nState: vi.fn().mockResolvedValue({
      language: "zh-CN",
      effectiveLocale: "zh-CN",
    }),
    onLocaleChanged: vi.fn().mockResolvedValue(() => {}),
  };
}

describe("BreakWindow", () => {
  it("renders the prompt and break surface in Simplified Chinese", async () => {
    const promptClient = makeClient(
      makeSettings({
        breakTitle: "Time for a break.",
        breakMessage: "Rest your eyes.\nStretch your legs.\nBreathe. Relax.",
      }),
      makePromptStatus(),
    );

    const { unmount } = render(
      <I18nProvider initialLocale="zh-CN" client={makeLocaleClient()}>
        <BreakWindow client={promptClient} />
      </I18nProvider>,
    );

    expect(await screen.findByText("休息将在 60 秒后开始…")).toBeTruthy();
    expect(screen.getByText("距上次休息 20分钟")).toBeTruthy();
    expect(screen.getByRole("button", { name: "开始" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "稍后提醒" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "跳过" })).toBeTruthy();
    unmount();

    const breakClient = makeClient(
      makeSettings({
        breakTitle: "Time for a break.",
        breakMessage: "Rest your eyes.\nStretch your legs.\nBreathe. Relax.",
      }),
      makeBreakStatus(),
    );
    render(
      <I18nProvider initialLocale="zh-CN" client={makeLocaleClient()}>
        <BreakWindow client={breakClient} />
      </I18nProvider>,
    );

    expect(await screen.findByText("该休息了。")).toBeTruthy();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent === "放松眼睛。\n伸展双腿。\n深呼吸，放松。",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "取消休息" })).toBeTruthy();
  });

  it("keeps custom break text and HTML-like content unchanged in Chinese", async () => {
    const client = makeClient(
      makeSettings({
        breakTitle: "Time for a break",
        breakMessage: "<b>Look away</b>",
      }),
      makeBreakStatus(),
    );

    render(
      <I18nProvider initialLocale="zh-CN" client={makeLocaleClient()}>
        <BreakWindow client={client} />
      </I18nProvider>,
    );

    expect(await screen.findByText("Time for a break")).toBeTruthy();
    expect(screen.getByText("<b>Look away</b>")).toBeTruthy();
  });

  it("shows the single countdown prompt immediately and starts on request", async () => {
    const client = makeClient(makeSettings(), makePromptStatus());

    render(<BreakWindow client={client} />);

    expect(await screen.findByText("Break starting in 60s...")).toBeTruthy();
    expect(screen.queryByText("Start your break when ready...")).toBeNull();
    expect(screen.getByText("20m since last break")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(client.beginBreak).toHaveBeenCalledTimes(1);
    });
  });

  it("shows the countdown and respects disabled actions", async () => {
    const now = Date.now();
    const status = {
      ...makePromptStatus(now - 10_000),
      allowPostpone: false,
    };
    const client = makeClient(
      makeSettings({ postponeBreakEnabled: false, skipBreakEnabled: false }),
      status,
    );

    render(<BreakWindow client={client} />);

    expect(await screen.findByText("Break starting in 50s...")).toBeTruthy();
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

  it("keeps the rectangle branch as the default", async () => {
    const client = makeClient(makeSettings(), makeBreakStatus());
    render(<BreakWindow client={client} />);

    expect(await screen.findByText("Time for a break")).toBeTruthy();
    expect(
      document.querySelector('[data-break-card="rectangle"]'),
    ).toBeTruthy();
    expect(document.querySelector('[data-break-card="circle"]')).toBeNull();
    expect(screen.queryByTestId("break-progress-ring")).toBeNull();
    expect(
      document.querySelector<HTMLElement>('[data-break-card="rectangle"] .h-2')
        ?.className,
    ).toContain("rounded-full");
    expect(screen.getByRole("button", { name: "Cancel Break" })).toBeTruthy();
    expect(client.getSettings).toHaveBeenCalledTimes(1);
  });

  it("renders a circular card with a clockwise ring using the shared progress", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const now = Date.now();
    const client = makeClient(
      makeSettings({
        breakCardShape: "CIRCLE",
        backgroundColor: "#123456",
        textColor: "#abcdef",
        endBreakEnabled: false,
        breakMessage:
          "This is a deliberately long custom break message that must remain scrollable inside the circular card without covering the ring or the button. ".repeat(
            4,
          ),
      }),
      {
        ...makeBreakStatus(now),
        breakStartedAt: now - 15_000,
        breakEndAt: now + 45_000,
      },
    );
    render(<BreakWindow client={client} />);

    expect(await screen.findByText("00:45")).toBeTruthy();
    const circle = document.querySelector<HTMLElement>(
      '[data-break-card="circle"]',
    );
    expect(circle?.className).toContain("rounded-full");
    expect(circle?.style.backgroundColor).toBe("rgb(18, 52, 86)");
    expect(circle?.style.color).toBe("rgb(171, 205, 239)");
    expect(circle?.style.width).toBe("min(58vmin, 440px)");
    expect(circle?.style.height).toBe("min(58vmin, 440px)");

    const ring = screen.getByTestId("break-progress-ring");
    expect(Number(ring.getAttribute("data-break-progress"))).toBeCloseTo(0.25);
    expect(ring?.getAttribute("transform")).toBe("rotate(-90 50 50)");
    expect(Number(ring?.getAttribute("stroke-dasharray"))).toBeCloseTo(
      PROGRESS_CIRCUMFERENCE,
      6,
    );
    expect(Number(ring.getAttribute("stroke-dashoffset"))).toBeCloseTo(
      PROGRESS_CIRCUMFERENCE * 0.75,
      6,
    );
    expect(ring?.getAttribute("stroke")).toBe("currentColor");
    expect(ring?.parentElement?.getAttribute("role")).toBe("progressbar");
    expect(ring?.parentElement?.getAttribute("aria-valuenow")).toBe("25");
    expect(ring?.parentElement?.getAttribute("aria-label")).toBe(
      "Break progress",
    );

    const message = document.querySelector<HTMLElement>("[data-break-message]");
    expect(message?.textContent).toContain(
      "This is a deliberately long custom break message",
    );
    expect(message?.className).toContain("overflow-y-auto");
    expect(message?.className).toContain("break-words");
    // The circle never renders the rectangle's horizontal progress bar.
    expect(
      document.querySelector('[data-break-card="circle"] .h-2'),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel Break" })).toBeNull();
  });

  it("renders localized circular text and keeps Cancel Break available", async () => {
    const client = makeClient(
      makeSettings({
        breakCardShape: "CIRCLE",
        breakTitle: "Time for a break.",
        breakMessage: "Rest your eyes.\nStretch your legs.\nBreathe. Relax.",
      }),
      makeBreakStatus(),
    );

    render(
      <I18nProvider initialLocale="zh-CN" client={makeLocaleClient()}>
        <BreakWindow client={client} />
      </I18nProvider>,
    );

    expect(await screen.findByText("该休息了。")).toBeTruthy();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent === "放松眼睛。\n伸展双腿。\n深呼吸，放松。",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "取消休息" }));
    await waitFor(() => {
      expect(client.endBreak).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps the pre-break prompt rectangular when the circle is selected", async () => {
    const client = makeClient(
      makeSettings({ breakCardShape: "CIRCLE" }),
      makePromptStatus(),
    );
    render(<BreakWindow client={client} />);

    expect(await screen.findByText("Break starting in 60s...")).toBeTruthy();
    expect(document.querySelector('[data-break-card="circle"]')).toBeNull();
    expect(screen.getByText("20m since last break")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Snooze" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skip" })).toBeTruthy();
  });

  it("reads the saved shape once when the break window opens", async () => {
    const client = makeClient(
      makeSettings({ breakCardShape: "CIRCLE" }),
      makeBreakStatus(),
    );
    render(<BreakWindow client={client} />);

    expect(await screen.findByTestId("break-progress-ring")).toBeTruthy();
    expect(client.getSettings).toHaveBeenCalledTimes(1);
  });
});
