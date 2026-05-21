# Nowe wejścia do kalkulacji oferty przez `calculate-offer`

> Status: canonical
> Owner: TOP-INSTAL contract and integration guidance
> Last verified against code/runtime: 2026-04-02 (validator, mapper, fixture, contract doc audit)
> Source-of-truth level: L1
> Supersedes: none
> Related docs: `docs/contracts/API_CALCULATE_OFFER.md`, `docs/contracts/agent-calculate-offer-instruction.md`, `docs/SOURCE_OF_TRUTH_INDEX.md`

Kanoniczna instrukcja dla wszystkich sposobów wprowadzania danych do kalkulacji oferty TOP-INSTAL w repozytorium `kalk-top`.

## 1. Streszczenie wykonawcze

Ten dokument jest dla:

- osób biznesowych planujących nowe formularze,
- programistów budujących integracje,
- integratorów WordPress / landing page / CRM,
- autorów promptów i agentów AI,
- osób utrzymujących kontrakt `CalcRequestDTO -> OfferDTO`.

Złota zasada jest jedna:

1. Niezależnie od źródła danych, kalkulacja oferty zawsze kończy się na tym samym backendzie.
2. Backend przyjmuje `CalcRequestDTO` przez `POST /wp-json/topinstal/v1/calculate-offer`.
3. Backend zwraca `OfferDTO`.
4. Frontend, szybki formularz, mail-ingress i agent AI nie powinny liczyć oferty samodzielnie.
5. Nowe wejście to nie nowy silnik, tylko nowe mapowanie do istniejącego kontraktu.
6. Istnieje twarde minimum HTTP walidowane przez runtime oraz osobna kwestia dokładności biznesowej.
7. Szybkie formularze mogą dawać wyniki orientacyjne, jeśli jawnie używają profili domyślnych i komunikują założenia.
8. Agent AI nie ma osobnego API: też musi domknąć dane do poprawnego JSON-a.
9. `ozcResult` jest ścieżką specjalną dla zaufanego zewnętrznego wyniku OZC, nie zamiennikiem całego DTO.
10. `traceId` i `context` warto traktować jako obowiązkowe operacyjnie, nawet jeśli technicznie są opcjonalne.
11. Zmiany DTO, auth, trace lub odpowiedzi mogą wpływać na inne repozytoria TOP-INSTAL.
12. Przy wywołaniu REST trzymaj się runtime truth, nawet jeśli starsze schema JSON pokazują coś innego.

### Słowniczek

| Skrót / termin | Znaczenie |
| --- | --- |
| `DTO` | Data Transfer Object; ustalony kształt danych przesyłanych między warstwami |
| `CalcRequestDTO` | Kanoniczny request wejściowy do kalkulacji oferty |
| `OfferDTO` | Kanoniczna odpowiedź zwracana przez backend |
| `OZC` | Obliczenie zapotrzebowania cieplnego / strat ciepła budynku |
| `CWU` | Ciepła woda użytkowa |
| `DHW` | Domestic Hot Water; w kontrakcie API odpowiednik CWU |
| `traceId` | Identyfikator śledzenia requestu między warstwami |
| `context` | Metadane techniczne i operacyjne requestu |
| `nonce` | Token WordPress do autoryzacji żądań sesyjnych/browserowych |
| `agent key` | Sekret serwer-serwer dla integracji zewnętrznych |
| `runtime truth` | Faktyczne zachowanie działającego backendu i walidatora REST |

## 2. Model mentalny

Najprostszy poprawny model:

`dowolne wejście danych -> mapowanie do CalcRequestDTO -> POST calculate-offer -> OfferDTO -> render wyniku`

Z tego wynikają cztery ważne konsekwencje:

1. `kalk-top` jest warstwą decyzyjną i źródłem prawdy dla kalkulacji, doboru, bufora, cen i oferty.
2. Nowe wejścia nie powinny duplikować logiki obliczeniowej w JavaScript, promptach AI ani w repozytoriach pobocznych.
3. Widoczna wycena i inżynieria muszą pochodzić z backendu, nie z lokalnych heurystyk UI.
4. Jeśli wejście jest uproszczone, upraszczasz sposób zebrania danych, a nie kontrakt backendu.

W praktyce istnieją trzy warstwy pracy:

- warstwa wejścia: formularz, agent AI, import, mail-ingress,
- warstwa mapowania: budowa poprawnego `CalcRequestDTO`,
- warstwa obliczeń: backend `calculate-offer`.

## 3. Endpoint

### Kanoniczna granica systemu

- metoda: `POST`
- ścieżka: `/wp-json/topinstal/v1/calculate-offer`
- `Content-Type`: `application/json`

Przykład:

`https://twoja-domena.pl/wp-json/topinstal/v1/calculate-offer`

Jeżeli WordPress działa w subkatalogu lub za reverse proxy, zmienia się baza URL, ale sama ścieżka REST pozostaje taka sama.

### `schemaVersion`

Przy wywołaniu REST używaj:

- `schemaVersion: "1.0"`

To jest runtime truth potwierdzony przez:

- `wp-adapter/rest/RequestValidator.php`,
- `frontend/api/mapUiStateToCalcRequestDTO.js`,
- fixture'y harnessu,
- `core/application/CalculateOfferUseCase.php`.

