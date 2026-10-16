import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { Settings, SoundType } from "@/types/settings";

const SOUND_OPTIONS: ReadonlyArray<{ value: SoundType; label: string }> = [
  { value: "NONE", label: "None" },
  { value: "GONG", label: "Gong" },
  { value: "BLIP", label: "Blip" },
  { value: "BLOOP", label: "Bloop" },
  { value: "PING", label: "Ping" },
  { value: "SCIFI", label: "Sci-fi" },
];

interface AudioCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
  /** Plays the selected sound without saving (SPEC-0009). */
  onPreview: (soundType: SoundType) => void;
}

export function AudioCard({ settings, onPatch, onPreview }: AudioCardProps) {
  const volumePercent = Math.round(settings.breakSoundVolume * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Audio</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sound-type">Break sound</Label>
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
                  {option.label}
                </option>
              ))}
            </Select>
            {settings.soundType !== "NONE" && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Preview break sound"
                title="Preview break sound"
                onClick={() => onPreview(settings.soundType)}
              >
                <Play />
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="break-sound-volume">Break sound volume</Label>
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
