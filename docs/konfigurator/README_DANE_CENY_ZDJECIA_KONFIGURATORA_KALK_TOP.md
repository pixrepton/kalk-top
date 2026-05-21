# README — gdzie w kalk-top są dane firmowe, ceny, urządzenia i obrazki konfiguratora

**Weryfikacja:** 2026-03-26 — zestawiono z aktualnym `equipment-catalog.json`, `engineering-policy.json`, `konfigurator/configurator-unified.js`, `kalkulator/js/resultsRenderer.js`, `kalkulator/calculator.php`, `heatpump-calculator.php`.

## Cel dokumentu

Ten dokument jest praktyczną mapą repozytorium pod kątem edycji:

- cen biorących udział w wycenie końcowej,
- listy urządzeń i wariantów,
- opisów oraz treści kart konfiguratora,
- obrazków i URL-i do obrazków,
- reguł doboru bufora i innych elementów wpływających na wynik.

To nie jest README architektoniczne całego projektu. To jest przewodnik „gdzie co zmienić”, jeśli chcesz poprawić dane handlowe lub treści widoczne dla klienta.

### Polityka cen (kanon)

- **Oferta (netto/brutto, pozycje):** wyłącznie `core/infrastructure/master-data/equipment-catalog.json` oraz backend (`PricingEngine`, price book z `PriceBookRepositoryWp`). Po zmianie cen podbij `data_version` w `equipment-catalog.json`; pamiętaj o cache transientów WordPress (~600 s) dla price book / reguł.
- **Nie zmieniaj cen oferty** w `konfigurator/configurator-presentation.json` — plik zawiera wyłącznie copy i metadane prezentacji (**bez kwot cenowych**).
- **Technika pomp na kartach:** wyłącznie `konfigurator/panasonic.json` w runtime (`fetch`); brak duplikatu tablicy w `configurator-presentation.json`.

### Zgrupowana warstwa prezentacyjna (jeden plik)

- **`konfigurator/configurator-presentation.json`** — copy kart (CWU, bufor, cyrkulacja, Service Cloud, posadowienie, reduktor, woda), obrazki, schematy. Ładowany w przeglądarce przez `loadPresentationData()` w `configurator-unified.js`; przy błędzie sieci — fallback inline w JS.
- **`konfigurator/panasonic.json`** — osobny fetch (`loadPanasonicDB`) dla danych technicznych pomp.

---

## 1. Najkrótsza odpowiedź

### Jeśli chcesz zmienić…

| Chcesz zmienić                                  | Główne miejsce                                                                                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cenę końcową oferty                             | `core/infrastructure/master-data/equipment-catalog.json`                                                                                                       |
| opis / tekst na karcie konfiguratora            | `konfigurator/configurator-presentation.json` (preferowane) oraz `konfigurator/configurator-unified.js` (fallback)                                             |
| obrazek na karcie konfiguratora                 | `konfigurator/configurator-unified.js`                                                                                                                         |
| ikony/obrazki w kalkulatorze startowym          | `kalkulator/calculator.php`                                                                                                                                    |
| bazowy URL katalogu obrazków                    | `heatpump-calculator.php`                                                                                                                                      |
| logikę doboru bufora                            | `core/infrastructure/master-data/engineering-policy.json` + `core/domain/buffer/BufferEngine.php` + `konfigurator/buffer-engine.js`                            |
| reguły doboru modelu pompy (selekcja)           | `equipment-catalog.json` → `selection_policy`; backend: `wp-adapter/repositories/SelectionRulesRepositoryWp.php` + `core/domain/selection/SelectionEngine.php` |
| dane techniczne pomp na kartach                 | `konfigurator/panasonic.json`                                                                                                                                  |
| **całą warstwę prezentacyjną w jednym miejscu** | `konfigurator/configurator-presentation.json` + fetch w `configurator-unified.js` (ceny oferty tylko w `equipment-catalog.json`)                               |

### Jedno zdanie, które warto zapamiętać

**Ceny i katalog handlowy** siedzą głównie w `equipment-catalog.json`, a **teksty, karty, obrazki i warstwa prezentacji konfiguratora** siedzą głównie w `konfigurator/configurator-unified.js`.

---

## 2. Jak dane płyną przez aplikację

## 2.1. Warstwa kanoniczna — dane biznesowe i ceny

Źródłem prawdy dla backendu jest katalog master-data:

