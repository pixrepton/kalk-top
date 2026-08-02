# top-instal-generator — dokumentacja produktu i systemu

**Wersja:** 2026-05-26 · **Rola:** render dokumentów PDF/DOCX z danych oferty (`OfferDTO`)
**Ekosystem:** [`../knowledge/OS_README.md`](../knowledge/OS_README.md)

---

## Dla użytkownika (handlowiec / biuro)

### Po co jest generator

Po policzeniu oferty w **kalkulatorze** (lub automatycznie z pipeline’u Cieplo) potrzebujesz **ładnego pliku** dla klienta — Word lub PDF z logo, tabelami i ceną. Generator:

- bierze **gotowe liczby** z kalkulatora (nie liczy mocy pompy sam),
- wypełnia szablon DOCX placeholderami,
- udostępnia link do pobrania PDF lub DOCX.

Interfejs w stylu „Windows 95” na stronie WP: wybór mocy, CWU, bufora, zestawu, ceny.

### Typowy proces

1. Shortcode `[top_instal_offer_generator]` na stronie (lub wywołanie REST z innego systemu).
2. Wybór parametrów → **Generuj ofertę**.
3. Pobranie pliku.

Jeśli brak ceny dla konfiguracji — generator **zablokuje** wysyłkę (komunikat błędu).

---

## Dla developera

### Zasada architektoniczna

**Zero logiki HVAC w generatorze.** Wejście: `OfferDTO` lub ręczny formularz mapowany na ten sam kontrakt. Kalkulacja = wyłącznie `kalk-top`.

### Przepływ REST (automatyczny)

```text
OfferDTO (JSON)
  → POST /wp-json/.../offer-documents/generate
  → mode: from-offer-dto
  → TopInstal_GenerateOfferDocument_UseCase
  → PDF/DOCX + URL
```

### Konsumenci

| Konsument         | Ścieżka                            |
| ----------------- | ---------------------------------- |
| kalk-top WWW      | Po calculate-offer                 |
| cieplo-worker     | `integrations/generator/client.py` |
| RAG (opcjonalnie) | Tool / adapter — nie SoT           |

### Struktura (skrót)

| Element       | Opis                                          |
| ------------- | --------------------------------------------- |
| Szablony DOCX | Katalog pluginu (patrz README § szablony)     |
| `vendor/`     | phpword, dompdf — Composer                    |
| Konwerter VPS | `converter-vps/` — opcjonalny DOCX→PDF zdalny |

### Wymagania WP

- PHP 7.4+, rozszerzenia: zip, xml, gd, curl
- WordPress 5.0+
- `composer install` jeśli brak `vendor/`

### Wdrożenia maj 2026

- Udział w E2E Cieplo 23.05 (PDF po kalk-top) — env `GENERATOR_*` na VPS orchestratora
- Brak zmian architektury w oknie 7 dni — stabilny kontrakt `from-offer-dto`

### Testy i walidacja

Patrz README § „Testy i walidacja” — snapshoty PDF, ręczna regresja szablonów.

### Agent AI

- `AGENTS.md`
- Ekosystem: `docs/ecosystem/README.md`
- GitNexus kotwica: `TopInstal_GenerateOfferDocument_UseCase`

---

_Pełny README użytkownika+dev: [`README.md`](README.md)_
