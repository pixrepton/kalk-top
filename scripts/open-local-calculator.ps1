param(
    [switch] $NoBrowser,
    [switch] $NormalWindow
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$startScript = Join-Path $PSScriptRoot "start-runtime-wp.ps1"
$runtimePort = 8090
$baseUrl = "http://127.0.0.1:$runtimePort"
$appUrl = "$baseUrl/?page_id=5"
$freshUrl = "$appUrl&launcher_ts=$([DateTime]::Now.ToString('yyyyMMddHHmmss'))"
$stdoutLogPath = Join-Path $repoRoot ".runtime-wp\wordpress\_wp_server.out.log"
$stderrLogPath = Join-Path $repoRoot ".runtime-wp\wordpress\_wp_server.err.log"

function Show-LauncherDialog {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Message,
        [string] $Title = "TOP-INSTAL lokalnie",
        [ValidateSet("Information", "Warning", "Error")]
        [string] $Icon = "Information"
    )

    try {
        Add-Type -AssemblyName PresentationFramework -ErrorAction Stop
        [void] [System.Windows.MessageBox]::Show(
            $Message,
            $Title,
            [System.Windows.MessageBoxButton]::OK,
            [System.Windows.MessageBoxImage]::$Icon
        )
        return
    } catch {
        Write-Host ""
        Write-Host "[$Title]"
        Write-Host $Message
    }
}

function Get-ListeningProcess {
    param(
        [Parameter(Mandatory = $true)]
        [int] $Port
    )

    try {
        return Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
    } catch {
        return $null
    }
}

function Test-CalculatorRuntime {
    param(
        [int] $TimeoutSec = 3
    )

    try {
        $response = Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec $TimeoutSec
        if ($response.StatusCode -ne 200) {
            return $false
        }

        $content = [string] $response.Content
        return (
            $content -match "top-instal-calc" -or
            $content -match "heatpump-calculator" -or
            $content -match "Top-Instal - konfigurator"
        )
    } catch {
        return $false
    }
}

function Wait-CalculatorRuntime {
    param(
        [int] $MaxSeconds = 20
    )

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $MaxSeconds) {
        if (Test-CalculatorRuntime -TimeoutSec 2) {
            return $true
        }
        Start-Sleep -Milliseconds 750
    }

    return $false
}

function Resolve-Executable {
    param(
        [Parameter(Mandatory = $true)]
        [string] $CommandName,
        [string[]] $CandidatePaths = @()
    )

    $command = Get-Command $CommandName -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command -and $command.Source) {
        return $command.Source
    }

    foreach ($path in $CandidatePaths) {
        if ([string]::IsNullOrWhiteSpace($path)) {
            continue
        }
        if (Test-Path -LiteralPath $path) {
            return $path
        }
    }

    return $null
}

function Open-CalculatorBrowser {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Url
    )

    if ($NoBrowser) {
        return "browser skipped"
    }

    if (-not $NormalWindow) {
        $firefoxPaths = @(
            (Join-Path $env:ProgramFiles "Mozilla Firefox\firefox.exe"),
            (Join-Path ${env:ProgramFiles(x86)} "Mozilla Firefox\firefox.exe"),
            (Join-Path $env:LocalAppData "Mozilla Firefox\firefox.exe")
        )
        $firefox = Resolve-Executable -CommandName "firefox.exe" -CandidatePaths $firefoxPaths
        if ($firefox) {
            Start-Process -FilePath $firefox -ArgumentList @("-private-window", $Url) | Out-Null
            return "Firefox Private"
        }

        $edgePaths = @(
            (Join-Path $env:LocalAppData "Microsoft\Edge\Application\msedge.exe"),
            (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
            (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe")
        )
        $edge = Resolve-Executable -CommandName "msedge.exe" -CandidatePaths $edgePaths
        if ($edge) {
            Start-Process -FilePath $edge -ArgumentList @("--inprivate", $Url) | Out-Null
            return "Edge InPrivate"
        }

        $chromePaths = @(
            (Join-Path $env:LocalAppData "Google\Chrome\Application\chrome.exe"),
            (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
            (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe")
        )
        $chrome = Resolve-Executable -CommandName "chrome.exe" -CandidatePaths $chromePaths
        if ($chrome) {
            Start-Process -FilePath $chrome -ArgumentList @("--incognito", $Url) | Out-Null
            return "Chrome Incognito"
        }
    }

    Start-Process -FilePath $Url | Out-Null
    return "Default browser"
}

function Fail-Launcher {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Message
    )

    Show-LauncherDialog -Message $Message -Icon Error
    throw $Message
}

if (-not (Test-Path -LiteralPath $startScript)) {
    Fail-Launcher "Nie znaleziono skryptu startowego runtime: $startScript"
}

if (-not (Get-Command php -ErrorAction SilentlyContinue)) {
    Fail-Launcher "Polecenie 'php' nie jest dostepne w systemie. Launcher nie moze uruchomic lokalnego WordPressa."
}

$runtimeHealthy = Test-CalculatorRuntime
if (-not $runtimeHealthy) {
    $listener = Get-ListeningProcess -Port $runtimePort
    if ($listener) {
        $portOwnerPid = $listener.OwningProcess
        Fail-Launcher @"
Port $runtimePort jest juz zajety przez proces PID $portOwnerPid, ale lokalny kalkulator nie odpowiada poprawnie pod adresem:
$appUrl

Launcher nie zatrzymal tego procesu automatycznie. Zamknij aplikacje zajmujaca port albo zwolnij port i uruchom skrot ponownie.
"@
    }

    try {
        & $startScript | Out-Null
    } catch {
        $details = @(
            "Nie udalo sie uruchomic lokalnego runtime.",
            "",
            "STDOUT log: $stdoutLogPath",
            "STDERR log: $stderrLogPath",
            "",
            "Blad: $($_.Exception.Message)"
        ) -join [Environment]::NewLine
        Fail-Launcher $details
    }

    if (-not (Wait-CalculatorRuntime -MaxSeconds 20)) {
        $details = @(
            "Runtime uruchomil sie niepoprawnie albo nie odpowiedzial na czas.",
            "",
            "Sprawdz logi:",
            $stdoutLogPath,
            $stderrLogPath
        ) -join [Environment]::NewLine
        Fail-Launcher $details
    }
}

$browserMode = Open-CalculatorBrowser -Url $freshUrl
Write-Host "TOP-INSTAL lokalnie otwarty: $freshUrl"
Write-Host "Tryb przegladarki: $browserMode"
