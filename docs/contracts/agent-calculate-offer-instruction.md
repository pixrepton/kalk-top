# Instrukcja dla agenta AI — wywołanie calculate-offer

Pełna specyfikacja wywołania `POST /wp-json/topinstal/v1/calculate-offer` przez zewnętrznego agenta AI.

---

> Status: canonical
> Owner: TOP-INSTAL contract owner
> Last verified against code/runtime: 2026-04-03 (metadata normalization pass)
> Source-of-truth level: L1/L2
> Supersedes: none
> Related docs: `API_CALCULATE_OFFER.md`, `README_NOWE_WEJSCIA_CALCULATE_OFFER.md`, `../SOURCE_OF_TRUTH_INDEX.md`

## 1. Endpoint i metoda

| Element          | Wartość                                           |
| ---------------- | ------------------------------------------------- |
| **URL**          | `{BASE_URL}/wp-json/topinstal/v1/calculate-offer` |
| **Metoda**       | `POST`                                            |
| **Content-Type** | `application/json`                                |

Przykład: `https://twoja-domena.pl/wp-json/topinstal/v1/calculate-offer`

---

## 2. Autoryzacja

Agent **musi** przesłać jedną z opcji:

### Opcja A: Agent key (zalecane dla agentów zewnętrznych)

```
X-Top-Instal-Agent-Key: {WARTOŚĆ_KLUCZA}
```

lub

```
X-Topinstal-Agent-Key: {WARTOŚĆ_KLUCZA}
```

Klucz konfiguruje się w WordPress: opcja `topinstal_calc_agent_api_key` lub zmienna środowiskowa `TOPINSTAL_CALC_AGENT_API_KEY`.

### Opcja B: Nonce (sesja WordPress)

```
X-WP-Nonce: {nonce}
```

lub

```
X-Topinstal-Nonce: {nonce}
```

Nonce jest wymagany dla użytkowników zalogowanych w WordPress.

**Bez poprawnej autoryzacji:** odpowiedź `401` z kodem `AUTH_REQUIRED`.

---

## 3. Rate limit

- **Limit:** 45 żądań na 60 sekund (domyślnie)
- **Przekroczenie:** odpowiedź `429` z kodem `RATE_LIMITED`
- **Nagłówek:** `Retry-After` (sekundy do ponowienia)

---

## 4. Format żądania — CalcRequestDTO

### 4.1 Struktura główna

```json
{
  "schemaVersion": "1.0",
  "traceId": "agent-{uuid}",
  "lead": { ... },
  "building": { ... },
  "preferences": { ... },
  "context": { ... },
  "ozcResult": { ... }
}
```

| Pole            | Wymagane | Opis                                     |
| --------------- | -------- | ---------------------------------------- |
| `schemaVersion` | tak      | Zawsze `"1.0"`                           |
| `traceId`       | nie      | Identyfikator śledzenia (max 128 znaków) |
| `lead`          | tak      | Obiekt (może być pusty)                  |
| `building`      | tak      | Obiekt z danymi budynku                  |
| `preferences`   | tak      | Obiekt z preferencjami                   |
| `context`       | nie      | Obiekt metadanych                        |
| `ozcResult`     | nie      | Opcjonalny wynik OZC (pomija silnik OZC) |

### 4.2 Obiekt `lead`

```json
{
  "name": null,
  "contact": {
    "email": null,
    "phone": null,
    "postalCode": null,
    "preferredContactTime": null
  },
  "consents": {},
  "intent": null
}
```

Wszystkie pola mogą być `null` lub puste.

### 4.3 Obiekt `building`

#### Pola wymagane przez walidator

- **Geometria budynku**:
  - co najmniej jedno dodatnie pole area:
    - `heated_area` LUB
    - `floor_area` LUB
    - `total_area`
  - albo komplet dodatnich wymiarów:
    - `building_length` I `building_width`

#### Pola ZAWSZE w payloadzie (dla pełnych obliczeń)

