//! Settings and app-state persistence (SPEC-0010).
//!
//! On disk the store is a single JSON object:
//!
//! ```json
//! {
//!   "settings": { ... },
//!   "appInitialized": false,
//!   "settingsVersion": 2,
//!   "disableEndTime": null
//! }
//! ```
//!
//! Migrations run against the raw `settings` JSON before it is parsed into
//! [`Settings`], so legacy-only fields are still visible to the migration chain.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::AppResult;
use crate::state::migrations::{self, CURRENT_SETTINGS_VERSION};
use crate::state::settings::Settings;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreData {
    #[serde(default)]
    pub settings: Settings,
    #[serde(default)]
    pub app_initialized: bool,
    #[serde(default)]
    pub settings_version: u32,
    #[serde(default)]
    pub disable_end_time: Option<i64>,
}

impl Default for StoreData {
    fn default() -> Self {
        Self {
            settings: Settings::default(),
            app_initialized: false,
            settings_version: CURRENT_SETTINGS_VERSION,
            disable_end_time: None,
        }
    }
}

pub struct SettingsStore {
    path: PathBuf,
    data: Mutex<StoreData>,
}

impl SettingsStore {
    /// Loads the store from `path`, running migrations when needed. Missing
    /// files start from defaults.
    pub fn load(path: PathBuf) -> AppResult<Self> {
        if !path.exists() {
            return Ok(Self::new(path, StoreData::default()));
        }

        let raw = fs::read_to_string(&path)?;
        let root: Value = serde_json::from_str(&raw)?;

        let stored_version = root
            .get("settingsVersion")
            .and_then(Value::as_u64)
            .unwrap_or(0) as u32;
        let stored_settings = root.get("settings").cloned().unwrap_or(Value::Null);

        let outcome = migrations::run(stored_settings, stored_version);
        if let Some((version, message)) = &outcome.failure {
            // Leave the file as-is; a failed migration must never corrupt data.
            eprintln!("settings migration {version} failed, keeping stored data: {message}");
        }

        let settings = if outcome.settings.is_null() {
            Settings::default()
        } else {
            serde_json::from_value(outcome.settings)?
        };

        let data = StoreData {
            settings,
            app_initialized: root
                .get("appInitialized")
                .and_then(Value::as_bool)
                .unwrap_or(false),
            settings_version: outcome.version,
            disable_end_time: root.get("disableEndTime").and_then(Value::as_i64),
        };

        let store = Self::new(path, data);
        if outcome.failure.is_none() {
            store.persist()?;
        }
        Ok(store)
    }

    fn new(path: PathBuf, data: StoreData) -> Self {
        Self {
            path,
            data: Mutex::new(data),
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn settings(&self) -> Settings {
        self.with_data(|data| data.settings.clone())
    }

    pub fn set_settings(&self, settings: Settings) -> AppResult<()> {
        self.with_data(|data| data.settings = settings);
        self.persist()
    }

    #[allow(dead_code)]
    pub fn app_initialized(&self) -> bool {
        self.with_data(|data| data.app_initialized)
    }

    #[allow(dead_code)]
    pub fn set_app_initialized(&self, initialized: bool) -> AppResult<()> {
        self.with_data(|data| data.app_initialized = initialized);
        self.persist()
    }

    #[allow(dead_code)]
    pub fn disable_end_time(&self) -> Option<i64> {
        self.with_data(|data| data.disable_end_time)
    }

    #[allow(dead_code)]
    pub fn set_disable_end_time(&self, end_time: Option<i64>) -> AppResult<()> {
        self.with_data(|data| data.disable_end_time = end_time);
        self.persist()
    }

    fn with_data<T>(&self, f: impl FnOnce(&mut StoreData) -> T) -> T {
        let mut guard = self
            .data
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        f(&mut guard)
    }

    fn persist(&self) -> AppResult<()> {
        let snapshot = self.with_data(|data| data.clone());
        let json = serde_json::to_string_pretty(&snapshot)?;
        fs::write(&self.path, json)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join("breaktimer-tests");
        fs::create_dir_all(&dir).unwrap();
        dir.join(name)
    }

    #[test]
    fn round_trips_settings() {
        let path = temp_path("round-trip.json");
        let _ = fs::remove_file(&path);

        let store = SettingsStore::load(path.clone()).unwrap();
        assert_eq!(store.settings().break_frequency_seconds, 28 * 60);

        let mut settings = store.settings();
        settings.break_frequency_seconds = 900;
        store.set_settings(settings).unwrap();

        let reloaded = SettingsStore::load(path.clone()).unwrap();
        assert_eq!(reloaded.settings().break_frequency_seconds, 900);

        fs::remove_file(path).unwrap();
    }

    #[test]
    fn merges_defaults_for_partial_files() {
        let path = temp_path("partial.json");
        fs::write(&path, r#"{"settings": {"breakLengthSeconds": 45}}"#).unwrap();

        let store = SettingsStore::load(path.clone()).unwrap();
        let settings = store.settings();

        assert_eq!(settings.break_length_seconds, 45);
        assert_eq!(settings.sound_type, crate::state::settings::SoundType::Gong);
        assert_eq!(store.path(), path.as_path());

        fs::remove_file(path).unwrap();
    }
}