### Ważna niespójność dokumentacyjna

Pliki schema JSON:

- `docs/ecosystem/schemas/calc-request-dto.v1.json`
- `docs/ecosystem/schemas/offer-dto.v1.json`

mają nadal:

- `const: "1"`

To jest niespójne z działającym runtime, który wymaga i zwraca:

- `"1.0"`

Wniosek praktyczny:

- dla HTTP REST i integracji trzymaj się zawsze `"1.0"`;
- traktuj schema JSON jako dokumentację pomocniczą, nie jako źródło prawdy dla tego pola.

## 4. Autoryzacja

Runtime dopuszcza dwa modele auth.

### 4.1 Agent key

Rekomendowana ścieżka dla:

- integracji zewnętrznych,
- agentów AI,
- połączeń serwer-serwer,
- narzędzi automatycznych,
- orchestratora i innych backendów.

Akceptowane nagłówki:

- `X-Top-Instal-Agent-Key`
- `X-Topinstal-Agent-Key`

Konfiguracja po stronie WordPress / runtime:

- opcja `topinstal_calc_agent_api_key`
- env/constant `TOPINSTAL_CALC_AGENT_API_KEY`

Kompatybilność legacy:

- jeśli główny klucz nie jest ustawiony, runtime potrafi fallbackować do aliasu `TOP_INSTAL_AGENT_API_KEY`
- to jest ścieżka zgodności wstecznej; nowe wdrożenia powinny używać `topinstal_calc_agent_api_key` / `TOPINSTAL_CALC_AGENT_API_KEY`

### 4.2 Nonce

Ścieżka dla:

- przeglądarki,
- sesji WordPress,
- wywołań wykonywanych z runtime UI.

Akceptowane nagłówki:

- `X-Topinstal-Nonce`
- `X-WP-Nonce`

Dodatkowo runtime akceptuje parametr:

- `nonce`

Uwaga praktyczna:

- publiczne docs preferują `X-Topinstal-Nonce`,
- kod kontrolera sprawdza oba nagłówki,
- dla nowych integracji zewnętrznych nie opieraj się na nonce, tylko na agent key.

### 4.3 Statusy auth

| Sytuacja | HTTP | `errorCode` |
| --- | --- | --- |
| brak nonce i brak agent key | `401` | `AUTH_REQUIRED` |
| nonce podany, ale niepoprawny | `403` | `NONCE_INVALID` |
| agent key podany, ale niepoprawny | `403` | `AGENT_KEY_INVALID` |

## 5. Rate limiting i błędy

### 5.1 Rate limiting

Domyślny rate limit runtime:

- okno: `60` sekund
- limit: `45` requestów na IP w oknie

