# Szybki check strony kalkulatora (bez wiszącego curl + całego HTML w pipe).
param(
    [string]$Url = "http://127.0.0.1:8090/?page_id=5",
    [int]$TimeoutSec = 15
)

$ProgressPreference = "SilentlyContinue"
try {
    $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
    $html = $r.Content
    [PSCustomObject]@{
        Ok           = $true
        Status       = $r.StatusCode
        Bytes        = $html.Length
        HasAiCoach   = $html -match "ai-coach"
        HasSourceLbl = $html -match "Główne źródło"
        HasHiddenHp  = $html -match 'name="source_type"[^>]*value="air_to_water_hp"|value="air_to_water_hp"[^>]*name="source_type"'
    }
} catch {
    [PSCustomObject]@{
        Ok    = $false
        Error = $_.Exception.Message
    }
    exit 1
}
