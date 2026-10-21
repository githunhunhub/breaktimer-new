import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { BreakStatus } from "@/types/breaks";
import type { Settings, SoundType } from "@/types/settings";

/** Event name the backend emits on every scheduler transition. */
export const BREAK_STATUS_EVENT = "break-status";

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
};

export interface AppInfo {
  name: string;
  version: string;
  settingsPath: string;
}
