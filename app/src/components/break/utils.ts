// Helpers shared by the break overlay components (SPEC-0002).
// Ported from `breaktimer-app/app/renderer/components/break/utils.ts`.

import { translate, type Translate } from "@/lib/i18n";

const LEGACY_DEFAULT_TITLES = new Set([
  "Time for a break.",
  "A Moment's Respite.",
]);
const LEGACY_DEFAULT_MESSAGES = new Set([
  "Rest your eyes.\nStretch your legs.\nBreathe. Relax.",
  "Eyes to the horizon, drifting with clouds;\nBody unfolding, like a branch to the wind",
]);

/** Maps the legacy English default to the current locale without touching custom text. */
export function localizedBreakText(
  value: string,
  key: string,
  locale: string,
): string {
  const legacyValues =
    key === "break.defaultTitle"
      ? LEGACY_DEFAULT_TITLES
      : key === "break.defaultMessage"
        ? LEGACY_DEFAULT_MESSAGES
        : null;
  return legacyValues?.has(value) ? translate(locale, key) : value;
}

/** Human-readable "time since last break" label. */
export function formatTimeSinceLastBreak(
  seconds: number,
  t: Translate,
): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  let duration: string;
  if (hours > 0) {
    duration =
      minutes > 0
        ? t("common.duration.hoursMinutesSpaced", { hours, minutes })
        : t("common.duration.hours", { count: hours });
  } else if (minutes > 0) {
    duration = t("common.duration.minutes", { count: minutes });
  } else {
    duration = t("common.duration.lessThanMinute");
  }

  return t("break.timeSince", { duration });
}

function parseHexChannel(hex: string, start: number): number {
  return Number.parseInt(hex.slice(start, start + 2), 16) || 0;
}

/** A darkened, opaque rgba() backdrop derived from the configured color. */
export function createDarkerRgba(hex: string): string {
  const r = Math.floor(parseHexChannel(hex, 1) * 0.3);
  const g = Math.floor(parseHexChannel(hex, 3) * 0.3);
  const b = Math.floor(parseHexChannel(hex, 5) * 0.3);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Formats a millisecond duration as `mm:ss`. */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/** The circle's normalized radius; actual pixels come from the SVG viewBox (SPEC-0021). */
export const PROGRESS_RADIUS = 46;
export const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS;

/** Ring dash offset for clockwise progress starting at 12 o'clock (SPEC-0021). */
export function progressDashoffset(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return PROGRESS_CIRCUMFERENCE * (1 - clamped);
}