- `core/infrastructure/master-data/equipment-catalog.json`
- `core/infrastructure/master-data/engineering-policy.json`
- pomocniczo: `core/infrastructure/master-data/system-dictionary.json`

Te pliki są ładowane przez adapter WP i zamieniane na struktury używane przez silniki domenowe.

**Ważne:** po edycji `equipment-catalog.json` rozważ podbicie pola `data_version` w tym pliku — front ładuje katalog przez `fetch` z cache-bustingiem wersji wtyczki; transienty WP dla reguł selekcji/bufora mają TTL (~600 s), więc w dev warto wiedzieć o ewentualnym opóźnieniu cache.

## 2.2. Warstwa backendowa — obliczenie oferty

Główne pliki backendowe:

- `wp-adapter/repositories/MasterDataRepositoryWp.php`
- `wp-adapter/repositories/PriceBookRepositoryWp.php`
- `wp-adapter/repositories/SelectionRulesRepositoryWp.php` (reguły selekcji budowane z katalogu sprzętu)
- `wp-adapter/repositories/BufferRulesRepositoryWp.php`
- `core/application/CalculateOfferUseCase.php`
- `core/domain/pricing/PricingEngine.php`
- `core/domain/selection/SelectionEngine.php`
- `core/domain/buffer/BufferEngine.php`

W praktyce:

1. repozytoria ładują JSON-y z `core/infrastructure/master-data/`,
2. `CalculateOfferUseCase.php` buduje wejście do silników,
3. `PricingEngine.php` liczy cenę netto/brutto i pozycje oferty,
4. wynik wraca jako kanoniczne `OfferDTO`.

## 2.3. Warstwa konfiguratora — to, co widzi użytkownik

Główny plik frontu:

- `konfigurator/configurator-unified.js`

Ten plik:

- ładuje `equipment-catalog.json` po stronie frontu,
- renderuje karty pomp, CWU, buforów, dodatków i opcji,
- używa własnych opisów, etykiet i obrazków,
- pokazuje klientowi wybory,
- w niektórych miejscach ma też displayowe dane wpisane ręcznie.

To ważne, bo oznacza to rozdział:

- **backend** liczy finalną ofertę,
- **frontend** pokazuje klientowi karty i copy,
- czasem jedno i drugie korzysta z tych samych źródeł,
- ale opisy kart często są trzymane osobno w JS.

---

## 3. Główne pliki danych, które warto znać

## 3.1. `core/infrastructure/master-data/equipment-catalog.json`

Najważniejszy plik handlowy w całej aplikacji.

Tu znajdziesz m.in.:

- listę pomp `pumps[]`,
- modele i serie,
- zakresy doboru `selection_range_kw`,
- ceny pomp w `pricing`,
- sekcje cenowe `pricing_sections`,
- politykę cenową `pricing_policy`,
- politykę selekcji `selection_policy`.

To jest główne miejsce, gdy chcesz zmienić:

- cenę pompy,
- cenę zasobnika CWU,
- cenę bufora,
- cenę fundamentu / stojaka / uzdatniania / dodatków oraz katalogowych pozycji poza aktywnym runtime,
- politykę wyboru kolumn cenowych,
- część reguł doboru urządzeń.

### Najważniejsze sekcje tego pliku

- `pumps`
- `pricing_sections`
- `pricing_policy`
- `selection_policy`

### Inwentaryzacja — modele KIT w `pumps[]` (14 wpisów)

| Split (zewnętrzna + jednostka wewnętrzna)                                                                      | All-in-one                                                                                                            |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `KIT-WC03K3E5`, `KIT-WC05K3E5`, `KIT-WC07K3E5`, `KIT-WC09K3E5`, `KIT-WC09K3E8`, `KIT-WC12K9E8`, `KIT-WC16K9E8` | `KIT-ADC03K3E5`, `KIT-ADC05K3E5`, `KIT-ADC07K3E5`, `KIT-ADC09K3E5`, `KIT-ADC09K9E8`, `KIT-ADC12K9E8`, `KIT-ADC16K9E8` |

Do każdego modelu: `pricing` (np. `split_net`, `split400_net`, `aio_premium_net`, `aio_premium400_net` — zależnie od mocy/faz), `technical`, `pair.aio_model` dla splitów.

### Inwentaryzacja — `pricing_sections` (klucze, wartości netto PLN w stanie na `data_version` pliku)

