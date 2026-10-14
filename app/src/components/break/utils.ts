// Helpers shared by the break overlay components (SPEC-0002).
// Ported from `breaktimer-app/app/renderer/components/break/utils.ts`.

/** Human-readable "time since last break" label. */
export function formatTimeSinceLastBreak(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h${minutes > 0 ? ` ${minutes}m` : ""} since last break`;
  }
  if (minutes > 0) {
    return `${minutes}m since last break`;
  }
  return "Less than 1m since last break";
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
