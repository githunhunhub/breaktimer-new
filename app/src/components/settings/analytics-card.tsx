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

interface AnalyticsCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

/** Anonymous installation metrics toggle (SPEC-0018). */
export function AnalyticsCard({ settings, onPatch }: AnalyticsCardProps) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("settings.analytics.title")}
        </CardTitle>
        <CardDescription>{t("settings.analytics.helper")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="analytics-enabled">
            {t("settings.analytics.toggle")}
          </Label>
          <Switch
            id="analytics-enabled"
            checked={settings.analyticsEnabled}
            onCheckedChange={(checked) =>
              onPatch({ analyticsEnabled: checked })
            }
          />
        </div>
        {!settings.analyticsEnabled && (
          <p className="text-muted-foreground text-sm">
            {t("settings.analytics.disabledHint")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
