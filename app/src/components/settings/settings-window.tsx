import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ipc } from "@/lib/ipc";
import type { Settings, SoundType } from "@/types/settings";

import { AudioCard } from "./audio-card";
import { BreaksCard } from "./breaks-card";
import { SmartBreaksCard } from "./smart-breaks-card";
import { StartupCard } from "./startup-card";
import { TrayCard } from "./tray-card";
import { WorkingHoursCard } from "./working-hours-card";

export interface SettingsClient {
  getSettings: () => Promise<Settings>;
  setSettings: (settings: Settings) => Promise<void>;
  /** Plays a preview of a sound without saving (SPEC-0009); optional. */
  playSoundPreview?: (soundType: SoundType, volume: number) => Promise<void>;
}

interface SettingsWindowProps {
  client?: SettingsClient;
}

function messageFrom(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function SettingsWindow({ client = ipc }: SettingsWindowProps) {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    client
      .getSettings()
      .then((settings) => {
        if (!active) return;
        setSaved(settings);
        setDraft(settings);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(messageFrom(cause));
      });

    return () => {
      active = false;
    };
  }, [client]);

  const dirty = useMemo(
    () =>
      saved !== null &&
      draft !== null &&
      JSON.stringify(saved) !== JSON.stringify(draft),
    [draft, saved],
  );

  function updateDraft(patch: Partial<Settings>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  async function handleSave() {
    if (!draft || !dirty || saving) return;

    setSaving(true);
    setError(null);
    try {
      await client.setSettings(draft);
      setSaved(draft);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setSaving(false);
    }
  }

  function handlePreview(soundType: SoundType) {
    const preview = client.playSoundPreview?.(
      soundType,
      draft?.breakSoundVolume ?? 1,
    );
    preview?.catch((cause: unknown) => setError(messageFrom(cause)));
  }

  if (!draft) {
    return (
      <main className="flex h-full items-center justify-center gap-2">
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span className="sr-only">Loading settings</span>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="flex h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between px-6">
          <h1 className="text-xl font-semibold">Settings</h1>
          <Button onClick={handleSave} disabled={!dirty || saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">General</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="breaks-enabled">Breaks enabled</Label>
                <Switch
                  id="breaks-enabled"
                  checked={draft.breaksEnabled}
                  onCheckedChange={(checked) =>
                    updateDraft({ breaksEnabled: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <StartupCard settings={draft} onPatch={updateDraft} />

          <BreaksCard settings={draft} onPatch={updateDraft} />

          <WorkingHoursCard settings={draft} onPatch={updateDraft} />

          <SmartBreaksCard settings={draft} onPatch={updateDraft} />

          <TrayCard settings={draft} onPatch={updateDraft} />

          <AudioCard
            settings={draft}
            onPatch={updateDraft}
            onPreview={handlePreview}
          />

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
