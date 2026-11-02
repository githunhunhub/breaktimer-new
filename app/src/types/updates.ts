// TypeScript mirror of the Rust update-check result in
// `app/src-tauri/src/updates/mod.rs` (SPEC-0017).

export type UpdateStatus =
  "upToDate" | "available" | "unavailable" | "noRelease";

export type UpdateErrorCode =
  "network" | "timeout" | "rateLimited" | "invalidResponse" | "http" | "busy";

export type UpdateLinkKind = "quark" | "baidu";

export interface UpdateDownloads {
  quark: string | null;
  baidu: string | null;
  baiduCode: string | null;
}

export interface UpdateCheckResult {
  status: UpdateStatus;
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string | null;
  publishedAt: string | null;
  checkedAt: number;
  error: UpdateErrorCode | null;
  downloads: UpdateDownloads;
}
