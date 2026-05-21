# Agent biznesowy TOP-INSTAL - narzedzia do celow biznesowych

> **Cel:** Agent AI działający na VPS, z chatem (Telegram/Slack), który **korzysta** z narzędzi ekosystemu do pracy biznesowej. Agent **nie** zmienia kodu, konfiguracji ani infrastruktury — tylko **wywołuje** API.

---

> Status: operational
> Owner: TOP-INSTAL ecosystem governance
> Last verified against code/runtime: 2026-04-03 (metadata normalization pass)
> Source-of-truth level: L2
> Supersedes: none
> Related docs: `TOPINSTAL_ECOSYSTEM_STATE.md`, `TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md`, `../SOURCE_OF_TRUTH_INDEX.md`

> This document is an ecosystem-level tool summary for business-facing agents. It does not override repo-local execution rules, runtime validators, or canonical contract docs.
>
> Broader future agent-runtime documentation should ultimately live outside `kalk-top`; this file should stay focused on ecosystem tool boundaries relevant to the current repos.

## 1. Rola agenta

| Agent robi                                   | Agent NIE robi                   |
| -------------------------------------------- | -------------------------------- |
| Oblicza zapotrzebowanie na pompÄ™ (OZC)       | Zmienia kodu kalk-top            |
| Wylicza oferty (CalcRequestDTO → OfferDTO)   | Zarządza serwerami / backupami   |
| Generuje dokumenty ofertowe (DOCX/PDF)       | Deployuje aplikacje              |
| Korzysta z RAG przy wyjaśnieniach            | Modyfikuje konfiguracji narzędzi |
| Orkiestruje workflow: kalkulator → generator | DevOps / infrastruktura          |

Agent jest **warstwą orkiestracyjną** nad istniejącymi API — użytkownik biznesowy, nie administrator.

**Realizacje w ekosystemie (to samo API, inne procesy):**

- **agent-zordon** — serwis Python (LangGraph) + plugin WordPress; narzędzia jak poniżej (`calculate_offer`, `generate_offer_document`, `ask_rag`, pliki w `KNOWLEDGE_PATH`).
- **topinstal-cieplo-orchestrator** — automatyzacja po **mail-ingress** na VPS (HTML cieplo.app → CalcRequestDTO → kalk-top → generator); to nie jest "chat agent", ale ten sam **kalk-top + generator** jako źródło prawdy.

Szczegóły ścieżek: `TOPINSTAL_ECOSYSTEM_STATE.md` §1 i §3.

---

## 2. Narzędzia agenta (tools) — mapowanie na API

### 2.1 `calculate_offer` — obliczanie oferty

**Źródło:** kalk-top REST `POST /wp-json/topinstal/v1/calculate-offer`

| Parametr       | Opis                                 | Przykład               |
| -------------- | ------------------------------------ | ---------------------- |
| CalcRequestDTO | lead, building, preferences, context | Z rozmowy / formularza |
| traceId        | Korelacja end-to-end                 | UUID                   |

**Zwraca:** OfferDTO (engineering, pricing, warnings)

**UĹĽycie przez agenta:**

- Użytkownik: "Oblicz zapotrzebowanie na pompę dla domu 150 m², Gdańsk"
- Agent: buduje CalcRequestDTO, wywołuje `calculate_offer`, interpretuje OfferDTO, odpowiada tekstem

---

### 2.2 `generate_offer_document` — generowanie DOCX/PDF

**Źródło:** top-instal-generator `POST /wp-json/topinstal/v1/offer-documents/generate`

| Parametr      | Opis                               |
| ------------- | ---------------------------------- |
| OfferDTO      | Z poprzedniego kroku lub z payload |
| output_format | docx \| pdf                        |
| documentType  | offer_document (default)           |

**Zwraca:** OfferDocumentResponseDTO (document_id, download_url, etc.)

**UĹĽycie przez agenta:**

