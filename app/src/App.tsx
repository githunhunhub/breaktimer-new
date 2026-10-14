import { getCurrentWindow } from "@tauri-apps/api/window";

import { BreakWindow } from "@/components/break/break-window";
import { SettingsWindow } from "@/components/settings/settings-window";

export default function App() {
  const label = currentWindowLabel();

  return label.startsWith("break-") ? <BreakWindow /> : <SettingsWindow />;
}

function currentWindowLabel(): string {
  try {
    return getCurrentWindow().label;
  } catch {
    // Vite's browser preview is useful while styling; it has no Tauri window.
    return "main";
  }
}
