import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", false, "b", undefined, null)).toBe("a b");
  });

  it("lets later tailwind utilities win", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
