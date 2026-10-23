import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import type { Settings } from "@/types/settings";

import { SettingsCard } from "./settings-card";

interface AdvancedCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

export function AdvancedCard({ settings, onPatch }: AdvancedCardProps) {
  const { t } = useI18n();
  const isPopup = settings.notificationType === "POPUP";

  return (
    <SettingsCard title={t("settings.advanced.title")}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="immediately-start-breaks">
            {t("settings.advanced.immediatelyStart")}
          </Label>
          <Switch
            id="immediately-start-breaks"
            checked={settings.immediatelyStartBreaks}
            disabled={!isPopup}
            onCheckedChange={(checked) =>
              onPatch({ immediatelyStartBreaks: checked })
            }
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="end-break-enabled">
            {t("settings.advanced.endEarly")}
          </Label>
          <Switch
            id="end-break-enabled"
            checked={settings.endBreakEnabled}
            onCheckedChange={(checked) => onPatch({ endBreakEnabled: checked })}
          />
        </div>
      </div>
    </SettingsCard>
  );
}
