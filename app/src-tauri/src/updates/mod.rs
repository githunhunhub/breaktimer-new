//! Update checking against GitHub Releases (SPEC-0017).
//!
//! This module deliberately stops at "is there a newer stable version?" and
//! returns browser links. It never downloads or executes a release asset.

use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::breaks::BreakPhase;
use crate::i18n;
use crate::notifications;
use crate::state::AppState;

pub const UPDATE_STATUS_EVENT: &str = "update-status";

const LATEST_RELEASE_URL: &str =
    "https://api.github.com/repos/githunhunhub/breaktimer-new/releases/latest";
const RELEASE_PAGE_URL: &str = "https://github.com/githunhunhub/breaktimer-new/releases";
const USER_AGENT: &str = concat!("BreakTimer-new/", env!("CARGO_PKG_VERSION"));
const CHECK_INTERVAL_SECONDS: i64 = 24 * 60 * 60;
const STARTUP_DELAY_SECONDS: u64 = 30;
const LOOP_INTERVAL_SECONDS: u64 = 60;
const DOWNLOAD_MARKER_START: &str = "<!-- breaktimer-downloads";
const DOWNLOAD_MARKER_END: &str = "-->";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UpdateStatus {
    UpToDate,
    Available,
    Unavailable,
    NoRelease,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UpdateErrorCode {
    Network,
    Timeout,
    RateLimited,
    InvalidResponse,
    Http,
    Busy,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadLinks {
    pub quark: Option<String>,
    pub baidu: Option<String>,
    pub baidu_code: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub status: UpdateStatus,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub release_url: Option<String>,
    pub published_at: Option<String>,
    pub checked_at: i64,
    pub error: Option<UpdateErrorCode>,
    pub downloads: DownloadLinks,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UpdateLinkKind {
    Quark,
    Baidu,
}

/// In-memory result cache so the settings window can render immediately after
/// reopening, and so concurrent auto/manual checks do not overlap.
#[derive(Default)]
pub struct UpdateState {
    result: Mutex<Option<UpdateCheckResult>>,
    in_flight: AtomicBool,
}

impl UpdateState {
    pub fn result(&self) -> Option<UpdateCheckResult> {
        self.result
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }

    fn set_result(&self, result: UpdateCheckResult) {
        *self
            .result
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(result);
    }

    fn begin_check(&self) -> bool {
        self.in_flight
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
    }

    fn end_check(&self) {
        self.in_flight.store(false, Ordering::SeqCst);
    }
}

/// Runs one update check and records the result for the frontend.
///
/// The caller decides whether to show a notification (automatic checks) or
/// just return the result (manual checks).
pub fn check_now(app: &AppHandle, state: &AppState) -> UpdateCheckResult {
    let now = Utc::now();
    let current_version = app.package_info().version.to_string();

    if !state.updates.begin_check() {
        return unavailable(&current_version, now, UpdateErrorCode::Busy);
    }

    let result = check_current_version(&current_version, now);
    state.updates.end_check();
    state.updates.set_result(result.clone());

    if let Err(error) = state
        .store
        .set_update_last_checked_at(Some(now.timestamp()))
    {
        eprintln!("failed to persist update check time: {error}");
    }
    if let Err(error) = app.emit(UPDATE_STATUS_EVENT, &result) {
        eprintln!("failed to emit update status: {error}");
    }

    result
}

/// Starts the background automatic checker.
///
/// Development builds skip this entirely so `tauri dev` does not generate
/// GitHub traffic; the manual button remains available.
pub fn spawn_auto_checker(app: AppHandle) {
    if cfg!(debug_assertions) {
        return;
    }

    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(STARTUP_DELAY_SECONDS));

        loop {
            {
                let state = app.state::<AppState>();
                let settings = state.store.settings();
                if settings.check_for_updates {
                    let now = Utc::now();
                    if auto_check_due(&state, now) {
                        check_now(&app, &state);
                        dispatch_notify(&app);
                    } else {
                        dispatch_notify(&app);
                    }
                }
            }

            std::thread::sleep(Duration::from_secs(LOOP_INTERVAL_SECONDS));
        }
    });
}

pub fn open_update_link(state: &AppState, kind: UpdateLinkKind) -> Result<(), String> {
    let result = state
        .updates
        .result()
        .ok_or_else(|| "no update information is available".to_string())?;
    let url = match kind {
        UpdateLinkKind::Quark => result
            .downloads
            .quark
            .as_deref()
            .and_then(|url| validate_url(url, "pan.quark.cn")),
        UpdateLinkKind::Baidu => result
            .downloads
            .baidu
            .as_deref()
            .and_then(|url| validate_url(url, "pan.baidu.com")),
    }
    .ok_or_else(|| "the requested update link is not available".to_string())?;

    open::that(url).map_err(|error| error.to_string())
}