Nagłówki odpowiedzi:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Window`
- `X-RateLimit-Reset-In`
- `Retry-After` przy `429`

Uwaga:

- wartości mogą być filtrowane po stronie WordPress przez hooki, więc są domyślne, a nie absolutnie gwarantowane dla każdego wdrożenia.

### 5.2 Standardowe błędy REST

| HTTP | `errorCode` | Znaczenie |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | payload nie spełnia kontraktu runtime |
| `401` | `AUTH_REQUIRED` | brak poprawnej autoryzacji |
| `403` | `NONCE_INVALID` | niepoprawny nonce |
| `403` | `AGENT_KEY_INVALID` | niepoprawny agent key |
| `429` | `RATE_LIMITED` | przekroczony limit żądań |
| `500` | `CALCULATION_FAILED` | błąd wykonania po stronie serwera |

Format błędu:

```json
{
  "traceId": "example-trace",
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

### 5.3 Nagłówki śledzenia

Przy poprawnej i błędnej odpowiedzi runtime ustawia:

- `X-Topinstal-Trace-Id`

Jeżeli nie przekażesz `traceId`, backend wygeneruje go sam.

## 6. `CalcRequestDTO`

### 6.1 Drzewo pól

```text
CalcRequestDTO
├── schemaVersion
├── traceId (opcjonalne, ale zalecane)
├── lead
│   ├── name
│   ├── contact
│   │   ├── email
│   │   ├── phone
│   │   ├── postalCode
│   │   └── preferredContactTime
│   ├── consents
│   └── intent
├── building
├── preferences
│   ├── heating
│   ├── dhw
│   ├── hasBuffer
│   └── options
├── context
└── ozcResult (opcjonalne)
```

### 6.2 Top-level

| Pole | Wymagane | Uwagi |
| --- | --- | --- |
| `schemaVersion` | tak | przy REST dokładnie `"1.0"` |
| `traceId` | nie | string do 128 znaków; operacyjnie zalecane zawsze |
| `lead` | tak | obiekt; może być pusty |
| `building` | tak | obiekt; zawiera geometrię i parametry budynku |
| `preferences` | tak | obiekt; ogrzewanie, DHW/CWU, bufor, opcje |
| `context` | nie | obiekt metadanych |
| `ozcResult` | nie | opcjonalny zewnętrzny wynik OZC |

### 6.3 `lead`

Runtime nie waliduje szczegółowej struktury `lead`, wymaga tylko obiektu. W praktyce warto używać stabilnych pól:

- `name`
- `contact.email`
- `contact.phone`
- `contact.postalCode`
- `contact.preferredContactTime`
- `consents`
- `intent`

Fixture'y pokazują też dodatki typu:

- `sessionId`

Wniosek:

- kontrakt jest addytywny i luźny transportowo,
- dla współdzielonych integracji trzymaj się nazw kanonicznych z mappera i docs.

### 6.4 `building`

To główny nośnik danych technicznych. HTTP validator sprawdza tylko część pól, ale silniki korzystają z dużo bogatszego zestawu.

### 6.5 `preferences`

Typowy kształt:

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

### 6.6 `context`

Traktuj `context` jako bezpieczne miejsce na metadane operacyjne, np.:

- `source`
- `channel`
- `requestId`
- `profileId`
- `pluginVersion`
- `uiVersion`
- `agent`
- `agentVersion`
- `mode`

### 6.7 `ozcResult`

Opcjonalne. Szczegóły w sekcji 12.

## 7. Walidacja HTTP (twarde minimum)

Poniższe reguły wynikają bezpośrednio z `wp-adapter/rest/RequestValidator.php` i to one są źródłem prawdy dla REST.

### 7.1 Reguły top-level

1. Body musi być obiektem JSON.
2. `schemaVersion` musi istnieć, być niepustym stringiem i mieć wartość dokładnie `"1.0"`.
3. `lead` musi być obiektem.
4. `building` musi być obiektem.
5. `preferences` musi być obiektem.
6. `traceId`, jeśli podane, musi być stringiem długości maksymalnie 128 znaków.
7. `context`, jeśli podane, musi być obiektem.

### 7.2 Reguły `building`

HTTP validator wymaga geometrii budynku w jednej z dwóch postaci:

1. dodatnie pole powierzchni:
   - `heated_area`, lub
   - `floor_area`, lub
   - `total_area`
2. albo komplet dodatnich wymiarów:
   - `building_length`
   - `building_width`

Dodatkowe reguły HTTP:

- jeśli `building_length` lub `building_width` są podane, muszą być numeryczne;
- jeśli są podane, muszą być `> 0`;
- `construction_year`, jeśli podany, musi być numeryczny i w zakresie `1800-2100`;
- `include_hot_water`, jeśli podane, musi być boolean-like.

### 7.3 Reguły `preferences`

1. `preferences.heating` musi być obiektem.
2. `preferences.dhw` musi być obiektem.
3. `preferences.hasBuffer`, jeśli podane, musi być boolean-like.
4. `preferences.dhw.enabled`, jeśli podane, musi być boolean-like.
5. Jeśli `preferences.dhw.enabled === true`, to `preferences.dhw.persons` musi być numeryczne i `> 0`.

### 7.4 Reguły `ozcResult`

1. `ozcResult`, jeśli podane i nie jest `null`, musi być obiektem.
2. Jeśli `ozcResult` jest obiektem niepustym, walidator wymaga:
   - `designHeatLoss_kW` numeryczne w zakresie `(0, 500]`
   - `heatedArea_m2` numeryczne w zakresie `(0, 10000]`

### 7.5 Co znaczy `boolean-like`

Runtime akceptuje jako bool-like:

- `true` / `false`
- `1` / `0`
- `"1"` / `"0"`
- `"true"` / `"false"`
- `"yes"` / `"no"`

Rekomendacja:

- w nowych integracjach wysyłaj prawdziwe typy JSON, czyli booleany i liczby, a nie stringi.

### 7.6 Czego validator nie robi

To ważne dla projektowania nowych wejść:

- validator nie wymaga pełnego zestawu pól „jak z dużego formularza”;
- validator nie wymaga większości enumów, izolacji, stolarki, kondygnacji itp.;
- validator nie sprawdza wielu zależności biznesowych znanych z UI;
- to, że payload przejdzie HTTP, nie znaczy jeszcze, że wynik będzie dokładny.

## 8. Pola budynku i preferencji

Ta sekcja syntetyzuje:

- `docs/contracts/field-mapping.md`
- `docs/contracts/payload-field-classification.md`
- rzeczywiste zachowanie mappera UI

Kluczowe rozróżnienie:

- `ZAWSZE / LUB / opcjonalne` opisuje głównie to, jak pełny formularz buduje payload,
- nie oznacza to automatycznie twardego minimum HTTP.

### 8.1 `building`: pola zwykle obecne w pełnym formularzu

| Pole | Znaczenie |
| --- | --- |
| `building_type` | typ budynku |
| `construction_year` | rok budowy |
| `construction_type` | typ konstrukcji |
| `building_floors` | liczba kondygnacji |
| `building_heated_floors` | ogrzewane kondygnacje |
| `floor_height` | wysokość kondygnacji |
| `building_roof` | typ dachu |
| `has_basement` | piwnica |
| `has_balcony` | balkon |
| `wall_size` | grubość ściany |
| `number_doors` | liczba drzwi |
| `number_balcony_doors` | liczba drzwi balkonowych |
| `number_windows` | liczba okien |
| `number_huge_windows` | duże przeszklenia |
| `doors_type` | typ drzwi |
| `windows_type` | typ okien |
| `indoor_temperature` | temperatura wewnętrzna |
| `ventilation_type` | wentylacja |
| `heating_type` | typ emitera ciepła |
| `source_type` | źródło ciepła |
| `include_hot_water` | czy uwzględniać CWU |

### 8.2 `building`: pola geometrii typu LUB

| Wariant | Pola |
| --- | --- |
| regular + dimensions | `building_shape`, `building_length`, `building_width` |
| regular + area | `building_shape`, `floor_area` |
| irregular | `building_shape`, `floor_area`, `floor_perimeter` |

Praktyczna uwaga:

- validator HTTP wymaga tylko dodatniej powierzchni lub długości + szerokości;
- pełny UI niesie dodatkową semantykę `building_shape` i `floor_perimeter`.

### 8.3 `building`: pola zależne od konstrukcji

| Warunek | Pole |
| --- | --- |
| `construction_type = traditional` | `primary_wall_material` |
| `construction_type = canadian` | `internal_wall_isolation` |

### 8.4 `building`: pola zależne od CWU

| Warunek | Pola |
| --- | --- |
| `include_hot_water = true` | `hot_water_persons`, `hot_water_usage` |
| `include_hot_water = false` | brak tych pól w pełnym payloadzie UI |

### 8.5 `building`: pola opcjonalne

| Pole | Uwagi |
| --- | --- |
| `location_id` | strefa / lokalizacja |
| `latitude`, `longitude` | współrzędne powiązane z lokalizacją |
| `garage_type` | typ garażu |
| `external_wall_isolation` | izolacja ścian zewnętrznych |
| `top_isolation` | izolacja góry |
| `bottom_isolation` | izolacja dołu |
| `secondary_wall_material` | materiał wtórny ścian |
| `unheated_space_under_type` | przestrzeń nieogrzewana pod budynkiem |
| `unheated_space_over_type` | przestrzeń nieogrzewana nad budynkiem |

### 8.6 `building`: pola zależne od typu budynku

| `building_type` | Dodatkowe pola w logice UI |
| --- | --- |
| `apartment` | `whats_over`, `whats_under`, `whats_north`, `whats_south`, `whats_east`, `whats_west` |
| `row_house` | `on_corner` |
| `multifamily` | `number_stairways`, `number_elevators` |

Uwaga:

- te zależności są opisem pełniejszego modelu danych,
- validator REST nie egzekwuje ich twardo na poziomie HTTP.

### 8.7 `preferences`

| Pole | Znaczenie |
| --- | --- |
| `preferences.heating.emitterType` | typ emitera, np. `underfloor` |
| `preferences.heating.sourceType` | źródło ciepła |
| `preferences.heating.indoorTemperatureC` | temperatura wewnętrzna |
| `preferences.heating.ventilationType` | typ wentylacji |
| `preferences.dhw.enabled` | czy CWU jest włączone |
| `preferences.dhw.persons` | liczba osób dla CWU |
| `preferences.dhw.usageProfile` | profil użycia CWU |
| `preferences.hasBuffer` | preferencja bufora |
| `preferences.options` | wybrane opcje konfiguratora |

### 8.8 `preferences.options`: wspierane klucze

Backend sanitizuje `preferences.options` do wspieranego zbioru. Utrzymywane klucze:

- `pumpOptionId`
- `dhwOptionId`
- `bufferOptionId`
- `circulationOptionId`
- `pressureReducerOptionId`
- `waterTreatmentOptionId`
- `foundationOptionId`
- `serviceOptionId`

Wniosek:

- inne własne klucze konfiguracyjne nie powinny być traktowane jako część stabilnego kontraktu ofertowego.

## 9. `OfferDTO` (skrót)

Klient dostaje z backendu odpowiedź, którą należy traktować jako źródło prawdy dla wyniku.

### 9.1 Minimalny kształt odpowiedzi

| Pole | Znaczenie |
| --- | --- |
| `schemaVersion` | wersja kontraktu odpowiedzi; runtime zwraca `"1.0"` |
| `traceId` | identyfikator requestu |
| `engineering` | wyniki obliczeń i doboru |
| `pricing` | ceny i sumy |
| `warnings` | ostrzeżenia |
| `assumptions` | założenia |
| `engineMeta` | metadane silników i fallbacków |

### 9.2 `engineering`

Najważniejsze poddrzewa:

- `engineering.ozc`
- `engineering.selection`
- `engineering.buffer`
- `engineering.cwu`

Przykładowe informacje:

- `engineering.ozc.designHeatLoss_kW`
- `engineering.ozc.recommendedPower_kW`
- `engineering.ozc.heatedArea_m2`
- `engineering.ozc.audit`
- `engineering.ozc.metrics`
- `engineering.ozc.extended`
- `engineering.selection.pumpModel`
- `engineering.selection.reasonCodes`
- `engineering.buffer.liters`
- `engineering.buffer.setupType`
- `engineering.buffer.explanation`
- `engineering.cwu.recommendedCapacityL`
- `engineering.cwu.pricingHint`

### 9.3 `pricing`

Najważniejsze pola:

- `currency`
- `items[]`
- `totals`
- `source`
- `catalogVersion`

W praktyce:

- `pricing.source` powinno wskazywać backendowy pricebook,
- `pricing.catalogVersion` pomaga śledzić, z jakiej wersji danych pochodzi oferta.

### 9.4 `warnings`, `assumptions`, `engineMeta`

To są kluczowe pola dla szybkich formularzy i AI:

- `warnings` tłumaczą ryzyka, braki lub ograniczenia,
- `assumptions` pokazują, jakie założenia przyjęto,
- `engineMeta` mówi, czy weszły fallbacki i z jakiej wersji danych/silników korzystano.

Jeśli budujesz wynik orientacyjny:

- nie ukrywaj tych pól,
- pokaż je w prostszej formie biznesowej.

## 10. Szybkie formularze i profile

### 10.1 Zasada

Szybki formularz może zbierać mniej danych niż pełny formularz, ale musi kończyć się poprawnym `CalcRequestDTO`.

To oznacza:

1. zbierasz tylko najważniejsze informacje od użytkownika,
2. brakujące dane uzupełniasz według jawnych reguł,
3. wysyłasz backendowi poprawny request,
4. wynik komunikujesz jako szacunek / przybliżenie.

### 10.2 Co zwykle warto zebrać w szybkim formularzu

Typowy zestaw:

- powierzchnia,
- rok budowy,
- lokalizacja lub strefa klimatyczna,
- typ ogrzewania: podłogówka / grzejniki / mieszane,
- czy liczyć CWU,
- liczba osób,
- obecne źródło ciepła.

### 10.3 Profile domyślne

Najlepszy wzorzec to nie „milczące zgadywanie”, tylko profile, np.:

- dom starszy,
- dom po termomodernizacji,
- dom nowy,
- mieszkanie,
- budynek z podłogówką,
- budynek z grzejnikami.

Profil może definiować m.in.:

- stolarkę,
- izolacje,
- konstrukcję,
- typ dachu,
- wysokość kondygnacji,
- typowe wartości CWU,
- domyślne pola niezbędne dla pełniejszego wejścia.

### 10.4 Jak komunikować wynik

Wynik z szybkiego formularza powinien być opisany np. jako:

- wynik orientacyjny,
- oferta wstępna,
- rekomendacja przybliżona,
- wycena oparta na założeniach.

Warto wyświetlić:

- skrócone `warnings`,
- skrócone `assumptions`,
- informację, że pełny formularz daje większą dokładność.

### 10.5 Dobre praktyki dla szybkich formularzy

1. Trzymaj mały zestaw pytań.
2. Miej jawny słownik profili i defaultów.
3. Zapisuj `profileId` lub podobne pole w `context`.
4. Używaj `traceId`, aby rozróżniać źródła wejścia.
5. Nie twórz osobnej logiki liczącej po stronie frontu.

## 11. Agent AI

### 11.1 Brak osobnego API

Agent AI używa tego samego endpointu co formularz:

- `POST /wp-json/topinstal/v1/calculate-offer`

Nie istnieje osobny „tryb AI” po stronie backendu.

### 11.2 Trzy tryby danych

#### A. Dane kompletne

Agent ma komplet informacji porównywalny z pełnym formularzem:

- mapuje dane 1:1 do `CalcRequestDTO`,
- wysyła request,
- zwraca wynik.

#### B. Dane częściowo niepełne

Agent ma większość danych, ale część pól jest nieznana:

- powinien uzupełnić braki zgodnie z polityką defaultów,
- albo dopytać użytkownika,
- albo wyraźnie oznaczyć przyjęte założenia.

#### C. Dane szczątkowe

Agent zna tylko kilka faktów, np.:

- powierzchnię,
- miasto,
- rok budowy,
- liczbę osób.

Wtedy agent nadal może policzyć orientacyjny wynik, ale tylko jeśli:

- domknie dane do poprawnego JSON-a,
- dołoży brakujące pola ze zdefiniowanych profili,
- nie wyśle do API luźnego opisu tekstowego.

### 11.3 Minimalna polityka dla agenta

Rekomendowany algorytm:

1. Wyodrębnij dane pewne.
2. Oznacz dane nieznane.
3. Uzupełnij je profilem lub regułami.
4. Zbuduj poprawny `CalcRequestDTO`.
5. Ustaw `traceId`.
6. Dodaj metadane w `context`:
   - źródło,
   - nazwa agenta,
   - wersja promptu,
   - tryb `estimate` / `full`,
   - identyfikator profilu.
7. Wyślij request.
8. Przedstaw wynik razem z założeniami.

### 11.4 Co powinien robić prompt / orchestrator AI

Dobry prompt lub warstwa pośrednia powinna wymuszać:

- wynik końcowy jako JSON zgodny z kontraktem,
- jawne rozróżnienie między danymi pewnymi i założonymi,
- brak liczenia po stronie modelu,
- brak samowolnego wymyślania cen lub mocy poza backendem.

## 12. `ozcResult`

### 12.1 Kiedy używać

Używaj tylko wtedy, gdy masz zaufane zewnętrzne wyliczenie OZC i chcesz je przekazać backendowi.

To ścieżka dla:

- integracji z zewnętrznym programem OZC,
- procesów importu gotowych strat ciepła,
- specjalistycznych workflow agentowych.

### 12.2 Minimalne pola wymagane przez validator

Jeśli `ozcResult` jest niepustym obiektem, REST validator wymaga:

- `designHeatLoss_kW`
- `heatedArea_m2`

Zakresy:

- `designHeatLoss_kW`: `0 < x <= 500`
- `heatedArea_m2`: `0 < x <= 10000`

### 12.3 Pola opcjonalne akceptowane przez use case

Use case potrafi wykorzystać także:

- `recommendedPower_kW`
- `hotWaterPower_kW`
- `assumptions`
- `warnings`
- `audit`
- `source`
- `metrics`
- `extended`

### 12.4 Co `ozcResult` zmienia w pipeline

Jeśli `ozcResult` jest obecne i niepuste:

- use case pomija obliczanie OZC przez silnik backendowy,
- bierze wynik z `ozcResult`,
- dalej wykonuje resztę pipeline'u: selection, buffer, CWU, pricing.

To bardzo ważne:

- `ozcResult` nie zastępuje całego `CalcRequestDTO`,
- nie omija całego backendu,
- nie jest osobnym kontraktem wejściowym.

### 12.5 Ważny niuans runtime

Pusty obiekt:

```json
{ "ozcResult": {} }
```

przechodzi validator, ale nie uruchamia bypassu OZC w use case, bo runtime traktuje bypass tylko dla niepustego obiektu.

Wniosek:

- wysyłaj `ozcResult` tylko wtedy, gdy naprawdę masz poprawne dane;
- nie używaj pustego obiektu jako placeholdera.

## 13. Mapowanie z pełnego formularza

Pełny formularz nie wysyła danych „magicznie”. Też kończy się na `CalcRequestDTO`.

### 13.1 Główna logika mappera

`frontend/api/mapUiStateToCalcRequestDTO.js` robi m.in.:

- buduje `lead` z danych użytkownika,
- bierze `building` z `sourcePayload` albo `buildJsonData()`,
- mapuje `building.include_hot_water` na `preferences.dhw.enabled`,
- mapuje `building.hot_water_persons` na `preferences.dhw.persons`,
- mapuje `building.hot_water_usage` na `preferences.dhw.usageProfile`,
- mapuje `formData.heating_type` / `building.heating_type` na `preferences.heating.emitterType`,
- mapuje `formData.source_type` / `building.source_type` na `preferences.heating.sourceType`,
- buduje `preferences.options` z wyborów konfiguratora,
- dopisuje `context.source`, `pluginVersion`, `uiVersion`.

### 13.2 Mapowanie opcji konfiguratora

Mapper UI przenosi wybory z kluczy UI na kontraktowe `preferences.options`, np.:

- `pompa -> pumpOptionId`
- `cwu -> dhwOptionId`
- `bufor -> bufferOptionId`
- `cyrkulacja -> circulationOptionId`
- `reduktor -> pressureReducerOptionId`
- `woda -> waterTreatmentOptionId`
- `posadowienie -> foundationOptionId`
- `service -> serviceOptionId`

### 13.3 Normalizacja aliasów

Runtime i mapper potrafią normalizować część aliasów historycznych, np.:

- `PL_III -> PL_STREFA_III`
- `surface`, `floor_heating`, `podlogowe` -> `underfloor`
- `single_family` -> `single_house`
- `semi_detached` -> `double_house`

To jest kompatybilność wsteczna, nie rekomendowany sposób projektowania nowych integracji.

Dla nowych wejść:

- wysyłaj wartości kanoniczne z docs,
- nie opieraj projektu na tym, że backend „coś domyśli się z aliasów”.

## 14. Zmiany kontraktu i ekosystem

`kalk-top` nie działa w próżni. Ten kontrakt ma downstream consumerów.

### 14.1 Główne moduły zależne

| Moduł | Relacja |
| --- | --- |
| `top-instal-generator` | konsumuje `OfferDTO` do dokumentów |
| `topinstal-mail-ingress` | wysyła dane do `kalk-top` albo do orchestratora |
| `topinstal-cieplo-orchestrator` | buduje `CalcRequestDTO` i wywołuje `calculate-offer` |
| `agent-zordon` | może wywoływać kalkulator jako narzędzie |
| `rag-chat-asystent` | może interpretować ofertę, ale jej nie liczy |

### 14.2 Kiedy musisz ocenić impact cross-repo

Zgodnie z docs ekosystemowymi, wpływ na inne repozytoria trzeba ocenić przy zmianie:

- `CalcRequestDTO`
- `OfferDTO`
- kształtu requestu lub response REST
- auth headers / agent key semantics
- trace semantics
- generator integration behavior
- mail-ingress workflow boundaries

### 14.3 Kiedy aktualizować living docs ekosystemu

Aktualizacja `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md` jest wymagana m.in. gdy:

- zmienia się DTO,
- zmienia się `schemaVersion`,
- dochodzi nowa integracja,
- znika stara integracja,
- zmienia się auth/trace/retry semantics,
- zmienia się ownership modułów.

Nie trzeba aktualizować living docs przy:

- lokalnym refaktorze,
- samej dokumentacji bez zmiany runtime,
- poprawce wewnątrz jednego repo bez skutku cross-repo.

### 14.4 Wniosek praktyczny

Dodanie nowego szybkiego formularza lub nowego promptu AI zwykle nie wymaga zmiany kontraktu.

Najczęściej wystarczy:

- nowe mapowanie,
- nowy profil domyślny,
- nowe UI / orchestration.

## 15. Antywzorce

Unikaj poniższych wzorców:

1. Liczenie mocy, bufora albo ceny w JS zamiast w backendzie.
2. Wysyłanie do API luźnej notatki tekstowej zamiast poprawnego `CalcRequestDTO`.
3. Ukrywanie przed użytkownikiem faktu, że wynik jest orientacyjny.
4. Milczące zgadywanie dużej liczby pól bez zapisu założeń.
5. Traktowanie starej schema JSON z `"1"` jako ważniejszej niż runtime validator z `"1.0"`.
6. Projektowanie nowej integracji wyłącznie pod aliasy historyczne zamiast pod wartości kanoniczne.
7. Doklejanie własnych cen lub lokalnej logiki pricingowej po stronie frontu.
8. Wkładanie do `preferences.options` dowolnych niestabilnych kluczy i zakładanie, że backend je zachowa.
9. Używanie nonce do integracji serwer-serwer.
10. Traktowanie pustego `ozcResult` jako „włączonego” bypassu OZC.

## 16. Troubleshooting

| Objaw | Prawdopodobna przyczyna | Co poprawić |
| --- | --- | --- |
| `400 VALIDATION_ERROR`, `field=schemaVersion` | zła wersja lub brak pola | ustaw `"1.0"` |
| `400 VALIDATION_ERROR`, `field=lead` | `lead` nie jest obiektem | wyślij `{}` albo pełny obiekt |
| `400 VALIDATION_ERROR`, `field=building` | `building` nie jest obiektem | wyślij obiekt z geometrią |
| `400 VALIDATION_ERROR`, `field=preferences` | `preferences` nie jest obiektem | wyślij obiekt z `heating` i `dhw` |
| `400 VALIDATION_ERROR`, `field=building.geometry` | brak powierzchni i brak kompletu wymiarów | dodaj `heated_area` / `floor_area` / `total_area` albo `building_length` + `building_width` |
| `400 VALIDATION_ERROR`, `field=building.building_length` lub `building.building_width` | wymiar jest nienumeryczny albo `<= 0` | podaj dodatnią liczbę |
| `400 VALIDATION_ERROR`, `field=building.construction_year` | rok poza zakresem albo zły typ | podaj liczbę `1800-2100` |
| `400 VALIDATION_ERROR`, `field=preferences.heating` | brak obiektu | wyślij co najmniej `{}` |
| `400 VALIDATION_ERROR`, `field=preferences.dhw` | brak obiektu | wyślij co najmniej `{}` |
| `400 VALIDATION_ERROR`, `field=preferences.dhw.persons` | `enabled=true`, ale brak liczby osób > 0 | ustaw `persons` na dodatnią liczbę albo wyłącz DHW |
| `400 VALIDATION_ERROR`, `field=ozcResult` | `ozcResult` nie jest obiektem | wyślij obiekt albo usuń pole |
| `400 VALIDATION_ERROR`, `code=OZC_RESULT_INVALID` | brakuje `designHeatLoss_kW` lub `heatedArea_m2`, albo są poza zakresem | popraw wartości `ozcResult` |
| `401 AUTH_REQUIRED` | brak auth | dodaj nonce lub agent key |
| `403 NONCE_INVALID` | zły nonce | pobierz świeży nonce z runtime WP |
| `403 AGENT_KEY_INVALID` | zły klucz | sprawdź konfigurację opcji / env |
| `429 RATE_LIMITED` | za dużo wywołań | respektuj `Retry-After`, dodaj backoff i debouncing |

## 17. Checklisty

### 17.1 Przed wdrożeniem szybkiego formularza

- Czy formularz kończy się poprawnym `CalcRequestDTO`?
- Czy mam geometrię budynku w minimum HTTP?
- Czy `preferences.heating` i `preferences.dhw` są zawsze obiektami?
- Czy dla `dhw.enabled=true` podaję `persons > 0`?
- Czy mam jawnie zdefiniowane profile domyślne?
- Czy zapisuję, który profil został użyty?
- Czy UI jasno komunikuje, że wynik jest orientacyjny?
- Czy pokazuję lub tłumaczę `warnings` i `assumptions`?
- Czy nie liczę niczego samodzielnie w JS?

### 17.2 Przed wdrożeniem agenta AI

- Czy agent korzysta z tego samego endpointu `calculate-offer`?
- Czy agent zawsze produkuje poprawny JSON, a nie luźny opis?
- Czy mam politykę uzupełniania braków danych?
- Czy rozróżniam dane pewne od założonych?
- Czy wysyłam `traceId`?
- Czy zapisuję w `context` nazwę agenta, wersję promptu i tryb działania?
- Czy używam `X-Top-Instal-Agent-Key`, a nie nonce?
- Czy agent respektuje `429` i `Retry-After`?
- Czy wynik orientacyjny jest oznaczony jako oparty na założeniach?

### 17.3 Przed zmianą DTO / kontraktu

- Czy zmieniam `CalcRequestDTO`, `OfferDTO`, auth, trace albo shape REST?
- Czy sprawdziłem wpływ na generator?
- Czy sprawdziłem wpływ na mail-ingress / orchestrator?
- Czy trzeba zaktualizować `TOPINSTAL_ECOSYSTEM_STATE.md`?
- Czy trzeba zaktualizować `TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md` lub schema docs?
- Czy fixture'y i harnessy nadal przechodzą?

## 18. Załączniki / przykłady JSON

### 18.1 Minimalny request przechodzący walidację

```json
{
  "schemaVersion": "1.0",
  "traceId": "quick-form-minimal-001",
  "lead": {},
  "building": {
    "floor_area": 100,
    "construction_year": 2011,
    "include_hot_water": false
  },
  "preferences": {
    "heating": {},
    "dhw": {
      "enabled": false
    }
  },
  "context": {
    "source": "quick-form",
    "mode": "estimate"
  }
}
```

To przejdzie validator HTTP, ale nie jest pełnym opisem budynku. Wynik będzie bardziej orientacyjny.

### 18.2 Przykład bogatszy dla szybkiego formularza z profilem

```json
{
  "schemaVersion": "1.0",
  "traceId": "quick-form-profile-a-001",
  "lead": {
    "contact": {
      "email": "klient@example.com",
      "phone": "+48123123123"
    }
  },
  "building": {
    "heated_area": 135,
    "construction_year": 2005,
    "building_type": "single_house",
    "location_id": "PL_STREFA_III",
    "heating_type": "underfloor",
    "source_type": "air_to_water_hp",
    "include_hot_water": true,
    "hot_water_persons": 4,
    "hot_water_usage": "shower_bath",
    "windows_type": "new_double_glass",
    "ventilation_type": "gravity"
  },
  "preferences": {
    "heating": {
      "emitterType": "underfloor",
      "sourceType": "air_to_water_hp",
      "ventilationType": "gravity"
    },
    "dhw": {
      "enabled": true,
      "persons": 4,
      "usageProfile": "shower_bath"
    },
    "hasBuffer": true
  },
  "context": {
    "source": "quick-form",
    "mode": "estimate",
    "profileId": "house-2000s-standard"
  }
}
```

### 18.3 Przykład z `ozcResult`

```json
{
  "schemaVersion": "1.0",
  "traceId": "agent-external-ozc-001",
  "lead": {},
  "building": {
    "heated_area": 123,
    "construction_year": 2008,
    "building_type": "single_house",
    "location_id": "PL_STREFA_III",
    "include_hot_water": true,
    "hot_water_persons": 3,
    "hot_water_usage": "shower"
  },
  "preferences": {
    "heating": {
      "emitterType": "underfloor",
      "sourceType": "air_to_water_hp"
    },
    "dhw": {
      "enabled": true,
      "persons": 3,
      "usageProfile": "shower"
    },
    "hasBuffer": true
  },
  "ozcResult": {
    "designHeatLoss_kW": 7.8,
    "heatedArea_m2": 123,
    "recommendedPower_kW": 8.1,
    "source": "external-agent"
  },
  "context": {
    "source": "agent",
    "mode": "estimate",
    "agent": "offer-assistant"
  }
}
```

## 19. Indeks odniesień

| Temat | Plik |
| --- | --- |
| rola repo i granica systemu | `AGENTS.md`, `memory-bank/project-brief.md` |
| granice DTO | `docs/contracts/dto-and-boundaries.md` |
| kontrakt REST | `docs/contracts/API_CALCULATE_OFFER.md` |
| instrukcja dla agentów AI | `docs/contracts/agent-calculate-offer-instruction.md` |
| mapowanie pól | `docs/contracts/field-mapping.md` |
| klasyfikacja pól `building` | `docs/contracts/payload-field-classification.md` |
| walidacja HTTP | `wp-adapter/rest/RequestValidator.php` |
| auth, rate limit, nagłówki | `wp-adapter/rest/CalculateOfferController.php` |
| typedef request | `core/contracts/CalcRequestDTO.js` |
| typedef response | `core/contracts/OfferDTO.js` |
| mapper pełnego UI | `frontend/api/mapUiStateToCalcRequestDTO.js` |
| living docs ekosystemu | `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md` |
| protokół aktualizacji ekosystemu | `docs/ecosystem/TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md` |
| schema JSON request | `docs/ecosystem/schemas/calc-request-dto.v1.json` |
| schema JSON response | `docs/ecosystem/schemas/offer-dto.v1.json` |
| przykładowe payloady | `core/application/harness/fixtures/*.json` |

## Uwagi końcowe

Ten dokument opisuje kanoniczny model pracy dla nowych wejść do `calculate-offer`.

Najważniejsza praktyczna zasada brzmi:

- upraszczaj sposób zbierania danych,
- nie upraszczaj backendu przez omijanie kontraktu,
- nie przenoś liczenia poza `kalk-top`.
