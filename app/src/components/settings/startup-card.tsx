import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/types/settings";

interface StartupCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

/** Launch at login (SPEC-0007). */
export function StartupCard({ settings, onPatch }: StartupCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Start at login</CardTitle>
        <CardDescription>
          Automatically start BreakTimer when you log in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="auto-launch">Launch at login</Label>
          <Switch
            id="auto-launch"
            checked={settings.autoLaunch}
            onCheckedChange={(checked) => onPatch({ autoLaunch: checked })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
