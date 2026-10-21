import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationType, Settings } from "@/types/settings";

import { DurationInputs } from "./duration-inputs";
import { SettingsCard } from "./settings-card";

interface BreaksCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

/** Break type, cadence, length and the text shown on the break screen (SPEC-0008, SPEC-0010). */
export function BreaksCard({ settings, onPatch }: BreaksCardProps) {
  const disabled = !settings.breaksEnabled;
  const isPopup = settings.notificationType === "POPUP";

  return (
    <SettingsCard
      title="Breaks"
      toggle={{
        label: "Breaks enabled",
        checked: settings.breaksEnabled,
        onCheckedChange: (checked) => onPatch({ breaksEnabled: checked }),
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="notification-type">Break type</Label>
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
              <option value="POPUP">Popup break</option>
              <option value="NOTIFICATION">Notification</option>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="break-frequency-minutes">Frequency</Label>
            <DurationInputs
              minutesId="break-frequency-minutes"
              value={settings.breakFrequencySeconds}
              disabled={disabled}
              minutesLabel="Break frequency in minutes"
              secondsLabel="Break frequency in seconds"
              onChange={(seconds) =>
                onPatch({ breakFrequencySeconds: seconds })
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="break-length-minutes">Length</Label>
            <DurationInputs
              minutesId="break-length-minutes"
              value={settings.breakLengthSeconds}
              disabled={disabled || !isPopup}
              minutesLabel="Break length in minutes"
              secondsLabel="Break length in seconds"
              onChange={(seconds) => onPatch({ breakLengthSeconds: seconds })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="break-title">Title</Label>
          <Input
            id="break-title"
            value={settings.breakTitle}
            disabled={disabled}
            onChange={(event) => onPatch({ breakTitle: event.target.value })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="break-message">Message</Label>
          <Textarea
            id="break-message"
            rows={3}
            className="resize-none"
            placeholder="Enter your break message..."
            value={settings.breakMessage}
            disabled={disabled}
            onChange={(event) => onPatch({ breakMessage: event.target.value })}
          />
        </div>
      </div>
    </SettingsCard>
  );
}
