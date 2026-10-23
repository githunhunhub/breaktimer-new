//! Application settings model (SPEC-0010).
//!
//! Mirrors the legacy TypeScript `Settings` interface in
//! `breaktimer-app/app/types/settings.ts`. Serialized field names are
//! camelCase so the JSON file stays readable and matches the frontend types in
//! `app/src/types/settings.ts`.

use serde::{Deserialize, Serialize};

/// How a due break is presented to the user (SPEC-0008).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum NotificationType {
    Notification,
    Popup,
}

/// Break start/end sound selection (SPEC-0009).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SoundType {
    None,
    Gong,
    Blip,
    Bloop,
    Ping,
    Scifi,
}

/// Which countdown the tray title shows (SPEC-0006).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TrayTextMode {
    TimeToNextBreak,
    TimeSinceLastBreak,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkingHoursRange {
    pub from_minutes: u32,
    pub to_minutes: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkingHours {
    pub enabled: bool,
    pub ranges: Vec<WorkingHoursRange>,
}

/// Everything the user can configure. Loading merges stored values over
/// [`Settings::default`], so unknown or missing fields fall back to defaults
/// (SPEC-0010 acceptance criteria).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    #[serde(default)]
    pub language: Option<String>,
    pub auto_launch: bool,
    pub breaks_enabled: bool,
    pub tray_text_enabled: bool,
    pub tray_text_mode: TrayTextMode,
    pub notification_type: NotificationType,
    pub break_frequency_seconds: u32,
    pub break_length_seconds: u32,
    pub postpone_length_seconds: u32,
    pub postpone_limit: u32,
    pub working_hours_enabled: bool,
    pub working_hours_monday: WorkingHours,
    pub working_hours_tuesday: WorkingHours,
    pub working_hours_wednesday: WorkingHours,
    pub working_hours_thursday: WorkingHours,
    pub working_hours_friday: WorkingHours,
    pub working_hours_saturday: WorkingHours,
    pub working_hours_sunday: WorkingHours,
    pub idle_reset_enabled: bool,
    pub idle_reset_length_seconds: u32,
    pub idle_reset_notification: bool,
    pub sound_type: SoundType,
    pub break_sound_volume: f32,
    pub break_title: String,
    pub break_message: String,
    pub background_color: String,
    pub text_color: String,
    pub show_backdrop: bool,
    pub backdrop_opacity: f32,
    pub end_break_enabled: bool,
    pub skip_break_enabled: bool,
    pub postpone_break_enabled: bool,
    pub immediately_start_breaks: bool,
}

impl WorkingHoursRange {
    /// Legacy default working window: 09:00 to 18:00.
    pub const fn default_range() -> Self {
        Self {
            from_minutes: 9 * 60,
            to_minutes: 18 * 60,
        }
    }
}

impl Default for Settings {
    fn default() -> Self {
        let everyday = || WorkingHours {
            enabled: true,
            ranges: vec![WorkingHoursRange::default_range()],
        };
        let weekend = || WorkingHours {
            enabled: false,
            ranges: vec![WorkingHoursRange::default_range()],
        };

        Self {
            language: None,
            auto_launch: true,
            breaks_enabled: true,
            tray_text_enabled: true,
            tray_text_mode: TrayTextMode::TimeToNextBreak,
            notification_type: NotificationType::Popup,
            break_frequency_seconds: 28 * 60,
            break_length_seconds: 2 * 60,
            postpone_length_seconds: 3 * 60,
            postpone_limit: 0,
            working_hours_enabled: true,
            working_hours_monday: everyday(),
            working_hours_tuesday: everyday(),
            working_hours_wednesday: everyday(),
            working_hours_thursday: everyday(),
            working_hours_friday: everyday(),
            working_hours_saturday: weekend(),
            working_hours_sunday: weekend(),
            idle_reset_enabled: true,
            idle_reset_length_seconds: 5 * 60,
            idle_reset_notification: false,
            sound_type: SoundType::Gong,
            break_sound_volume: 1.0,
            break_title: "Time for a break.".to_string(),
            break_message: "Rest your eyes.\nStretch your legs.\nBreathe. Relax.".to_string(),
            background_color: "#16a085".to_string(),
            text_color: "#ffffff".to_string(),
            show_backdrop: true,
            backdrop_opacity: 0.7,
            end_break_enabled: true,
            skip_break_enabled: false,
            postpone_break_enabled: true,
            immediately_start_breaks: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_matches_legacy_settings() {
        let settings = Settings::default();
        assert_eq!(settings.break_frequency_seconds, 28 * 60);
        assert_eq!(settings.break_length_seconds, 2 * 60);
        assert_eq!(settings.postpone_length_seconds, 3 * 60);
        assert_eq!(settings.sound_type, SoundType::Gong);
        assert_eq!(settings.notification_type, NotificationType::Popup);
        assert!(settings.working_hours_monday.enabled);
        assert!(!settings.working_hours_saturday.enabled);
        assert_eq!(
            settings.working_hours_monday.ranges,
            vec![WorkingHoursRange::default_range()]
        );
    }

    #[test]
    fn missing_fields_fall_back_to_defaults() {
        let settings: Settings = serde_json::from_str(r#"{"breakLengthSeconds": 90}"#).unwrap();
        assert_eq!(settings.break_length_seconds, 90);
        assert_eq!(settings.break_frequency_seconds, 28 * 60);
        assert_eq!(settings.sound_type, SoundType::Gong);
    }

    #[test]
    fn missing_language_defaults_to_follow_system() {
        let settings: Settings = serde_json::from_str("{}").unwrap();
        assert_eq!(settings.language, None);
        assert_eq!(
            serde_json::to_value(settings).unwrap()["language"],
            serde_json::Value::Null
        );
    }

    #[test]
    fn serializes_camel_case_enums() {
        let json = serde_json::to_value(Settings::default()).unwrap();
        assert_eq!(json["notificationType"], "POPUP");
        assert_eq!(json["soundType"], "GONG");
        assert_eq!(json["trayTextMode"], "TIME_TO_NEXT_BREAK");
        assert_eq!(json["workingHoursMonday"]["enabled"], true);
        assert_eq!(json["workingHoursMonday"]["ranges"][0]["fromMinutes"], 540);
    }
}
