# TOP-INSTAL: Workflow aplikacji, silniki obliczeniowe i aktualny stan architektury

> Status: canonical
> Owner: TOP-INSTAL architecture maintainer
> Last verified against code/runtime: 2026-04-02 (documentation governance pass; deep runtime not fully re-walked in this session)
> Source-of-truth level: L1
> Supersedes: none
> Related docs: `repo-rules.md`, `../contracts/dto-and-boundaries.md`, `../SOURCE_OF_TRUTH_INDEX.md`

## 1. Cel dokumentu

Ten dokument jest technicznym README dla aktualnej architektury `kalk-top`.
Opisuje:

- jak dziala aplikacja end-to-end,
- jakie sa kanoniczne zrodla logiki obliczeniowej,
- jak backend sklada `OfferDTO`,
- jak dzialaja silniki `OZC`, `Selection`, `Buffer` i `Pricing`,
- decyzje produktowe i ewolucje workflow zapisane w trakcie refaktoryzacji (w tym sekcje historyczne nizej).

To nie jest pelna historia repozytorium od poczatku projektu. Starsze sekcje moga uzywac sformulowania „w tej rozmowie” — traktuj je jako zapis kontekstu decyzji; **zrodlem prawdy dla zachowania pozostaje kod i harnessy** (`npm run verify`, `npm run test:contract`, `npm run proof`, `core/application/harness/*`). Sekcja 6 (parity JS↔PHP) jest historyczna — `engine-parity.php` usuniety (2026-06).

---

## 2. Aktualny model systemu

Aktualny model pracy repo jest backend-first:

```text
UI / formularz / konfigurator
-> mapowanie do CalcRequestDTO
-> POST /wp-json/topinstal/v1/calculate-offer
-> RequestValidator
-> CalculateOfferUseCase
-> silniki domenowe
-> OfferDTO
-> render wynikow / konfigurator / PDF / dalsze integracje
```

Najwazniejsze zasady:

- backend jest zrodlem prawdy dla `OfferDTO`,
- frontend nie jest juz autonomicznym silnikiem oferty,
- logika obliczeniowa ma byc zgodna z kanonicznymi wzorcami `.js`,
- kompatybilnosc publicznego API ma pozostac zachowana.

Jednoczesnie trzeba rozroznic dwie rzeczy:

- `kanoniczne wzorce zachowania` dla silnikow zostaly wskazane przez Ciebie jako frontendowe `.js`,
- `kanoniczny runtime odpowiedzi ofertowej` pozostaje backendowy: `CalcRequestDTO -> OfferDTO`.

To oznacza, ze backend nie przejal "wlasnej" nowej logiki dla selection/buffer/pricing, tylko zostal dostrojony do logiki wzorcowej z `.js`.

---

## 3. Glowny workflow aplikacji

### 3.1. Wejscie z UI

Wejscie pochodzi z dwoch glownych miejsc:

- `kalkulator/` - etap zbierania danych o budynku i potrzebach,
- `konfigurator/` - etap doboru wariantu maszynowni i opcji.

Frontend buduje `CalcRequestDTO` i wysyla go na backend.

Najwazniejsze warstwy frontendowe:

- `frontend/api/mapUiStateToCalcRequestDTO.js`
- `kalkulator/js/mapUiStateToCalcRequestDTO.js`
- `frontend/api/topinstalApi.js`
- `kalkulator/js/topinstalApi.js`
- `konfigurator/configurator-unified.js`

Frontend nie powinien juz liczyc "ostatecznej oferty" po swojemu. Ma:

- zebrac dane,
- zmapowac je do kontraktu,
- wyslac na backend,
- odebrac `OfferDTO`,
- wyrenderowac wynik.

### 3.2. REST entrypoint

Publiczne wejscie backendu to:

```text
POST /wp-json/topinstal/v1/calculate-offer
```

Kontroler:

- `wp-adapter/rest/CalculateOfferController.php`

Controller robi:

1. odczyt `traceId`,
2. auth gate,
3. rate limit,
4. walidacje payloadu,
5. uruchomienie `TopInstal_CalculateOffer_UseCase`,
6. zwrot `OfferDTO`.

Auth obsluguje:

- nonce (`X-WP-Nonce` lub `X-Topinstal-Nonce`),
- agent key.

