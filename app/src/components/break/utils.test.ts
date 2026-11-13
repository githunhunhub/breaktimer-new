import { describe, expect, it } from "vitest";

import {
  PROGRESS_CIRCUMFERENCE,
  formatCountdown,
  localizedBreakText,
  progressDashoffset,
} from "./utils";

describe("localizedBreakText", () => {
  it("localizes only the exact legacy default break text", () => {
    expect(
      localizedBreakText("Time for a break.", "break.defaultTitle", "zh-CN"),
    ).toBe("该休息了。");
    expect(
      localizedBreakText("Time for a break", "break.defaultTitle", "zh-CN"),
    ).toBe("Time for a break");
    expect(
      localizedBreakText(
        "Rest your eyes.\nStretch your legs.\nBreathe. Relax.",
        "break.defaultMessage",
        "zh-CN",
      ),
    ).toBe("放松眼睛。\n伸展双腿。\n深呼吸，放松。");
  });
});

describe("active break rendering helpers (SPEC-0021)", () => {
  it("formats the shared countdown as mm:ss", () => {
    expect(formatCountdown(50_000)).toBe("00:50");
    expect(formatCountdown(0)).toBe("00:00");
  });

  it("draws the ring clockwise from twelve o'clock and closes it at 100%", () => {
    expect(progressDashoffset(0)).toBe(PROGRESS_CIRCUMFERENCE);
    expect(progressDashoffset(0.25)).toBeCloseTo(PROGRESS_CIRCUMFERENCE * 0.75);
    expect(progressDashoffset(1)).toBe(0);
    expect(progressDashoffset(-0.5)).toBe(PROGRESS_CIRCUMFERENCE);
    expect(progressDashoffset(1.5)).toBe(0);
  });
});
