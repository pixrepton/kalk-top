# Proof before deploy (kalk-top)

Lokalna bramka jakości przed wdrożeniem kalkulatora / konfiguratora na WordPress (bez GitHub Actions).

## Jedna komenda

```powershell
cd c:\Users\compg\Desktop\kalk-top
npm run proof
```

Składa się z:

| Tier        | Skrypt               | Co sprawdza                                                                          |
| ----------- | -------------------- | ------------------------------------------------------------------------------------ |
| Engine      | `verify:engine`      | JS syntax + regressions + integracja VM + PHP contract + fixtures + production-shape |
| UI critical | `verify:ui:critical` | Playwright: smoke, finish CTA, konfigurator pompa, persony, walidacja formularza     |
| UI soft     | `verify:ui:soft`     | Full journey, hydraulics layout, mobile finish; REST opcjonalny                      |

**Exit code `proof`:** krytyczne warstwy muszą przejść. Soft może zgłosić `SKIP PDF` bez blokowania całego `proof` (patrz niżej).

## Przygotowanie runtime (pierwszy raz lub po zmianach pluginu)

```powershell
npm run runtime:sync
npm run runtime:start
```

Playwright `global-setup` uruchomi sync/start automatycznie, jeśli port `8090` nie nasłuchuje.

Domyślny URL: `http://127.0.0.1:8090/?page_id=5`
Zmienne: `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_CALCULATOR_PATH`.

## Tylko wybrane tiery

```powershell
npm run verify:engine
npm run verify:ui:critical
npm run verify:ui:soft
```

## PDF (soft)

Generator ofert (top-instal-generator) może być niedostępny lokalnie. Wtedy `full-journey` oznacza krok PDF jako **SKIP** (adnotacja Playwright), a `proof` nadal kończy się sukcesem.

Twardy wymóg PDF:

```powershell
$env:PROOF_PDF_REQUIRED = "1"
npm run test:e2e:journey
```

## REST zewnętrzny (soft)

```powershell
$env:TOPINSTAL_REST_BASE_URL = "https://twoja-domena.pl"
$env:TOPINSTAL_REST_NONCE = "nonce"
npm run verify:ui:soft
```

## Raporty artefaktów

| Plik                                     | Zawartość                                               |
| ---------------------------------------- | ------------------------------------------------------- |
| `test-results/journey-report.json`       | Kroki ostatniego journey + ostatni udany krok przy fail |
| `test-results/full-journey-screenshots/` | Zrzuty E2E                                              |
| `test-results/console-errors.json`       | Błędy konsoli przy fail critical                        |
| `playwright-report/`                     | HTML: `npx playwright show-report`                      |

## Typowe problemy

| Objaw                                  | Działanie                                                            |
| -------------------------------------- | -------------------------------------------------------------------- |
| `#heatCalcFormFull` timeout            | `npm run runtime:sync` + `runtime:start`                             |
| `calculate-offer` 200, brak Gratulacji | Sprawdź `finish-cta` + `kalkulator/js/integration/workflow-dispatch` |
| Journey wisi na starcie                | Nie używaj `networkidle`; użyj `gotoCalculator` (już w helperze)     |
| PDF fail w soft                        | OK bez `PROOF_PDF_REQUIRED`; uruchom generator lub ustaw skip        |

## Szacowany czas

- `verify:engine`: ~1–3 min
- `verify:ui:critical`: ~3–6 min (workers=1)
- `verify:ui:soft`: ~5–15 min (zależnie od PDF/generatora)
