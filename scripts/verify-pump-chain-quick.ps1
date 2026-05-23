# Lekka weryfikacja lancucha pompa -> configurator (bez Playwright).
param(
    [string]$CalculatorUrl = "http://127.0.0.1:8090/?page_id=5"
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

Push-Location $root
try {
    Write-Host "[verify-pump-chain] PHP offer.pumpSelection contract..."
    php core/application/harness/configurator-pump-offer.regression.php
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    Write-Host "[verify-pump-chain] JS static regressions (ui + workflow)..."
    node kalkulator/js/ui.regression.test.js
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    Write-Host "[verify-pump-chain] calculator page HTTP smoke..."
    & "$PSScriptRoot/check-calculator-page.ps1" -Url $CalculatorUrl | Format-List
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    if ($env:TOPINSTAL_REST_BASE_URL) {
        Write-Host "[verify-pump-chain] REST calculate-offer..."
        npm run test:rest
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } else {
        Write-Host "[verify-pump-chain] REST skipped (set TOPINSTAL_REST_BASE_URL + TOPINSTAL_REST_NONCE to enable)."
    }

    Write-Host "[verify-pump-chain] OK"
} finally {
    Pop-Location
}