### 3.3. Walidacja requestu

Walidator:

- `wp-adapter/rest/RequestValidator.php`

Walidator pilnuje m.in.:

- `schemaVersion`,
- obecnosci `lead`, `building`, `preferences`,
- geometrii budynku,
- sensownosci danych DHW,
- opcjonalnego `ozcResult`.

Istotna decyzja produktowa, pozostawiona swiadomie:

- publiczny kontrakt nadal dopuszcza dostarczenie gotowego `ozcResult`,
- backend moze wiec swiadomie ominac lokalne przeliczenie OZC,
- to NIE zostalo usuniete, bo zostalo przez Ciebie potwierdzone jako poprawne i pozadane.

### 3.4. Orkiestracja backendu

Glowny use-case:

- `core/application/CalculateOfferUseCase.php`

Sekwencja w use-case:

1. pobranie master-data i rules,
2. canonicalizacja requestu,
3. rozwiazanie `ozcResult`:
   - albo z payloadu zewnetrznego,
   - albo przez lokalny engine OZC,
4. wyliczenie selection,
5. wyliczenie cwu (`core/domain/cwu/CwuEngine.php`),
6. wyliczenie buffer,
7. wyliczenie pricing,
8. zlozenie `OfferDTO`,
9. agregacja warnings, assumptions, fallback meta i engine meta.

Aktualnie use-case przekazuje tez additive `context` do silnikow, zeby backend mial te same przeslanki runtime co kanoniczne `.js`.

---

## 4. Kontrakty i granice

### 4.1. Wejscie

Publiczny kontrakt wejsciowy:

- `CalcRequestDTO`

Praktycznie zawiera:

- `lead`
- `building`
- `preferences`
- opcjonalne `ozcResult`
- opcjonalne `context`
- `traceId`
- `schemaVersion`

### 4.2. Wyjscie

Publiczny kontrakt wyjsciowy:

- `OfferDTO`

Najwazniejsze sekcje:

- `engineering.ozc`
- `engineering.selection`
- `engineering.buffer`
- `engineering.cwu`
- `pricing`
- `warnings`
- `assumptions`
- `engineMeta`

### 4.3. Granica kompatybilnosci

Podczas zmian w tym czacie obowiazywala zasada:

- publiczne nazwy i envelope endpointow maja pozostac zgodne z dotychczasowym API,
- additive pola sa dopuszczalne,
- breaking change nie jest dopuszczalny.

Dlatego:

- nie usuwalismy publicznych pol kontraktowych,
- nowe dane dla parity weszly jako additive/internal `context.configurator`,
- `OfferDTO` zachowal publiczna forme.

---

## 5. Silniki obliczeniowe: aktualny model

## 5.1. OZC

### Referencyjne zrodlo zachowania

Referencyjny wzorzec obliczen OZC:

- `kalkulator/engine/ozc/ozc-engine.js`

Backendowy wrapper:

- `core/domain/ozc/OzcEngine.php`
- `core/domain/ozc/ozc-engine-runner.js`

W praktyce obecny model wyglada tak:

- `TopInstal_OzcEngine_Full` jest kanonicznym natywnym runtime PHP,
- `TopInstal_OzcEngine` jest parity/fallback engine po stronie PHP,
- `TopInstal_OzcEngine_JsReference` zostal zachowany tylko jako reference/parity archive przez Node,
- use-case domyslnie bierze engine Full bez zaleznosci runtime od Node.

### Co liczy OZC

OZC odpowiada za:

- design heat loss,
- recommended heating power,
- heated area,
- hot water power,
- metrics,
- assumptions,
- warnings,
- audit,
- extended explainability.

### Jak liczy OZC

Model OZC nie jest pelnym room-by-room EN 12831 solverem.
To blokowy engine obciazenia cieplnego, ktory laczy:

- geometrie budynku,
- przegrody,
- strefe klimatyczna,
- wentylacje,
- reguly materialowe i izolacyjne,
- poprawki i explainability.

Na poziomie produktu trzeba rozroznic:

- `design_heat_loss` - wynik kanoniczny,
- `annual_energy` - wynik heurystyczny,
- `energy_losses` - explainability,
- `bivalent_points` - advisory/heuristic.

