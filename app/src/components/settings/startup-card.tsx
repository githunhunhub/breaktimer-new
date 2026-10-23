import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import type { Settings } from "@/types/settings";

interface StartupCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

/** Launch at login (SPEC-0007). */
export function StartupCard({ settings, onPatch }: StartupCardProps) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("settings.startup.title")}
        </CardTitle>
        <CardDescription>{t("settings.startup.helper")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="auto-launch">{t("settings.startup.toggle")}</Label>
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