- Użytkownik: "Wygeneruj PDF oferty"
- Agent: używa OfferDTO z kontekstu (lub wcześniejszego `calculate_offer`), wywołuje `generate_offer_document`, zwraca link do pobrania

---

### 2.3 `ask_rag` — wiedza i wyjaśnienia

**Źródło:** rag-chat-asystent (API RAG)

| Parametr | Opis                                           |
| -------- | ---------------------------------------------- |
| query    | Pytanie uĹĽytkownika                            |
| context  | Opcjonalnie: OfferDTO, reasonCodes, engineMeta |

**Zwraca:** Odpowiedź z bazy wiedzy (dokumentacja, FAQ, wyjaśnienia)

**UĹĽycie przez agenta:**

- Użytkownik: "Co oznacza reasonCode BUFFER_OVERSIZED?"
- Agent: wywołuje `ask_rag` z query + context, zwraca wyjaśnienie

---

### 2.4 `http_request` (fallback) — dowolne wywołanie REST

Dla przypadków, gdy agent musi wywołać API nieobjęte dedykowanymi narzędziami (np. mail-ingress, przyszłe endpointy).

---

## 3. Architektura implementacji

```
┌─────────────────────────────────────────────────────────────────┐
│  Chat (Telegram / Slack)                                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             â–Ľ
┌─────────────────────────────────────────────────────────────────┐
│  Agent (VPS)                                                     │
│  - LLM (OpenAI / local / Groq)                                   │
│  - Tool definitions: calculate_offer, generate_offer_document,  │
│    ask_rag, http_request                                         │
│  - Kontekst: sesja, ostatni OfferDTO, traceId                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST
         ┌───────────────────┼───────────────────┐
         â–Ľ                   â–Ľ                   â–Ľ
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ kalk-top        │ │ top-instal-     │ │ rag-chat-       │
│ /calculate-offer│ │ generator       │ │ asystent        │
│                 │ │ /offer-docs/    │ │ (RAG API)       │
│                 │ │ generate        │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 4. Opcje implementacyjne

### 4.1 OpenClaw + własne narzędzia (rekomendowane)

- **OpenClaw** ma wbudowane `http_request` — agent może od razu wywoływać REST.
- Dla czytelności i walidacji: **własne narzędzia** jako pluginy:
  - `calculate_offer` — wrapper na POST kalk-top
  - `generate_offer_document` — wrapper na POST generator
  - `ask_rag` — wrapper na API RAG

**Konfiguracja narzędzi (przykład):**

```yaml
agents:
  topinstal-agent:
    tools:
      - calculate_offer # własny plugin
      - generate_offer_document
      - ask_rag
      - http_request # fallback
```

**Rejestracja własnego narzędzia (Node.js plugin):**

```javascript
api.registerTool(
  {
    name: "calculate_offer",
    description:
      "Oblicza ofertÄ™ HVAC (zapotrzebowanie OZC, dobĂłr pompy, bufor, ceny). Wymaga: building (powierzchnia, lokalizacja), lead (email), preferences.",
    parameters: Type.Object({
      building: Type.Object({
        area_m2: Type.Number(),
        location: Type.String(),
      }),
      lead: Type.Object({ email: Type.String() }),
      preferences: Type.Optional(
        Type.Object({ buffer: Type.Boolean(), tank: Type.Boolean() }),
      ),
    }),
    async execute(_id, params) {
      const dto = mapToCalcRequestDTO(params);
      const res = await fetch(
        KALK_TOP_URL + "/wp-json/topinstal/v1/calculate-offer",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Top-Instal-Agent-Key": process.env.AGENT_KEY,
          },
          body: JSON.stringify(dto),
        },
      );
      return {
        content: [{ type: "text", text: JSON.stringify(await res.json()) }],
      };
    },
  },
  { optional: true },
);
```

---

### 4.2 LangGraph + custom tools

- **LangGraph** — graf stanów, multi-step, retry, human-in-the-loop.
- Narzędzia jako funkcje Pythona z `@tool`:

```python
@tool
def calculate_offer(building_area_m2: float, location: str, lead_email: str, buffer: bool = True) -> str:
    """Oblicza ofertÄ™ HVAC. Zwraca OfferDTO w JSON."""
    dto = {"building": {"area_m2": building_area_m2, "location": location}, "lead": {"email": lead_email}, ...}
    r = requests.post(f"{KALK_TOP_URL}/wp-json/topinstal/v1/calculate-offer", json=dto, headers=...)
    return r.json()
