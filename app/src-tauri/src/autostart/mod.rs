//! Launch-at-login registration (SPEC-0007).
//!
//! The public API is wired ahead of the M4 settings flow.

#![allow(dead_code)]

use tauri::{AppHandle, Runtime};
use tauri_plugin_autostart::ManagerExt;

use crate::error::{AppError, AppResult};

/// Turns launch-at-login on or off to match settings.
pub fn set_enabled<R: Runtime>(app: &AppHandle<R>, enabled: bool) -> AppResult<()> {
    if !should_apply_autostart(cfg!(debug_assertions)) {
        return Ok(());
    }

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

fn should_apply_autostart(is_development: bool) -> bool {
    !is_development
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skips_system_registration_in_development() {
        assert!(!should_apply_autostart(true));
    }

    #[test]
    fn applies_system_registration_outside_development() {
        assert!(should_apply_autostart(false));
    }
}