| Pole                     | Typ    | Opis                                                          |
| ------------------------ | ------ | ------------------------------------------------------------- |
| `building_type`          | enum   | single_house, double_house, row_house, apartment, multifamily |
| `construction_year`      | int    | Rok budowy (1800–2100)                                        |
| `construction_type`      | enum   | traditional, canadian                                         |
| `building_floors`        | int    | 1–4                                                           |
| `building_heated_floors` | int[]  | np. [1, 2]                                                    |
| `floor_height`           | number | 2.3, 2.6, 3.1, 4.1                                            |
| `building_roof`          | enum   | flat, oblique, steep                                          |
| `has_basement`           | bool   |                                                               |
| `has_balcony`            | bool   |                                                               |
| `wall_size`              | number | 20–200 (cm)                                                   |
| `number_doors`           | int    | min 1                                                         |
| `number_balcony_doors`   | int    | 0 gdy brak balkonu                                            |
| `number_windows`         | int    | min 0                                                         |
| `number_huge_windows`    | int    | min 0                                                         |
| `doors_type`             | enum   | old_wooden, old_metal, new_wooden, new_metal, new_pvc         |
| `windows_type`           | enum   | patrz słownik                                                 |
| `indoor_temperature`     | number | °C                                                            |
| `ventilation_type`       | enum   | natural, gravity, mechanical, mechanical_recovery             |
| `heating_type`           | enum   | underfloor, radiators, mixed                                  |
| `source_type`            | enum   | air_to_water_hp, gas, oil, biomass, district_heating          |
| `include_hot_water`      | bool   |                                                               |

#### Pola LUB (wzajemnie wykluczające się)

**Wymiary geometryczne:**

| Warunek              | Pola                                                  |
| -------------------- | ----------------------------------------------------- |
| regular + dimensions | `building_shape`, `building_length`, `building_width` |
| regular + area       | `building_shape`, `floor_area`                        |
| irregular            | `building_shape`, `floor_area`, `floor_perimeter`     |

**Materiał ścian:**

| Warunek                         | Pola                                         |
| ------------------------------- | -------------------------------------------- |
| construction_type = traditional | `primary_wall_material` (int)                |
| construction_type = canadian    | `internal_wall_isolation` { material, size } |

**CWU:**

| Warunek                   | Pola                                   |
| ------------------------- | -------------------------------------- |
| include_hot_water = true  | `hot_water_persons`, `hot_water_usage` |
| include_hot_water = false | brak tych pól                          |

#### Pola opcjonalne

| Pole                      | Typ    | Uwagi                                                          |
| ------------------------- | ------ | -------------------------------------------------------------- |
| `location_id`             | string | Patrz słownik                                                  |
| `latitude`, `longitude`   | number | Gdy podano location_id                                         |
| `garage_type`             | enum   | single_unheated, single_heated, double_unheated, double_heated |
| `external_wall_isolation` | object | { material, size }                                             |
| `top_isolation`           | object | { material, size }                                             |
| `bottom_isolation`        | object | { material, size }                                             |

#### Pola zależne od `building_type`

| building_type | Wymagane pola                                                             |
| ------------- | ------------------------------------------------------------------------- |
| apartment     | whats_over, whats_under, whats_north, whats_south, whats_east, whats_west |
| row_house     | on_corner                                                                 |
| multifamily   | number_stairways, number_elevators (opcjonalne)                           |

### 4.4 Obiekt `preferences`

```json
{
  "heating": {
    "emitterType": "underfloor",
    "sourceType": "air_to_water_hp",
    "indoorTemperatureC": 21,
    "ventilationType": "mechanical_recovery"
  },
  "dhw": {
    "enabled": true,
    "persons": 4,
    "usageProfile": "shower_bath"
  },
  "hasBuffer": true,
  "options": {}
}
```

**Uwaga:** Gdy `preferences.dhw.enabled === true`, wymagane jest `preferences.dhw.persons` > 0.

### 4.5 Obiekt `ozcResult` (opcjonalny)

Jeśli agent ma własny wynik OZC, może pominąć silnik OZC:

```json
"ozcResult": {
  "designHeatLoss_kW": 7.8,
  "heatedArea_m2": 123,
  "recommendedPower_kW": 8.1,
  "source": "external-agent"
}
```

| Pole                  | Wymagane | Walidacja           |
| --------------------- | -------- | ------------------- |
| `designHeatLoss_kW`   | tak      | 0 < wartość ≤ 500   |
| `heatedArea_m2`       | tak      | 0 < wartość ≤ 10000 |
| `recommendedPower_kW` | nie      |                     |
| `source`              | nie      |                     |

