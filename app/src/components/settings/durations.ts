/** Splits a stored second count into the minute/second fields the UI edits. */
export function splitSeconds(totalSeconds: number): {
  minutes: number;
  seconds: number;
} {
  const safe = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.trunc(totalSeconds))
    : 0;
  return { minutes: Math.floor(safe / 60), seconds: safe % 60 };
}

/** Joins edited minute/second fields back into a stored second count. */
export function joinDurationSeconds(minutes: number, seconds: number): number {
  const safeMinutes = Number.isFinite(minutes)
    ? Math.max(0, Math.trunc(minutes))
    : 0;
  const safeSeconds = Number.isFinite(seconds)
    ? Math.min(59, Math.max(0, Math.trunc(seconds)))
    : 0;
  return safeMinutes * 60 + safeSeconds;
}
