import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/types/settings";

import { joinDurationSeconds, splitSeconds } from "./durations";

interface SmartBreaksCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

export function SmartBreaksCard({ settings, onPatch }: SmartBreaksCardProps) {
  const disabled = !settings.idleResetEnabled;
  const { minutes, seconds } = splitSeconds(settings.idleResetLengthSeconds);

  function updateDuration(nextMinutes: number, nextSeconds: number) {
    onPatch({
      idleResetLengthSeconds: joinDurationSeconds(nextMinutes, nextSeconds),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Smart Breaks</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="idle-reset-enabled">
            Reset the break timer when idle
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
          <span className="text-sm font-medium">Minimum idle time</span>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              className="w-24"
              aria-label="Idle time in minutes"
              value={minutes}
              disabled={disabled}
              onChange={(event) =>
                updateDuration(Number(event.target.value), seconds)
              }
            />
            <span className="text-muted-foreground text-sm">minutes</span>
            <Input
              type="number"
              min={0}
              max={59}
              className="w-20"
              aria-label="Idle time in seconds"
              value={seconds}
              disabled={disabled}
              onChange={(event) =>
                updateDuration(minutes, Number(event.target.value))
              }
            />
            <span className="text-muted-foreground text-sm">seconds</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="idle-reset-notification">
            Show notification when break automatically detected
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
      </CardContent>
    </Card>
  );
}
