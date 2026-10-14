//! Tauri commands exposed to the renderer (PLAN-0001, SPEC-0010).

use chrono::Utc;
use serde::Serialize;
use tauri::{AppHandle, State};

use crate::autostart;
use crate::error::AppResult;
use crate::state::{AppState, Settings, SettingsEffects};

/// Basic application metadata used by the M3 scaffold screen.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub settings_path: String,
}

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {name}! You've been greeted from Rust!")
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Settings {
    state.store.settings()
}

#[tauri::command]
pub fn set_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: Settings,
) -> AppResult<()> {
    let effects = SettingsEffects::between(&state.store.settings(), &settings);

    state.store.set_settings(settings.clone())?;

    if let Some(enabled) = effects.auto_launch {
        autostart::set_enabled(&app, enabled)?;
    }

    state.apply_settings_effects(&settings, effects, Utc::now());
    Ok(())
}

#[tauri::command]
pub fn get_app_info(app: AppHandle, state: State<'_, AppState>) -> AppInfo {
    let name = app
        .config()
        .product_name
        .clone()
        .unwrap_or_else(|| app.package_info().name.clone());

    AppInfo {
        name,
        version: app.package_info().version.to_string(),
        settings_path: state.store.path().to_string_lossy().into_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_info_serializes_with_frontend_field_names() {
        let value = serde_json::to_value(AppInfo {
            name: "BreakTimer".to_string(),
            version: "0.1.0".to_string(),
            settings_path: "settings.json".to_string(),
        })
        .unwrap();

        assert_eq!(value["name"], "BreakTimer");
        assert_eq!(value["version"], "0.1.0");
        assert_eq!(value["settingsPath"], "settings.json");
    }
}
