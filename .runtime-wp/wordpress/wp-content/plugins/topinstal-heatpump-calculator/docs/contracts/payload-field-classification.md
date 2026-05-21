# Klasyfikacja pol payloadu (building) - buildJsonData

> Status: canonical
> Owner: TOP-INSTAL contract/form-flow owner
> Last verified against code/runtime: 2026-04-03 (metadata normalization pass)
> Source-of-truth level: L1
> Supersedes: none
> Related docs: `field-mapping.md`, `../../kalkulator/js/formDataProcessor.js`, `../SOURCE_OF_TRUTH_INDEX.md`

Zrodlo: `kalkulator/js/formDataProcessor.js` (`buildJsonData`).

Dokument opisuje, ktore pola **zawsze** trafiaja do payloadu, ktore sa **warunkowe (LUB)**, a ktore **opcjonalnie**.

---

## 1. Pola ZAWSZE w payloadzie

Te pola są zawsze przypisywane (z wartością lub domyślną). Nie są usuwane przed wysłaniem.

| Pole                     | Uwagi                                                               |
| ------------------------ | ------------------------------------------------------------------- |
| `building_type`          | enum: single_house, double_house, row_house, apartment, multifamily |
| `construction_year`      | integer (np. 2011, 1990)                                            |
| `construction_type`      | enum: traditional, canadian                                         |
| `building_floors`        | integer (1–4)                                                       |
| `building_heated_floors` | array[int] (np. [1, 2])                                             |
| `floor_height`           | number (2.3, 2.6, 3.1, 4.1)                                         |
| `building_roof`          | enum: flat, oblique, steep                                          |
| `has_basement`           | boolean                                                             |
| `has_balcony`            | boolean                                                             |
| `wall_size`              | number (20–200 cm)                                                  |
| `number_doors`           | integer, domyślnie 1                                                |
| `number_balcony_doors`   | integer, 0 gdy has_balcony=false, 1 gdy true (lub z formularza)     |
| `number_windows`         | integer, domyślnie 0                                                |
| `number_huge_windows`    | integer, domyślnie 0                                                |
| `doors_type`             | enum, domyślnie `new_wooden` gdy brak wyboru                        |
| `windows_type`           | enum                                                                |
| `indoor_temperature`     | number (°C)                                                         |
| `ventilation_type`       | enum: natural, gravity, mechanical, mechanical_recovery             |
| `heating_type`           | enum: underfloor, radiators, mixed                                  |
| `source_type`            | enum: air_to_water_hp, gas, oil, biomass, district_heating          |
| `include_hot_water`      | boolean                                                             |

**Uwaga:** `building_shape` jest ustawiane dla irregular i dla regular+dimensions; dla regular+area w obecnej implementacji może nie być ustawiane (tylko `floor_area`).

---

## 2. Pola LUB (wzajemnie wykluczajÄ…ce siÄ™)

W payloadzie pojawia się **albo** jedna grupa **albo** druga — nigdy obie naraz.

### 2.1 Wymiary geometryczne (building_shape)

| Warunek                                                    | Pola w payloadzie                                     |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| `building_shape = regular` + `regular_method = dimensions` | `building_shape`, `building_length`, `building_width` |
| `building_shape = regular` + `regular_method = area`       | `building_shape`, `floor_area`                        |
| `building_shape = irregular`                               | `building_shape`, `floor_area`, `floor_perimeter`     |

**Reguła:** Albo `(building_length + building_width)` LUB `floor_area`. Dla irregular dodatkowo wymagane `floor_perimeter`.

### 2.2 Materiał ścian (construction_type)

| Warunek                           | Pola w payloadzie                                       |
| --------------------------------- | ------------------------------------------------------- |
| `construction_type = traditional` | `primary_wall_material` (wymagane)                      |
| `construction_type = canadian`    | `internal_wall_isolation` { material, size } (wymagane) |

**Reguła:** Albo `primary_wall_material` LUB `internal_wall_isolation` — nigdy oba.

### 2.3 CWU (include_hot_water)

| Warunek                     | Pola w payloadzie                                     |
| --------------------------- | ----------------------------------------------------- |
| `include_hot_water = true`  | `hot_water_persons`, `hot_water_usage` (oba wymagane) |
| `include_hot_water = false` | brak tych pĂłl                                         |

**Reguła:** Gdy CWU wyłączone — `hot_water_persons` i `hot_water_usage` nie trafiają do payloadu (nic zamiast nich).

