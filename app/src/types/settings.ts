// TypeScript mirror of the Rust `Settings` model in
// `app/src-tauri/src/state/settings.rs` (SPEC-0010).
// Field names match the serialized camelCase form used by the backend.

export type NotificationType = "NOTIFICATION" | "POPUP";

export type SoundType = "NONE" | "GONG" | "BLIP" | "BLOOP" | "PING" | "SCIFI";

export type TrayTextMode = "TIME_TO_NEXT_BREAK" | "TIME_SINCE_LAST_BREAK";

/** Shape of the active Popup break card (SPEC-0021). */
export type BreakCardShape = "RECTANGLE" | "CIRCLE";

export interface WorkingHoursRange {
  fromMinutes: number;
  toMinutes: number;
}

export interface WorkingHours {
  enabled: boolean;
  ranges: WorkingHoursRange[];
}

export interface Settings {
  language: string | null;
  checkForUpdates: boolean;
  analyticsEnabled: boolean;
  autoLaunch: boolean;
  breaksEnabled: boolean;
  trayTextEnabled: boolean;
  trayTextMode: TrayTextMode;
  notificationType: NotificationType;
  breakFrequencySeconds: number;
  breakLengthSeconds: number;
  postponeLengthSeconds: number;
  postponeLimit: number;
  workingHoursEnabled: boolean;
  workingHoursMonday: WorkingHours;
  workingHoursTuesday: WorkingHours;
  workingHoursWednesday: WorkingHours;
  workingHoursThursday: WorkingHours;
  workingHoursFriday: WorkingHours;
  workingHoursSaturday: WorkingHours;
  workingHoursSunday: WorkingHours;
  idleResetEnabled: boolean;
  idleResetLengthSeconds: number;
  idleResetNotification: boolean;
  soundType: SoundType;
  breakSoundVolume: number;
  breakTitle: string;
  breakMessage: string;
  backgroundColor: string;
  textColor: string;
  breakCardShape: BreakCardShape;
  showBackdrop: boolean;
  backdropOpacity: number;
  endBreakEnabled: boolean;
  skipBreakEnabled: boolean;
  postponeBreakEnabled: boolean;
  immediatelyStartBreaks: boolean;
}
