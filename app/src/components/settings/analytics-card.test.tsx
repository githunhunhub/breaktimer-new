// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n";
import type { Settings } from "@/types/settings";

import { AnalyticsCard } from "./analytics-card";

afterEach(cleanup);

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  const settings: Partial<Settings> = {
    analyticsEnabled: true,
    ...overrides,
  };
  return settings as Settings;
}

describe("AnalyticsCard", () => {
  it("patches the analytics setting when the toggle changes", () => {
    const onPatch = vi.fn();

    render(
      <I18nProvider>
        <AnalyticsCard settings={makeSettings()} onPatch={onPatch} />
      </I18nProvider>,
    );

    const toggle = screen.getByRole("switch", {
      name: "Allow anonymous usage data",
    });
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(toggle);

    expect(onPatch).toHaveBeenCalledWith({ analyticsEnabled: false });
  });

  it("explains that nothing is sent once disabled", () => {
    render(
      <I18nProvider>
        <AnalyticsCard
          settings={makeSettings({ analyticsEnabled: false })}
          onPatch={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(
      screen.queryByText("Off: the app will not send any usage data."),
    ).not.toBeNull();
  });
});
