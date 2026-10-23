[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$appRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$tauriRoot = Join-Path $appRoot "src-tauri"
$targetDir = Join-Path $tauriRoot "target\release"
$executable = Join-Path $targetDir "breaktimer-new.exe"
$readme = Join-Path $PSScriptRoot "portable-README.txt"

if (-not [System.IO.File]::Exists($executable)) {
    throw "Release executable not found: $executable. Run 'pnpm tauri:build --no-bundle' first."
}
if (-not [System.IO.File]::Exists($readme)) {
    throw "Portable README not found: $readme"
}

$package = Get-Content -Raw -Encoding UTF8 (Join-Path $appRoot "package.json") |
    ConvertFrom-Json
$version = [string]$package.version
if ([string]::IsNullOrWhiteSpace($version)) {
    throw "package.json does not contain a version."
}

$portableName = (& node (Join-Path $PSScriptRoot "release-version.mjs") "asset-name" "portable" $version).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($portableName)) {
    throw "Failed to resolve the portable ZIP file name."
}

$outputRoot = Join-Path $targetDir "bundle\portable"
[System.IO.Directory]::CreateDirectory($outputRoot) | Out-Null

$stagingRoot = Join-Path $outputRoot (".staging-" + [System.Guid]::NewGuid().ToString("N"))
$packageDir = Join-Path $stagingRoot "BreakTimer-new"
$zipPath = Join-Path $outputRoot $portableName

[System.IO.Directory]::CreateDirectory($packageDir) | Out-Null

try {
    Copy-Item -LiteralPath $executable -Destination (Join-Path $packageDir "breaktimer-new.exe")
    Copy-Item -LiteralPath $readme -Destination (Join-Path $packageDir "README.txt")
    [System.IO.File]::WriteAllBytes(
        (Join-Path $packageDir "portable.flag"),
        [byte[]]::new(0)
    )

    if ([System.IO.File]::Exists($zipPath)) {
        [System.IO.File]::Delete($zipPath)
    }
    $archive = [System.IO.Compression.ZipFile]::Open(
        $zipPath,
        [System.IO.Compression.ZipArchiveMode]::Create
    )
    try {
        $archive.CreateEntry("BreakTimer-new/") | Out-Null
        foreach ($name in @("breaktimer-new.exe", "portable.flag", "README.txt")) {
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive,
                (Join-Path $packageDir $name),
                "BreakTimer-new/$name",
                [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
        }
    }
    finally {
        $archive.Dispose()
    }

    $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        $entries = @($archive.Entries | ForEach-Object { $_.FullName })
        $required = @(
            "BreakTimer-new/",
            "BreakTimer-new/breaktimer-new.exe",
            "BreakTimer-new/portable.flag",
            "BreakTimer-new/README.txt"
        )
        foreach ($entry in $required) {
            if ($entries -notcontains $entry) {
                throw "Portable ZIP is missing required entry: $entry"
            }
        }
        if ($entries | Where-Object { $_ -notlike "BreakTimer-new/*" }) {
            throw "Portable ZIP contains an entry outside the BreakTimer-new directory."
        }
        if ($entries | Where-Object { $_ -like "BreakTimer-new/data/*" }) {
            throw "Portable ZIP must not include a data directory."
        }
    }
    finally {
        $archive.Dispose()
    }

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $stream = [System.IO.File]::OpenRead($zipPath)
    try {
        $hash = [System.BitConverter]::ToString(
            $sha256.ComputeHash($stream)
        ).Replace("-", "")
    }
    finally {
        $stream.Dispose()
        $sha256.Dispose()
    }
    $size = (Get-Item -LiteralPath $zipPath).Length
    Write-Host "Portable ZIP: $zipPath"
    Write-Host "Size: $size bytes"
    Write-Host "SHA256: $hash"
}
finally {
    if ([System.IO.Directory]::Exists($stagingRoot)) {
        $resolvedOutput = [System.IO.Path]::GetFullPath($outputRoot)
        $resolvedStaging = [System.IO.Path]::GetFullPath($stagingRoot)
        $expectedPrefix = $resolvedOutput.TrimEnd(
            [System.IO.Path]::DirectorySeparatorChar
        ) + [System.IO.Path]::DirectorySeparatorChar
        if (-not $resolvedStaging.StartsWith(
            $expectedPrefix,
            [System.StringComparison]::OrdinalIgnoreCase
        )) {
            throw "Refusing to clean a staging directory outside $resolvedOutput"
        }
        [System.IO.Directory]::Delete($resolvedStaging, $true)
    }
}
