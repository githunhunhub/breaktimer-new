//! Anonymous installation metrics (SPEC-0018, ADR-0019, ADR-0023).
//!
//! Only installation-level, day-granular data leaves the machine: a random
//! install id, the local day, the first-launch day, the app version, a coarse
//! OS label, the CPU architecture, the effective locale and the install
//! channel. Nothing here can identify a person or a device, and the server
//! never stores IP addresses.
//!
//! Reporting stays disabled unless `BREAKTIMER_METRICS_URL` is set at build
//! time, so forks and local builds never send data to the maintainer endpoint.

use std::time::Duration;

use chrono::Local;
use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::app_paths::AppPaths;
use crate::state::AppState;

/// Set at build time after deploying `server/metrics`:
///
/// ```text
/// BREAKTIMER_METRICS_URL=https://<metrics-domain>/v1/collect
/// ```
const COLLECT_URL: &str = match option_env!("BREAKTIMER_METRICS_URL") {
    Some(url) => url,
    None => "",
};

const SCHEMA_VERSION: u32 = 1;
const STARTUP_DELAY_SECONDS: u64 = 90;
const LOOP_INTERVAL_SECONDS: u64 = 60;
/// While the machine is offline the loop must not hammer the endpoint.
const RETRY_INTERVAL_SECONDS: u64 = 30 * 60;
const REQUEST_TIMEOUT_SECONDS: u64 = 5;
const USER_AGENT: &str = concat!("BreakTimer-new/", env!("CARGO_PKG_VERSION"));

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EventKind {
    Install,
    Heartbeat,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Channel {
    Installer,
    Portable,
}

/// The complete set of fields this app is allowed to upload (SPEC-0018).
/// Adding a field requires a spec change and a privacy review.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Payload {
    pub schema: u32,
    pub event: EventKind,
    pub install_id: String,
    pub day: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_launch_day: Option<String>,
    pub version: String,
    pub os: String,
    pub arch: String,
    pub locale: String,
    pub channel: Channel,
}

/// Local calendar day (`YYYY-MM-DD`); the only time precision we collect.
pub fn current_day() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

pub fn endpoint_is_usable(url: &str) -> bool {
    let url = url.trim();
    !url.is_empty() && url.starts_with("https://")
}

pub fn build_payload(
    event: EventKind,
    install_id: &str,
    day: &str,
    first_launch_day: Option<&str>,
    version: &str,
    locale: &str,
    channel: Channel,
) -> Payload {
    Payload {
        schema: SCHEMA_VERSION,
        event,
        install_id: install_id.to_string(),
        day: day.to_string(),
        first_launch_day: first_launch_day.map(str::to_string),
        version: version.to_string(),
        os: os_label().to_string(),
        arch: arch_label().to_string(),
        locale: locale.to_string(),
        channel,
    }
}

/// Coarse OS family only: no build number, edition or device details.
pub fn os_label() -> &'static str {
    #[cfg(windows)]
    {
        match windows_build_number() {
            Some(build) if build >= 22_000 => "windows-11",
            Some(_) => "windows-10",
            None => "windows",
        }
    }
    #[cfg(not(windows))]
    {
        std::env::consts::OS
    }
}

pub fn arch_label() -> &'static str {
    match std::env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        "x86" => "x86",
        other => other,
    }
}

#[cfg(windows)]
fn windows_build_number() -> Option<u32> {
    use windows_sys::Wdk::System::SystemServices::RtlGetVersion;
    use windows_sys::Win32::System::SystemInformation::OSVERSIONINFOW;

    // SAFETY: `RtlGetVersion` only fills the caller-provided structure.
    let mut info: OSVERSIONINFOW = unsafe { std::mem::zeroed() };
    info.dwOSVersionInfoSize = std::mem::size_of::<OSVERSIONINFOW>() as u32;
    let status = unsafe { RtlGetVersion(&mut info) };
    (status >= 0).then_some(info.dwBuildNumber)
}

/// Starts the background reporter. Development builds and unconfigured builds
/// do nothing at all (SPEC-0018).
pub fn spawn(app: AppHandle) {
    if cfg!(debug_assertions) || !endpoint_is_usable(COLLECT_URL) {
        return;
    }

    std::thread::spawn(move || {
        // Stay out of the way of startup and the update check (30 s, 24 h).
        std::thread::sleep(Duration::from_secs(STARTUP_DELAY_SECONDS));

        let mut last_attempt: Option<std::time::Instant> = None;
        loop {
            let due = last_attempt
                .map(|attempt| attempt.elapsed() >= Duration::from_secs(RETRY_INTERVAL_SECONDS))
                .unwrap_or(true);
            if due {
                run_cycle(&app);
                last_attempt = Some(std::time::Instant::now());
            }
            std::thread::sleep(Duration::from_secs(LOOP_INTERVAL_SECONDS));
        }
    });
}

