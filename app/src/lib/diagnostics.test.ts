// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { installGlobalErrorLogging } from "./diagnostics";

describe("installGlobalErrorLogging", () => {
  it("reports uncaught errors and unhandled promise rejections", () => {
    const reports: Array<{ message: string; stack: string }> = [];
    const uninstall = installGlobalErrorLogging((message, stack) => {
      reports.push({ message, stack });
    });

    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "render failed",
        filename: "app://index.js",
        lineno: 12,
        colno: 4,
        error: new Error("render failed"),
      }),
    );

    const rejection = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(rejection, "reason", {
      value: new Error("async failed"),
    });
    window.dispatchEvent(rejection);
    uninstall();

    expect(reports).toHaveLength(2);
    expect(reports[0].message).toBe("render failed");
    expect(reports[0].stack).toContain("app://index.js:12:4");
    expect(reports[1].message).toBe("async failed");
    expect(reports[1].stack).toContain("async failed");
  });
});
