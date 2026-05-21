# API REST: calculate-offer

> Status: canonical
> Owner: TOP-INSTAL contract owner
> Last verified against code/runtime: 2026-04-02 (controller/validator/contract audit)
> Source-of-truth level: L1
> Supersedes: none
> Related docs: `dto-and-boundaries.md`, `README_NOWE_WEJSCIA_CALCULATE_OFFER.md`, `../SOURCE_OF_TRUTH_INDEX.md`

## 1. Endpoint

- Metoda: `POST`
- URL: `/wp-json/topinstal/v1/calculate-offer`
- Content-Type: `application/json`

Przyklad URL (prod):

`https://topinstal.com.pl/wp-json/topinstal/v1/calculate-offer`

## 2. Security (REST)

Dopuszczalne sa dwa modele auth:

1. Nonce:
- `X-Topinstal-Nonce` (preferowany)
- `X-WP-Nonce` (fallback)
- lub parametr `nonce`

2. Agent key:
- `X-Top-Instal-Agent-Key`
- wartosc z opcji `topinstal_calc_agent_api_key`
- lub env/constant `TOPINSTAL_CALC_AGENT_API_KEY`

Walidacja auth:
- brak nonce i brak agent key -> HTTP `401`, `errorCode = AUTH_REQUIRED`
- podany nonce, ale niepoprawny -> HTTP `403`, `errorCode = NONCE_INVALID`
- podany agent key, ale niepoprawny -> HTTP `403`, `errorCode = AGENT_KEY_INVALID`

## 3. Uwaga: wywolanie wewnetrzne use-case (agent)

Agent cieplo.app dziala wewnatrz WP i wywoluje `TopInstal_CalculateOffer_UseCase` bezposrednio,
wiec nie korzysta z REST nonce.
Dotyczy to tylko weznego workera PHP, nie zewnetrznych klientow HTTP.

## 4. Rate limiting (REST)

Domyslnie:

- okno: `60s`
- limit: `45` requestow / IP / okno

