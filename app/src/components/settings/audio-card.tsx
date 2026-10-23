import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useI18n } from "@/lib/i18n";
import type { Settings, SoundType } from "@/types/settings";

const SOUND_OPTIONS: ReadonlyArray<{ value: SoundType; labelKey: string }> = [
  { value: "NONE", labelKey: "settings.audio.sounds.none" },
  { value: "GONG", labelKey: "settings.audio.sounds.gong" },
  { value: "BLIP", labelKey: "settings.audio.sounds.blip" },
  { value: "BLOOP", labelKey: "settings.audio.sounds.bloop" },
  { value: "PING", labelKey: "settings.audio.sounds.ping" },
  { value: "SCIFI", labelKey: "settings.audio.sounds.scifi" },
];

interface AudioCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
  /** Plays the selected sound without saving (SPEC-0009). */
  onPreview: (soundType: SoundType) => void;
}

export function AudioCard({ settings, onPatch, onPreview }: AudioCardProps) {
  const { t } = useI18n();
  const volumePercent = Math.round(settings.breakSoundVolume * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.audio.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sound-type">{t("settings.audio.breakSound")}</Label>
          <div className="flex items-center gap-2">
            <Select
              id="sound-type"
              value={settings.soundType}
              onChange={(event) =>
                onPatch({ soundType: event.target.value as SoundType })
              }
            >
              {SOUND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </Select>
            {settings.soundType !== "NONE" && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t("settings.audio.preview")}
                title={t("settings.audio.preview")}
                onClick={() => onPreview(settings.soundType)}
              >
                <Play />
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="break-sound-volume">
            {t("settings.audio.volume")}
          </Label>
          <Slider
            id="break-sound-volume"
            min={0}
            max={1}
            step={0.01}
            value={settings.breakSoundVolume}
            onChange={(event) =>
              onPatch({ breakSoundVolume: Number(event.target.value) })
            }
          />
          <div className="text-muted-foreground flex justify-between text-sm">
            <span>0%</span>
            <span>{volumePercent}%</span>
            <span>100%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
