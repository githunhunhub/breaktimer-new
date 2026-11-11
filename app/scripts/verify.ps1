# Repository verification gate (AGENTS.md「验证门禁」).
# Packaging commands (tauri:build / portable:build) are deliberately excluded.

$ErrorActionPreference = "Stop"

$steps = @(
  "pnpm format:check",
  "pnpm lint",
  "pnpm typecheck",
  "pnpm test",
  "pnpm build",
  "cargo fmt --all --manifest-path src-tauri/Cargo.toml -- --check",
  "cargo check --locked --all-targets --manifest-path src-tauri/Cargo.toml",
  "cargo test --locked --all-targets --manifest-path src-tauri/Cargo.toml"
)

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
  foreach ($step in $steps) {
    Write-Host "==> $step"
    Invoke-Expression $step
    if ($LASTEXITCODE -ne 0) {
      Write-Host "FAILED: $step"
      exit $LASTEXITCODE
    }
  }
  Write-Host "All verification steps passed."
}
finally {
  Pop-Location
}