```

- **LangGraph Server** — REST API dla agenta, integracja z Telegram/Slack przez webhook.

---

### 4.3 n8n / Make — workflow no-code

- **n8n** lub **Make** — workflowy z krokami HTTP.
- Agent (np. OpenAI Assistants API z function calling) wywołuje webhook n8n.
- n8n wykonuje: POST kalk-top → POST generator → zwraca wynik.
- Ograniczenie: mniej elastyczności w konwersacji, ale szybki start.

---

## 5. Wymagania techniczne

| Element              | Wymaganie                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Dostęp do kalk-top   | URL + `X-Top-Instal-Agent-Key`                                                            |
| Dostęp do generatora | URL + `X-Top-Instal-Agent-Key`                                                            |
| Dostęp do RAG        | URL + auth (jeśli wymagane)                                                               |
| traceId              | Propagacja w nagłówku `X-Topinstal-Trace-Id`                                              |
| Schematy DTO         | `docs/ecosystem/schemas/*.json` jako reference-only; agent powinien znac runtime authority i kanoniczne kontrakty (lub miec uproszczone mapowanie) |

---

## 6. Przykładowe scenariusze

### Scenariusz A: Pełna oferta w jednej rozmowie

1. Użytkownik: "Chcę ofertę na pompę dla domu 120 m² w Krakowie"
2. Agent: wywołuje `calculate_offer` → otrzymuje OfferDTO
3. Agent: "Zapotrzebowanie ~8 kW, proponowana pompa X. Wygenerować PDF?"
4. Użytkownik: "Tak"
5. Agent: wywołuje `generate_offer_document` z OfferDTO → zwraca link do PDF

### Scenariusz B: Wyjaśnienie

1. Użytkownik: "Co to znaczy BUFFER_OVERSIZED w mojej ofercie?"
2. Agent: wywołuje `ask_rag` z query + context (reasonCode)
3. Agent: zwraca wyjaśnienie z bazy wiedzy

### Scenariusz C: Iteracja

1. Użytkownik: "Zwiększ bufor do 500 l i przelicz"
2. Agent: modyfikuje preferences w CalcRequestDTO, wywołuje `calculate_offer` ponownie
3. Agent: prezentuje zaktualizowanÄ… ofertÄ™

---

## 7. Checklist przed wdroĹĽeniem

- [ ] Endpoint `calculate-offer` działa i zwraca OfferDTO
- [ ] Endpoint generatora `/offer-documents/generate` przyjmuje OfferDTO
- [ ] RAG API dostępne i udokumentowane
- [ ] Klucze `X-Top-Instal-Agent-Key` skonfigurowane
- [ ] Agent ma dostęp do schematów DTO (lub uproszczonego mapowania)
- [ ] traceId propagowany w nagłówkach
- [ ] Chat (Telegram/Slack) skonfigurowany z agentem

---

## 8. PowiÄ…zane dokumenty

- `docs/contracts/agent-calculate-offer-instruction.md` — **pełna instrukcja** wywołania calculate-offer (endpoint, auth, enumy, ozcResult, błędy)
- `TOPINSTAL_ECOSYSTEM_STATE.md` — kontrakty, integracje
- `docs/ecosystem/schemas/` - reference JSON Schema dla DTO; nie silniejsze niz runtime i kanoniczne kontrakty
- `AGENTS.md` — instrukcje dla agenta Cursor (ten repo)

---

_Last updated: 2026-03-24_

