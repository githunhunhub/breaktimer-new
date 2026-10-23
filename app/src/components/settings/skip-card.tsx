import { useI18n } from "@/lib/i18n";
import type { Settings } from "@/types/settings";

import { SettingsCard } from "./settings-card";

interface SkipCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

export function SkipCard({ settings, onPatch }: SkipCardProps) {
  const { t } = useI18n();

  return (
    <SettingsCard
      title={t("settings.skip.title")}
      helperText={t("settings.skip.helper")}
      toggle={{
        label: t("settings.skip.toggle"),
        checked: settings.skipBreakEnabled && !settings.immediatelyStartBreaks,
        disabled: settings.immediatelyStartBreaks,
        onCheckedChange: (checked) => onPatch({ skipBreakEnabled: checked }),
      }}
    />
  );
}
