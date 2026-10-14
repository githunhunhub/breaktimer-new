import type { Settings, WorkingHoursRange } from "@/types/settings";

export type WorkingHoursDayKey =
  | "workingHoursMonday"
  | "workingHoursTuesday"
  | "workingHoursWednesday"
  | "workingHoursThursday"
  | "workingHoursFriday"
  | "workingHoursSaturday"
  | "workingHoursSunday";

export interface WorkingHoursDay {
  key: WorkingHoursDayKey;
  label: string;
}

export const WORKING_HOURS_DAYS: WorkingHoursDay[] = [
  { key: "workingHoursMonday", label: "Monday" },
  { key: "workingHoursTuesday", label: "Tuesday" },
  { key: "workingHoursWednesday", label: "Wednesday" },
  { key: "workingHoursThursday", label: "Thursday" },
  { key: "workingHoursFriday", label: "Friday" },
  { key: "workingHoursSaturday", label: "Saturday" },
  { key: "workingHoursSunday", label: "Sunday" },
];

export const DEFAULT_WORKING_HOURS_RANGE: WorkingHoursRange = {
  fromMinutes: 9 * 60,
  toMinutes: 18 * 60,
};

const LAST_MINUTE_OF_DAY = 23 * 60 + 59;

/** Formats minutes since midnight as the `HH:MM` value an `<input type="time">` expects. */
export function minutesToTimeValue(minutes: number): string {
  const clamped = Math.min(
    Math.max(Number.isFinite(minutes) ? Math.trunc(minutes) : 0, 0),
    LAST_MINUTE_OF_DAY,
  );
  const hours = Math.floor(clamped / 60);
  return `${String(hours).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

/** Parses an `HH:MM` time value back into minutes since midnight. */
export function timeValueToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/** Moves a range start, keeping at least a 30 minute window when it overlaps the end. */
export function updateRangeStart(
  range: WorkingHoursRange,
  fromMinutes: number,
): WorkingHoursRange {
  if (fromMinutes >= range.toMinutes) {
    return {
      fromMinutes,
      toMinutes: Math.min(fromMinutes + 30, LAST_MINUTE_OF_DAY),
    };
  }
  return { ...range, fromMinutes };
}

/** Moves a range end, ignoring values that would invert the range. */
export function updateRangeEnd(
  range: WorkingHoursRange,
  toMinutes: number,
): WorkingHoursRange {
  if (toMinutes <= range.fromMinutes) return range;
  return { ...range, toMinutes };
}

export function workingHoursDayKey(
  key: WorkingHoursDayKey,
): keyof Pick<Settings, WorkingHoursDayKey> {
  return key;
}