To rozroznienie zostalo w tym czacie bardzo mocno usztywnione.

### Najwazniejsze aktualne zasady OZC

- brak lub zly `indoor_temperature` nie moze juz zejsc do `0 C`,
- full bridge zwraca `formatted + raw + audit`,
- `annual_energy` jest jawnie oznaczone jako `heuristic_hdd_v1`,
- `energy_losses` zachowuje fizyczny bilans 100%,
- parity i Full maja taki sam default lokalizacji: `PL_STREFA_III`.

### Co zostalo swiadomie bez zmiany

- `bivalent_points` pozostaly heurystyczne,
- nie przebudowywalismy ich na model curve-based,
- to byla swiadoma decyzja z tej rozmowy.

---

## 5.2. Selection

### Referencyjne zrodlo zachowania

Referencyjny wzorzec selection:

- `konfigurator/configurator-unified.js`
- w szczegolnosci `selectHeatPumps()` i `preparePumpProfiles()`

Backendowy odpowiednik:

- `core/domain/selection/SelectionEngine.php`

### Co robi selection

Selection odpowiada za:

- dobranie modelu pompy,
- okreslenie mocy,
- typu (`split` / `all-in-one`),
- fazy,
- listy rekomendowanych modeli,
- ostrzezen i reason codes,
- struktury `pumpSelection`.

### Charakter logiki

To nie jest OEM-grade selection po krzywych wydajnosci.
To engine katalogowo-zakresowy z wyjatkami specjalnymi.

Najwazniejsze zachowania:

- exact-range matching,
- special low-power path,
- special high-power path,
- brak nearest-fallback tam, gdzie frontend kanoniczny go nie robi,
- generowanie `pumpSelection.hp` i `pumpSelection.aio`.

### Co zostalo zmienione w tym czacie

PHP selection mial kilka driftow wzgledem kanonicznego JS:

Bylo:

- mogl wejsc nearest fallback, mimo ze referencyjny JS go nie uzywal,
- special-case split potrafil dostac dorobiony wariant AIO,
- backend nie przenosil semantyki special-case tak jak frontend.

Zmieniono:

- nearest fallback zostal wygaszony w aktywnej logice,
- special-case low-power/high-power zostaly zrownane do wzorca JS,
- AIO nie jest juz dorabiane tam, gdzie frontend zwraca tylko split,
- backend zachowuje bardziej zblizona semantyke special-case.

Dlaczego:

- bo selection `.js` zostal przez Ciebie wskazany jako referencyjny wzorzec zachowania.

---

## 5.3. Buffer

### Referencyjne zrodlo zachowania

Referencyjny wzorzec buffer/hydrauliki:

- `konfigurator/buffer-engine.js`

Backendowy odpowiednik:

- `core/domain/buffer/BufferEngine.php`

### Co robi buffer engine

Buffer engine odpowiada za:

- os A: `flow_protection`,
- os B: `hydraulic_separation`,
- os C: `energy_storage`,
- rekomendacje `NONE / BUFOR_SZEREGOWO / BUFOR_ROWNOLEGLE`,
- mapowanie do `setupType`,
- sizing bufora,
- assumptions, warnings, reason codes,
- explainability dla skladnikow sizingu.

### Jak liczy buffer

Najwazniejsze komponenty sizingu:

- `V_anti` - anti-cycling volume,
- `V_bivalent` - magazyn dla drugiego zrodla,
- `V_hydraulic` - deficyt hydrauliczny,
- `systemVolume.required / estimated / sufficient`.

Silnik syntezuje potem decyzje:

- czy bufor jest potrzebny,
- czy ma byc szeregowy czy rownolegly,
- jaka ma byc pojemnosc rynkowa po zaokragleniu.

### Krytyczny szczegol architektoniczny

Frontendowy kanoniczny buffer engine nie dziala tylko na `building + preferences`.
On dostaje tez runtime context z konfiguratora:

- wybrana pompa,
- hydraulics mini-form,
- meta snapshot.

To bylo glownym powodem driftu PHP po przepisaniu.

### Co bylo przed zmianami

Bylo:

