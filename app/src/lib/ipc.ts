import { invoke } from "@tauri-apps/api/core";

import type { Settings } from "@/types/settings";

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
};

export interface AppInfo {
  name: string;
  version: string;
  settingsPath: string;
}
