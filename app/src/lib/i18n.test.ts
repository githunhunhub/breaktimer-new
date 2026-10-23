// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { afterEach } from "vitest";

import {
  I18nProvider,
  availableLanguages,
  createCatalog,
  messageKeys,
  parseLocaleResource,
  translate,
  useI18n,
} from "./i18n";
import type { I18nClient, I18nState } from "@/types/i18n";

afterEach(cleanup);

describe("i18n catalog", () => {
  it("discovers bundled locale resources", () => {
    expect(
      availableLanguages().map(({ locale, name }) => ({ locale, name })),
    ).toEqual([
      { locale: "en-US", name: "English" },
      { locale: "zh-CN", name: "简体中文" },
    ]);
  });

  it("falls back to en-US for an unknown locale", () => {
    expect(translate("fr-FR", "settings.title")).toBe("Settings");
  });

  it("falls back to en-US for a missing key and returns the key if both are missing", () => {
    const catalog = createCatalog([
      JSON.stringify({
        locale: "en-US",
        name: "English",
        aliases: ["en"],
        messages: { settings: { title: "Settings" } },
      }),
      JSON.stringify({
        locale: "zh-CN",
        name: "简体中文",
        aliases: ["zh"],
        messages: {},
      }),
    ]);

    expect(catalog.translate("zh-CN", "settings.title")).toBe("Settings");
    expect(catalog.translate("en-US", "missing.key")).toBe("missing.key");
  });

  it("interpolates values and selects plural variants", () => {
    const catalog = createCatalog([
      JSON.stringify({
        locale: "en-US",
        name: "English",
        aliases: ["en"],
        messages: {
          demo: {
            hello: "Hello, {name}!",
            items: { one: "{count} item", other: "{count} items" },
          },
        },
      }),
    ]);

    expect(catalog.translate("en-US", "demo.hello", { name: "Ada" })).toBe(
      "Hello, Ada!",
    );
    expect(catalog.translate("en-US", "demo.items", { count: 1 })).toBe(
      "1 item",
    );
    expect(catalog.translate("en-US", "demo.items", { count: 0 })).toBe(
      "0 items",
    );
    expect(catalog.translate("en-US", "demo.items", { count: -1 })).toBe(
      "-1 items",
    );
  });

  it("skips malformed locale resources", () => {
    expect(parseLocaleResource("{")).toBeNull();
    expect(
      parseLocaleResource(
        JSON.stringify({
          locale: "bad",
          name: "Bad",
          aliases: [],
          messages: { invalid: { one: "only one" } },
        }),
      ),
    ).toBeNull();
  });

  it("adds a third language from a resource file without registration code", () => {
    const catalog = createCatalog([
      JSON.stringify({
        locale: "fr-FR",
        name: "Français",
        aliases: ["fr"],
        messages: { settings: { title: "Paramètres" } },
      }),
    ]);

    expect(catalog.languages()).toContainEqual({
      locale: "fr-FR",
      name: "Français",
    });
    expect(catalog.translate("fr-FR", "settings.title")).toBe("Paramètres");
  });

  it("keeps the first-party locale key sets complete", () => {
    expect(messageKeys("zh-CN")).toEqual(messageKeys("en-US"));
  });

  it("uses the compact Chinese minute unit", () => {
    expect(translate("zh-CN", "common.minutesShort")).toBe("分");
  });
});

describe("I18nProvider", () => {
  it("loads the effective locale and reacts to locale changes", async () => {
    let emit: ((state: I18nState) => void) | undefined;
    const client: I18nClient = {
      getI18nState: async () => ({
        language: null,
        effectiveLocale: "zh-CN",
      }),
      onLocaleChanged: async (handler) => {
        emit = handler;
        return () => {};
      },
    };

    function Probe() {
      return createElement("p", null, useI18n().t("settings.title"));
    }

    render(
      createElement(I18nProvider, {
        client,
        children: createElement(Probe),
      }),
    );

    expect(await screen.findByText("设置")).toBeTruthy();
    await waitFor(() => {
      expect(document.documentElement.lang).toBe("zh-CN");
    });

    act(() => {
      emit?.({ language: "en-US", effectiveLocale: "en-US" });
    });
    expect(await screen.findByText("Settings")).toBeTruthy();
    await waitFor(() => {
      expect(document.documentElement.lang).toBe("en-US");
    });
  });
});