- PHP mial za malo danych runtime wzgledem JS,
- nie dostawal pelnego `selectedPump`,
- nie dostawal `hydraulics_inputs`,
- nie dostawal tego samego `meta`,
- potrafil podjac inna decyzje niz frontend,
- regule producenta `3ph K -> 200 l` wykrywal, ale nie zawsze egzekwowal na finalnym litrazu,
- istnial dawny seam z preferencja `hasBuffer`, ktory mogl zbyt wczesnie zlamac logike.

### Co zmieniono

Zmieniono dwa poziomy:

1. transport danych do backendu,
2. logike samego PHP engine.

#### Transport danych

`konfigurator/configurator-unified.js` zaczal wysylac additive:

- `context.configurator.selectedPump`
- `context.configurator.hydraulics_inputs`
- `context.configurator.meta`

`CalculateOfferUseCase.php` przekazuje ten `context` dalej do `BufferEngine`.

#### Logika backendu

`BufferEngine.php` zostal zrownany do JS:

- czyta `selectedPump`, `hydraulics_inputs`, `meta`,
- normalizuje `radiators_is_ht`, `has_underfloor_actuators`, `bivalent` inputy,
- bierze rzeczywista moc/faze/serie pompy,
- bierze heated area z tego samego typu zrodel co frontend,
- odtwarza logike osi A/B/C jak w kanonicznym JS,
- zachowuje aktualna semantyke kolejnosci decyzji z JS,
- finalnie wymusza `3ph K -> 200 l` na rekomendowanej pojemnosci.

### Uwaga o "dziwnej" logice

W trakcie parity wyszly miejsca, gdzie JS ma wlasna, nie do konca intuicyjna semantyke.
Przy tej rozmowie priorytet byl jasny:

- backend ma liczyc tak jak referencyjny JS,
- nie poprawialismy "na czuja" frontendowego wzorca,
- tylko zrownalismy PHP do rzeczywistego runtime behavior `.js`.

---

## 5.4. Pricing

### Referencyjne zrodlo zachowania

Referencyjny wzorzec pricing:

- `konfigurator/configurator-unified.js`
- glownie:
  - `calculatePumpPrice()`
  - `calculateCwuPrice()`
  - `calculateBufferPrice()`
  - `calculateAccessoryPrice()`

Backendowy odpowiednik:

- `core/domain/pricing/PricingEngine.php`

### Co robi pricing

Pricing sklada:

- `PUMP`
- `HYDRAULIC`
- `BUFFER`
- `CWU`
- accessory items
- `INSTALLATION`
- totals net/vat/gross

### Charakter logiki

Pricing jest master-data driven, ale referencyjny JS ma bardzo konkretna semantyke runtime:

- cena pompy jest sterowana przede wszystkim przez `optionId`,
- nie kazdy rekomendowany bufor ma byc automatycznie policzony jako pozycja cenowa,
- wycena bufora pojawia sie po wyborze opcji,
- `installation` zalezy od obecnosci wybranej pompy, a nie od tego, czy cena pompy wyszla dodatnia.

### Co bylo przed zmianami

Bylo:

- PHP pricing wybieral price key glownie po `type + phase`,
- generic `hp` / `aio` mogly byc cicho podbijane do `_400`,
- backend auto-wycenial rekomendowany bufor nawet bez jawnego wyboru opcji,
- `INSTALLATION` bylo zwiazane z istnieniem dodatniej pozycji `PUMP`,
- mount type dla bufora byl czytany z innej semantyki niz w kanonicznym JS runtime.

### Co zmieniono

PricingEngine zostal ustawiony zgodnie z frontendowym wzorcem:

- generic `hp` / `aio` sa option-driven i nie dostaja ukrytego upgradu do `_400`,
- wycena `BUFFER` pojawia sie tylko po jawnym `bufferOptionId`,
- `INSTALLATION` zalezy od obecnosci selected pump, nie od dodatniej ceny `PUMP`,
- semantyka mount-type dla bufora zostala dostrojona do aktualnego runtime contract seamu kanonicznego JS.

### Dlaczego

Bo parity pokazala realne rozjazdy:

- JS i PHP mogly miec inna cene tej samej pompy,
- JS i PHP mogly inaczej wyceniac bufor,
- backend liczyl "bardziej inteligentnie", ale nie tak jak kanoniczny frontend,
- a celem bylo zrownanie zachowania, nie wymyslanie nowej logiki.

---

