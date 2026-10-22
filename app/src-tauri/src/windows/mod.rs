//! Break window management (SPEC-0002).
//!
//! Break windows are per-display overlays created when a break is prompted.
//! They are labelled with [`BREAK_WINDOW_PREFIX`] so the rest of the backend can
//! find and close them without tracking a list.
//!
//! Presentation changes by break phase: the pre-break prompt is not focusable,
//! while an active Popup break is focusable and covers every monitor so input
//! cannot fall through to the desktop, taskbar, or tray. Geometry still uses
//! monitor bounds rather than native fullscreen (ADR-0004, ADR-0007).

use std::{
    path::Path,
    sync::{
        Mutex, OnceLock,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, Window, WindowEvent,
};

use crate::app_paths::AppPaths;
use crate::error::AppResult;
use crate::state::Settings;

/// Label prefix for every break overlay window.
pub const BREAK_WINDOW_PREFIX: &str = "break-";
pub const SETTINGS_WINDOW_LABEL: &str = "main";

const SETTINGS_REFOCUS_DELAY: Duration = Duration::from_millis(100);

#[derive(Debug, Default)]
pub struct LifecycleState {
    quitting: AtomicBool,
}

impl LifecycleState {
    fn is_quitting(&self) -> bool {
        self.quitting.load(Ordering::SeqCst)
    }

    fn begin_quit(&self) {
        self.quitting.store(true, Ordering::SeqCst);
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SettingsCloseBehavior {
    Allow,
    Hide,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SettingsRestoreStep {
    Unminimize,
    Show,
    Focus,
}

pub const SETTINGS_RESTORE_STEPS: [SettingsRestoreStep; 3] = [
    SettingsRestoreStep::Unminimize,
    SettingsRestoreStep::Show,
    SettingsRestoreStep::Focus,
];

/// Prompt bar base size, in logical pixels. The width grows when the optional
/// postpone/skip buttons are enabled, matching the legacy window layout.
const PROMPT_BASE_WIDTH: f64 = 450.0;
const PROMPT_BUTTON_WIDTH: f64 = 50.0;
const PROMPT_THREE_BUTTON_EXTRA: f64 = 20.0;
const PROMPT_HEIGHT: f64 = 88.0;
/// Distance from the top of the monitor to the prompt bar, in logical pixels.
const PROMPT_TOP_OFFSET: f64 = 48.0;

/// Window creation must not overlap: `WebviewWindowBuilder::build` marshals
/// work to the event loop, and two concurrent calls could race the same label.
static WINDOW_OPERATION_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

/// Physical bounds of one monitor, detached from the Tauri handle so geometry
/// can be unit-tested without a running application.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct MonitorBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

impl MonitorBounds {
    fn from_monitor(monitor: &tauri::Monitor) -> Self {
        Self {
            x: monitor.position().x,
            y: monitor.position().y,
            width: monitor.size().width,
            height: monitor.size().height,
            scale_factor: monitor.scale_factor(),
        }
    }
}

/// A resolved window layout, in physical pixels.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WindowGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Geometry and focus behavior for one break-window presentation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WindowPresentation {
    pub geometry: WindowGeometry,
    pub focusable: bool,
    pub focus_on_show: bool,
}

fn scale(value: f64, scale_factor: f64) -> u32 {
    (value * scale_factor.max(1.0)).round() as u32
}

/// Geometry for the pre-break prompt: a slim bar centred horizontally near the
/// top of the monitor.
pub fn prompt_geometry(monitor: MonitorBounds, width: f64) -> WindowGeometry {
    let width = scale(width, monitor.scale_factor);
    let height = scale(PROMPT_HEIGHT, monitor.scale_factor);
    let x = monitor.x + (monitor.width as i32 - width as i32) / 2;
    let y = monitor.y + scale(PROMPT_TOP_OFFSET, monitor.scale_factor) as i32;
    WindowGeometry {
        x,
        y,
        width,
        height,
    }
}

/// Geometry that covers the whole monitor.
pub fn backdrop_geometry(monitor: MonitorBounds) -> WindowGeometry {
    WindowGeometry {
        x: monitor.x,
        y: monitor.y,
        width: monitor.width,
        height: monitor.height,
    }
}

/// The pre-break prompt stays clickable without interrupting the current app.
fn prompt_presentation(monitor: MonitorBounds, width: f64) -> WindowPresentation {
    WindowPresentation {
        geometry: prompt_geometry(monitor, width),
        focusable: false,
        focus_on_show: false,
    }
}

/// An active break always blocks the full monitor and takes focus.
///
/// `showBackdrop` intentionally does not participate: it only changes the
/// renderer's visual treatment, never the input-blocking geometry.
fn break_presentation(monitor: MonitorBounds) -> WindowPresentation {
    WindowPresentation {
        geometry: backdrop_geometry(monitor),
        focusable: true,
        focus_on_show: true,
    }
}

/// Closes every open break window.
///
/// Both the natural end of a break and a manual "end break" go through this so
/// no overlay is ever left behind.
pub fn close_all<R: Runtime>(app: &AppHandle<R>) {
    for (label, window) in app.webview_windows() {
        if label.starts_with(BREAK_WINDOW_PREFIX) {
            if let Err(error) = window.close() {
                eprintln!("failed to close break window {label}: {error}");
            }
        }
    }
}

/// Shows the pre-break prompt on every monitor.
pub fn show_prompt<R: Runtime>(app: &AppHandle<R>, settings: &Settings) -> AppResult<()> {
    let app = app.clone();
    let width = prompt_width(settings);

    spawn_window_task("break-prompt-show", app, "show break prompt", move |app| {
        close_all(app);
        show_prompt_inner(app, width)
    })?;

    Ok(())
}

fn show_prompt_inner<R: Runtime>(app: &AppHandle<R>, width: f64) -> AppResult<()> {
    ensure_windows(app)?;

    for (index, monitor) in monitors(app)?.iter().enumerate() {
        let Some(window) = app.get_webview_window(&label_for(index)) else {
            continue;
        };
        apply_presentation(
            &window,
            prompt_presentation(MonitorBounds::from_monitor(monitor), width),
        );
    }

    Ok(())
}

fn prompt_width(settings: &Settings) -> f64 {
    let mut button_count = 1;
    if settings.postpone_break_enabled {
        button_count += 1;
    }
    if settings.skip_break_enabled {
        button_count += 1;
    }

    PROMPT_BASE_WIDTH
        + (button_count - 1) as f64 * PROMPT_BUTTON_WIDTH
        + if button_count == 3 {
            PROMPT_THREE_BUTTON_EXTRA
        } else {
            0.0
        }
}

/// Shows the active break on every monitor with full input-blocking geometry.
pub fn show_break<R: Runtime>(app: &AppHandle<R>) -> AppResult<()> {
    spawn_window_task(
        "break-window-show",
        app.clone(),
        "show break window",
        show_break_inner,
    )?;

    Ok(())
}

fn show_break_inner<R: Runtime>(app: &AppHandle<R>) -> AppResult<()> {
    ensure_windows(app)?;

    for (index, monitor) in monitors(app)?.iter().enumerate() {
        let Some(window) = app.get_webview_window(&label_for(index)) else {
            continue;
        };
        apply_presentation(
            &window,
            break_presentation(MonitorBounds::from_monitor(monitor)),
        );
    }

    Ok(())
}

/// Runs window API work on a worker thread because building a webview from the
/// event-loop thread sends it a message and then waits for that same thread.
fn spawn_window_task<R, F>(
    thread_name: &str,
    app: AppHandle<R>,
    error_context: &'static str,
    task: F,
) -> AppResult<()>
where
    R: Runtime,
    F: FnOnce(&AppHandle<R>) -> AppResult<()> + Send + 'static,
{
    std::thread::Builder::new()
        .name(thread_name.into())
        .spawn(move || {
            let _guard = WINDOW_OPERATION_LOCK
                .get_or_init(|| Mutex::new(()))
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            if let Err(error) = task(&app) {
                eprintln!("failed to {error_context}: {error}");
            }
        })?;

    Ok(())
}

/// Wires the window subsystem. The main window is created explicitly so it can
/// share the configured WebView2 data directory with every break window.
pub fn init<R: Runtime>(app: &AppHandle<R>) -> AppResult<()> {
    app.manage(LifecycleState::default());
    Ok(())
}

pub fn create_main_window<R: Runtime>(
    app: &AppHandle<R>,
    data_directory: &Path,
) -> AppResult<WebviewWindow<R>> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == SETTINGS_WINDOW_LABEL)
        .cloned()
        .ok_or_else(|| crate::error::AppError::message("main window configuration is missing"))?;

    let window = WebviewWindowBuilder::from_config(app, &config)?
        .data_directory(data_directory.to_path_buf())
        .build()?;
    Ok(window)
}

pub fn settings_close_behavior(label: &str, quitting: bool) -> SettingsCloseBehavior {
    if label == SETTINGS_WINDOW_LABEL && !quitting {
        SettingsCloseBehavior::Hide
    } else {
        SettingsCloseBehavior::Allow
    }
}

pub fn handle_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    let WindowEvent::CloseRequested { api, .. } = event else {
        return;
    };

    let quitting = window.app_handle().state::<LifecycleState>().is_quitting();
    if settings_close_behavior(window.label(), quitting) == SettingsCloseBehavior::Hide {
        api.prevent_close();
        if let Err(error) = window.hide() {
            eprintln!("failed to hide the settings window: {error}");
        }
    }
}

