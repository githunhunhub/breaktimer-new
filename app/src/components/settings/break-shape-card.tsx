import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import type { BreakCardShape, Settings } from "@/types/settings";

import { SettingsCard } from "./settings-card";

interface BreakShapeCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

/** Chooses the active break card shape; the default is the legacy rectangle (SPEC-0021). */
export function BreakShapeCard({ settings, onPatch }: BreakShapeCardProps) {
  const { t } = useI18n();

  return (
    <SettingsCard
      title={t("settings.breakCard.title")}
      helperText={t("settings.breakCard.helper")}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="break-card-shape">
          {t("settings.breakCard.shapeLabel")}
        </Label>
        <Select
          id="break-card-shape"
          value={settings.breakCardShape}
          onChange={(event) =>
            onPatch({
              breakCardShape: event.target.value as BreakCardShape,
            })
          }
        >
          <option value="RECTANGLE">{t("settings.breakCard.rectangle")}</option>
          <option value="CIRCLE">{t("settings.breakCard.circle")}</option>
        </Select>
      </div>
    </SettingsCard>
  );
}
