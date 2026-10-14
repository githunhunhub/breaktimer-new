//! Versioned settings migrations (SPEC-0010).
//!
//! Ports the legacy `migrations` chain from
//! `breaktimer-app/app/main/lib/store.ts`. Rules that must stay true:
//!
//! - Versions only ever increase, and migrations run in ascending order.
//! - A failing migration stops the chain and leaves the stored data untouched,
//!   so a bad migration cannot corrupt an existing settings file.
//! - Migrations operate on raw JSON so they can read shapes that no longer
//!   match the current [`crate::state::settings::Settings`] struct.

use chrono::{DateTime, Timelike};
use serde_json::{Value, json};

use crate::state::settings::WorkingHoursRange;

/// The settings schema version written by this build.
pub const CURRENT_SETTINGS_VERSION: u32 = 2;

/// A single forward migration, applied once when `version` is below the
/// migration's own version.
pub struct Migration {
    pub version: u32,
    pub apply: fn(Value) -> Result<Value, String>,
}

/// Registered migrations, highest version last.
pub fn migrations() -> &'static [Migration] {
    &[
        Migration {
            version: 1,
            apply: migrate_working_hours_to_ranges,
        },
        Migration {
            version: 2,
            apply: migrate_durations_to_seconds,
        },
    ]
}

#[derive(Debug)]
pub struct MigrationOutcome {
    pub settings: Value,
    pub version: u32,
    /// Set when a migration failed: `(version, message)`.
    pub failure: Option<(u32, String)>,
}

/// Applies every migration newer than `from_version`, stopping at the first
/// failure.
pub fn run(settings: Value, from_version: u32) -> MigrationOutcome {
    let mut current = settings;
    let mut version = from_version;
    let mut failure = None;

    let mut pending: Vec<&Migration> = migrations()
        .iter()
        .filter(|migration| migration.version > from_version)
        .collect();
    pending.sort_by_key(|migration| migration.version);

    for migration in pending {
        match (migration.apply)(current.clone()) {
            Ok(next) => {
                current = next;
                version = migration.version;
            }
            Err(message) => {
                failure = Some((migration.version, message));
                break;
            }
        }
    }

    MigrationOutcome {
        settings: current,
        version,
        failure,
    }
}

const DAY_NAMES: [&str; 7] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];

/// v0 -> v1: `workingHours<Day>` booleans become `{ enabled, ranges }`.
fn migrate_working_hours_to_ranges(mut settings: Value) -> Result<Value, String> {
    let Some(object) = settings.as_object_mut() else {
        return Ok(settings);
    };

    // Only the legacy boolean form needs migrating.
    let is_legacy = object
        .get("workingHoursMonday")
        .is_some_and(Value::is_boolean);
    if !is_legacy {
        return Ok(settings);
    }

    let from_minutes = object
        .get("workingHoursFrom")
        .and_then(wall_clock_minutes)
        .unwrap_or(WorkingHoursRange::default_range().from_minutes);
    let to_minutes = object
        .get("workingHoursTo")
        .and_then(wall_clock_minutes)
        .unwrap_or(WorkingHoursRange::default_range().to_minutes);

    for day in DAY_NAMES {
        let key = format!("workingHours{day}");
        let enabled = object.get(&key).and_then(Value::as_bool).unwrap_or(false);
        object.insert(
            key,
            json!({
                "enabled": enabled,
                "ranges": [{ "fromMinutes": from_minutes, "toMinutes": to_minutes }],
            }),
        );
    }

    object.remove("workingHoursFrom");
    object.remove("workingHoursTo");
    Ok(settings)
}

/// v1 -> v2: duration fields move from date-like values to plain seconds.
fn migrate_durations_to_seconds(mut settings: Value) -> Result<Value, String> {
    const DURATION_FIELDS: [(&str, &str); 4] = [
        ("breakFrequency", "breakFrequencySeconds"),
        ("breakLength", "breakLengthSeconds"),
        ("postponeLength", "postponeLengthSeconds"),
        ("idleResetLength", "idleResetLengthSeconds"),
    ];

    let Some(object) = settings.as_object_mut() else {
        return Ok(settings);
    };

    if !object.contains_key("breakFrequency") || object.contains_key("breakFrequencySeconds") {
        return Ok(settings);
    }

    for (legacy_key, modern_key) in DURATION_FIELDS {
        let Some(value) = object.get(legacy_key).cloned() else {
            continue;
        };
        if let Some(seconds) = wall_clock_seconds(&value) {
            object.insert(modern_key.to_string(), json!(seconds));
        }
        object.remove(legacy_key);
    }

    Ok(settings)
}

/// Reads the wall-clock time encoded in an ISO-8601 string, expressed as
/// minutes since midnight. Uses the offset embedded in the string so the result
/// is deterministic; the legacy implementation used the machine's local zone.
fn wall_clock_minutes(value: &Value) -> Option<u32> {
    let parsed = parse_iso(value)?;
    Some(parsed.hour() * 60 + parsed.minute())
}

fn wall_clock_seconds(value: &Value) -> Option<u32> {
    let parsed = parse_iso(value)?;
    Some(parsed.hour() * 3600 + parsed.minute() * 60 + parsed.second())
}

fn parse_iso(value: &Value) -> Option<DateTime<chrono::FixedOffset>> {
    DateTime::parse_from_rfc3339(value.as_str()?).ok()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn migrates_legacy_working_hours_booleans() {
        let legacy = json!({
            "workingHoursMonday": true,
            "workingHoursSaturday": false,
            "workingHoursFrom": "2020-01-01T09:30:00+00:00",
            "workingHoursTo": "2020-01-01T17:45:00+00:00",
        });

        let outcome = run(legacy, 0);

        assert_eq!(outcome.version, CURRENT_SETTINGS_VERSION);
        assert!(outcome.failure.is_none());
        assert_eq!(outcome.settings["workingHoursMonday"]["enabled"], true);
        assert_eq!(outcome.settings["workingHoursSaturday"]["enabled"], false);
        assert_eq!(
            outcome.settings["workingHoursMonday"]["ranges"][0]["fromMinutes"],
            570
        );
        assert_eq!(
            outcome.settings["workingHoursMonday"]["ranges"][0]["toMinutes"],
            1065
        );
        assert!(outcome.settings.get("workingHoursFrom").is_none());
    }

    #[test]
    fn migrates_durations_to_seconds() {
        let legacy = json!({
            "breakFrequency": "2020-01-01T00:28:00+00:00",
            "breakLength": "2020-01-01T00:02:30+00:00",
        });

        let outcome = run(legacy, 1);

        assert!(outcome.failure.is_none());
        assert_eq!(outcome.settings["breakFrequencySeconds"], 28 * 60);
        assert_eq!(outcome.settings["breakLengthSeconds"], 150);
        assert!(outcome.settings.get("breakFrequency").is_none());
    }

    #[test]
    fn current_settings_are_left_untouched() {
        let settings = json!({ "breakFrequencySeconds": 600 });
        let outcome = run(settings.clone(), CURRENT_SETTINGS_VERSION);

        assert_eq!(outcome.version, CURRENT_SETTINGS_VERSION);
        assert_eq!(outcome.settings, settings);
    }
}