fn check_current_version(current_version: &str, now: DateTime<Utc>) -> UpdateCheckResult {
    match fetch_latest_release() {
        Ok(None) => no_release(current_version, now),
        Ok(Some(release)) => result_from_release(current_version, now, release),
        Err(error) => unavailable(current_version, now, error.code()),
    }
}

fn result_from_release(
    current_version: &str,
    now: DateTime<Utc>,
    release: Release,
) -> UpdateCheckResult {
    let Some(newer) = is_newer(&release.tag_name, current_version) else {
        return unavailable(current_version, now, UpdateErrorCode::InvalidResponse);
    };

    let latest_version = release.tag_name.trim().trim_start_matches('v').to_string();
    let release_url = Some(
        validate_github_url(&release.html_url).unwrap_or_else(|| RELEASE_PAGE_URL.to_string()),
    );

    if newer {
        UpdateCheckResult {
            status: UpdateStatus::Available,
            current_version: current_version.to_string(),
            latest_version: Some(latest_version),
            release_url: release_url.clone(),
            published_at: release.published_at,
            checked_at: now.timestamp(),
            error: None,
            downloads: download_links(release.body.as_deref().unwrap_or_default()),
        }
    } else {
        UpdateCheckResult {
            status: UpdateStatus::UpToDate,
            current_version: current_version.to_string(),
            latest_version: Some(latest_version),
            release_url,
            published_at: release.published_at,
            checked_at: now.timestamp(),
            error: None,
            downloads: DownloadLinks::default(),
        }
    }
}

fn no_release(current_version: &str, now: DateTime<Utc>) -> UpdateCheckResult {
    UpdateCheckResult {
        status: UpdateStatus::NoRelease,
        current_version: current_version.to_string(),
        latest_version: None,
        release_url: None,
        published_at: None,
        checked_at: now.timestamp(),
        error: None,
        downloads: DownloadLinks::default(),
    }
}

fn unavailable(
    current_version: &str,
    now: DateTime<Utc>,
    error: UpdateErrorCode,
) -> UpdateCheckResult {
    UpdateCheckResult {
        status: UpdateStatus::Unavailable,
        current_version: current_version.to_string(),
        latest_version: None,
        release_url: None,
        published_at: None,
        checked_at: now.timestamp(),
        error: Some(error),
        downloads: DownloadLinks::default(),
    }
}

