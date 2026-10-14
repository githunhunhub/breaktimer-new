// TypeScript mirror of the Rust `BreakStatus` snapshot in
// `app/src-tauri/src/breaks/mod.rs` (SPEC-0002, SPEC-0003).
// Field names match the serialized camelCase form used by the backend.

export type BreakPhase = "IDLE" | "WORKING" | "ON_BREAK" | "POSTPONED";

export interface BreakStatus {
  phase: BreakPhase;
  breakStartedAt: number | null;
  breakEndAt: number | null;
  nextBreakAt: number | null;
  promptStartedAt: number | null;
  promptDeadlineAt: number | null;
  timeSinceLastBreakSeconds: number;
  allowPostpone: boolean;
  startedFromTray: boolean;
}
