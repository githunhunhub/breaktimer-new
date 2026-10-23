//! Tauri commands exposed to the renderer (PLAN-0001, SPEC-0010).

use chrono::Utc;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::autostart;
use crate::breaks::BreakStatus;
use crate::error::AppResult;
use crate::flow;
use crate::i18n::I18nState;
use crate::sounds;
use crate::state::{AppState, Settings, SettingsEffects, SoundType};

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
pub fn get_i18n_state(state: State<'_, AppState>) -> I18nState {
    state.i18n_state()
}

#[tauri::command]
pub fn set_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: Settings,
) -> AppResult<()> {
    let previous_i18n = state.i18n_state();
    let effects = SettingsEffects::between(&state.store.settings(), &settings);

    state.store.set_settings(settings.clone())?;

    if let Some(enabled) = effects.auto_launch {
        autostart::set_enabled(&app, enabled)?;
    }

    state.apply_settings_effects(&settings, effects, Utc::now());
    // The tray menu (and any open break window) reads the new settings
    // immediately after a save (SPEC-0006).
    flow::emit_status(&app, state.inner());
    let next_i18n = state.i18n_state();
    if locale_changed(&previous_i18n, &next_i18n)
        && let Err(error) = app.emit(flow::LOCALE_CHANGED_EVENT, next_i18n)
    {
        eprintln!("failed to emit locale change: {error}");
    }
    Ok(())
}

fn locale_changed(previous: &I18nState, next: &I18nState) -> bool {
    previous.effective_locale != next.effective_locale
}

#[tauri::command]
pub fn get_app_info(app: AppHandle, state: State<'_, AppState>) -> AppInfo {
    let name = app
        .config()
        .product_name
        .clone()
        .unwrap_or_else(|| crate::PRODUCT_NAME.to_string());

    AppInfo {
        name,
        version: app.package_info().version.to_string(),
        settings_path: state.store.path().to_string_lossy().into_owned(),
    }
}

/// Current scheduler snapshot, polled once when a break window mounts.
#[tauri::command]
pub fn get_break_status(state: State<'_, AppState>) -> BreakStatus {
    state.break_status(Utc::now())
}

/// Starts the prompted break and returns the updated snapshot (SPEC-0002).
#[tauri::command]
pub fn begin_break(app: AppHandle, state: State<'_, AppState>) -> Result<BreakStatus, String> {
    flow::begin_break(&app, state.inner()).map_err(|error| error.to_string())?;
    Ok(state.break_status(Utc::now()))
}

/// Ends the active break and returns the updated snapshot (SPEC-0003).
#[tauri::command]
pub fn end_break(app: AppHandle, state: State<'_, AppState>) -> BreakStatus {
    flow::end_break(&app, state.inner());
    state.break_status(Utc::now())
}

/// Postpones the active break (SPEC-0003).
#[tauri::command]
pub fn postpone_break(app: AppHandle, state: State<'_, AppState>) -> Result<BreakStatus, String> {
    flow::postpone_break(&app, state.inner()).map_err(|error| error.to_string())?;
    Ok(state.break_status(Utc::now()))
}

/// Skips the active break (SPEC-0003).
#[tauri::command]
pub fn skip_break(app: AppHandle, state: State<'_, AppState>) -> Result<BreakStatus, String> {
    flow::skip_break(&app, state.inner()).map_err(|error| error.to_string())?;
    Ok(state.break_status(Utc::now()))
}

/// Starts a break immediately, bypassing the prompt (SPEC-0003).
#[tauri::command]
pub fn start_break_now(app: AppHandle, state: State<'_, AppState>) -> BreakStatus {
    flow::start_break_now(&app, state.inner());
    state.break_status(Utc::now())
}

/// Plays a sound from the settings window preview button (SPEC-0010).
#[tauri::command]
pub fn play_sound_preview(sound_type: SoundType, volume: f32) {
    sounds::play_preview(sound_type, volume);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_info_serializes_with_frontend_field_names() {
        let value = serde_json::to_value(AppInfo {
            name: "BreakTimer-new".to_string(),
            version: "0.1.0".to_string(),
            settings_path: "settings.json".to_string(),
        })
        .unwrap();

        assert_eq!(value["name"], "BreakTimer-new");
        assert_eq!(value["version"], "0.1.0");
        assert_eq!(value["settingsPath"], "settings.json");
    }

    #[test]
    fn locale_broadcast_is_only_required_when_the_effective_locale_changes() {
        assert!(!locale_changed(
            &I18nState {
                language: None,
                effective_locale: "en-US".to_string(),
            },
            &I18nState {
                language: Some("en-US".to_string()),
                effective_locale: "en-US".to_string(),
            },
        ));
        assert!(locale_changed(
            &I18nState {
                language: None,
                effective_locale: "en-US".to_string(),
            },
            &I18nState {
                language: Some("zh-CN".to_string()),
                effective_locale: "zh-CN".to_string(),
            },
        ));
    }
}