---

## 5. Słowniki wartości enum

### 5.1 building_type

| Wartość      | Opis                  |
| ------------ | --------------------- |
| single_house | Dom wolnostojący      |
| double_house | Bliźniak              |
| row_house    | Szeregowiec           |
| apartment    | Mieszkanie            |
| multifamily  | Budynek wielorodzinny |

### 5.2 construction_type

| Wartość     |
| ----------- |
| traditional |
| canadian    |

### 5.3 location_id

| Wartość                        | latitude | longitude |
| ------------------------------ | -------- | --------- |
| PL_GDANSK                      | 54.352   | 18.6466   |
| PL_KUJAWSKOPOMORSKIE_BYDGOSZCZ | 53.1235  | 18.0084   |
| PL_DOLNOSLASKIE_WROCLAW        | 51.1079  | 17.0385   |
| PL_STREFA_IV                   | 49.6216  | 20.697    |
| PL_ZAKOPANE                    | 49.2992  | 19.9496   |
| PL_STREFA_I                    | 54.352   | 18.6466   |
| PL_STREFA_II                   | 52.2297  | 21.0122   |
| PL_STREFA_III                  | 50.0647  | 19.945    |
| PL_STREFA_V                    | 49.2992  | 19.9496   |

### 5.4 ventilation_type

| Wartość             |
| ------------------- |
| natural             |
| gravity             |
| mechanical          |
| mechanical_recovery |

### 5.5 heating_type

| Wartość    |
| ---------- |
| underfloor |
| radiators  |
| mixed      |

### 5.6 source_type

| Wartość          |
| ---------------- |
| air_to_water_hp  |
| gas              |
| oil              |
| biomass          |
| district_heating |

### 5.7 building_roof

| Wartość |
| ------- |
| flat    |
| oblique |
| steep   |

### 5.8 doors_type

| Wartość    |
| ---------- |
| old_wooden |
| old_metal  |
| new_wooden |
| new_metal  |
| new_pvc    |

### 5.9 windows_type

| Wartość               |
| --------------------- |
| 2021_triple_glass     |
| 2021_double_glass     |
| new_triple_glass      |
| new_double_glass      |
| semi_new_double_glass |
| old_double_glass      |
| old_single_glass      |

### 5.10 hot_water_usage (gdy include_hot_water = true)

| Wartość     |
| ----------- |
| shower      |
| shower_bath |
| bath        |

### 5.11 primary_wall_material (construction_type = traditional)

| ID  | Materiał                                |
| --- | --------------------------------------- |
| 84  | Porotherm                               |
| 54  | Beton komórkowy (Ytong, H+H, Termalica) |
| 63  | Pustaki ceramiczne                      |
| 57  | Cegła pełna                             |
| 60  | Cegła silikatowa                        |
| 51  | Beton                                   |
| 52  | Żelbet                                  |
| 56  | Drewno iglaste                          |
| 55  | Drewno liściaste                        |
| 53  | Pustak żużlobetonowy                    |

### 5.12 Izolacje — material (dla external_wall_isolation, top_isolation, bottom_isolation)

| ID  | Materiał                  |
| --- | ------------------------- |
| 68  | Wełna mineralna           |
| 70  | Styropian (EPS)           |
| 88  | Styropian grafitowy       |
| 71  | Styropian XPS (styrodur)  |
| 94  | Wełna drzewna             |
| 95  | PIR                       |
| 86  | PUR natryskowy            |
| 101 | Multipor / inne mineralne |
| 82  | Puste powietrze           |

Przykład: `{ "material": 88, "size": 18 }` — styropian grafitowy 18 cm.

---

## 6. Odpowiedzi

### 6.1 Sukces (200)

Zwracany jest obiekt OfferDTO z m.in.:

- `engineering` — wyniki OZC, dobór pompy, bufora
- `pricing` — ceny
- `warnings`, `assumptions`, `reasonCodes`

### 6.2 Błędy