## 6. Parity JS vs PHP

> **Status 2026-06:** `core/application/harness/engine-parity.php` i `js-canonical-engine-parity-runner.js` **nie istnieja** w repo. Kanoniczny OZC to PHP (`TopInstal_OzcEngine_Full`); `kalkulator/engine/ozc/ozc-engine.js` usuniety. Weryfikacja silnikow: `npm run test:contract`, `ozc-full-audit.regression.php`, `npm run proof`. Otwarte ryzyka OZC: `ozc-professional-method-audit.md` § Code sync status.

## 6.1. Dlaczego parity byla potrzebna

Po przepisaniach backendowych okazalo sie, ze:

- stare frontendowe `.js` sa przez Ciebie traktowane jako kanoniczne wzorce,
- nowe PHP rewrite'y mialy rozjazdy zachowania,
- bez twardego harnessu mozna bylo tylko "wydawac sie", ze logika jest zgodna.

Dlatego powstal parity harness.

## 6.2. Co porownuje harness

Pliki:

- `core/application/harness/engine-parity.php`
- `core/application/harness/js-canonical-engine-parity-runner.js`

Harness porownuje:

- selection JS vs selection PHP,
- buffer JS vs buffer PHP,
- pricing JS vs pricing PHP,
- Full OZC bridge vs direct JS OZC.

W przypadku OZC parity jest liczona uczciwie:

- direct JS dostaje dokladnie ten payload, ktory backendowy bridge buduje z `building + preferences`,
- czyli porownujemy realna granice kontraktu, nie dwa rozne payloady testowe.

## 6.3. Jak dziala runner JS

`js-canonical-engine-parity-runner.js`:

- laduje realne funkcje z `konfigurator/configurator-unified.js`,
- laduje `window.BufferEngine` z `konfigurator/buffer-engine.js`,
- laduje direct JS OZC z `kalkulator/engine/ozc/ozc-engine.js`,
- uruchamia wspolne scenariusze,
- zwraca znormalizowany JSON do PHP harnessu.

## 6.4. Scenariusze parity

Harness obejmuje scenariusze reprezentujace wazne seamy:

- baseline underfloor split,
- low-power special case,
- gap / no-nearest-fallback case,
- 3-phase K series / AIO / mandatory 200 l,
- mixed + gas + actuators.

Po zmianach z tego czatu:

- `Engine parity OK (5 scenarios)`.

---

## 7. Zmiany wykonane w tym czacie

Ta sekcja zbiera zmiany chronologicznie i merytorycznie.

## 7.1. Cleanup legacy workflow i starych zrodel prawdy

### Co bylo

Byly stare seamy legacy:

- lokalny fallback kalkulacji po stronie frontu,
- `window.lastCalculationResult`,
- legacy pricing snapshot w konfiguratorze,
- stare fallbacki w summary/payload opierajace sie na globalach,
- stary sposob hydracji konfiguratora.

W praktyce moglo to prowadzic do sytuacji:

- backend liczy jedno,
- frontend pokazuje cos z lokalnej historycznej sciezki.

### Co zmieniono

Usunieto twarde legacy seams:

- lokalne legacy calc path,
- legacy pricing snapshot,
- fallbacki do `lastCalculationResult`,
- stare zrodla oferty w summary/payload,
- stare workflow hydracje oparte o dawny interfejs.

### Jak

Zmieniane byly glownie:

- `kalkulator/js/apiCaller.js`
- `kalkulator/js/resultsRenderer.js`
- `kalkulator/js/workflowController.js`
- `kalkulator/js/offerSummary.js`
- `kalkulator/js/offerPayload.js`
- `konfigurator/configurator-unified.js`
- `preview.php`
- `heatpump-calculator.php`

### Dlaczego

Bo aplikacja miala wejsc w finalny, backend-first ksztalt i nie bylo juz miejsca na dwa rownolegle zrodla prawdy.

---

## 7.2. OZC hardening

### Problem 1: `indoor_temperature`

Bylo:

- brak `indoor_temperature` mogl byc w JS interpretowany jak `0 C`,
- to zanizalo design load i potrafilo produkowac negatywne `avg_heating_power`.

Zmieniono:

