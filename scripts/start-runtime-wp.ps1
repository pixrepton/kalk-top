$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $repoRoot '.runtime-wp\wordpress'
$routerPath = Join-Path $runtimeRoot '_router.php'
$stdoutLogPath = Join-Path $runtimeRoot '_wp_server.out.log'
$stderrLogPath = Join-Path $runtimeRoot '_wp_server.err.log'
$port = 8090
$baseUrl = "http://127.0.0.1:$port"

if (-not (Test-Path $runtimeRoot)) {
    throw "Runtime root not found: $runtimeRoot"
}

& (Join-Path $PSScriptRoot 'sync-runtime-plugin.ps1')

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
    Write-Output "WP runtime already listening on $baseUrl (PID $($listener.OwningProcess)); canonical repo files are linked into the runtime plugin"
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

Write-Output "WP runtime started at $baseUrl (PID $($proc.Id)); canonical repo files are linked into the runtime plugin"
