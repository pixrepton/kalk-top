# kalk-top — dokumentacja produktu i systemu

**Wersja:** 2026-05-26 · **Rola:** jedyne źródło prawdy kalkulacji HVAC i `OfferDTO` w TOP-INSTAL
**Ekosystem:** [`../knowledge/OS_README.md`](../knowledge/OS_README.md)
**Szczegóły techniczne:** [`docs/HANDBOOK.md`](docs/HANDBOOK.md), [`docs/SOURCE_OF_TRUTH_INDEX.md`](docs/SOURCE_OF_TRUTH_INDEX.md)

---

## Dla klienta końcowego i handlowca

### Po co jest kalkulator

To **oficjalny kalkulator firmy TOP-INSTAL** do wstępnego doboru pompy ciepła Panasonic. Po wypełnieniu formularza (lub konfiguratora maszynowni) otrzymujesz:

- rekomendowaną moc i model pompy,
- dobór bufora i zbiornika CWU,
- **cenę brutto** i podsumowanie techniczne,
- możliwość wygenerowania **PDF oferty** (przez generator — osobna wtyczka).

Wynik na ekranie to **propozycja** — ostateczna oferta handlowa może wymagać wizyty i korekty.

### Gdzie działa

- Strona **topinstal.com.pl** (WordPress, wtyczka kalkulatora)
- **Konfigurator maszynowni** — krokowy dobór z kartami pomp
- Pośrednio: **cieplo.app** (wynik HTML → mail → orchestrator liczy ten sam silnik)
- Pośrednio: **fast-kalk** (widget leadgen — uproszczone pytania + ten sam endpoint)

### Co musisz wiedzieć jako operator

- Jeśli konfigurator pokazuje **pusty krok 1** (brak kart pomp) — to błąd danych/API, nie „brak oferty”; zgłoś developerowi (sesja 7ebc95d8 — typowo REST/auth/pricebook).
- Kalkulator **nie czyta** skrzynki Gmail — sprawy mailowe to gmail-agent.

---

## Dla developera

### Kontrakt kanoniczny

```text
CalcRequestDTO
  → POST /wp-json/topinstal/v1/calculate-offer
  → OfferDTO
```

**Właściciel logiki:** `core/application`, `core/domain` — nie `kalkulator/` ani `konfigurator/` (tylko UI).

### Struktura repo

| Ścieżka             | Odpowiedzialność              |
| ------------------- | ----------------------------- |
| `core/domain/`      | Modele, reguły OZC, dobór     |
| `core/application/` | Use case `CalculateOffer`     |
| `wp-adapter/rest/`  | REST WP, auth agent key       |
| `kalkulator/`       | Formularz główny (frontend)   |
| `konfigurator/`     | Maszynownia (frontend)        |
| `frontend/api/`     | Mapowanie UI → CalcRequestDTO |
| `docs/contracts/`   | Kontrakty JSON, nowe wejścia  |

### Konsumenci REST (prod)

| Konsument                     | Autoryzacja                                  |
| ----------------------------- | -------------------------------------------- |
| WWW topinstal                 | Nonce / sesja WP                             |
| topinstal-cieplo-orchestrator | `TOPINSTAL_CALC_AGENT_API_KEY`               |
| fast-kalk plugin              | Ten sam agent key                            |
| RAG (opcjonalnie)             | offer_context w `/chat` — nie zastępuje POST |

### WordPress lokalnie

```text
heatpump-calculator.php  — bootstrap wtyczki
preview.php             — podgląd UI bez pełnego WP
```

Patrz: `AGENTS.md`, skill `kalk-top-wp-runtime-verifier`.

### Testy

```powershell
# PHPUnit / pytest zależnie od warstwy — patrz docs/HANDBOOK.md
```

### Wdrożenia maj 2026

| Data     | Zmiana                                                     |
| -------- | ---------------------------------------------------------- |
| 22–23.05 | Kontrakty pod registry / orchestrator (bez zmiany silnika) |
| 25.05    | Sesja konfigurator — fix pustych kart (jeśli zmergowany)   |

### Granice (nie implementuj tutaj)

- Gmail poll, Postgres spraw
- Render PDF (→ `top-instal-generator`)
- RAG jako źródło cen

### Agent AI

1. `AGENTS.md`
2. `docs/HANDBOOK.md`
3. Skill: `kalk-top-offerdto-contract` przy zmianach OfferDTO

---

_Mapa dokumentacji: [`docs/README.md`](docs/README.md) · README skrót: [`README.md`](README.md)_
