import type { Settings } from "@/types/settings";

import { SettingsCard } from "./settings-card";

interface SkipCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

export function SkipCard({ settings, onPatch }: SkipCardProps) {
  return (
    <SettingsCard
      title="Skip"
      helperText="Allow skipping breaks entirely without rescheduling them."
      toggle={{
        label: "Allow skipping breaks",
        checked: settings.skipBreakEnabled && !settings.immediatelyStartBreaks,
        disabled: settings.immediatelyStartBreaks,
        onCheckedChange: (checked) => onPatch({ skipBreakEnabled: checked }),
      }}
    />
  );
}
