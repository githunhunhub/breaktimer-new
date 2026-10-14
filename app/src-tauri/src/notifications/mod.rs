//! System notifications (SPEC-0008).
//!
//! Wraps `tauri-plugin-notification` so the scheduler can raise a notification
//! without depending on the plugin API directly.

#![allow(dead_code)]

use tauri::{AppHandle, Runtime};

use crate::error::{AppError, AppResult};
use tauri_plugin_notification::NotificationExt;

/// Shows a system notification with `title` and `body`.
///
/// Used by SPEC-0008 (`NotificationType::Notification`) and by the optional
/// idle-reset notification in SPEC-0005.
pub fn notify<R: Runtime>(app: &AppHandle<R>, title: &str, body: &str) -> AppResult<()> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|error| AppError::message(error.to_string()))
}
