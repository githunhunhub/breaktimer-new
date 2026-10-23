import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useI18n } from "@/lib/i18n";
import type { Settings } from "@/types/settings";

import { SettingsCard } from "./settings-card";

interface BackdropCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

export function BackdropCard({ settings, onPatch }: BackdropCardProps) {
  const { t } = useI18n();
  const popupMode = settings.notificationType === "POPUP";
  const opacityPercent = Math.round(settings.backdropOpacity * 100);

  return (
    <SettingsCard
      title={t("settings.backdrop.title")}
      helperText={t("settings.backdrop.helper")}
      toggle={{
        label: t("settings.backdrop.toggle"),
        checked: settings.showBackdrop,
        disabled: !popupMode,
        onCheckedChange: (checked) => onPatch({ showBackdrop: checked }),
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="backdrop-opacity">
          {t("settings.backdrop.opacity")}
        </Label>
        <Slider
          id="backdrop-opacity"
          min={0.2}
          max={1}
          step={0.05}
          value={settings.backdropOpacity}
          disabled={!popupMode || !settings.showBackdrop}
          onChange={(event) =>
            onPatch({ backdropOpacity: Number(event.target.value) })
          }
        />
        <div className="text-muted-foreground flex justify-between text-sm">
          <span>20%</span>
          <span>{opacityPercent}%</span>
          <span>100%</span>
        </div>
      </div>
    </SettingsCard>
  );
}
