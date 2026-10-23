import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import type { Settings } from "@/types/settings";

import { DurationInputs } from "./duration-inputs";
import { SettingsCard } from "./settings-card";

interface SnoozeCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

export function SnoozeCard({ settings, onPatch }: SnoozeCardProps) {
  const { t } = useI18n();
  const disabled =
    !settings.postponeBreakEnabled || settings.immediatelyStartBreaks;

  return (
    <SettingsCard
      title={t("settings.snooze.title")}
      helperText={t("settings.snooze.helper")}
      toggle={{
        label: t("settings.snooze.toggle"),
        checked:
          settings.postponeBreakEnabled && !settings.immediatelyStartBreaks,
        disabled: settings.immediatelyStartBreaks,
        onCheckedChange: (checked) =>
          onPatch({ postponeBreakEnabled: checked }),
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="snooze-length-minutes">
            {t("settings.snooze.length")}
          </Label>
          <DurationInputs
            minutesId="snooze-length-minutes"
            value={settings.postponeLengthSeconds}
            disabled={disabled}
            minutesLabel={t("settings.snooze.minutesLabel")}
            secondsLabel={t("settings.snooze.secondsLabel")}
            onChange={(seconds) => onPatch({ postponeLengthSeconds: seconds })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="snooze-limit">{t("settings.snooze.limit")}</Label>
          <Select
            id="snooze-limit"
            aria-label={t("settings.snooze.limitLabel")}
            value={String(settings.postponeLimit)}
            disabled={disabled}
            onChange={(event) =>
              onPatch({ postponeLimit: Number(event.target.value) })
            }
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="0">{t("common.noLimit")}</option>
          </Select>
        </div>
      </div>
    </SettingsCard>
  );
}
