import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import type { Settings } from "@/types/settings";

import { joinDurationSeconds, splitSeconds } from "./durations";
import { SettingsCard } from "./settings-card";

interface SmartBreaksCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

export function SmartBreaksCard({ settings, onPatch }: SmartBreaksCardProps) {
  const { t } = useI18n();
  const disabled = !settings.idleResetEnabled;
  const { minutes, seconds } = splitSeconds(settings.idleResetLengthSeconds);

  function updateDuration(nextMinutes: number, nextSeconds: number) {
    onPatch({
      idleResetLengthSeconds: joinDurationSeconds(nextMinutes, nextSeconds),
    });
  }

  return (
    <SettingsCard title={t("settings.smartBreaks.title")}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="idle-reset-enabled">
            {t("settings.smartBreaks.idleReset")}
          </Label>
          <Switch
            id="idle-reset-enabled"
            checked={settings.idleResetEnabled}
            onCheckedChange={(checked) =>
              onPatch({ idleResetEnabled: checked })
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">
            {t("settings.smartBreaks.minimumIdleTime")}
          </span>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              className="w-24"
              aria-label={t("settings.smartBreaks.minutesLabel")}
              value={minutes}
              disabled={disabled}
              onChange={(event) =>
                updateDuration(Number(event.target.value), seconds)
              }
            />
            <span className="text-muted-foreground text-sm">
              {t("common.minutes")}
            </span>
            <Input
              type="number"
              min={0}
              max={59}
              className="w-20"
              aria-label={t("settings.smartBreaks.secondsLabel")}
              value={seconds}
              disabled={disabled}
              onChange={(event) =>
                updateDuration(minutes, Number(event.target.value))
              }
            />
            <span className="text-muted-foreground text-sm">
              {t("common.seconds")}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="idle-reset-notification">
            {t("settings.smartBreaks.notification")}
          </Label>
          <Switch
            id="idle-reset-notification"
            checked={settings.idleResetNotification}
            disabled={disabled}
            onCheckedChange={(checked) =>
              onPatch({ idleResetNotification: checked })
            }
          />
        </div>
      </div>
    </SettingsCard>
  );
}
