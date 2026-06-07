$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $repoRoot '.runtime-wp\wordpress'
$stdoutLogPath = Join-Path $runtimeRoot '_wp_server.out.log'
$stderrLogPath = Join-Path $runtimeRoot '_wp_server.err.log'
$configureScript = Join-Path $PSScriptRoot 'configure-runtime-wp.php'

$port = 8091
if ($env:KALK_TOP_RUNTIME_PORT -and [int]::TryParse([string]$env:KALK_TOP_RUNTIME_PORT, [ref]$null)) {
    $port = [int]$env:KALK_TOP_RUNTIME_PORT
}

$baseUrl = "http://127.0.0.1:$port"
$env:KALK_TOP_RUNTIME_PORT = [string]$port
$env:KALK_TOP_RUNTIME_BASE_URL = $baseUrl

if (-not (Test-Path $runtimeRoot)) {
    throw "Runtime root not found: $runtimeRoot"
}

& (Join-Path $PSScriptRoot 'sync-runtime-plugin.ps1')

function Invoke-RuntimeConfigure {
    if (-not (Test-Path -LiteralPath $configureScript)) {
        throw "Missing configure script: $configureScript"
    }
    & php $configureScript
}

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
    Invoke-RuntimeConfigure | Out-Null
    Write-Output "WP runtime already listening on $baseUrl (PID $($listener.OwningProcess)); siteurl synced"
    exit 0
}

if (Test-Path $stdoutLogPath) {
    Remove-Item $stdoutLogPath -Force
}
if (Test-Path $stderrLogPath) {
    Remove-Item $stderrLogPath -Force
}

$proc = Start-Process -FilePath 'php' -ArgumentList @('-S', "127.0.0.1:$port", '-t', '.', '_router.php') -WorkingDirectory $runtimeRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutLogPath -RedirectStandardError $stderrLogPath -PassThru
Start-Sleep -Seconds 2

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $listener) {
    throw "WP runtime did not start. Check $stdoutLogPath and $stderrLogPath"
}

Invoke-RuntimeConfigure | Out-Null
Write-Output "WP runtime started at $baseUrl (PID $($proc.Id)); siteurl synced"
