import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/types/settings";

import { SettingsCard } from "./settings-card";

interface AdvancedCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

export function AdvancedCard({ settings, onPatch }: AdvancedCardProps) {
  const isPopup = settings.notificationType === "POPUP";

  return (
    <SettingsCard title="Advanced">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="immediately-start-breaks">
            Immediately start breaks
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
          <Label htmlFor="end-break-enabled">Allow ending break early</Label>
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
