import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Settings } from "@/types/settings";

import { SettingsCard } from "./settings-card";

interface ThemeCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

const DEFAULT_BACKGROUND_COLOR = "#16a085";
const DEFAULT_TEXT_COLOR = "#ffffff";
const DEFAULT_BACKDROP_OPACITY = 0.7;

export function ThemeCard({ settings, onPatch }: ThemeCardProps) {
  return (
    <SettingsCard title="Theme">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="theme-primary-color">Primary color</Label>
            <Input
              id="theme-primary-color"
              type="color"
              className="h-10 w-20 cursor-pointer p-1"
              value={settings.backgroundColor}
              onChange={(event) =>
                onPatch({ backgroundColor: event.target.value })
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="theme-text-color">Text color</Label>
            <Input
              id="theme-text-color"
              type="color"
              className="h-10 w-20 cursor-pointer p-1"
              value={settings.textColor}
              onChange={(event) => onPatch({ textColor: event.target.value })}
            />
          </div>
        </div>

        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onPatch({
                backgroundColor: DEFAULT_BACKGROUND_COLOR,
                textColor: DEFAULT_TEXT_COLOR,
                backdropOpacity: DEFAULT_BACKDROP_OPACITY,
              })
            }
          >
            Reset
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}
