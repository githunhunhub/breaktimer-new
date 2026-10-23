import { describe, expect, it } from "vitest";

import { localizedBreakText } from "./utils";

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