- JS i PHP Full bridge teraz normalizuja temperature i wpadaja na `21 C`,
- pojawia sie `DEFAULT_INDOOR_TEMPERATURE_ASSUMED`,
- wynik przechodzi sanity guard.

Dlaczego:

- bo to byl blad krytyczny dla wiarygodnosci obliczen.

### Problem 2: explainability Full bridge

Bylo:

- Full bridge oddawal glownie sformatowany wynik,
- assumptions/warnings/defaults nie byly dobrze przenoszone downstream.

Zmieniono:

- bridge zwraca `formatted + raw + audit`,
- backend przenosi audit i metadane,
- `OfferDTO` zachowuje `engineering.ozc.audit`.

Dlaczego:

- bo bez tego sparse payload mogl wygladac jak "czysty" wynik, mimo duzej liczby fallbackow.

### Problem 3: `energy_losses`

Bylo:

- komponenty strat potrafily sumowac sie do wiecej niz 100%,
- bo mieszal sie breakdown fizyczny z korektami addytywnymi.

Zmieniono:

- explainability opiera sie na fizycznym bilansie,
- suma `energy_losses` wraca do 100%.

Dlaczego:

- bo breakdown ma byc interpretowalny i inzyniersko uczciwy.

### Problem 4: annual energy

Bylo:

- roczna energia byla liczona heurystycznie, ale wynik nie byl jasno nazwany jako heurystyczny,
- to moglo byc odczytywane jak wynik normowy.

Zmieniono:

- `annual_energy` zostalo jawnie oznaczone jako `heuristic_hdd_v1`,
- `canonical = false`,
- klasyfikacja jest widoczna w `audit`.

Dlaczego:

- bo trzeba rozdzielic wynik kanoniczny od estimate/advisory.

### Problem 5: default location

Bylo:

- parity i Full mialy rozne semantyki domyslnej lokalizacji.

Zmieniono:

- obie sciezki korzystaja z `PL_STREFA_III`.

Dlaczego:

- bo kontrakty backendowe musza byc spojne, a roznica nie moze byc widoczna dla uzytkownika.

### Co swiadomie zostalo bez zmiany

- `bivalent_points` zostaly takie, jakie byly,
- ich przebudowa zostala odlozona decyzja produktowa z tego czatu.

---

## 7.3. Decyzja: JS jest kanoniczny dla selection/buffer/ozc/pricing

W pewnym momencie tej rozmowy zostala przyjeta jednoznaczna decyzja:

- frontendowe `.js` sa kanonicznymi wzorcami zachowania dla silnikow,
- nowe `.php` po przepisaniu maja sie do nich dostroic.

To przestawilo logike pracy z:

- "naprawiamy frontend do backendu"

na:

- "budujemy parity i dostrajamy backend do wzorca `.js`".

To byla jedna z najwazniejszych decyzji architektonicznych tej rozmowy.

---

## 7.4. Parity rollout: configurator context -> backend

### Co bylo

Backend selection/buffer/pricing nie dostawaly wszystkich danych, ktorymi operuje referencyjny JS runtime.

Szczegolnie brakowalo:

- pelnego `selectedPump`,
- `hydraulics_inputs`,
- `meta`.

### Co zmieniono

`konfigurator/configurator-unified.js` zaczal przekazywac do backendu:

- `context.configurator.selectedPump`
- `context.configurator.hydraulics_inputs`
- `context.configurator.meta`

Backend use-case przekazuje ten context dalej do silnikow.

### Dlaczego

Bo bez tej warstwy PHP i JS nie pracowaly na tym samym zestawie przeslanek.

---

## 7.5. Selection parity rollout

### Co bylo

PHP selection mial aktywne lub latwo dostepne zachowania, ktorych referencyjny JS nie mial:

- nearest fallback,
- AIO dorabiane dla special-case split.

### Co zmieniono

SelectionEngine zostal zblizony do JS:

- special-case low-power i high-power zachowuja sie jak w `preparePumpProfiles()`,
- forced split nie generuje sztucznego AIO,
- backend lepiej odwzorowuje aktualny frontendowy runtime.

### Dlaczego

Bo selection parity byla jednym z glownych celow tej fazy.

---

## 7.6. Buffer parity rollout

### Co bylo

Buffer PHP byl przepisywany, ale mial inne wejsciowe przeslanki niz frontendowy `buffer-engine.js`.

