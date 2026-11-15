import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { Settings } from "@/types/settings";

import {
  PROGRESS_CIRCUMFERENCE,
  PROGRESS_RADIUS,
  createDarkerRgba,
  formatCountdown,
  localizedBreakText,
  progressDashoffset,
} from "./utils";

interface ActiveBreakCardProps {
  settings: Settings;
  progress: number;
  remainingMs: number;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
}

/** The 12 o'clock starting point for clockwise SVG circle progress. */
const RING_TRANSFORM = "rotate(-90 50 50)";

/**
 * Circle diameter. Equal area to the 500x300 rectangle card (≈437px) keeps both
 * shapes at the same visual weight (SPEC-0021).
 */
const CIRCLE_DIAMETER = "min(58vmin, 440px)";

/**
 * The circle's content box stays inside the inscribed square (side ≈ 0.71 ×
 * diameter), so the round edge can never clip the title or the button.
 */
const CIRCLE_CONTENT_BOX = "w-[76%] max-h-[62%]";

/**
 * Fully transparent windows stop receiving mouse input on Windows, so the
 * no-backdrop variant keeps a 1/1000 alpha (same trick as SPEC-0002).
 */
const TRANSPARENT_BUT_CLICKABLE = "rgba(0, 0, 0, 0.001)";

export function ActiveBreakCard({
  settings,
  progress,
  remainingMs,
  busy,
  error,
  onCancel,
}: ActiveBreakCardProps) {
  const { locale, t } = useI18n();
  const isCircle = settings.breakCardShape === "CIRCLE";
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const countdown = formatCountdown(remainingMs);
  const localizedTitle = localizedBreakText(
    settings.breakTitle,
    "break.defaultTitle",
    locale,
  );
  const localizedMessage = localizedBreakText(
    settings.breakMessage,
    "break.defaultMessage",
    locale,
  );
  const backdrop = settings.showBackdrop ? (
    <div
      aria-hidden="true"
      className="absolute inset-0 transition-opacity duration-500"
      style={{
        backgroundColor: createDarkerRgba(settings.backgroundColor),
        opacity: settings.backdropOpacity,
      }}
    />
  ) : null;

  const cancelButton = settings.endBreakEnabled ? (
    <Button
      className="shrink-0 border border-current/20 bg-transparent hover:bg-black/10"
      disabled={busy}
      onClick={onCancel}
      variant="outline"
    >
      {t("break.cancel")}
    </Button>
  ) : null;

  const errorMessage = error ? (
    <p
      role="alert"
      className="mt-4 max-h-24 shrink-0 overflow-y-auto rounded bg-black/20 px-3 py-2 text-sm"
    >
      {error}
    </p>
  ) : null;

  return (
    <main
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-transparent p-6"
      style={
        settings.showBackdrop
          ? undefined
          : { backgroundColor: TRANSPARENT_BUT_CLICKABLE }
      }
    >
      {backdrop}

      {isCircle ? (
        <section
          data-break-card="circle"
          className="relative shrink-0 overflow-hidden rounded-full shadow-xl"
          style={{
            backgroundColor: settings.backgroundColor,
            color: settings.textColor,
            containerType: "inline-size",
            height: CIRCLE_DIAMETER,
            width: CIRCLE_DIAMETER,
          }}
        >
          <svg
            aria-label={t("break.progressLabel")}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(clampedProgress * 100)}
            className="pointer-events-none absolute inset-0 h-full w-full"
            role="progressbar"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              fill="none"
              opacity="0.2"
              r={PROGRESS_RADIUS}
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle
              cx="50"
              cy="50"
              data-break-progress={progress}
              data-testid="break-progress-ring"
              fill="none"
              r={PROGRESS_RADIUS}
              stroke="currentColor"
              strokeDasharray={PROGRESS_CIRCUMFERENCE}
              strokeDashoffset={progressDashoffset(clampedProgress)}
              strokeLinecap="round"
              strokeWidth="1.5"
              transform={RING_TRANSFORM}
            />
          </svg>

          <div
            className={`absolute top-1/2 left-1/2 flex ${CIRCLE_CONTENT_BOX} -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-[3.5cqw] text-center`}
          >
            <h1 className="line-clamp-2 w-full shrink-0 break-words text-[clamp(0.95rem,4.8cqw,1.75rem)] font-semibold leading-tight tracking-tight">
              {localizedTitle}
            </h1>
            <p
              data-break-countdown
              className="shrink-0 text-[clamp(1.75rem,9cqw,3rem)] font-semibold leading-none tabular-nums"
            >
              {countdown}
            </p>
            <p
              data-break-message
              className="min-h-0 w-[86%] shrink overflow-y-auto whitespace-pre-line break-words text-[clamp(0.7rem,3cqw,1rem)] font-medium leading-snug opacity-80"
            >
              {localizedMessage}
            </p>
            {cancelButton}
            {errorMessage}
          </div>
        </section>
      ) : (
        <section
          data-break-card="rectangle"
          className="relative flex min-h-[300px] w-full max-w-[500px] flex-col justify-center overflow-hidden rounded-lg p-6 shadow-xl"
          style={{
            backgroundColor: settings.backgroundColor,
            color: settings.textColor,
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-tight">
              {localizedTitle}
            </h1>
            {cancelButton}
          </div>

          <p className="mt-6 whitespace-pre-line text-lg font-medium opacity-80">
            {localizedMessage}
          </p>

          <div className="mt-6 w-full">
            <div className="mb-2 flex justify-end text-sm font-medium tabular-nums opacity-60">
              {countdown}
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

          {errorMessage}
        </section>
      )}
    </main>
  );
}