Wartości poniżej pochodzą z repo; przy zmianach handlowych sprawdź aktualny JSON.

| Sekcja           | Zawartość                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cwu`            | `emalia`: 150 / 200 / 300 L; `inox`: 150 / 200 / 250 / 300 L; `none`                                                                                          |
| `buffer`         | pojemności (L): `0`, `40`, `60`, `80`, `100`, `120`, `140`, `150`, `200`, `300`, `400`, `500`, `800`, `1000` — dla każdej: `sprzeglo` i `na_powrocie` (netto) |
| `foundation`     | `fundament-nasz`, `fundament-klienta`, `stojak`                                                                                                               |
| `drainage`       | `skropliny-z-grzalka`, `bez` — pozycje katalogowe poza aktywnym runtime kalkulatora                                                                          |
| `water.filters`  | `filtry-zmiekczacz`, `filtry-podstawowe`, `bez-filtrow`                                                                                                       |
| `water.pressure` | `z-reduktorem-cisnienia`, `bez-reduktora`                                                                                                                     |
| `options`        | aktywny runtime korzysta z `service-cloud` oraz `cyrkulacja-tak` / `cyrkulacja-nie`; `magnetic_filter_*`, `hydro_safety_*`, `flushing_*`, `electrical_standard` pozostają tylko w pricebooku |
| (root)           | `hydraulic_components_aio`, `hydraulic_components_split` — stałe kwoty; `installation_net` — koszt montażu netto                                              |

### Typowe przykłady zmian

- zmiana ceny 9 kW split 3f,
- zmiana ceny zasobnika 250 L inox,
- zmiana ceny Service Cloud,
- zmiana ceny cyrkulacji CWU,
- zmiana ceny posadowienia,
- zmiana ceny filtrów lub reduktora.

---

## 3.2. `core/infrastructure/master-data/engineering-policy.json`

To jest główne miejsce dla parametrów inżynierskich.

Tu siedzą m.in.:

- polityka OZC,
- reguły bufora,
- dostępne pojemności,
- minima,
- polityka `buffer_engine_policy`,
- reguły `hot_water_power`.

To ruszasz wtedy, gdy chcesz zmienić:

- jak dobierany jest bufor,
- jakie pojemności są dostępne,
- kiedy system wymusza określone zachowania,
- parametry techniczne wpływające na rekomendację.

Nie jest to pierwsze miejsce do zwykłej zmiany ceny.

---

## 3.3. `konfigurator/panasonic.json`

To jest pomocnicza baza danych technicznych pomp, używana w kartach konfiguratora.

Tu znajdziesz m.in.:

- model `kit`,
- COP,
- czynnik chłodniczy,
- poziom hałasu,
- wymiary,
- inne parametry techniczne do wyświetlenia na karcie.

To jest właściwe miejsce, gdy chcesz zmienić:

- dane techniczne widoczne na kartach pomp,
- COP,
- wymiary,
- hałas,
- specyfikację modelu.

To **nie** jest główne miejsce do ceny końcowej oferty.

---

## 4. Gdzie dokładnie zmieniać konkretne rzeczy

## 4.1. Pompy ciepła

### Cena biorąca udział w ofercie

Plik:

- `core/infrastructure/master-data/equipment-catalog.json`

Szukaj:

- `pumps`
- `pricing`
- `pricing_policy.pump`

### Gdzie backend używa tych cen

Plik:

- `core/domain/pricing/PricingEngine.php`

Tu są ważne rzeczy:

- `resolve_pump_price(...)`
- wybór odpowiedniej kolumny cenowej,
- fallback / nearest pricing,
- przeliczanie pozycji oferty.

### Gdzie frontend pokazuje kartę pompy

Plik:

- `konfigurator/configurator-unified.js`

Szukaj funkcji:

- `getPumpImage(...)`
- `renderPumpCard(...)`
- `renderPumpSection(...)`
- `loadPanasonicDB()`
- `getPumpDataFromDB(model)`
- `calculatePumpPrice(...)`
- `pickPumpPriceFromMasterRow(...)`

### Co dokładnie edytować w konfiguratorze

- tytuł karty,
- opis karty,
- kolejność informacji,
- badge „rekomendowane”,
- obrazek,
- teksty speców,
- label typu split / all-in-one,
- copy rekomendacji mocy.

### Uwaga

W `renderPumpCard(...)` ceny na kartach są dziś wyłączone jako UX. To oznacza, że zmiana ceny końcowej nadal ma znaczenie dla oferty, ale niekoniecznie dla ceny widocznej bezpośrednio na samej karcie.

---

## 4.2. Zasobniki CWU

### Cena biorąca udział w ofercie

Plik:

- `core/infrastructure/master-data/equipment-catalog.json`

Najczęściej przez:

- `pricing_sections.cwu`
- mapowanie po materiale i pojemności

### Gdzie backend liczy cenę CWU

Plik:

- `core/domain/pricing/PricingEngine.php`

Szukaj:

- `resolve_cwu_capacity_from_inputs(...)`
- `resolve_cwu_price(...)`

### Gdzie konfigurator renderuje kartę CWU

Plik:

- `konfigurator/configurator-unified.js`

Szukaj:

- `const cwuData = { ... }`
- `renderCwuCard(type, capacity, isRecommended = false)`
- `resolveCwuProduct(...)`

### Co dokładnie siedzi w `cwuData`

- nazwa handlowa,
- materiał,
- anoda,
- gwarancja,
- opis,
- obrazek.

### To edytujesz tutaj, jeśli chcesz zmienić

- nazwę typu CWU,
- opis marketingowy,
- tekst o stali nierdzewnej lub emalii,
- obrazek,
- gwarancję pokazywaną w karcie.

---

## 4.3. Bufory CO

### Cena biorąca udział w ofercie

Plik:

- `core/infrastructure/master-data/equipment-catalog.json`

Najczęściej sekcja:

- `pricing_sections.buffer`

### Logika doboru bufora

Pliki:

- `core/infrastructure/master-data/engineering-policy.json`
- `core/domain/buffer/BufferEngine.php`
- `konfigurator/buffer-engine.js`

### Gdzie konfigurator renderuje kartę bufora

Plik:

- `konfigurator/configurator-unified.js`

Szukaj:

- `renderBufferCard(...)`
- `renderBufferSection(...)`
- `resolveBufferProduct(...)`

### Ważna uwaga praktyczna

W kartach bufora w JS siedzi własny displayowy katalog `bufferData`, z wpisami takimi jak:

- tytuł,
- opis,
- wymiary,
- displayowa cena fallbackowa,
- obrazek.

To oznacza rozdział:

- **cena finalnej oferty** — z master-data / backendu,
- **opis i wygląd karty** — z `configurator-unified.js`.

### Gdzie edytować, jeśli chcesz zmienić

- treść opisu karty,
- nazwę „Bufor 200L”,
- wymiary pokazywane na karcie,
- tekst sposobu montażu,
- schemat i komunikaty dla klienta.

### Gdzie nie robić pierwszej zmiany

Nie zaczynaj od `renderBufferCard(...)`, jeśli chcesz wyłącznie zmienić cenę końcową oferty. Do ceny idź najpierw do `equipment-catalog.json`.

---

## 4.4. Service Cloud

### Cena końcowa

Plik:

- `core/infrastructure/master-data/equipment-catalog.json`

Najczęściej:

- `pricing_sections.options`
- klucz typu `service-cloud`

### Widoczność, dostępność i karta w konfiguratorze

Plik:

- `konfigurator/configurator-unified.js`

Szukaj:

- `rulesEngine.serviceCloud(state)`
- `renderServiceCard()`
- `serviceCloudOptions`
- `data-option-id="service-cloud"`

### Co zmienisz tutaj

- czy krok ma być dostępny,
- czy karta ma się renderować,
- opis usługi,
- teksty sprzedażowe,
- obrazek `service-cloud-adapter.png`.

---

## 4.5. Cyrkulacja CWU

### Cena końcowa

Plik:

- `core/infrastructure/master-data/equipment-catalog.json`

Szukaj:

- `pricing_sections.options`
- klucz `cyrkulacja-tak`

### Karta i opisy w konfiguratorze

Plik:

- `konfigurator/configurator-unified.js`

Szukaj fraz:

- `Cyrkulacja CWU`
- `circulationOptions`
- `cyrkulacja`

Tu zmienisz:

- opis,
- komunikat marketingowy,
- treści w kartach,
- logikę pokazywania kroku.

---

## 4.6. Posadowienie jednostki zewnętrznej

### Cena końcowa

Plik:

- `core/infrastructure/master-data/equipment-catalog.json`

Najczęściej w:

- `pricing_sections.foundation`

Typowe klucze:

- `fundament-nasz`
- `fundament-klienta`
- `stojak`

### Karty i teksty

Plik:

- `konfigurator/configurator-unified.js`

Szukaj:

- `foundationOptions`
- tekstów o fundamencie / stojaku / montażu ściennym / gruntowym

---

## 4.7. Uzdatnianie wody, filtry, reduktor ciśnienia

### Cena końcowa

Plik:

- `core/infrastructure/master-data/equipment-catalog.json`

Szukaj sekcji:

- `pricing_sections.water`
- `filters`
- `pressure`

### Backendowe doliczanie pozycji

Plik:

- `core/domain/pricing/PricingEngine.php`

Szukaj:

- `ACCESSORY_PRESSURE`
- `ACCESSORY_WATER_SOFTENER`
- `ACCESSORY_WATER_FILTER`

### Teksty i karta w konfiguratorze

Plik:

- `konfigurator/configurator-unified.js`

Szukaj:

- `water`
- `pressure`
- `reducer`
- `filter`
- `station`

---

## 4.8. Pozostałe dodatki oferty

Również zwykle w:

- `core/infrastructure/master-data/equipment-catalog.json`

Szczególnie w sekcjach:

- `pricing_sections.options`
- `pricing_sections.foundation`
- `pricing_sections.water`
- `pricing_sections.drainage`

To jest miejsce dla dodatków, które nie są pompą, CWU ani buforem. W aktywnym kalkulatorze na cenę brutto wpływają tylko wspierane rodziny runtime, a `drainage` oraz stare ukryte rodziny `options` pozostają tu wyłącznie jako pozycje katalogowe.

---

## 5. Gdzie są odwołania do obrazków

## 5.1. Bazowy URL katalogu obrazków

Plik:

- `heatpump-calculator.php`

Tutaj do frontu jest lokalizowane:

- `HEATPUMP_CONFIG.imgUrl`

To jest globalna baza typu:

- `/img`
- albo inny katalog, jeśli zmienisz konfigurację bootstrapu.

Jeśli chcesz zmienić **cały bazowy URL obrazków**, to jest pierwsze miejsce do sprawdzenia.

---

## 5.2. Obrazki kart w konfiguratorze

Główne miejsce:

- `konfigurator/configurator-unified.js`

### Pompy

Szukaj:

- `getPumpImage(...)`
- `renderPumpCard(...)`

Tu są mapowane pliki typu:

- `splitK1f.png`
- `allinoneK1f.png`
- `allinoneK3f.png`
- fallbacki do `dom.png`

### CWU

Szukaj:

- `const cwuData = { ... }`

Pliki:

- `cwu-emalia.png`
- `cwu-nierdzewka.png`

### Bufor

Szukaj:

- `renderBufferCard(...)`

Obecnie dla buforów często idzie fallback do:

- `dom.png`

### Service Cloud

Szukaj:

- `renderServiceCard()`

Plik:

- `service-cloud-adapter.png`

---

## 5.3. Obrazki w startowym kalkulatorze

Plik:

- `kalkulator/calculator.php`

Tu są m.in. odwołania do:

- `dom.png`
- `blizniak.png`
- `szeregowiec.png`
- `mieszkanie.png`
- `mapka.png`

To zmieniasz, jeśli chcesz podmienić ikonki startowe lub ilustracje w samym kalkulatorze, a nie w konfiguratorze.

---

## 5.4. Fizyczny katalog obrazków

Pliki siedzą w:

- `img/` (względem rootu wtyczki; URL bazowy: `HEATPUMP_CONFIG.imgUrl` w `heatpump-calculator.php`)

**Uwaga:** w klonie repozytorium katalog `img/` może być pusty lub nie wersjonowany — na produkcji pliki są w paczce wtyczki pod `/wp-content/plugins/.../img/`.

Przykłady nazw używanych w kodzie:

- `img/splitK1f.png`
- `img/allinoneK1f.png`
- `img/allinoneK3f.png`
- `img/aioK.png`
- `img/split-k.png`
- `img/cwu-emalia.png`
- `img/cwu-nierdzewka.png`
- `img/service-cloud-adapter.png`
- `img/dom.png`

Jeśli chcesz zmienić obrazek, masz zwykle dwa warianty:

1. podmienić sam plik w `img/`,
2. zostawić plik, ale zmienić odwołanie w JS/PHP.

---

## 5.5. Obrazki w ekranie wyników kalkulatora (nie tylko konfigurator)

Plik:

- `kalkulator/js/resultsRenderer.js`

Dodatkowe nazwy (poza listą z §5.2), łączone z `config.imgUrl`:

- `split-k.png`, `allinone.png` — typ pompy w podsumowaniu
- `default-pump.png` — fallback pompy
- `sdc-k.png`, `adc-k.png` — jednostka wewnętrzna split vs AIO w jednym z widoków
- `splitK1f.png`, `allinoneK1f.png` — fallbacki; część ścieżek preferuje też pliki z **mediów WordPress** (`uploadsUrl`: `split-k.png`, `aio-k.png`), jeśli są wgrane

---

## 5.6. Obrazki poza katalogiem wtyczki (`/pictures/`)

Plik:

- `kalkulator/calculator.php`

Zmienna `$pictures_url` domyślnie wskazuje na `{site_url}/pictures` (nie na folder wtyczki). Typowe pliki:

- `obrys.png`, `zabudowa.png`, `www-mobile.png`

Katalog `pictures/` **nie** leży w repozytorium kalk-top — pliki są na serwerze WWW.

### Start kalkulatora — dodatkowy plik z `img/`

W `kalkulator/calculator.php` jest też m.in.:

- `header-image.png` (nagłówek)

---

## 6. Co dokładnie odpowiada za cenę końcową oferty

## 6.1. Kanoniczny tor cenowy

1. `equipment-catalog.json`
2. `MasterDataRepositoryWp.php`
3. `PriceBookRepositoryWp.php`
4. `CalculateOfferUseCase.php`
5. `PricingEngine.php`
6. `OfferDTO`

To jest właściwa ścieżka, jeśli pytasz: **„co naprawdę liczy cenę brutto dla klienta?”**

## 6.2. Frontendowy tor pomocniczy

W `konfigurator/configurator-unified.js` jest też frontowe ładowanie katalogu cen:

- fetch do `core/infrastructure/master-data/equipment-catalog.json`
- mapowanie do `pricesData`
- funkcje typu:
  - `calculatePumpPrice(...)`
  - `calculateCwuPrice(...)`
  - `calculateBufferPrice(...)`
  - `getCanonicalPricingSnapshot()`

To jest potrzebne do preview, prezentacji, wyświetlenia pewnych sum lub stanów w konfiguratorze, ale **nie powinno zastępować backendu jako źródła prawdy**.

### Zasada praktyczna

Jeśli chcesz zmienić cenę oferty, zacznij od:

- `equipment-catalog.json`

Dopiero potem sprawdź, czy frontend pokazuje to zgodnie z backendem.

---

## 7. Co dokładnie odpowiada za opisy i treści kart konfiguratora

Najwięcej siedzi w:

- `konfigurator/configurator-unified.js`

To jest plik, w którym znajdziesz:

- tytuły sekcji,
- opisy kroków,
- opisy kart,
- teksty rekomendacji,
- teksty marketingowe,
- komunikaty typu „wybrano / wymagane / niedostępne”,
- część szczegółów technicznych widocznych na karcie,
- podsumowanie kroków i etykiety summary.

Jeśli chcesz poprawić to, co klient czyta w konfiguratorze, to najczęściej zaczynasz właśnie tutaj.

---

## 8. Co edytować najczęściej — scenariusze praktyczne

## 8.1. Chcesz zmienić cenę konkretnej pompy

1. Otwórz `core/infrastructure/master-data/equipment-catalog.json`
2. Znajdź odpowiedni model / moc / kolumnę ceny
3. Zmień wartość w `pricing`
4. Sprawdź `pricing_policy`, jeśli zmieniasz logikę wyboru kolumny
5. Przetestuj backendową kalkulację

## 8.2. Chcesz zmienić tekst na karcie CWU

1. Otwórz `konfigurator/configurator-unified.js`
2. Znajdź `const cwuData = { ... }`
3. Edytuj `name`, `description`, `material`, `warranty`, `image`
4. Sprawdź render kroku CWU

## 8.3. Chcesz zmienić cenę bufora w ofercie

1. Otwórz `core/infrastructure/master-data/equipment-catalog.json`
2. Znajdź `pricing_sections.buffer`
3. Zmień cenę dla odpowiedniej pojemności i wariantu montażu
4. Nie zaczynaj od `renderBufferCard(...)`, jeśli chodzi tylko o cenę końcową

## 8.4. Chcesz zmienić opis bufora widoczny klientowi

1. Otwórz `konfigurator/configurator-unified.js`
2. Znajdź `renderBufferCard(...)`
3. Zmień opis, wymiary, copy montażu, teksty pomocnicze

## 8.5. Chcesz podmienić obrazek pompy

1. Otwórz `konfigurator/configurator-unified.js`
2. Znajdź `getPumpImage(...)`
3. Zmień nazwę pliku lub mapowanie
4. Upewnij się, że nowy plik istnieje w `img/`

## 8.6. Chcesz zmienić bazowy katalog obrazków

1. Otwórz `heatpump-calculator.php`
2. Znajdź lokalizację `HEATPUMP_CONFIG.imgUrl`
3. Zmień bazowy URL
4. Sprawdź, czy wszystkie karty nadal ładują obrazki poprawnie

---

## 9. Miejsca, które wyglądają jak źródło danych, ale trzeba uważać

## 9.1. `konfigurator/configurator-unified.js`

Ten plik jest bardzo ważny, ale zawiera mieszankę:

- renderowania,
- fallbacków,
- copy,
- helperów cenowych,
- lokalnych katalogów displayowych.

Nie każda liczba, którą tam zobaczysz, jest kanoniczną ceną oferty.

## 9.2. `bufferData` w `renderBufferCard(...)`

To nie jest najlepsze miejsce do zmiany końcowej ceny oferty.
To jest głównie warstwa displayowa karty.

## 9.3. `cwuData`

To jest dobre miejsce do zmiany opisu i obrazka, ale nie główne miejsce do ceny końcowej.

## 9.4. `panasonic.json`

To jest dobre miejsce do danych technicznych, ale nie główne miejsce do cen handlowych.

---

## 10. Bezpieczna kolejność zmian

Gdy chcesz zmienić ofertę, najlepiej iść tak:

1. **najpierw** zmiana kanonicznych danych w `equipment-catalog.json`,
2. **potem** sprawdzenie, czy backend liczy poprawnie przez `PricingEngine.php`,
3. **potem** dopasowanie frontu w `configurator-unified.js`, jeśli karta ma pokazać nowy opis lub nowy obrazek,
4. **na końcu** smoke test UI.

To jest bezpieczniejsze niż zaczynanie od frontu.

---

## 11. Grep / wyszukiwanie — szybkie komendy

### Pompy

```bash
rg -n "getPumpImage|renderPumpCard|calculatePumpPrice|pickPumpPriceFromMasterRow|panasonic" konfigurator/configurator-unified.js
```

### CWU

```bash
rg -n "cwuData|renderCwuCard|calculateCwuPrice|resolveCwuProduct" konfigurator/configurator-unified.js
```

### Bufor

```bash
rg -n "renderBufferCard|renderBufferSection|calculateBufferPrice|resolveBufferProduct|buffer" konfigurator/configurator-unified.js
```

### Service Cloud

```bash
rg -n "serviceCloud|renderServiceCard|service-cloud" konfigurator/configurator-unified.js
```

### Ceny kanoniczne

```bash
rg -n "pricing_sections|pricing_policy|selection_policy|split_net|split400_net|aio_premium" core/infrastructure/master-data/equipment-catalog.json
```

### Obrazki

```bash
rg -n "imgUrl|dom.png|cwu-|service-cloud|splitK|allinone" heatpump-calculator.php kalkulator/calculator.php konfigurator/configurator-unified.js kalkulator/js/resultsRenderer.js
```

---

## 12. Inwentaryzacja — ceny zduplikowane tylko w UI (nie zastępują `equipment-catalog.json`)

W `konfigurator/configurator-unified.js` występują **sztywne kwoty** służące kartom / placeholderom (backend przy włączonym `useBackendCalc` i tak liczy z master-data):

| Miejsce (logiczne)                | Przykład                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `bufferData` w `renderBufferCard` | pojemności 50–1000 L: `price` 1400 … 8500 (opisy, wymiary; obrazek często `dom.png`) |
| `renderFoundationCard`            | obiekt `data`: 1200, 1600 — w kodzie komentarz o niewyświetlaniu cen na kartach      |
| `renderWaterStationCard`          | 4200 / 320 / 0                                                                       |

**Zasada:** zmiana **oferty końcowej** → `equipment-catalog.json`. Zmiana **tylko** liczb w powyższych miejscach bez JSON może rozjeżdżać podgląd z backendem.

---

## 13. Rekomendacja operacyjna

Jeżeli masz zmienić coś szybko i bezpiecznie:

### Zmiany handlowe

- edytuj `core/infrastructure/master-data/equipment-catalog.json`

### Zmiany UX / kart / opisów / obrazków

- edytuj `konfigurator/configurator-unified.js`

### Zmiany technicznych danych pompy

- edytuj `konfigurator/panasonic.json`

### Zmiany ikon startowych i ilustracji kalkulatora

- edytuj `kalkulator/calculator.php` lub podmień pliki w `img/`

### Podsumowanie wyników / PDF-flow (grafiki pomp)

- `kalkulator/js/resultsRenderer.js` + ewentualnie media WP (`uploads`)

---

## 14. Finalna mapa odpowiedzialności

### Kanoniczne źródła danych

- `core/infrastructure/master-data/equipment-catalog.json`
- `core/infrastructure/master-data/engineering-policy.json`
- `core/infrastructure/master-data/system-dictionary.json` (kody komunikatów, bez cen)
- `konfigurator/panasonic.json`

### Backend liczący ofertę

- `core/application/CalculateOfferUseCase.php`
- `wp-adapter/repositories/MasterDataRepositoryWp.php`, `PriceBookRepositoryWp.php`, `SelectionRulesRepositoryWp.php`, `BufferRulesRepositoryWp.php`
- `core/domain/pricing/PricingEngine.php`
- `core/domain/selection/SelectionEngine.php`
- `core/domain/buffer/BufferEngine.php`

### Front konfiguratora

- `konfigurator/configurator-unified.js`
- `konfigurator/buffer-engine.js`

### Bootstrap i konfiguracja assetów

- `heatpump-calculator.php`
- `kalkulator/calculator.php`

### Obrazki

- `img/` (wtyczka)
- host `get_site_url()/pictures/` — patrz §5.6

---

## 15. Jedno praktyczne ostrzeżenie na koniec

Jeśli zmienisz tylko tekst lub obrazek w konfiguratorze, wszystko będzie wyglądać dobrze wizualnie, ale **cena końcowa może nadal pozostać stara**, jeśli nie dotkniesz `equipment-catalog.json`.

I odwrotnie: jeśli zmienisz tylko `equipment-catalog.json`, oferta policzy się poprawnie, ale klient może nadal widzieć stare nazwy, opisy albo obrazki w kartach, dopóki nie poprawisz `configurator-unified.js`.

Dlatego przy zmianach handlowych prawie zawsze warto sprawdzić oba miejsca:

- **backendowe źródło ceny**,
- **frontendowy opis / karta / obrazek**.

---

## 16. Spis plików graficznych — nazwy występujące w kodzie (bez duplikatów)

| Plik                                                                                                           | Gdzie używany                                                                   |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `splitK1f.png`, `allinoneK1f.png`, `allinoneK3f.png`, `aioK.png`, `split-k.png`                                | `konfigurator/configurator-unified.js` (`getPumpImage`, podgląd)                |
| `cwu-emalia.png`, `cwu-nierdzewka.png`, `dom.png`, `service-cloud-adapter.png`                                 | `konfigurator/configurator-unified.js`                                          |
| `split-k.png`, `allinone.png`, `default-pump.png`, `splitK1f.png`, `allinoneK1f.png`, `sdc-k.png`, `adc-k.png` | `kalkulator/js/resultsRenderer.js`                                              |
| `header-image.png`, `dom.png`, `blizniak.png`, `szeregowiec.png`, `mieszkanie.png`, `mapka.png`                | `kalkulator/calculator.php` (`img/`)                                            |
| `obrys.png`, `zabudowa.png`, `www-mobile.png`                                                                  | `kalkulator/calculator.php` (`$pictures_url` → zwykle `/pictures/` na serwerze) |
| `split-k.png`, `aio-k.png`                                                                                     | opcjonalnie media WP (`uploadsUrl` w `resultsRenderer.js`)                      |

Jeśli zmieniasz **nazwę** pliku, zaktualizuj wszystkie odwołania w powyższych plikach i wgraj asset do właściwego katalogu (`img/`, `/pictures/` lub media).
