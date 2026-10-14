//! Break sound playback (SPEC-0009).
//!
//! The playback channel is not decided yet: the legacy app used Howler in the
//! renderer, while a Rust-side audio library is also viable. PLAN-0001 defers
//! that choice to the implementation phase, so this module intentionally stops
//! at the boundary. Record an ADR before picking a channel.

use tauri::{AppHandle, Runtime};

use crate::error::AppResult;

/// Wires the sound subsystem. No-op until SPEC-0009 is implemented in M4.
#[allow(dead_code)]
pub fn init<R: Runtime>(_app: &AppHandle<R>) -> AppResult<()> {
    Ok(())
}