---

## 3. Pola OPCJONALNE

Trafiają do payloadu **tylko gdy** użytkownik wybrał/wypełnił. Gdy brak — pole **nie jest dodawane** (brak klucza).

| Pole                        | Warunek dodania                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `location_id`               | użytkownik wybrał lokalizację                                                                           |
| `latitude`, `longitude`     | gdy jest `location_id` (mapowanie z locationMap)                                                        |
| `garage_type`               | użytkownik wybrał inny niż "brak" (none → nie dodajemy)                                                 |
| `secondary_wall_material`   | `has_secondary_wall_material = true` i wartość > 0                                                      |
| `external_wall_isolation`   | tryb szczegółowy: `has_external_isolation = yes` + material+size                                        |
| `top_isolation`             | tryb szczegółowy: `top_isolation = yes` + material+size LUB poziom uproszczony (average/good/very_good) |
| `bottom_isolation`          | tryb szczegółowy: `bottom_isolation = yes` + material+size LUB poziom uproszczony                       |
| `internal_wall_isolation`   | tylko canadian (wymagane) LUB traditional + `has_internal_isolation = true`                             |
| `unheated_space_under_type` | enum: worst, poor, medium, great                                                                        |
| `unheated_space_over_type`  | enum: worst, poor, medium, great                                                                        |
| `number_stairways`          | building_type = multifamily                                                                             |
| `number_elevators`          | building_type = multifamily                                                                             |
| `on_corner`                 | building_type = row_house (wymagane dla row_house)                                                      |

---

## 4. Pola WARUNKOWE (tylko dla danego building_type)

| Pole                                                                                  | building_type | Uwagi                   |
| ------------------------------------------------------------------------------------- | ------------- | ----------------------- |
| `whats_over`, `whats_under`, `whats_north`, `whats_south`, `whats_east`, `whats_west` | apartment     | wymagane dla mieszkania |
| `on_corner`                                                                           | row_house     | wymagane dla szeregowca |
| `number_stairways`, `number_elevators`                                                | multifamily   | opcjonalne              |

---

## 5. Pola NIGDY nie trafiajÄ…ce do payloadu

Są zbierane w UI, ale **usuwane** przed wysłaniem (konwertowane na inne pola lub tylko do walidacji):

| Pole                                                                                                      | PowĂłd                                                           |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `walls_insulation_level`                                                                                  | konwertowane na `external_wall_isolation` { material, size }    |
| `roof_insulation_level`                                                                                   | konwertowane na `top_isolation`                                 |
| `floor_insulation_level`                                                                                  | konwertowane na `bottom_isolation`                              |
| `detailed_insulation_mode`                                                                                | tylko UX, nie API                                               |
| `has_external_isolation`, `has_internal_isolation`, `top_isolation` (yes/no), `bottom_isolation` (yes/no) | kontrolują widoczność; do payloadu trafiają tylko material+size |

---

## 6. Czyszczenie końcowe

Przed wysłaniem **wszystkie** pola o wartości `null` lub `undefined` są **usuwane** z obiektu. API nie akceptuje null.

```javascript
Object.keys(data).forEach((key) => {
  if (data[key] === null || data[key] === undefined) {
    delete data[key];
  }
});
```

---

## 7. Podsumowanie — drzewo decyzyjne

```
building_shape?
├── regular
│   ├── regular_method=dimensions → building_length, building_width
│   └── regular_method=area       → floor_area
└── irregular
    └── floor_area, floor_perimeter

construction_type?
├── traditional → primary_wall_material (wymagane)
└── canadian   → internal_wall_isolation (wymagane)

include_hot_water?
├── true  → hot_water_persons, hot_water_usage (wymagane)
└── false → (brak tych pól)

garage_type?
├── none/brak → (brak pola)
└── inny      → garage_type

location_id wybrane? → location_id, latitude, longitude
```

---

## 8. Mapowanie na CalcRequestDTO

Payload `building` z buildJsonData trafia do `CalcRequestDTO.building`. Dodatkowo `mapUiStateToCalcRequestDTO` mapuje:

- `preferences.dhw.enabled` ← `building.include_hot_water`
- `preferences.dhw.persons` ← `building.hot_water_persons`
- `preferences.dhw.usageProfile` ← `building.hot_water_usage`
- `preferences.heating.*` ← odpowiednie pola z building
