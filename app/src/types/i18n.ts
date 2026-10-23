export interface I18nState {
  language: string | null;
  effectiveLocale: string;
}

export interface I18nClient {
  getI18nState: () => Promise<I18nState>;
  onLocaleChanged: (handler: (state: I18nState) => void) => Promise<() => void>;
}
