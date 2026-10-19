import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationType, Settings } from "@/types/settings";

import { joinDurationSeconds, splitSeconds } from "./durations";

interface BreaksCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

/** Break type, cadence, length and the text shown on the break screen (SPEC-0008, SPEC-0010). */
export function BreaksCard({ settings, onPatch }: BreaksCardProps) {
  const disabled = !settings.breaksEnabled;
  const isPopup = settings.notificationType === "POPUP";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Breaks</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
            <span className="text-sm font-medium">Frequency</span>
            <DurationInputs
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
            <span className="text-sm font-medium">Length</span>
            <DurationInputs
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
      </CardContent>
    </Card>
  );
}

interface DurationInputsProps {
  value: number;
  disabled: boolean;
  minutesLabel: string;
  secondsLabel: string;
  onChange: (seconds: number) => void;
}

function DurationInputs({
  value,
  disabled,
  minutesLabel,
  secondsLabel,
  onChange,
}: DurationInputsProps) {
  const { minutes, seconds } = splitSeconds(value);

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        className="w-20"
        aria-label={minutesLabel}
        value={minutes}
        disabled={disabled}
        onChange={(event) =>
          onChange(joinDurationSeconds(Number(event.target.value), seconds))
        }
      />
      <span className="text-muted-foreground text-sm">min</span>
      <Input
        type="number"
        min={0}
        max={59}
        className="w-16"
        aria-label={secondsLabel}
        value={seconds}
        disabled={disabled}
        onChange={(event) =>
          onChange(joinDurationSeconds(minutes, Number(event.target.value)))
        }
      />
      <span className="text-muted-foreground text-sm">sec</span>
    </div>
  );
}
