import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import type { Settings } from "@/types/settings";

import { SettingsCard } from "./settings-card";

interface LanguageCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

export function LanguageCard({ settings, onPatch }: LanguageCardProps) {
  const { t, languages } = useI18n();

  return (
    <SettingsCard
      title={t("settings.language.title")}
      helperText={t("settings.language.helper")}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="display-language">{t("settings.language.label")}</Label>
        <Select
          id="display-language"
          value={settings.language ?? ""}
          onChange={(event) =>
            onPatch({ language: event.target.value || null })
          }
        >
          <option value="">{t("common.followSystem")}</option>
          {languages.map((language) => (
            <option key={language.locale} value={language.locale}>
              {language.name}
            </option>
          ))}
        </Select>
      </div>
    </SettingsCard>
  );
}
