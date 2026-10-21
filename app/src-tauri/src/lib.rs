mod autostart;
mod breaks;
mod commands;
mod error;
mod flow;
mod notifications;
mod sounds;
mod state;
mod system_state;
mod tray;
mod windows;

use std::fs;
use std::time::Duration;

use chrono::Utc;
use tauri::Manager;

use state::{AppState, SettingsEffects, SettingsStore};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Register first: re-launches are handled before any other plugin setup.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name("BreakTimer")
                .build(),
        )
        .setup(|app| {
            let config_dir = app.path().app_config_dir()?;
            fs::create_dir_all(&config_dir)?;

            let store = SettingsStore::load(config_dir.join("settings.json"))?;
            let state = AppState::new(store);
            let settings = state.store.settings();

            // Start the countdown before the first tick so the tray and the
            // renderer show a running schedule right away (SPEC-0003, SPEC-0006).
            state.apply_settings_effects(
                &settings,
                SettingsEffects {
                    auto_launch: None,
                    reset_time_since_last_break: false,
                    restart_scheduler: true,
                },
                Utc::now(),
            );

            // Keep the OS registration in sync with the stored preference;
            // development builds skip the real registration (SPEC-0007).
            if let Err(error) = autostart::set_enabled(app.handle(), settings.auto_launch) {
                eprintln!("failed to apply the launch-at-login setting: {error}");
            }

            app.manage(state);

            let handle = app.handle();
            tray::init(handle)?;
            windows::init(handle)?;
            sounds::init(handle)?;
            tray::refresh(handle);
            spawn_scheduler_tick(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::get_settings,
            commands::set_settings,
            commands::get_app_info,
            commands::get_break_status,
            commands::begin_break,
            commands::end_break,
            commands::postpone_break,
            commands::skip_break,
            commands::start_break_now,
            commands::play_sound_preview,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Drives the scheduler once per second on the main thread.
///
/// Window creation and resizing must run on the main thread, so each tick is
/// dispatched there; the sleeping thread only paces the loop.
fn spawn_scheduler_tick(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_secs(1));

            let dispatch = app.clone();
            let result = app.run_on_main_thread(move || {
                let state = dispatch.state::<AppState>();
                flow::tick(&dispatch, &state);
            });

            if result.is_err() {
                break;
            }
        }
    });
}