/// Restores the one settings window from any hidden, minimized or unfocused
/// state. The delayed second focus handles the tray menu closing after the
/// event and taking activation back on Windows.
pub fn restore_settings_window<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(SETTINGS_WINDOW_LABEL) else {
        return;
    };
    apply_settings_restore(&window);

    let delayed_app = app.clone();
    let spawn_result = std::thread::Builder::new()
        .name("settings-refocus".into())
        .spawn(move || {
            std::thread::sleep(SETTINGS_REFOCUS_DELAY);
            let dispatch = delayed_app.clone();
            let _ = delayed_app.run_on_main_thread(move || {
                if let Some(window) = dispatch.get_webview_window(SETTINGS_WINDOW_LABEL) {
                    if let Err(error) = window.set_focus() {
                        eprintln!("failed to refocus the settings window: {error}");
                    }
                }
            });
        });
    if let Err(error) = spawn_result {
        eprintln!("failed to schedule the settings window refocus: {error}");
    }
}

fn apply_settings_restore<R: Runtime>(window: &WebviewWindow<R>) {
    for step in SETTINGS_RESTORE_STEPS {
        let result = match step {
            SettingsRestoreStep::Unminimize => window.unminimize(),
            SettingsRestoreStep::Show => window.show(),
            SettingsRestoreStep::Focus => window.set_focus(),
        };
        if let Err(error) = result {
            eprintln!("failed to {step:?} the settings window: {error}");
        }
    }
}

