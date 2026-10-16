import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Settings, TrayTextMode } from "@/types/settings";

interface TrayCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

/** macOS menu bar title (SPEC-0006). */
export function TrayCard({ settings, onPatch }: TrayCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Menu Bar Text</CardTitle>
        <CardDescription>
          Show timing information next to the menu bar icon.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="tray-text-enabled">Show menu bar text</Label>
          <Switch
            id="tray-text-enabled"
            checked={settings.trayTextEnabled}
            onCheckedChange={(checked) => onPatch({ trayTextEnabled: checked })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tray-text-mode">Text</Label>
          <Select
            id="tray-text-mode"
            value={settings.trayTextMode}
            disabled={!settings.trayTextEnabled}
            onChange={(event) =>
              onPatch({ trayTextMode: event.target.value as TrayTextMode })
            }
          >
            <option value="TIME_TO_NEXT_BREAK">Time to next break</option>
            <option value="TIME_SINCE_LAST_BREAK">Time since last break</option>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
