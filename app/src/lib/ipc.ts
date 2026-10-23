import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { BreakStatus } from "@/types/breaks";
import type { I18nState } from "@/types/i18n";
import type { Settings, SoundType } from "@/types/settings";

/** Event name the backend emits on every scheduler transition. */
export const BREAK_STATUS_EVENT = "break-status";
export const LOCALE_CHANGED_EVENT = "locale-changed";

/**
 * Thin, typed wrappers around Tauri commands defined in
 * `app/src-tauri/src/commands.rs`. All renderer -> backend calls should flow
 * through this module so the command surface stays in one place.
 */
export const ipc = {
  greet: (name: string) => invoke<string>("greet", { name }),
  getSettings: () => invoke<Settings>("get_settings"),
  setSettings: (settings: Settings) =>
    invoke<void>("set_settings", { settings }),
  getI18nState: () => invoke<I18nState>("get_i18n_state"),
  getAppInfo: () => invoke<AppInfo>("get_app_info"),
  getBreakStatus: () => invoke<BreakStatus>("get_break_status"),
  beginBreak: () => invoke<BreakStatus>("begin_break"),
  endBreak: () => invoke<BreakStatus>("end_break"),
  postponeBreak: () => invoke<BreakStatus>("postpone_break"),
  skipBreak: () => invoke<BreakStatus>("skip_break"),
  startBreakNow: () => invoke<BreakStatus>("start_break_now"),
  playSoundPreview: (soundType: SoundType, volume: number) =>
    invoke<void>("play_sound_preview", { soundType, volume }),
  onBreakStatus: (
    handler: (status: BreakStatus) => void,
  ): Promise<UnlistenFn> =>
    listen<BreakStatus>(BREAK_STATUS_EVENT, (event) => handler(event.payload)),
  onLocaleChanged: (handler: (state: I18nState) => void): Promise<UnlistenFn> =>
    listen<I18nState>(LOCALE_CHANGED_EVENT, (event) => handler(event.payload)),
};

export interface AppInfo {
  name: string;
  version: string;
  settingsPath: string;
}