pub fn request_quit<R: Runtime>(app: &AppHandle<R>) {
    app.state::<LifecycleState>().begin_quit();
    app.exit(0);
}

fn label_for(index: usize) -> String {
    format!("{BREAK_WINDOW_PREFIX}{index}")
}

/// Enumerates the connected monitors through an existing window.
///
/// `available_monitors` lives on windows, not on `AppHandle`; the settings
/// window is always present and serves as the enumeration anchor.
fn monitors<R: Runtime>(app: &AppHandle<R>) -> AppResult<Vec<tauri::Monitor>> {
    if let Some(window) = app.get_webview_window("main") {
        return Ok(window.available_monitors()?);
    }
    if let Some((_, window)) = app.webview_windows().into_iter().next() {
        return Ok(window.available_monitors()?);
    }
    Ok(Vec::new())
}

/// Creates one overlay window per monitor that does not have one yet.
fn ensure_windows<R: Runtime>(app: &AppHandle<R>) -> AppResult<()> {
    for (index, _monitor) in monitors(app)?.iter().enumerate() {
        let label = label_for(index);
        if app.get_webview_window(&label).is_some() {
            continue;
        }
        build_window(app, &label)?;
    }
    Ok(())
}

fn build_window<R: Runtime>(app: &AppHandle<R>, label: &str) -> AppResult<WebviewWindow<R>> {
    let data_directory = app.state::<AppPaths>().webview2_dir.clone();
    let window = WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title("BreakTimer")
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .resizable(false)
        .shadow(false)
        .focusable(false)
        .visible(false)
        .data_directory(data_directory)
        .build()?;

    Ok(window)
}

