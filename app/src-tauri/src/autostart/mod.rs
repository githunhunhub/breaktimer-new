//! Launch-at-login registration (SPEC-0007).
//!
//! The public API is wired ahead of the M4 settings flow.

#![allow(dead_code)]

use tauri::{AppHandle, Runtime};
use tauri_plugin_autostart::ManagerExt;

use crate::error::{AppError, AppResult};

/// Turns launch-at-login on or off to match settings.
pub fn set_enabled<R: Runtime>(app: &AppHandle<R>, enabled: bool) -> AppResult<()> {
    let manager = app.autolaunch();
    let result = if enabled {
        manager.enable()
    } else {
        manager.disable()
    };
    result.map_err(|error| AppError::message(error.to_string()))
}

/// Whether launch-at-login is currently registered with the OS.
pub fn is_enabled<R: Runtime>(app: &AppHandle<R>) -> AppResult<bool> {
    app.autolaunch()
        .is_enabled()
        .map_err(|error| AppError::message(error.to_string()))
}