### Co zmieniono

BufferEngine:

- czyta configurator parity context,
- normalizuje inputy hydrauliki jak JS,
- korzysta z tej samej informacji o pompie,
- egzekwuje 3ph-K 200 l na finalnym sizingu,
- zachowuje aktualna semantyke kolejnosci decyzji z kanonicznego JS.

### Dlaczego

Bo to byl najwiekszy praktyczny seam pomiedzy starym frontendowym wzorcem a nowym backendowym rewrite.

---

## 7.7. Pricing parity rollout

### Co bylo

Pricing PHP byl "sprytniejszy" niz JS, ale przez to inny:

- dopowiadal `_400`,
- liczyl bufor bez jawnego wyboru,
- warunkowal instalacje od ceny pompy.

### Co zmieniono

PricingEngine zostal zrownany do semantyki frontendowej:

- option-driven pump pricing,
- explicit buffer selection,
- installation po selected pump presence,
- mount-type pricing zgodny z runtime seamem JS.

### Dlaczego

Bo parity miala mierzyc realne zachowanie, nie intuicyjnie "lepsze" backendowe dopowiedzenia.

---

## 8. Co zostalo swiadomie bez zmiany

W tym czacie swiadomie NIE zmieniano:

- publicznego `ozcResult` bypass - zostal uznany za poprawny i potrzebny,
- heurystycznych `bivalent_points`,
- ogolnej biznesowej natury selection engine jako modelu katalogowo-zakresowego,
- publicznego envelope API,
- glownych nazw kontraktowych `CalcRequestDTO` i `OfferDTO`.

To wazne, bo brak zmiany tez jest decyzja architektoniczna.

---

## 9. Weryfikacja po zmianach

Aktualna powierzchnia weryfikacji (2026-06):

- `npm run verify` — JS syntax, regressions, PHP lint, `test:contract`, `test:fixtures`
- `npm run proof` — `verify` + Playwright `@critical` + soft tier (runtime domyslnie `:8091`)
- `npm run test:rest` — REST e2e (wymaga `TOPINSTAL_REST_BASE_URL`)

Historycznie (sekcja parity): `engine-parity.php` raportowal `Engine parity OK (5 scenarios)` — harness usuniety.

---

## 10. Praktyczne podsumowanie

Po tej serii zmian aktualny stan jest taki:

- frontend nie ma juz byc alternatywnym zrodlem finalnej oferty,
- backend jest autorytatywnym producentem `OfferDTO`,
- selection/buffer/pricing sa w PHP z harnessami regresji (`test:contract`),
- OZC kanoniczny w PHP (`TopInstal_OzcEngine_Full`) z audytem i harnessami; otwarte P0/P1: `ozc-professional-method-audit.md` § Code sync status,
- historyczny PHP↔JS parity harness usuniety — nie zakladaj zgodnosci z usunietym `ozc-engine.js`,
- kompatybilnosc publicznego API zostala utrzymana.

Najkrocej:

```text
stary problem: frontendowy wzorzec i backendowy rewrite rozjezdzaly sie
stan 2026-06: backend jest source of truth dla API i OZC; testy: `test:contract` + `proof` (nie `test:engine-parity`)
```

---

## 11. Powiazane pliki

Najwazniejsze pliki do dalszej pracy:

- `wp-adapter/rest/CalculateOfferController.php`
- `wp-adapter/rest/RequestValidator.php`
- `core/application/CalculateOfferUseCase.php`
- `core/domain/ozc/OzcEngine.php`
- `core/domain/selection/SelectionEngine.php`
- `core/domain/buffer/BufferEngine.php`
- `core/domain/pricing/PricingEngine.php`
- `konfigurator/configurator-unified.js`
- `konfigurator/buffer-engine.js`
- `core/application/harness/ozc-full-audit.regression.php`
- `core/application/harness/calculate-offer.fixtures.php`

---

## 12. Status dokumentu

Stan dokumentu:

- ma opisywac aktualny stan zgodny z kodem; przy rozbieznosciach weryfikuj `core/`, `wp-adapter/`, `kalkulator/`, `konfigurator/`, `package.json`,
- ma byc aktualizowany przy kolejnych duzych zmianach workflow, silnikow lub parity.
