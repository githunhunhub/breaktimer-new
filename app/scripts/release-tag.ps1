[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Version
)

$ErrorActionPreference = "Stop"
$appRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$normalizedVersion = $Version.Trim()
if ($normalizedVersion.StartsWith("v")) {
    $normalizedVersion = $normalizedVersion.Substring(1)
}
if ($normalizedVersion -notmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$') {
    throw "Invalid release version: $Version. Expected X.Y.Z or vX.Y.Z."
}
$tag = "v$normalizedVersion"

Push-Location $appRoot
try {
    & node ./scripts/release-version.mjs check $tag
    if ($LASTEXITCODE -ne 0) {
        throw "Release version check failed."
    }

    $branch = (git branch --show-current).Trim()
    if ($branch -ne "master") {
        throw "Release tags must be created from master, current branch: $branch."
    }

    $status = @(git status --porcelain)
    if ($status.Count -gt 0) {
        throw "Working tree is not clean. Commit or remove all changes first."
    }

    $upstream = (git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}').Trim()
    if ($LASTEXITCODE -ne 0 -or $upstream -notmatch '^([^/]+)/(.+)$') {
        throw "The current master branch must have an upstream remote branch."
    }
    $remote = $Matches[1]
    $remoteBranch = $Matches[2]
    if ($remoteBranch -ne "master") {
        throw "The upstream branch must be master, current upstream: $upstream."
    }

    git fetch $remote $remoteBranch --tags
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to fetch $remote/$remoteBranch."
    }

    $aheadBehind = @(
        (git rev-list --left-right --count "HEAD...$remote/$remoteBranch").Trim() -split '\s+'
    )
    if ($aheadBehind.Count -ne 2 -or $aheadBehind[0] -ne "0" -or $aheadBehind[1] -ne "0") {
        throw "Local master is not synchronized with $remote/$remoteBranch."
    }

    git rev-parse -q --verify "refs/tags/$tag" | Out-Null
    if ($LASTEXITCODE -eq 0) {
        throw "Local tag $tag already exists."
    }

    $remoteTag = git ls-remote --tags $remote "refs/tags/$tag"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to check remote tags on $remote."
    }
    if (-not [string]::IsNullOrWhiteSpace($remoteTag)) {
        throw "Remote tag $tag already exists on $remote."
    }

    git tag -a $tag -m "BreakTimer-new $tag"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create tag $tag."
    }

    git rev-parse --verify "refs/tags/$tag"
    Write-Host "Created annotated tag $tag."
    Write-Host "Push it when ready: git push $remote $tag"
}
finally {
    Pop-Location
}