| Status | code               | Opis                          |
| ------ | ------------------ | ----------------------------- |
| 400    | VALIDATION_ERROR   | Błąd walidacji CalcRequestDTO |
| 401    | AUTH_REQUIRED      | Brak autoryzacji              |
| 403    | NONCE_INVALID      | Nieprawidłowy nonce           |
| 403    | AGENT_KEY_INVALID  | Nieprawidłowy agent key       |
| 429    | RATE_LIMITED       | Przekroczony limit żądań      |
| 500    | CALCULATION_FAILED | Błąd obliczeń                 |

Format błędu:

```json
{
  "traceId": "...",
  "errorCode": "VALIDATION_ERROR",
  "message": "Invalid CalcRequestDTO payload.",
  "details": {
    "errors": [
      {
        "field": "building.geometry",
        "code": "REQUIRED_ONE_OF",
        "message": "Provide positive area in one of: building.heated_area, building.floor_area, building.total_area, or provide both building.building_length and building.building_width."
      }
    ]
  }
}
```

---

## 7. Przykładowe wywołanie (cURL)

```bash
curl -X POST "https://twoja-domena.pl/wp-json/topinstal/v1/calculate-offer" \
  -H "Content-Type: application/json" \
  -H "X-Top-Instal-Agent-Key: TWOJ_AGENT_KEY" \
  -d '{
    "schemaVersion": "1.0",
    "traceId": "agent-001",
    "lead": {},
    "building": {
      "building_type": "single_house",
      "construction_year": 2011,
      "construction_type": "traditional",
      "location_id": "PL_STREFA_III",
      "latitude": 50.0647,
      "longitude": 19.945,
      "building_shape": "regular",
      "building_length": 12,
      "building_width": 10,
      "building_floors": 2,
      "building_heated_floors": [1, 2],
      "floor_height": 2.6,
      "building_roof": "oblique",
      "has_basement": true,
      "has_balcony": true,
      "wall_size": 44,
      "primary_wall_material": 84,
      "external_wall_isolation": { "material": 88, "size": 18 },
      "top_isolation": { "material": 68, "size": 25 },
      "bottom_isolation": { "material": 88, "size": 15 },
      "number_doors": 1,
      "number_balcony_doors": 1,
      "number_windows": 12,
      "number_huge_windows": 0,
      "doors_type": "new_pvc",
      "windows_type": "new_double_glass",
      "indoor_temperature": 21,
      "ventilation_type": "mechanical_recovery",
      "heating_type": "underfloor",
      "source_type": "air_to_water_hp",
      "include_hot_water": true,
      "hot_water_persons": 4,
      "hot_water_usage": "shower_bath"
    },
    "preferences": {
      "heating": {
        "emitterType": "underfloor",
        "sourceType": "air_to_water_hp",
        "indoorTemperatureC": 21,
        "ventilationType": "mechanical_recovery"
      },
      "dhw": {
        "enabled": true,
        "persons": 4,
        "usageProfile": "shower_bath"
      },
      "hasBuffer": true,
      "options": {}
    },
    "context": { "source": "agent" }
  }'
```

---

## 8. Minimalny poprawny payload

Dla szybkiego testu (silniki używają fallbacków):

```json
{
  "schemaVersion": "1.0",
  "traceId": "agent-minimal",
  "lead": {},
  "building": {
    "floor_area": 100,
    "construction_year": 2011,
    "building_type": "single_house",
    "location_id": "PL_STREFA_III",
    "include_hot_water": false
  },
  "preferences": {
    "heating": { "emitterType": "underfloor", "sourceType": "air_to_water_hp" },
    "dhw": { "enabled": false, "persons": null, "usageProfile": null },
    "hasBuffer": true,
    "options": {}
  }
}
```

**Uwaga:** Minimalny payload może dawać mniej precyzyjne wyniki. Pełne obliczenia wymagają wszystkich pól z sekcji 4.3.

---

## 9. Powiązane dokumenty

- `docs/contracts/payload-field-classification.md` — klasyfikacja pól (ZAWSZE / LUB / OPCJONALNIE)
- `docs/fixtures/dom-jednorodzinny-payloady-przykladowe.json` — przykładowe payloady
- `docs/fixtures/dom-jednorodzinny-wszystkie-payloady.json` — 1149 wariantów (generator: `npm run generate:dom-payloads`)
- `docs/ecosystem/AGENT_BUSINESS_TOOLS.md` — narzędzia agenta biznesowego
