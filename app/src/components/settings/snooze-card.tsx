import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Settings } from "@/types/settings";

import { DurationInputs } from "./duration-inputs";
import { SettingsCard } from "./settings-card";

interface SnoozeCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

export function SnoozeCard({ settings, onPatch }: SnoozeCardProps) {
  const disabled =
    !settings.postponeBreakEnabled || settings.immediatelyStartBreaks;

  return (
    <SettingsCard
      title="Snooze"
      helperText="Snoozing allows you to postpone breaks when busy."
      toggle={{
        label: "Snooze enabled",
        checked:
          settings.postponeBreakEnabled && !settings.immediatelyStartBreaks,
        disabled: settings.immediatelyStartBreaks,
        onCheckedChange: (checked) =>
          onPatch({ postponeBreakEnabled: checked }),
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Length</span>
          <DurationInputs
            value={settings.postponeLengthSeconds}
            disabled={disabled}
            minutesLabel="Snooze length in minutes"
            secondsLabel="Snooze length in seconds"
            onChange={(seconds) => onPatch({ postponeLengthSeconds: seconds })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="snooze-limit">Limit</Label>
          <Select
            id="snooze-limit"
            aria-label="Snooze limit"
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
            <option value="0">No limit</option>
          </Select>
        </div>
      </div>
    </SettingsCard>
  );
}
