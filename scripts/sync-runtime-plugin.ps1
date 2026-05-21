$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimePlugin = Join-Path $repoRoot '.runtime-wp\wordpress\wp-content\plugins\topinstal-heatpump-calculator'

if (-not (Test-Path $runtimePlugin)) {
    New-Item -ItemType Directory -Path $runtimePlugin -Force | Out-Null
}

$directoriesToLink = @(
    'core',
    'docs',
    'frontend',
    'img',
    'kalkulator',
    'konfigurator',
    'libraries',
    'wp-adapter'
)

$filesToLink = @(
    'AGENTS.md',
    'COMPAT_POINTERS.md',
    'heatpump-calculator.php',
    'preview.php',
    'README.md'
)

function Remove-RuntimeEntry {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    $item = Get-Item -LiteralPath $Path -Force
    $isReparsePoint = ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0

    if ($item.PSIsContainer) {
        if ($isReparsePoint) {
            cmd /c "rmdir `"$Path`"" | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to remove runtime directory link: $Path"
            }
            return
        }

        Remove-Item -LiteralPath $Path -Recurse -Force
        return
    }

    Remove-Item -LiteralPath $Path -Force
}

function New-RuntimeDirectoryLink {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Source,
        [Parameter(Mandatory = $true)]
        [string] $Target
    )

    cmd /c "mklink /J `"$Target`" `"$Source`"" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create runtime junction: $Target -> $Source"
    }
}

function New-RuntimeFileLink {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Source,
        [Parameter(Mandatory = $true)]
        [string] $Target
    )

    cmd /c "mklink /H `"$Target`" `"$Source`"" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create runtime hard link: $Target -> $Source"
    }
}

Get-ChildItem -LiteralPath $runtimePlugin -Force | ForEach-Object {
    Remove-RuntimeEntry -Path $_.FullName
}

foreach ($dir in $directoriesToLink) {
    $sourceDir = Join-Path $repoRoot $dir
    $targetDir = Join-Path $runtimePlugin $dir

    if (-not (Test-Path $sourceDir)) {
        continue
    }

    New-RuntimeDirectoryLink -Source $sourceDir -Target $targetDir
}

foreach ($file in $filesToLink) {
    $sourceFile = Join-Path $repoRoot $file
    $targetFile = Join-Path $runtimePlugin $file

    if (-not (Test-Path $sourceFile)) {
        continue
    }

    New-RuntimeFileLink -Source $sourceFile -Target $targetFile
}

Write-Output "Runtime plugin linked from repo root to $runtimePlugin"
