import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ipc } from "@/lib/ipc";
import type { BreakStatus } from "@/types/breaks";
import type { Settings } from "@/types/settings";

import {
  createDarkerRgba,
  formatCountdown,
  formatTimeSinceLastBreak,
} from "./utils";

export interface BreakClient {
  getSettings: () => Promise<Settings>;
  getBreakStatus: () => Promise<BreakStatus>;
  beginBreak: () => Promise<BreakStatus>;
  endBreak: () => Promise<BreakStatus>;
  postponeBreak: () => Promise<BreakStatus>;
  skipBreak: () => Promise<BreakStatus>;
  onBreakStatus: (
    handler: (status: BreakStatus) => void,
  ) => Promise<() => void>;
}

interface BreakWindowProps {
  client?: BreakClient;
}

const PROMPT_GRACE_MS = 60_000;

function messageFrom(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;

    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [active]);

  return now;
}

export function BreakWindow({ client = ipc }: BreakWindowProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<BreakStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useNow(status?.phase === "ON_BREAK");

  useEffect(() => {
    let active = true;

    Promise.all([client.getSettings(), client.getBreakStatus()])
      .then(([nextSettings, nextStatus]) => {
        if (!active) return;
        setSettings(nextSettings);
        setStatus(nextStatus);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(messageFrom(cause));
      });

    return () => {
      active = false;
    };
  }, [client]);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;

    client
      .onBreakStatus((nextStatus) => {
        if (active) setStatus(nextStatus);
      })
      .then((stopListening) => {
        if (active) {
          unlisten = stopListening;
        } else {
          stopListening();
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(messageFrom(cause));
      });

    return () => {
      active = false;
      unlisten?.();
    };
  }, [client]);

  useEffect(() => {
    const previousHtmlBackground = document.documentElement.style.background;
    const previousBodyBackground = document.body.style.background;
    const previousOverflow = document.body.style.overflow;

    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.background = previousHtmlBackground;
      document.body.style.background = previousBodyBackground;
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function runAction(action: () => Promise<BreakStatus>) {
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      setStatus(await action());
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  }

  const prompt = useMemo(() => {
    if (!status?.promptStartedAt || !status.promptDeadlineAt) return null;

    const elapsed = Math.max(0, now - status.promptStartedAt);
    const remaining = Math.max(0, status.promptDeadlineAt - now);

    return {
      phase: elapsed < PROMPT_GRACE_MS ? "grace" : "countdown",
      secondsRemaining: Math.ceil(remaining / 1000),
      progress:
        elapsed < PROMPT_GRACE_MS
          ? 0
          : clamp((elapsed - PROMPT_GRACE_MS) / PROMPT_GRACE_MS, 0, 1),
    };
  }, [now, status]);

  const breakProgress = useMemo(() => {
    if (!status?.breakStartedAt || !status.breakEndAt) return null;

    const duration = Math.max(1, status.breakEndAt - status.breakStartedAt);
    const elapsed = clamp(now - status.breakStartedAt, 0, duration);

    return {
      progress: elapsed / duration,
      remainingMs: Math.max(0, status.breakEndAt - now),
    };
  }, [now, status]);

  if (error && (!settings || !status)) {
    return (
      <main className="flex h-full w-full items-center justify-center bg-transparent p-6">
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      </main>
    );
  }

  if (!settings || !status) {
    return (
      <main className="flex h-full w-full items-center justify-center bg-transparent">
        <Loader2 className="size-5 animate-spin text-white/80" />
        <span className="sr-only">Loading break</span>
      </main>
    );
  }

  if (status.phase !== "ON_BREAK") {
    return null;
  }

  if (!status.breakStartedAt) {
    const showPostpone = settings.postponeBreakEnabled && status.allowPostpone;
    const showSkip = settings.skipBreakEnabled;
    const isCountdown = prompt?.phase === "countdown";

    return (
      <main className="flex h-full w-full items-center justify-center overflow-hidden bg-transparent p-2">
        <section
          className="relative flex h-full w-full items-center justify-between gap-4 overflow-hidden rounded-lg px-5 py-3 shadow-lg"
          style={{
            backgroundColor: settings.backgroundColor,
            color: settings.textColor,
          }}
        >
          {isCountdown && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 transition-[width] duration-100 ease-linear"
              style={{
                backgroundColor: settings.textColor,
                opacity: 0.15,
                width: `${(prompt?.progress ?? 0) * 100}%`,
              }}
            />
          )}

          <div className="relative min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight">
              {isCountdown
                ? `Break starting in ${prompt?.secondsRemaining ?? 0}s...`
                : "Start your break when ready..."}
            </h1>
            <p className="truncate text-xs font-medium opacity-75">
              {formatTimeSinceLastBreak(status.timeSinceLastBreakSeconds)}
            </p>
          </div>

          <div className="relative flex shrink-0 items-center gap-2">
            <Button
              className="border border-current/20 bg-transparent hover:bg-black/10"
              disabled={busy}
              onClick={() => void runAction(client.beginBreak)}
              variant="outline"
            >
              Start
            </Button>
            {showPostpone && (
              <Button
                className="border border-current/20 bg-transparent hover:bg-black/10"
                disabled={busy}
                onClick={() => void runAction(client.postponeBreak)}
                variant="outline"
              >
                Snooze
              </Button>
            )}
            {showSkip && (
              <Button
                className="border border-current/20 bg-transparent hover:bg-black/10"
                disabled={busy}
                onClick={() => void runAction(client.skipBreak)}
                variant="outline"
              >
                Skip
              </Button>
            )}
          </div>
        </section>

        {error && (
          <p
            role="alert"
            className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/70 px-2 py-1 text-xs text-white"
          >
            {error}
          </p>
        )}
      </main>
    );
  }

  const progress = breakProgress?.progress ?? 0;

  return (
    <main
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-transparent p-6"
      style={
        settings.showBackdrop
          ? undefined
          : { backgroundColor: "rgba(0, 0, 0, 0.001)" }
      }
    >
      {settings.showBackdrop && (
        <div
          aria-hidden="true"
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            backgroundColor: createDarkerRgba(settings.backgroundColor),
            opacity: settings.backdropOpacity,
          }}
        />
      )}

      <section
        className="relative flex min-h-[300px] w-full max-w-[500px] flex-col justify-center overflow-hidden rounded-lg p-6 shadow-xl"
        style={{
          backgroundColor: settings.backgroundColor,
          color: settings.textColor,
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">
            {settings.breakTitle}
          </h1>
          {settings.endBreakEnabled && (
            <Button
              className="shrink-0 border border-current/20 bg-transparent hover:bg-black/10"
              disabled={busy}
              onClick={() => void runAction(client.endBreak)}
              variant="outline"
            >
              Cancel Break
            </Button>
          )}
        </div>

        <p className="mt-6 whitespace-pre-line text-lg font-medium opacity-80">
          {settings.breakMessage}
        </p>

        <div className="mt-6 w-full">
          <div className="mb-2 flex justify-end text-sm font-medium tabular-nums opacity-60">
            {formatCountdown(breakProgress?.remainingMs ?? 0)}
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.2)" }}
          >
            <div
              className="h-full transition-[width] duration-100 ease-out"
              style={{
                backgroundColor: settings.textColor,
                width: `${progress * 100}%`,
              }}
            />
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded bg-black/20 px-3 py-2 text-sm"
          >
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
