# UI Change Surface

## Pliki do zmiany (Faza 1–3)

| Plik                                          | Zakres                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `kalkulator/css/main.css`                     | Tokeny, hero, progress, stage-header, help, cards, buttons, summary panel, results hierarchy |
| `kalkulator/css/wordpress-integration.css`    | Hero min-height / full-bleed sync                                                            |
| `kalkulator/css/mobile-redesign.css`          | Hero mobile, help accordion, profile accordion                                               |
| `kalkulator/calculator.php`                   | Hero, progress meta, stage headers, CTA, results header                                      |
| `kalkulator/js/workflowController.js`         | Progress + workflow summary header                                                           |
| `kalkulator/js/uiSummary.js`                  | Panel profilu budynku                                                                        |
| `kalkulator/js/choiceInsights.js`             | Insights + help progressive disclosure                                                       |
| `kalkulator/js/calculatorInit.js`             | Bootstrap modules                                                                            |
| `kalkulator/js/resultsRenderer.js`            | kW / W/m² / loss insight                                                                     |
| `konfigurator/configurator-unified.js`        | Progress sync + recommendation badges                                                        |
| `konfigurator/configurator-presentation.json` | Badge copy                                                                                   |
| `konfigurator/configurator-v2-flat.css`       | Shared badge/selected language                                                               |
| `heatpump-calculator.php`                     | Enqueue choiceInsights                                                                       |
| `package.json`                                | verify:js                                                                                    |
| `docs/ui-ux/*`                                | Dokumentacja + proof                                                                         |

## Zależności ładowania CSS

1. `wordpress-integration.css`
2. `main.css`
3. `error-system.css` / `onboarding-modal.css` / `workflow-system.css`
4. `mobile-redesign.css`
5. `configurator.css`
6. `configurator-v2-flat.css`

Enqueue: `heatpump-calculator.php` → `enqueue_calculator_assets()`.

## Kluczowe selektory

- `.hero`, `.hero-lead`, `.hero-scope`
- `.progress-bar-container`, `.progress-meta`, `#progress-percentage`, `#progress-label`
- `.stage-header`, `.stage-header__label`, `.stage-header__title`, `.stage-header__desc`
- `.help-box`, `.help-box__summary`, `.help-box__details`
- `.option-card`, `.option-card--selected`, `.ui-option.is-selected`
- `.btn-next1`…`.btn-next5`, `.btn-finish`, `.btn-prev`
- `.ti-ui-summary-panel`
- `.results-summary-header`

## Komponenty JS

- `workflowController.updateProgress`
- `uiSummary.createPanel` / `refresh`
- `resultsRenderer` (bez zmiany kontraktu danych)
- `mobileController` (nie zmieniać logiki; unikać konfliktu labeli progress)

## Testy

- Gate A: `npm run proof` (engine + `@critical` + soft)
- Critical: `calculator-smoke`, `finish-cta`, `form-validation-gate`, `configurator-pump-step`, `business-personas`
- Visual proof: `docs/ui-ux/proof/before|after/`

## Kontrakty — nie wolno zmieniać

- `docs/contracts/API_CALCULATE_OFFER.md`
- `docs/contracts/dto-and-boundaries.md`
- `CalcRequestDTO` / `OfferDTO` shape
- REST `/calculate-offer` payload
- Analytics event names / funnel semantics
- Generator PDF field mapping
- Node B lead registry payloads
- Business pricebook / engineering policy values