Naglowki odpowiedzi:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Window`
- `X-RateLimit-Reset-In`
- (dla 429) `Retry-After`

## 5. Kontrakt wejscia: CalcRequestDTO

### Wymagane

- `schemaVersion` (musi byc `"1.0"`)
- `lead` (object)
- `building` (object)
- `preferences` (object)

### Dodatkowe walidacje

- `traceId` (jesli podany): string <= 128
- `building`: dodatnia powierzchnia w jednym z pol:
  - `heated_area` lub
  - `floor_area` lub
  - `total_area`
- `preferences.heating`: object wymagany
- `preferences.dhw`: object wymagany
- jesli `preferences.dhw.enabled = true`, wtedy `preferences.dhw.persons > 0`

### Pole opcjonalne: `ozcResult`

Gdy obecny i poprawny, use-case pomija `OzcEngine`.

Pola wymagane (`ozcResult`):

- `designHeatLoss_kW` (number, `0 < x <= 500`)
- `heatedArea_m2` (number, `0 < x <= 10000`)

Pola opcjonalne (`ozcResult`):

- `recommendedPower_kW`
- `assumptions`
- `warnings`
- `source`
- `metrics`
- `extended`

Niepoprawny `ozcResult`:

- HTTP `400`
- `errorCode = VALIDATION_ERROR`
- detal: `field = ozcResult`, `code = OZC_RESULT_INVALID`

## 6. Kontrakt wyjscia: OfferDTO

Sukces (`200`) zwraca:

- `schemaVersion`
- `traceId`
- `engineering`:
  - `ozc`
  - `selection`
  - `buffer`
- `pricing`:
  - `currency`
  - `items[]`
  - `totals`
  - `source` (`backend_pricebook`)
  - `catalogVersion` (z `equipment-catalog.json`)
- `warnings[]`
- `assumptions[]`
- `engineMeta`

Dodatkowo naglowek:

- `X-Topinstal-Trace-Id`

## 7. Format bledow

Przyklad:

```json
{
  "traceId": "...",
  "errorCode": "VALIDATION_ERROR",
  "message": "Invalid CalcRequestDTO payload.",
  "details": {
    "errors": [
      {"field": "building.heated_area", "code": "REQUIRED", "message": "..."}
    ]
  }
}
```

Typowe statusy:

- `400` `VALIDATION_ERROR`
- `401` `AUTH_REQUIRED`
- `403` `NONCE_INVALID` / `AGENT_KEY_INVALID`
- `429` `RATE_LIMITED`
- `500` `CALCULATION_FAILED`

## 8. Przyklad requestu (minimalny poprawny)

```json
{
  "schemaVersion": "1.0",
  "traceId": "smoke-001",
  "lead": { "name": "Smoke Test" },
  "building": {
    "heated_area": 120,
    "include_hot_water": true,
    "hot_water_persons": 3,
    "hot_water_usage": "shower_bath"
  },
  "preferences": {
    "heating": { "emitterType": "surface", "sourceType": "air_to_water_hp" },
    "dhw": { "enabled": true, "persons": 3, "usageProfile": "shower_bath" },
    "hasBuffer": false
  },
  "context": { "source": "configurator" }
}
```

## 9. Przyklad requestu z `ozcResult`

```json
{
  "schemaVersion": "1.0",
  "traceId": "agent-ozc-001",
  "lead": { "name": "Agent Test" },
  "building": {
    "heated_area": 120,
    "include_hot_water": true,
    "hot_water_persons": 3,
    "hot_water_usage": "shower_bath"
  },
  "preferences": {
    "heating": { "emitterType": "unknown", "sourceType": "air_to_water_hp" },
    "dhw": { "enabled": true, "persons": 3, "usageProfile": "shower" },
    "hasBuffer": false
  },
  "ozcResult": {
    "designHeatLoss_kW": 5.1,
    "heatedArea_m2": 128,
    "recommendedPower_kW": 5.3,
    "source": "agent_cieplo_app",
    "assumptions": [],
    "warnings": [],
    "metrics": {},
    "extended": {}
  },
  "context": { "source": "agent", "agent": "cieplo_bridge", "agentVersion": "1.0" }
}
```

## 10. Smoke (PowerShell)

```powershell
$url = "https://twoja-domena.pl/wp-json/topinstal/v1/calculate-offer"
$nonce = "<fresh_nonce>"

$body = @{
  schemaVersion = "1.0"
  traceId = "smoke-001"
  lead = @{ name = "Smoke Test" }
  building = @{
    heated_area = 120
    include_hot_water = $true
    hot_water_persons = 3
    hot_water_usage = "shower_bath"
  }
  preferences = @{
    heating = @{ emitterType = "surface"; sourceType = "air_to_water_hp" }
    dhw = @{ enabled = $true; persons = 3; usageProfile = "shower_bath" }
    hasBuffer = $false
  }
  context = @{ source = "configurator" }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri $url -Method Post -Headers @{
  "X-Topinstal-Nonce" = $nonce
  "Content-Type" = "application/json"
} -Body $body
```

## 11. Przyklad requestu z agent key

```bash
curl -X POST "https://twoja-domena.pl/wp-json/topinstal/v1/calculate-offer" \
  -H "Content-Type: application/json" \
  -H "X-Top-Instal-Agent-Key: <CALC_AGENT_KEY>" \
  -d '{
    "schemaVersion":"1.0",
    "traceId":"agent-key-001",
    "lead":{"name":"Agent Key Test"},
    "building":{"heated_area":120,"include_hot_water":true,"hot_water_persons":3,"hot_water_usage":"shower_bath"},
    "preferences":{"heating":{"emitterType":"surface","sourceType":"air_to_water_hp"},"dhw":{"enabled":true,"persons":3,"usageProfile":"shower_bath"},"hasBuffer":false}
  }'
```