fn apply_geometry<R: Runtime>(window: &WebviewWindow<R>, geometry: WindowGeometry) {
    // Move across displays before resizing so Windows applies the target
    // monitor's DPI scale first; resizing before the move makes the OS rescale
    // the physical bounds and can leave part of a mixed-DPI display uncovered.
    let _ = window.set_position(PhysicalPosition::new(geometry.x, geometry.y));
    let _ = window.set_size(PhysicalSize::new(geometry.width, geometry.height));
}

fn apply_presentation<R: Runtime>(window: &WebviewWindow<R>, presentation: WindowPresentation) {
    if let Err(error) = window.set_focusable(presentation.focusable) {
        eprintln!("failed to set break window focusable state: {error}");
    }
    apply_geometry(window, presentation.geometry);
    if let Err(error) = window.show() {
        eprintln!("failed to show break window: {error}");
    }
    if presentation.focus_on_show {
        if let Err(error) = window.set_focus() {
            eprintln!("failed to focus break window: {error}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn closing_the_settings_window_hides_it_to_the_tray() {
        assert_eq!(
            settings_close_behavior("main", false),
            SettingsCloseBehavior::Hide
        );
    }

    #[test]
    fn closing_the_settings_window_during_quit_is_allowed() {
        assert_eq!(
            settings_close_behavior("main", true),
            SettingsCloseBehavior::Allow
        );
    }

    #[test]
    fn closing_break_windows_is_always_allowed() {
        assert_eq!(
            settings_close_behavior("break-0", false),
            SettingsCloseBehavior::Allow
        );
    }

    #[test]
    fn restoring_the_settings_window_unminimizes_then_shows_then_focuses() {
        assert_eq!(
            SETTINGS_RESTORE_STEPS,
            [
                SettingsRestoreStep::Unminimize,
                SettingsRestoreStep::Show,
                SettingsRestoreStep::Focus,
            ]
        );
    }

    fn monitor() -> MonitorBounds {
        MonitorBounds {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            scale_factor: 1.0,
        }
    }

    #[test]
    fn prompt_bar_is_centred_near_the_top() {
        let geometry = prompt_geometry(monitor(), PROMPT_BASE_WIDTH);

        assert_eq!(geometry.width, 450);
        assert_eq!(geometry.height, 88);
        assert_eq!(geometry.x, (1920 - 450) / 2);
        assert_eq!(geometry.y, 48);
    }

    #[test]
    fn prompt_width_grows_with_enabled_actions() {
        let settings = Settings::default();
        assert_eq!(prompt_width(&settings), 500.0);

        let settings = Settings {
            skip_break_enabled: true,
            ..settings
        };
        assert_eq!(prompt_width(&settings), 570.0);
    }

    #[test]
    fn prompt_presentation_does_not_take_focus() {
        let presentation = prompt_presentation(monitor(), PROMPT_BASE_WIDTH);

        assert_eq!(
            presentation.geometry,
            prompt_geometry(monitor(), PROMPT_BASE_WIDTH)
        );
        assert!(!presentation.focusable);
        assert!(!presentation.focus_on_show);
    }

    #[test]
    fn active_break_presentation_covers_all_displays_and_takes_focus() {
        let bounds = MonitorBounds {
            x: -1600,
            y: -200,
            width: 1280,
            height: 720,
            scale_factor: 1.0,
        };

        let presentation = break_presentation(bounds);

        assert_eq!(
            presentation.geometry,
            WindowGeometry {
                x: -1600,
                y: -200,
                width: 1280,
                height: 720,
            }
        );
        assert!(presentation.focusable);
        assert!(presentation.focus_on_show);
    }

    #[test]
    fn backdrop_covers_the_whole_monitor() {
        let geometry = backdrop_geometry(MonitorBounds {
            x: -1280,
            y: 0,
            width: 1280,
            height: 1024,
            scale_factor: 1.0,
        });

        assert_eq!(
            geometry,
            WindowGeometry {
                x: -1280,
                y: 0,
                width: 1280,
                height: 1024,
            }
        );
    }

    #[test]
    fn geometry_scales_with_the_monitor() {
        let geometry = prompt_geometry(
            MonitorBounds {
                scale_factor: 2.0,
                ..monitor()
            },
            500.0,
        );

        assert_eq!(geometry.width, 1000);
        assert_eq!(geometry.height, 176);
        assert_eq!(geometry.y, 96);
    }
}
