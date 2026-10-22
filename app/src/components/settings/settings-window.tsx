import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { ipc } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import type { Settings, SoundType } from "@/types/settings";

import { AdvancedCard } from "./advanced-card";
import { AudioCard } from "./audio-card";
import { BackdropCard } from "./backdrop-card";
import { BreaksCard } from "./breaks-card";
import { SkipCard } from "./skip-card";
import { SmartBreaksCard } from "./smart-breaks-card";
import { SnoozeCard } from "./snooze-card";
import { StartupCard } from "./startup-card";
import { ThemeCard } from "./theme-card";
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

const SETTINGS_TABS = [
  { value: "general", label: "General" },
  { value: "working-hours", label: "Working Hours" },
  { value: "customization", label: "Customization" },
  { value: "system", label: "System" },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]["value"];

function messageFrom(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function SettingsWindow({ client = ipc }: SettingsWindowProps) {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

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

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % SETTINGS_TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = SETTINGS_TABS.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = SETTINGS_TABS[nextIndex];
    setActiveTab(nextTab.value);
    document.getElementById(`settings-tab-${nextTab.value}`)?.focus();
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
        <div className="mx-auto w-full max-w-2xl px-6 pb-4">
          <div
            role="tablist"
            aria-label="Settings sections"
            className="bg-muted text-muted-foreground grid h-9 grid-cols-4 items-center rounded-lg p-1"
          >
            {SETTINGS_TABS.map((tab, index) => {
              const selected = activeTab === tab.value;

              return (
                <button
                  key={tab.value}
                  id={`settings-tab-${tab.value}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`settings-panel-${tab.value}`}
                  tabIndex={selected ? 0 : -1}
                  className={cn(
                    "inline-flex h-full items-center justify-center rounded-md px-2 text-sm font-medium whitespace-nowrap transition-colors",
                    selected
                      ? "bg-background text-foreground shadow-sm"
                      : "hover:text-foreground",
                  )}
                  onClick={() => setActiveTab(tab.value)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div
          id={`settings-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${activeTab}`}
          className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6"
        >
          {activeTab === "general" && (
            <>
              <BreaksCard settings={draft} onPatch={updateDraft} />
              <SmartBreaksCard settings={draft} onPatch={updateDraft} />
              <SnoozeCard settings={draft} onPatch={updateDraft} />
              <SkipCard settings={draft} onPatch={updateDraft} />
              <AdvancedCard settings={draft} onPatch={updateDraft} />
            </>
          )}

          {activeTab === "working-hours" && (
            <WorkingHoursCard settings={draft} onPatch={updateDraft} />
          )}

          {activeTab === "customization" && (
            <>
              <ThemeCard settings={draft} onPatch={updateDraft} />
              <AudioCard
                settings={draft}
                onPatch={updateDraft}
                onPreview={handlePreview}
              />
              <BackdropCard settings={draft} onPatch={updateDraft} />
            </>
          )}

          {activeTab === "system" && (
            <StartupCard settings={draft} onPatch={updateDraft} />
          )}

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
