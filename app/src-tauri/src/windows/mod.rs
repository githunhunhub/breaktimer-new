//! Break window management (SPEC-0002).
//!
//! Break windows are the per-display fullscreen overlays created when a break
//! starts (see ADR-0002). They are labelled with [`BREAK_WINDOW_PREFIX`] so the
//! rest of the backend can find and close them without tracking a list.

#![allow(dead_code)]

use tauri::{AppHandle, Manager, Runtime};

use crate::error::AppResult;

/// Label prefix for every break overlay window.
pub const BREAK_WINDOW_PREFIX: &str = "break-";

/// Closes every open break window.
///
/// Both the natural end of a break and a manual "end break" go through this so
/// no overlay is ever left behind.
pub fn close_all<R: Runtime>(app: &AppHandle<R>) {
    for (label, window) in app.webview_windows() {
        if label.starts_with(BREAK_WINDOW_PREFIX) {
            if let Err(error) = window.close() {
                eprintln!("failed to close break window {label}: {error}");
            }
        }
    }
}

/// Wires the window subsystem. Window creation lands with SPEC-0002 in M4.
#[allow(dead_code)]
pub fn init<R: Runtime>(_app: &AppHandle<R>) -> AppResult<()> {
    Ok(())
}
