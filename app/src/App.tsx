import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ipc, type AppInfo } from "@/lib/ipc";
import type { Settings } from "@/types/settings";

/**
 * M3 scaffold harness: verifies the React -> Tauri IPC link and the backend
 * settings store are wired up. Replaced by the real settings/break UI in M4.
 */
export default function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [greetMsg, setGreetMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([ipc.getAppInfo(), ipc.getSettings()])
      .then(([appInfo, loadedSettings]) => {
        setInfo(appInfo);
        setSettings(loadedSettings);
      })
      .catch((cause: unknown) => setError(String(cause)));
  }, []);

  async function runGreet() {
    try {
      setGreetMsg(await ipc.greet("BreakTimer"));
    } catch (cause) {
      setError(String(cause));
    }
  }

  async function updateSettings(patch: Partial<Settings>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await ipc.setSettings(next);
    } catch (cause) {
      setError(String(cause));
    }
  }

  if (!info || !settings) {
    return (
      <main className="text-muted-foreground flex h-full items-center justify-center gap-2">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>Connecting to backend...</span>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">{info.name}</h1>
        <span className="text-muted-foreground text-sm">v{info.version}</span>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backend link</CardTitle>
          <CardDescription>
            Renderer to Rust IPC is reachable through typed commands.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Settings file</span>
            <span
              className="min-w-0 flex-1 truncate text-right font-mono text-xs"
              title={info.settingsPath}
            >
              {info.settingsPath}
            </span>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">greet command</span>
            <Button size="sm" variant="outline" onClick={runGreet}>
              Call
            </Button>
          </div>
          {greetMsg && <p className="text-muted-foreground">{greetMsg}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings snapshot</CardTitle>
          <CardDescription>
            Changes persist to disk immediately (SPEC-0010).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="breaks-enabled">Breaks enabled</Label>
            <Switch
              id="breaks-enabled"
              checked={settings.breaksEnabled}
              onCheckedChange={(checked) =>
                updateSettings({ breaksEnabled: checked })
              }
            />
          </div>
          <Separator />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <dt className="text-muted-foreground">Break frequency</dt>
            <dd className="text-right font-mono text-xs">
              {settings.breakFrequencySeconds}s
            </dd>
            <dt className="text-muted-foreground">Break length</dt>
            <dd className="text-right font-mono text-xs">
              {settings.breakLengthSeconds}s
            </dd>
            <dt className="text-muted-foreground">Notification mode</dt>
            <dd className="text-right font-mono text-xs">
              {settings.notificationType}
            </dd>
            <dt className="text-muted-foreground">Sound</dt>
            <dd className="text-right font-mono text-xs">
              {settings.soundType}
            </dd>
          </dl>
        </CardContent>
      </Card>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </main>
  );
}