fn run_cycle(app: &AppHandle) {
    let state = app.state::<AppState>();
    if !state.store.settings().analytics_enabled {
        return;
    }

    let Some(install_id) = state.store.install_id() else {
        return;
    };
    let Some(first_launch_day) = state.store.install_first_launch_day() else {
        return;
    };

    let today = current_day();
    let install_reported = state.store.telemetry_install_reported();
    if install_reported && state.store.telemetry_last_ping_day().as_deref() == Some(today.as_str())
    {
        return;
    }

    let locale = state.effective_locale();
    let version = app.package_info().version.to_string();
    let channel = if app.state::<AppPaths>().portable {
        Channel::Portable
    } else {
        Channel::Installer
    };

    if !install_reported {
        let payload = build_payload(
            EventKind::Install,
            &install_id,
            &today,
            Some(&first_launch_day),
            &version,
            &locale,
            channel,
        );
        if !send(&payload) {
            return;
        }
        if let Err(error) = state.store.set_telemetry_install_reported(true) {
            log::error!("failed to persist the installation metric state: {error}");
        }
    }

    let payload = build_payload(
        EventKind::Heartbeat,
        &install_id,
        &today,
        None,
        &version,
        &locale,
        channel,
    );
    if send(&payload) {
        if let Err(error) = state.store.set_telemetry_last_ping_day(Some(today)) {
            log::error!("failed to persist the installation metric day: {error}");
        }
    }
}

fn send(payload: &Payload) -> bool {
    let client = match reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECONDS))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent(USER_AGENT)
        .build()
    {
        Ok(client) => client,
        Err(_) => return false,
    };

    client
        .post(COLLECT_URL)
        .json(payload)
        .send()
        .map(|response| response.status().is_success())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn keys(payload: &Payload) -> Vec<String> {
        let value = serde_json::to_value(payload).unwrap();
        let mut keys = value
            .as_object()
            .unwrap()
            .keys()
            .cloned()
            .collect::<Vec<_>>();
        keys.sort();
        keys
    }

    #[test]
    fn install_payload_only_carries_allowlisted_fields() {
        let payload = build_payload(
            EventKind::Install,
            "6f1f0d6a-1f5c-4c19-9a4e-0d2b6a4f9c11",
            "2026-11-02",
            Some("2026-10-30"),
            "0.1.1",
            "zh-CN",
            Channel::Portable,
        );

        assert_eq!(
            keys(&payload),
            vec![
                "arch",
                "channel",
                "day",
                "event",
                "firstLaunchDay",
                "installId",
                "locale",
                "os",
                "schema",
                "version",
            ]
        );
        assert_eq!(payload.schema, 1);
        assert_eq!(payload.event, EventKind::Install);
    }

    #[test]
    fn heartbeat_payload_omits_first_launch_day() {
        let payload = build_payload(
            EventKind::Heartbeat,
            "6f1f0d6a-1f5c-4c19-9a4e-0d2b6a4f9c11",
            "2026-11-02",
            None,
            "0.1.1",
            "en-US",
            Channel::Installer,
        );

        let value = serde_json::to_value(&payload).unwrap();
        assert!(value.get("firstLaunchDay").is_none());
        assert_eq!(value["event"], Value::String("heartbeat".to_string()));
        assert_eq!(value["channel"], Value::String("installer".to_string()));
        assert_eq!(value["os"], Value::String(os_label().to_string()));
        assert_eq!(value["arch"], Value::String(arch_label().to_string()));
    }

    #[test]
    fn endpoint_requires_https_and_a_value() {
        assert!(!endpoint_is_usable(""));
        assert!(!endpoint_is_usable("   "));
        assert!(!endpoint_is_usable("http://example.com/v1/collect"));
        assert!(endpoint_is_usable("https://metrics.example.com/v1/collect"));
    }

    #[test]
    fn payload_never_contains_banned_keys() {
        let payload = build_payload(
            EventKind::Install,
            "6f1f0d6a-1f5c-4c19-9a4e-0d2b6a4f9c11",
            "2026-11-02",
            Some("2026-10-30"),
            "0.1.1",
            "zh-CN",
            Channel::Installer,
        );
        let text = serde_json::to_string(&payload).unwrap().to_lowercase();

        for banned in [
            "username",
            "hostname",
            "ipaddress",
            "sid",
            "mac",
            "serial",
            "path",
            "title",
            "message",
            "timezone",
            "timestamp",
        ] {
            assert!(!text.contains(banned), "payload leaked {banned}");
        }
    }

    #[test]
    fn day_is_formatted_without_time_of_day() {
        let day = current_day();
        assert_eq!(day.len(), 10);
        assert_eq!(&day[4..5], "-");
        assert_eq!(&day[7..8], "-");
        assert!(!day.contains(':'));
    }
}
