import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import type { NotificationType, Settings } from "@/types/settings";

import { DurationInputs } from "./duration-inputs";
import { SettingsCard } from "./settings-card";

interface BreaksCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

/** Break type, cadence, length and the text shown on the break screen (SPEC-0008, SPEC-0010). */
export function BreaksCard({ settings, onPatch }: BreaksCardProps) {
  const { t } = useI18n();
  const disabled = !settings.breaksEnabled;
  const isPopup = settings.notificationType === "POPUP";

  return (
    <SettingsCard
      title={t("settings.breaks.title")}
      toggle={{
        label: t("settings.breaks.toggle"),
        checked: settings.breaksEnabled,
        onCheckedChange: (checked) => onPatch({ breaksEnabled: checked }),
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="notification-type">
              {t("settings.breaks.type")}
            </Label>
            <Select
              id="notification-type"
              value={settings.notificationType}
              disabled={disabled}
              onChange={(event) =>
                onPatch({
                  notificationType: event.target.value as NotificationType,
                })
              }
            >
              <option value="POPUP">{t("settings.breaks.typePopup")}</option>
              <option value="NOTIFICATION">
                {t("settings.breaks.typeNotification")}
              </option>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="break-frequency-minutes">
              {t("settings.breaks.frequency")}
            </Label>
            <DurationInputs
              minutesId="break-frequency-minutes"
              value={settings.breakFrequencySeconds}
              disabled={disabled}
              minutesLabel={t("settings.breaks.frequencyMinutesLabel")}
              secondsLabel={t("settings.breaks.frequencySecondsLabel")}
              onChange={(seconds) =>
                onPatch({ breakFrequencySeconds: seconds })
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="break-length-minutes">
              {t("settings.breaks.length")}
            </Label>
            <DurationInputs
              minutesId="break-length-minutes"
              value={settings.breakLengthSeconds}
              disabled={disabled || !isPopup}
              minutesLabel={t("settings.breaks.lengthMinutesLabel")}
              secondsLabel={t("settings.breaks.lengthSecondsLabel")}
              onChange={(seconds) => onPatch({ breakLengthSeconds: seconds })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="break-title">{t("settings.breaks.titleLabel")}</Label>
          <Input
            id="break-title"
            value={settings.breakTitle}
            disabled={disabled}
            onChange={(event) => onPatch({ breakTitle: event.target.value })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="break-message">
            {t("settings.breaks.messageLabel")}
          </Label>
          <Textarea
            id="break-message"
            rows={3}
            className="resize-none"
            placeholder={t("settings.breaks.messagePlaceholder")}
            value={settings.breakMessage}
            disabled={disabled}
            onChange={(event) => onPatch({ breakMessage: event.target.value })}
          />
        </div>
      </div>
    </SettingsCard>
  );
}
