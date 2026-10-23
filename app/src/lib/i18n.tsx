/* eslint-disable react-refresh/only-export-components -- SPEC-0014 keeps the catalog and its provider together. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { I18nClient, I18nState } from "@/types/i18n";

import { ipc } from "./ipc";

export interface Language {
  locale: string;
  name: string;
}

export type MessageParams = Record<string, string | number>;
export type Translate = (key: string, params?: MessageParams) => string;

interface LocaleResource extends Language {
  aliases: string[];
  messages: Record<string, unknown>;
}

type MessageValue = string | { one: string; other: string };

export interface Catalog {
  languages: () => Language[];
  translate: (locale: string, key: string, params?: MessageParams) => string;
  messageKeys: (locale: string) => string[];
}

const BASE_LOCALE = "en-US";

interface I18nContextValue {
  locale: string;
  t: Translate;
  languages: Language[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

const bundledCatalog = createCatalog(
  Object.values(
    import.meta.glob("../../locales/*.json", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
  ),
);

export function parseLocaleResource(raw: unknown): LocaleResource | null {
  if (typeof raw !== "string") return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    if (
      typeof value.locale !== "string" ||
      typeof value.name !== "string" ||
      !Array.isArray(value.aliases) ||
      !value.aliases.every((alias) => typeof alias === "string") ||
      !isRecord(value.messages)
    ) {
      return null;
    }

    if (!validMessages(value.messages)) return null;

    return {
      locale: value.locale,
      name: value.name,
      aliases: value.aliases,
      messages: value.messages,
    };
  } catch {
    return null;
  }
}

export function createCatalog(rawResources: unknown[]): Catalog {
  const resources = rawResources
    .map(parseLocaleResource)
    .filter((resource): resource is LocaleResource => resource !== null)
    .sort((left, right) => left.locale.localeCompare(right.locale));
  const messagesByLocale = new Map(
    resources.map((resource) => [
      resource.locale,
      flattenMessages(resource.messages),
    ]),
  );

  function resolveLocale(locale: string): string {
    const wanted = normalizeLocale(locale);
    return (
      resources.find(
        (resource) =>
          normalizeLocale(resource.locale) === wanted ||
          resource.aliases.some((alias) => normalizeLocale(alias) === wanted),
      )?.locale ?? BASE_LOCALE
    );
  }

  function translate(
    locale: string,
    key: string,
    params: MessageParams = {},
  ): string {
    const messages =
      messagesByLocale.get(resolveLocale(locale)) ??
      messagesByLocale.get(BASE_LOCALE);
    const value =
      messages?.get(key) ?? messagesByLocale.get(BASE_LOCALE)?.get(key);
    if (value === undefined) return key;

    const message =
      typeof value === "string"
        ? value
        : Number(params.count) === 1
          ? value.one
          : value.other;

    return message.replace(/\{([^{}]+)\}/g, (placeholder, name: string) =>
      Object.hasOwn(params, name) ? String(params[name]) : placeholder,
    );
  }

  return {
    languages: () => resources.map(({ locale, name }) => ({ locale, name })),
    translate,
    messageKeys: (locale) =>
      [...(messagesByLocale.get(resolveLocale(locale))?.keys() ?? [])].sort(),
  };
}

export function availableLanguages(): Language[] {
  return bundledCatalog.languages();
}

export function translate(
  locale: string,
  key: string,
  params?: MessageParams,
): string {
  return bundledCatalog.translate(locale, key, params);
}

export function messageKeys(locale: string): string[] {
  return bundledCatalog.messageKeys(locale);
}

interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: string;
  client?: I18nClient;
}

export function I18nProvider({
  children,
  initialLocale = BASE_LOCALE,
  client = ipc,
}: I18nProviderProps) {
  const [locale, setLocale] = useState(initialLocale);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;

    client
      .getI18nState()
      .then((state: I18nState) => {
        if (active) setLocale(state.effectiveLocale);
      })
      .catch(() => {
        // Keep the English fallback usable when this window has no backend.
      });

    client
      .onLocaleChanged((state) => {
        if (active) setLocale(state.effectiveLocale);
      })
      .then((stopListening) => {
        if (active) {
          unlisten = stopListening;
        } else {
          stopListening();
        }
      })
      .catch(() => {});

    return () => {
      active = false;
      unlisten?.();
    };
  }, [client]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const t = useCallback<Translate>(
    (key, params) => translate(locale, key, params),
    [locale],
  );
  const value = useMemo(
    () => ({ locale, t, languages: availableLanguages() }),
    [locale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return (
    useContext(I18nContext) ?? {
      locale: BASE_LOCALE,
      t: (key, params) => translate(BASE_LOCALE, key, params),
      languages: availableLanguages(),
    }
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validMessages(messages: Record<string, unknown>): boolean {
  return Object.values(messages).every((value) => {
    if (typeof value === "string") return true;
    if (!isRecord(value)) return false;
    const keys = Object.keys(value);
    if (keys.includes("one") || keys.includes("other")) {
      if (
        keys.length !== 2 ||
        !keys.includes("one") ||
        !keys.includes("other")
      ) {
        return false;
      }
    }
    if (keys.length === 2 && keys.includes("one") && keys.includes("other")) {
      return typeof value.one === "string" && typeof value.other === "string";
    }
    return validMessages(value);
  });
}

function flattenMessages(
  messages: Record<string, unknown>,
  prefix = "",
): Map<string, MessageValue> {
  const flattened = new Map<string, MessageValue>();

  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      flattened.set(path, value);
    } else if (isRecord(value) && typeof value.one === "string") {
      flattened.set(path, {
        one: value.one,
        other: value.other as string,
      });
    } else if (isRecord(value)) {
      for (const [nestedKey, nestedValue] of flattenMessages(value, path)) {
        flattened.set(nestedKey, nestedValue);
      }
    }
  }

  return flattened;
}

function normalizeLocale(locale: string): string {
  return locale.replaceAll("_", "-").toLowerCase();
}