fn download_links(body: &str) -> DownloadLinks {
    let metadata = download_metadata_from_body(body);
    let baidu = metadata
        .as_ref()
        .and_then(|metadata| metadata.baidu.as_deref())
        .and_then(|url| validate_url(url, "pan.baidu.com"));
    let baidu_code = if baidu.is_some() {
        metadata
            .as_ref()
            .and_then(|metadata| metadata.baidu_code.as_deref())
            .map(str::trim)
            .filter(|code| !code.is_empty())
            .map(str::to_string)
    } else {
        None
    };

    DownloadLinks {
        quark: metadata
            .as_ref()
            .and_then(|metadata| metadata.quark.as_deref())
            .and_then(|url| validate_url(url, "pan.quark.cn")),
        baidu,
        baidu_code,
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DownloadMetadata {
    quark: Option<String>,
    baidu: Option<String>,
    baidu_code: Option<String>,
}

fn download_metadata_from_body(body: &str) -> Option<DownloadMetadata> {
    let start = body.find(DOWNLOAD_MARKER_START)?;
    let rest = &body[start + DOWNLOAD_MARKER_START.len()..];
    let end = rest.find(DOWNLOAD_MARKER_END)?;
    serde_json::from_str(rest[..end].trim()).ok()
}

fn validate_url(value: &str, host: &str) -> Option<String> {
    let url = reqwest::Url::parse(value).ok()?;
    if url.scheme() != "https" || url.host_str() != Some(host) {
        return None;
    }
    Some(value.to_string())
}

fn validate_github_url(value: &str) -> Option<String> {
    is_allowed_github_url(value).then(|| value.to_string())
}

fn is_allowed_github_url(value: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(value) else {
        return false;
    };
    let path = url.path();
    url.scheme() == "https"
        && url.host_str() == Some("github.com")
        && (path == "/githunhunhub/breaktimer-new/releases"
            || path.starts_with("/githunhunhub/breaktimer-new/releases/"))
}

fn parse_version(value: &str) -> Option<(u64, u64, u64)> {
    let raw = value.trim();
    let raw = raw.strip_prefix('v').unwrap_or(raw);
    let mut parts = raw.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next()?.parse().ok()?;
    if parts.next().is_some() {
        return None;
    }
    Some((major, minor, patch))
}

fn is_newer(latest: &str, current: &str) -> Option<bool> {
    Some(parse_version(latest)? > parse_version(current)?)
}

fn auto_check_due(state: &AppState, now: DateTime<Utc>) -> bool {
    check_due(state.store.update_last_checked_at(), now)
}

fn check_due(last_checked_at: Option<i64>, now: DateTime<Utc>) -> bool {
    last_checked_at
        .is_none_or(|last| now.timestamp().saturating_sub(last) >= CHECK_INTERVAL_SECONDS)
}

fn maybe_notify_pending(app: &AppHandle, state: &AppState, now: DateTime<Utc>) {
    if let Some(result) = state.updates.result() {
        maybe_notify(app, state, &result, now);
    }
}

/// Dispatches the notification check to the main thread, matching the other
/// notification call sites in the application.
fn dispatch_notify(app: &AppHandle) {
    let handle = app.clone();
    if let Err(error) = app.run_on_main_thread(move || {
        let state = handle.state::<AppState>();
        maybe_notify_pending(&handle, &state, Utc::now());
    }) {
        eprintln!("failed to dispatch update notification: {error}");
    }
}

fn maybe_notify(app: &AppHandle, state: &AppState, result: &UpdateCheckResult, now: DateTime<Utc>) {
    if result.status != UpdateStatus::Available {
        return;
    }
    let Some(latest) = result.latest_version.as_deref() else {
        return;
    };
    if state.store.update_last_notified_version().as_deref() == Some(latest) {
        return;
    }
    if state.break_status(now).phase == BreakPhase::OnBreak {
        return;
    }

    let locale = state.effective_locale();
    let title = i18n::translate(&locale, "updates.notificationTitle", &[("version", latest)]);
    let body = i18n::translate(
        &locale,
        "updates.notificationBody",
        &[("current", &result.current_version)],
    );

    if let Err(error) = notifications::notify(app, &title, &body) {
        eprintln!("failed to show update notification: {error}");
        return;
    }
    if let Err(error) = state
        .store
        .set_update_last_notified_version(Some(latest.to_string()))
    {
        eprintln!("failed to record the notified update version: {error}");
    }
}

#[derive(Debug, Deserialize)]
struct Release {
    tag_name: String,
    html_url: String,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    published_at: Option<String>,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    prerelease: bool,
}

#[derive(Debug, Clone, Copy)]
enum FetchError {
    Network,
    Timeout,
    RateLimited,
    InvalidResponse,
    Http(u16),
}

impl FetchError {
    fn code(self) -> UpdateErrorCode {
        match self {
            Self::Network => UpdateErrorCode::Network,
            Self::Timeout => UpdateErrorCode::Timeout,
            Self::RateLimited => UpdateErrorCode::RateLimited,
            Self::InvalidResponse => UpdateErrorCode::InvalidResponse,
            Self::Http(status) => {
                eprintln!("update check failed with HTTP status {status}");
                UpdateErrorCode::Http
            }
        }
    }
}

fn fetch_latest_release() -> Result<Option<Release>, FetchError> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent(USER_AGENT)
        .build()
        .map_err(|_| FetchError::Network)?;

    let response = client
        .get(LATEST_RELEASE_URL)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .map_err(|error| {
            if error.is_timeout() {
                FetchError::Timeout
            } else {
                FetchError::Network
            }
        })?;

    match response.status().as_u16() {
        200 => {
            let release = response
                .json::<Release>()
                .map_err(|_| FetchError::InvalidResponse)?;
            if release.draft || release.prerelease {
                Ok(None)
            } else {
                Ok(Some(release))
            }
        }
        404 => Ok(None),
        403 | 429 => Err(FetchError::RateLimited),
        status => Err(FetchError::Http(status)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_and_compares_stable_versions() {
        assert_eq!(parse_version("v0.1.2"), Some((0, 1, 2)));
        assert_eq!(parse_version("0.1.2"), Some((0, 1, 2)));
        assert_eq!(parse_version("v1.20.300"), Some((1, 20, 300)));
        assert_eq!(parse_version("v1.2"), None);
        assert_eq!(parse_version("v1.2.3.4"), None);
        assert_eq!(parse_version("v1.2.x"), None);
        assert_eq!(parse_version("v1.2.3-beta"), None);

        assert_eq!(is_newer("v0.1.10", "0.1.9"), Some(true));
        assert_eq!(is_newer("v0.1.9", "0.1.10"), Some(false));
        assert_eq!(is_newer("v0.1.1", "0.1.1"), Some(false));
        assert_eq!(is_newer("bad", "0.1.1"), None);
    }

    #[test]
    fn extracts_download_metadata_from_a_release_body() {
        let body = r#"## Changes

<!-- breaktimer-downloads {"quark":"https://pan.quark.cn/s/abc","baidu":"https://pan.baidu.com/s/def?pwd=1234","baiduCode":"1234"} -->
"#;
        let metadata = download_metadata_from_body(body).unwrap();

        assert_eq!(
            metadata.quark.as_deref(),
            Some("https://pan.quark.cn/s/abc")
        );
        assert_eq!(
            metadata.baidu.as_deref(),
            Some("https://pan.baidu.com/s/def?pwd=1234")
        );
        assert_eq!(metadata.baidu_code.as_deref(), Some("1234"));
    }

    #[test]
    fn ignores_missing_or_malformed_download_metadata() {
        assert!(download_metadata_from_body("plain release notes").is_none());
        assert!(download_metadata_from_body("<!-- breaktimer-downloads not-json -->").is_none());
    }

    #[test]
    fn only_accepts_https_download_hosts() {
        assert!(validate_url("https://pan.quark.cn/s/abc", "pan.quark.cn").is_some());
        assert!(validate_url("http://pan.quark.cn/s/abc", "pan.quark.cn").is_none());
        assert!(validate_url("https://example.com/s/abc", "pan.quark.cn").is_none());
        assert!(validate_url("https://pan.baidu.com/s/abc", "pan.baidu.com").is_some());
        assert!(validate_url("https://pan.baidu.com.evil.test/s/abc", "pan.baidu.com").is_none());
    }

    #[test]
    fn only_accepts_project_release_urls() {
        assert!(is_allowed_github_url(
            "https://github.com/githunhunhub/breaktimer-new/releases/tag/v0.1.2"
        ));
        assert!(is_allowed_github_url(RELEASE_PAGE_URL));
        assert!(!is_allowed_github_url(
            "https://github.com/other/repo/releases/tag/v0.1.2"
        ));
        assert!(!is_allowed_github_url(
            "http://github.com/githunhunhub/breaktimer-new/releases/tag/v0.1.2"
        ));
    }

    #[test]
    fn builds_an_available_result_with_download_fields() {
        let now = DateTime::from_timestamp(1_700_000_000, 0).unwrap();
        let release = Release {
            tag_name: "v0.1.2".to_string(),
            html_url: "https://github.com/githunhunhub/breaktimer-new/releases/tag/v0.1.2"
                .to_string(),
            body: Some(
                r#"<!-- breaktimer-downloads {"quark":"https://pan.quark.cn/s/abc","baidu":"https://pan.baidu.com/s/def","baiduCode":"abcd"} -->"#
                    .to_string(),
            ),
            published_at: Some("2026-11-02T00:00:00Z".to_string()),
            draft: false,
            prerelease: false,
        };

        let result = result_from_release("0.1.1", now, release);

        assert_eq!(result.status, UpdateStatus::Available);
        assert_eq!(result.latest_version.as_deref(), Some("0.1.2"));
        assert_eq!(
            result.downloads.quark.as_deref(),
            Some("https://pan.quark.cn/s/abc")
        );
        assert_eq!(
            result.downloads.baidu.as_deref(),
            Some("https://pan.baidu.com/s/def")
        );
        assert_eq!(result.downloads.baidu_code.as_deref(), Some("abcd"));
    }

    #[test]
    fn treats_equal_or_older_releases_as_up_to_date() {
        let now = DateTime::from_timestamp(1_700_000_000, 0).unwrap();
        let release = Release {
            tag_name: "v0.1.1".to_string(),
            html_url: RELEASE_PAGE_URL.to_string(),
            body: None,
            published_at: None,
            draft: false,
            prerelease: false,
        };

        let result = result_from_release("0.1.1", now, release);

        assert_eq!(result.status, UpdateStatus::UpToDate);
        assert_eq!(result.downloads, DownloadLinks::default());
    }

    #[test]
    fn throttles_automatic_checks_to_once_per_day() {
        let now = DateTime::from_timestamp(1_700_000_000, 0).unwrap();
        assert!(check_due(None, now));
        assert!(check_due(
            Some(now.timestamp() - CHECK_INTERVAL_SECONDS),
            now
        ));
        assert!(!check_due(Some(now.timestamp() - 60), now));
    }

    #[test]
    fn serializes_update_results_for_the_renderer() {
        let result = unavailable(
            "0.1.1",
            DateTime::from_timestamp(1_700_000_000, 0).unwrap(),
            UpdateErrorCode::RateLimited,
        );
        let value = serde_json::to_value(result).unwrap();

        assert_eq!(value["status"], "unavailable");
        assert_eq!(value["currentVersion"], "0.1.1");
        assert_eq!(value["error"], "rateLimited");
        assert_eq!(value["downloads"]["quark"], serde_json::Value::Null);
    }
}
