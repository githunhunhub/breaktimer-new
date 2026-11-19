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
    ).toBe("片刻小憩");
    expect(
      localizedBreakText("Time for a break", "break.defaultTitle", "zh-CN"),
    ).toBe("Time for a break");
    expect(
      localizedBreakText(
        "Rest your eyes.\nStretch your legs.\nBreathe. Relax.",
        "break.defaultMessage",
        "zh-CN",
      ),
    ).toBe("极目天边，让目光随云远去。\n舒展身心，如晨枝缓缓向风打开。");
    expect(
      localizedBreakText("A Moment's Respite.", "break.defaultTitle", "zh-CN"),
    ).toBe("片刻小憩");
    expect(
      localizedBreakText(
        "Eyes to the horizon, drifting with clouds;\nBody unfolding, like a branch to the wind",
        "break.defaultMessage",
        "zh-CN",
      ),
    ).toBe("极目天边，让目光随云远去。\n舒展身心，如晨枝缓缓向风打开。");
    expect(
      localizedBreakText("Custom title", "break.defaultTitle", "zh-CN"),
    ).toBe("Custom title");
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
