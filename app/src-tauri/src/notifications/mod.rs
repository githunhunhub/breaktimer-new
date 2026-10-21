//! System notifications (SPEC-0008).
//!
//! Wraps `tauri-plugin-notification` so the scheduler can raise a notification
//! without depending on the plugin API directly.

#![allow(dead_code)]

use tauri::{AppHandle, Runtime};

use crate::error::{AppError, AppResult};
use tauri_plugin_notification::NotificationExt;

/// The `breakMessage` setting may contain simple HTML (`<br>`, `<b>`, …).
/// System notifications only render plain text, so tags are removed and line
/// breaks become spaces before the body is shown (SPEC-0008).
pub(crate) fn strip_html(html: &str) -> String {
    // Line breaks carry word separation; other tags are dropped outright.
    let line_breaks =
        regex::Regex::new(r"(?i)<br(?:\s[^>]*)?\s*/?>").expect("valid line-break regex");
    let tags = regex::Regex::new(r"<[^>]*>").expect("valid tag regex");

    tags.replace_all(&line_breaks.replace_all(html, " "), "")
        .trim()
        .to_string()
}

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_html_removes_tags_and_turns_breaks_into_spaces() {
        assert_eq!(strip_html("Rest <b>your</b> eyes."), "Rest your eyes.");
        assert_eq!(
            strip_html("Line one<br>Line two<br/>Line three"),
            "Line one Line two Line three"
        );
        assert_eq!(strip_html("  <p>Stretch</p>  "), "Stretch");
        assert_eq!(strip_html("Plain text"), "Plain text");
    }

    #[test]
    fn strip_html_handles_breaks_with_attributes_and_spacing() {
        assert_eq!(strip_html("Rest<br class=\"tight\" />now"), "Rest now");
    }
}
