# KALK-TOP — Technical Premium UI/UX Evolution

Status: active design brief for controlled frontend modernization.  
Date: 2026-08-03  
Branch: `feat/kalk-top-technical-premium-ui`

## Cel

Doprowadzić publiczny kalkulator i konfigurator maszynowni do wyglądu profesjonalnego narzędzia HVAC klasy premium, zachowując obecną tożsamość, funkcjonalność i szczegółowość procesu.

Docelowy rezultat: około 70% obecnej architektury UX + uporządkowana, dojrzalsza warstwa wizualna (w kierunku stylu konfiguratora).

## Granice (nienaruszalne)

Nie zmieniać:

- algorytmów OZC, doboru, polityk CWU/bufora/hydrauliki/ceny;
- kontraktów REST, `CalcRequestDTO`, `OfferDTO`;
- mapowania PDF, integracji Node B, leadów, semantyki analityki;
- odpowiedzialności warstw (`kalk-top` pozostaje właścicielem HVAC + `OfferDTO`).

Zmiana jest frontendowa / prezentacyjna.

## Relacja do fast-kalk

`kalk-top` pozostaje dokładnym, transparentnym narzędziem z pełną konfiguracją.  
Nie zbliżać funkcjonalnie do uproszczonego `fast-kalk`.

## Interpretacja mockupu

Mockup = north star charakteru (hero, złoto marki, czysta przestrzeń robocza, progress, karty, help panel), nie pikselowe studio 3-kolumnowe.

**Decyzja projektowa:** mockup = north star charakteru (hierarchia, hero, progress, karty, help, złoto marki, chłodny tech accent).  
Wskazówka „w stronę konfiguratora” dotyczy wyłącznie spójności kolorystyki/kart między dwoma istniejącymi powierzchniami — nie zamienia celu na redesign pod konfigurator.

## Design tokens (kanoniczne)

Źródło prawdy tokenów: `kalkulator/css/main.css` `:root`.

| Token                                       | Rola                                                 |
| ------------------------------------------- | ---------------------------------------------------- |
| `--color-gold` / `--color-accent` `#d4a574` | marka, CTA primary, selected, rekomendacja           |
| `--color-tech` `#3d5a80`                    | wartości systemowe, jednostki, aktywny progress tech |
| `--color-success` zieleń                    | sukces / walidacja pozytywna                         |
| `--color-warning` bursztyn                  | ostrzeżenie                                          |
| `--color-danger` czerwień                   | błąd / invalid                                       |
| `--color-info` błękit                       | info / help accent                                   |
| `--font-family` Titillium Web               | UI ciągłość                                          |
| `--font-mono` IBM Plex Mono                 | wyłącznie kluczowe wartości techniczne               |

Złoto **nie** jest jednocześnie sukcesem, błędem, ostrzeżeniem i info.

## Komponenty

- Hero skrócony + 3 dyskretne scope items
- Sticky progress: faza / ETAP n Z m / nazwa / % kompletności
- Stage headers: label + title sentence-case + krótki opis
- Karty wyboru: spójne stany default/hover/selected/focus/invalid/disabled
- Help-boxy: lżejsze, left accent, desktop prawo / mobile accordion
- Panel `PROFIL BUDYNKU` (projekcja stanu z `uiSummary.js`)
- CTA kontekstowe (bez `→ Dalej →`)
- Results summary header — hierarhia bez nowego systemu

## Desktop

Zachowany model: formularz lewa + pomoc prawa.  
Panel profilu kompaktowy, nie dashboard.

## Mobile

Jedna kolumna; hero 200–250 px; help jako belka rozwijana; touch ≥44 px; bez usuwania `mobile-redesign.css`.

## Wyniki

Istniejący `results-summary-header` + czytelniejsza hierarchia metryk.  
Bez sztucznych score/certyfikatów.

## Konfigurator

Faza 3: wspólne tokeny, spójne karty, sticky summary — bez ukrywania kroków.

## Dostępność

Focus ring niezależny od koloru; błędy czerwone + tekst; `prefers-reduced-motion`.

## Motion

120–180 ms interakcje; 180–260 ms sekcje; bez bounce/spring/neon.

## Architektura CSS (minimalna)

```
wordpress-integration.css  → izolacja WP / full-bleed
main.css                   → tokeny + komponenty kalkulatora (kanoniczne)
error/onboarding/workflow  → domenowe
mobile-redesign.css        → korekty mobile (stopniowa redukcja długu)
configurator.css + v2-flat → layout konfiguratora; inherytuje tokeny main
```

Bez dziewiątego pliku override.

## Lista zmian (Faza 1–3)

- Tokeny semantyczne + tech accent + typografia base ≥16px
- Hero skrócony (HTML + CSS + WP/mobile overrides)
- Progress meta (HTML + `workflowController.js`)
- Nagłówki etapów sentence-case + stage-header
- CTA kontekstowe
- Help-boxy lżejsze + toggle „Więcej szczegółów” + mobile accordion
- Panel profilu budynku (projekcja `uiSummary`)
- Lekka synchronizacja selected/gold z konfiguratorem
- Progress konfiguratora w globalnym pasku (`KONFIGURACJA n Z m`)
- Badge `REKOMENDACJA TOP-INSTAL`
- Hierarchia wyników: kW + W/m² + insight strat (gdy `energy_losses`)
- Choice insights (ogrzewanie / wentylacja / bryła)
- Karty: selected gold + `Wybrano`

## Pozostawione bez zmian

Proces etapów, walidacja, OZC/REST/DTO, PDF/leady, pełny konfigurator 10 kroków, sticky progress mechanika, `results-summary-header` jako komponent.
