mod app_paths;
mod autostart;
mod breaks;
mod commands;
mod error;
mod flow;
mod i18n;
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

use app_paths::AppPaths;
use state::{AppState, SettingsEffects, SettingsStore};

pub const PRODUCT_NAME: &str = "BreakTimer-new";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Register first: re-launches are handled before any other plugin setup.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            windows::restore_settings_window(app);
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name(PRODUCT_NAME)
                .build(),
        )
        .on_window_event(|window, event| windows::handle_window_event(window, event))
        .setup(|app| {
            let config_dir = app.path().app_config_dir()?;
            let local_data_dir = app.path().app_local_data_dir()?;
            let executable = std::env::current_exe()?;
            let paths = match app_paths::prepare(&executable, &config_dir, &local_data_dir) {
                Ok(paths) => paths,
                Err(error) => {
                    use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

                    app.dialog()
                        .message(format!(
                            "{PRODUCT_NAME} could not prepare its portable data directory.\n\n{error}"
                        ))
                        .title(PRODUCT_NAME)
                        .kind(MessageDialogKind::Error)
                        .blocking_show();
                    app.handle().exit(1);
                    return Ok(());
                }
            };
            if let Some(settings_dir) = paths.settings_path.parent() {
                fs::create_dir_all(settings_dir)?;
            }

            let store = SettingsStore::load(paths.settings_path.clone())?;
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
            let webview2_dir = paths.webview2_dir.clone();
            app.manage::<AppPaths>(paths);
            tray::init(handle)?;
            windows::init(handle)?;
            windows::create_main_window(handle, &webview2_dir)?;
            sounds::init(handle)?;
            tray::refresh(handle);
            spawn_scheduler_tick(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::get_settings,
            commands::set_settings,
            commands::get_i18n_state,
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
