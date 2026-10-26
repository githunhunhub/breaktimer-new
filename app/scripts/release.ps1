[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Version
)

$ErrorActionPreference = "Stop"
$appRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $appRoot ".."))
$normalizedVersion = $Version.Trim()
if ($normalizedVersion.StartsWith("v")) {
    $normalizedVersion = $normalizedVersion.Substring(1)
}
if ($normalizedVersion -notmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$') {
    throw "Invalid release version: $Version. Expected X.Y.Z or vX.Y.Z."
}
$tag = "v$normalizedVersion"
$versionFiles = @(
    "package.json",
    "src-tauri/tauri.conf.json",
    "src-tauri/Cargo.toml",
    "src-tauri/Cargo.lock"
)

function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE`: $Command $($Arguments -join ' ')"
    }
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

$versionBackups = @{}
foreach ($file in $versionFiles) {
    $fullPath = Join-Path $appRoot $file
    $versionBackups[$fullPath] = [System.IO.File]::ReadAllBytes($fullPath)
}

$versionChanged = $false
$versionStaged = $false
$commitCreated = $false
$completed = $false

Push-Location $appRoot
try {
    Write-Step "Validate repository state for $tag"

    $branch = (git branch --show-current).Trim()
    if ($branch -ne "master") {
        throw "Releases must run from master, current branch: $branch."
    }

    $status = @(git status --porcelain)
    if ($status.Count -gt 0) {
        throw "Working tree is not clean. Commit or remove all changes before releasing."
    }

    $upstream = (git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}').Trim()
    if ($LASTEXITCODE -ne 0 -or $upstream -ne "github/master") {
        throw "master must track github/master. Current upstream: $upstream."
    }

    Invoke-Native git @("fetch", "github", "master", "--tags")
    Invoke-Native git @("fetch", "origin", "master", "--no-tags")

    foreach ($remoteBranch in @("github/master", "origin/master")) {
        git merge-base --is-ancestor $remoteBranch HEAD
        if ($LASTEXITCODE -ne 0) {
            throw "$remoteBranch contains commits that are missing locally."
        }
    }

    $remoteTag = @(
        git ls-remote --tags github "refs/tags/$tag" "refs/tags/$tag^{}"
    )
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to read GitHub tags."
    }
    if ($remoteTag.Count -gt 0) {
        throw "GitHub tag $tag already exists. Use the existing Actions run or a new version."
    }

    $pendingCommits = @(git log --oneline "github/master..HEAD")
    if ($pendingCommits.Count -gt 0) {
        Write-Host "Commits currently ahead of github/master:"
        $pendingCommits | ForEach-Object { Write-Host "  $_" }
    }

    Write-Step "Run release checks"
    Invoke-Native pnpm @("format:check")
    Invoke-Native pnpm @("lint")
    Invoke-Native pnpm @("typecheck")
    Invoke-Native pnpm @("test")
    Invoke-Native pnpm @("build")
    Invoke-Native cargo @(
        "fmt",
        "--all",
        "--manifest-path",
        "src-tauri/Cargo.toml",
        "--",
        "--check"
    )
    Invoke-Native cargo @(
        "check",
        "--locked",
        "--all-targets",
        "--manifest-path",
        "src-tauri/Cargo.toml"
    )
    Invoke-Native cargo @(
        "test",
        "--locked",
        "--all-targets",
        "--manifest-path",
        "src-tauri/Cargo.toml"
    )

    Write-Step "Synchronize version files to $normalizedVersion"
    Invoke-Native pnpm @("release:version", $normalizedVersion)
    Invoke-Native pnpm @("release:check", $tag)

    $changedFiles = @(git status --porcelain -- $versionFiles)
    $versionChanged = $changedFiles.Count -gt 0

    if ($versionChanged) {
        Write-Host "Version file changes:"
        git diff -- $versionFiles
    }
    else {
        Write-Host "Version files already match $normalizedVersion."
    }

    Write-Host ""
    Write-Host "Release actions:" -ForegroundColor Yellow
    Write-Host "  - push master to GitHub and Gitee"
    if ($versionChanged) {
        Write-Host "  - commit version changes as chore(release): 发布 $normalizedVersion"
    }
    Write-Host "  - create and push $tag to GitHub only"
    Write-Host "  - GitHub Actions will build and publish the public Release"
    $answer = (Read-Host "Type y to continue").Trim().ToLowerInvariant()
    if ($answer -notin @("y", "yes")) {
        throw "Release cancelled."
    }

    if ($versionChanged) {
        Write-Step "Commit version changes"
        Invoke-Native git (@("add", "--") + $versionFiles)
        $versionStaged = $true
        Invoke-Native git @("diff", "--cached", "--check")
        Invoke-Native git @(
            "commit",
            "-m",
            "chore(release): 发布 $normalizedVersion"
        )
        $commitCreated = $true
        $versionStaged = $false
        $versionChanged = $false
    }

    Write-Step "Push master to GitHub and Gitee"
    Invoke-Native git @("push", "github", "master")
    Invoke-Native git @("push", "origin", "master")

    $remoteTag = @(
        git ls-remote --tags github "refs/tags/$tag" "refs/tags/$tag^{}"
    )
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to recheck GitHub tags."
    }
    if ($remoteTag.Count -gt 0) {
        throw "GitHub tag $tag appeared while releasing. Refusing to overwrite it."
    }

    $localTagCommit = git rev-parse -q --verify "refs/tags/$tag^{commit}"
    if ($LASTEXITCODE -eq 0) {
        $head = (git rev-parse HEAD).Trim()
        if ($localTagCommit.Trim() -ne $head) {
            throw "Local tag $tag already exists on $localTagCommit instead of HEAD $head."
        }
        Write-Host "Reusing existing local tag $tag."
    }
    else {
        & (Join-Path $PSScriptRoot "release-tag.ps1") $normalizedVersion
    }

    Write-Step "Publish $tag to GitHub"
    Invoke-Native git @(
        "push",
        "github",
        "refs/tags/$tag`:refs/tags/$tag"
    )

    $completed = $true
    Write-Host ""
    Write-Host "Release $tag triggered." -ForegroundColor Green
    Write-Host "GitHub Actions: https://github.com/githunhunhub/breaktimer-new/actions/workflows/release.yml"
}
finally {
    if (-not $completed -and -not $commitCreated) {
        if ($versionStaged) {
            git restore --staged -- $versionFiles
        }
        if ($versionChanged) {
            foreach ($file in $versionFiles) {
                $fullPath = Join-Path $appRoot $file
                [System.IO.File]::WriteAllBytes(
                    $fullPath,
                    $versionBackups[$fullPath]
                )
            }
            Write-Host "Restored version files after an incomplete release."
        }
    }
    Pop-Location
}
