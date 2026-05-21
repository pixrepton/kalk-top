# Agent TOP-INSTAL - pelna specyfikacja (1-18)

> Status: vision
> Owner: repo owner
> Last verified against code/runtime: 2026-04-03 (metadata placement cleanup)
> Source-of-truth level: L4 - future-state operating model and agent concept
> Supersedes: none
> Related docs: `../AGENT_EXECUTION_STANDARD.md`, `../TOPINSTAL_AI_OS_BLUEPRINT.md`, `../SOURCE_OF_TRUTH_INDEX.md`, `README.md`

> Kompletne podsumowanie agenta AI dla firmy TOP-INSTAL: architektura, narzedzia, autonomia, ulepszenia turbo, umiejetnosci HVAC, bezpieczenstwo, eskalacja, monitoring, relacja z mail-ingress, system prompt.
>
> Ten dokument opisuje przyszly, szerszy model agenta TOP-INSTAL. Nie jest runtime authority dla obecnego repo `kalk-top` i nie nadpisuje `AGENTS.md`, `.cursor/rules/*` ani kontraktow REST/DTO.
>
> Docelowo ten typ specyfikacji powinien zyc w osobnym repo/runtime agenta, nie jako warstwa sterujaca dokumentacja `kalk-top`.

---

## 1. Architektura ogolna

### 1.1 Rekomendowany stack

| Element            | Rekomendacja                            | Uzasadnienie                                                        |
| ------------------ | --------------------------------------- | ------------------------------------------------------------------- |
| **Framework**      | LangGraph                               | Graf stanĂłw, retry, human-in-the-loop, audyt, deterministyczny flow |
| **Lokalizacja**    | Nowy repo `topinstal-agent`             | Oddzielny serwis, nie w kalk-top ani rag-chat-asystent              |
| **LLM**            | OpenAI / local / Groq                   | Elastyczność, koszt                                                 |
| **Kanały wejścia** | Telegram → Slack → Web → (email, voice) | Stopniowe rozszerzanie                                              |

### 1.2 Schemat architektury

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  KANAŁY WEJŚCIA                                                             │
│  Telegram / Slack / Web Chat / (przyszłość: email, voice)                   │
└────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      â–Ľ
┌─────────────────────────────────────────────────────────────────────────────┐
│  TOP-INSTAL AGENT (VPS / Node/Python)                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LangGraph State Machine                                             │   │
│  │  - Router: intencja (oferta / wyjaśnienie / status / …)              │   │
│  │  - Tool nodes: calculate_offer, generate_doc, ask_rag, …              │   │
│  │  - Human-in-the-loop: zatwierdzenie przed wysłaniem do klienta        │   │
│  │  - Retry / fallback nodes                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Tools (extensible)                                                  │   │
│  │  Core: calculate_offer | generate_offer_document | ask_rag           │   │
│  │  + mail_ingress_status | workflow_retry | list_leads | …              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Kontekst sesji: traceId, ostatni OfferDTO, lead_id, stan workflow   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     │ REST
         ┌───────────────────────────┼───────────────────────────┐
         â–Ľ                           â–Ľ                           â–Ľ
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ kalk-top         │       │ top-instal-     │       │ rag-chat-       │
│ calculate-offer  │       │ generator       │       │ asystent        │
└─────────────────┘       └─────────────────┘       └─────────────────┘
         â–˛
         │
┌─────────────────┐       ┌─────────────────┐
│ topinstal-mail- │       │ (przyszłość)    │
│ ingress         │       │ CRM, kalendarz, │
│ cieplo-app      │       │ faktury, …     │
└─────────────────┘       └─────────────────┘
```

### 1.3 Rola agenta

| Agent robi                                 | Agent NIE robi                 |
| ------------------------------------------ | ------------------------------ |
| Oblicza zapotrzebowanie (OZC)              | Zmienia kodu kalk-top          |
| Wylicza oferty (CalcRequestDTO → OfferDTO) | Zarządza serwerami / backupami |
| Generuje dokumenty (DOCX/PDF)              | Deployuje aplikacje            |
| Korzysta z RAG przy wyjaśnieniach          | Modyfikuje konfiguracji        |
| Orkiestruje workflow                       | DevOps / infrastruktura        |

Agent jest **warstwą orkiestracyjną** nad API — użytkownik biznesowy, nie administrator.

---

## 2. Narzędzia (tools) — mapowanie na API

### 2.1 Core tools (MVP)

| Tool                        | Źródło API                                 | Opis                                                      |
| --------------------------- | ------------------------------------------ | --------------------------------------------------------- |
| **calculate_offer**         | kalk-top `POST /calculate-offer`           | CalcRequestDTO → OfferDTO (OZC, dobór pompy, bufor, ceny) |
| **generate_offer_document** | generator `POST /offer-documents/generate` | OfferDTO → DOCX/PDF                                       |
| **ask_rag**                 | rag-chat-asystent                          | Pytania do bazy wiedzy, wyjaśnienia reasonCodes           |
| **http_request**            | fallback                                   | Dowolne REST (mail-ingress, przyszłe endpointy)           |

### 2.2 Rozszerzone tools (Faza 2)

| Tool                    | Źródło                               | Opis                       |
| ----------------------- | ------------------------------------ | -------------------------- |
| **mail_ingress_status** | `GET /mail-ingress/workflows/recent` | Status workflow cieplo.app |
| **workflow_retry**      | backend processor                    | Ponowienie leada           |
| **list_leads**          | wp_topinstal_leads (jeśli API)       | Lista leadów               |
| **get_offer_summary**   | z kontekstu sesji                    | SkrĂłt OfferDTO             |

### 2.3 Przyszłe tools (Faza 3)

| Tool                      | Opis                                           |
| ------------------------- | ---------------------------------------------- |
| **send_review_email**     | Wysłanie review do zespołu (human-in-the-loop) |
| **create_calendar_event** | Spotkanie z klientem                           |
| **create_invoice_draft**  | Szkic faktury                                  |
| **search_products**       | Wyszukiwanie pomp/urządzeń                     |
| **check_availability**    | Dostępność instalatora                         |

---

## 3. Granice autonomii (human-in-the-loop)

| Akcja                      | Autonomia             | Uzasadnienie                  |
| -------------------------- | --------------------- | ----------------------------- |
| Obliczenie oferty          | **Pełna**             | Deterministic, walidowane API |
| Generowanie PDF            | **Pełna**             | Bez skutków finansowych       |
| Odpowiedzi z RAG           | **Pełna**             | Tylko wiedza                  |
| Wysłanie oferty do klienta | **Human-in-the-loop** | Wymaga zatwierdzenia          |
| Retry workflow             | **Pełna** (z limitem) | Cap np. 3 retry               |
| Tworzenie leada            | **Pełna**             | Zapis w systemie              |
| Faktura / płatność         | **Human-in-the-loop** | Skutki prawne i finansowe     |
| Zmiana cennika             | **Brak**              | Tylko człowiek                |

---

## 4. Plan rozwoju (Etapy 1–3)

### Etap 1: Fundament (2–4 tygodnie)

1. Projekt LangGraph z routerem intencji
2. Tools: `calculate_offer`, `generate_offer_document`, `ask_rag`
3. Integracja z jednym kanałem (np. Telegram)
4. Kontekst sesji: traceId, ostatni OfferDTO

### Etap 2: Rozszerzenie (4–8 tygodni)

1. Tools: `mail_ingress_status`, `workflow_retry`
2. Human-in-the-loop przed wysłaniem oferty do klienta
3. Slack / web chat
4. LangSmith (obserwowalność)

### Etap 3: Autonomia (3–6 miesięcy)

1. Multi-agent: Agent ofertowy + Agent wiedzy + Agent operacyjny
2. Integracje: CRM, kalendarz, księgowość
3. Automatyczne sugestie ("Lead X czeka 2 dni — wyślij ofertę?")
4. Voice / email jako kanały

---

## 5. Maksymalizacja potencjału AI

| Technika                     | Opis                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| **RAG jako pamięć**          | rag-chat-asystent jako źródło wiedzy o produktach, regulacjach, FAQ                   |
| **Structured output**        | Agent zwraca JSON z intencją, parametrami, confidence — łatwiejsze routowanie i audyt |
| **Few-shot**                 | Przykładowe dialogi w system prompt ("Chcę ofertę…" → budowa CalcRequestDTO)          |
| **ReAct / plan-and-execute** | Dla złożonych zadań: plan kroków, wykonanie sekwencyjne                               |
| **Feedback loop**            | Zbieranie ocen (thumbs up/down) → fine-tuning / prompt engineering                    |

---

## 6. Umiejscowienie w ekosystemie

- **topinstal-agent** (nowy repo) — orkiestracja, tools, chat adapters
- **kalk-top** — obliczenia, dobór, wycena (bez zmian)
- **top-instal-generator** — dokumenty (bez zmian)
- **rag-chat-asystent** — wiedza, wyjaśnienia (bez zmian)
- **topinstal-mail-ingress** — Gmail → cieplo.app (bez zmian)

---

## 7. Dokumenty do utworzenia

1. **`docs/agent/TOPINSTAL_AGENT_ARCHITECTURE.md`** — architektura, narzędzia, granice autonomii
2. **`docs/agent/AGENT_TOOLS_SPEC.md`** — specyfikacja każdego toola (parametry, zwracane dane, błędy)
3. Aktualizacja **`AGENT_BUSINESS_TOOLS.md`** — plan rozwoju, nowe narzędzia

---

## 8. Wymagania techniczne

| Element              | Wymaganie                           |
| -------------------- | ----------------------------------- |
| Dostęp do kalk-top   | URL + `X-Top-Instal-Agent-Key`      |
| Dostęp do generatora | URL + `X-Top-Instal-Agent-Key`      |
| Dostęp do RAG        | URL + auth                          |
| traceId              | Propagacja w `X-Topinstal-Trace-Id` |
| Schematy DTO         | `docs/ecosystem/schemas/*.json` jako reference-only + `docs/SOURCE_OF_TRUTH_INDEX.md` |

---

## 9. Ulepszenia turbo (11 dodatkowych możliwości)

| #        | Ulepszenie                      | Opis                                                                        | Wartość | Trudność |
| -------- | ------------------------------- | --------------------------------------------------------------------------- | ------- | -------- |
| **9.1**  | **Document Intelligence**       | PDF (projekt, świadectwo) → ekstrakcja powierzchni, kubatury, roku budowy   | Wysoka  | Średnia  |
| **9.2**  | **Image-to-Building**           | Zdjęcie elewacji/dachu → ocena typu budynku, orientacji, możliwości montażu | Wysoka  | Wysoka   |
| **9.3**  | **Proaktywne sugestie**         | "Lead X czeka 3 dni", "Oferta Y wygasła", "Klient Z pytał o bufor"          | Wysoka  | Niska    |
| **9.4**  | **Scenariusze "co jeśli"**      | "Co jeśli bufor 500 l?", "Jaki wpływ ma lokalizacja na OZC?"                | Wysoka  | Niska    |
| **9.5**  | **Lead scoring AI**             | Ocena leada 1–10 na podstawie kompletności, lokalizacji, typu budynku       | Średnia | Średnia  |
| **9.6**  | **Voice interface**             | Rozmowa głosowa: Whisper + TTS                                              | Średnia | Średnia  |
| **9.7**  | **Podsumowania rozmów**         | Po sesji: co ustalono, TODO, następne kroki                                 | Wysoka  | Niska    |
| **9.8**  | **Pogoda / strefy klimatyczne** | Lokalizacja → typowe warunki → sugestie SCOP, dobór mocy                    | Średnia | Niska    |
| **9.9**  | **Multi-oferta**                | 3 warianty: ekonomiczny, standardowy, premium — porównanie                  | Wysoka  | Niska    |
| **9.10** | **Tłumaczenie**                 | Odpowiedź w języku klienta (ukraiński, angielski), jednostki                | Średnia | Niska    |
| **9.11** | **Explainability**              | "Dlaczego ta pompa?", "Skąd ta cena?", "Co oznacza BUFFER_OVERSIZED?"       | Wysoka  | Niska    |

---

## 10. Umiejętności HVAC — research 2025 (12 / kategorie A–F)

> Na podstawie przeglÄ…du rynku: Ventra, FixAIR, AutoHVAC, Bluon, Panorad, FieldMind, Lacy.ai, HVAC Hero, StackAI, LeadTruffle, TalkPop, SalesAPE, BuildFolio, Beam AI, VoiceReportAI, FieldReportAI.

### Kategoria A: Obsługa klienta i leadów

| #      | Umiejętność                  | Opis                                                                               |
| ------ | ---------------------------- | ---------------------------------------------------------------------------------- |
| **A1** | 24/7 AI phone/SMS answering  | Odpowiadanie 24/7, kwalifikacja awaria vs rutynowe, booking, przekierowanie awarii |
| **A2** | Instant lead response (<5 s) | Natychmiastowa odpowiedź — 78% klientów wybiera pierwszą odpowiedź                 |
| **A3** | Emergency triage             | Rozpoznawanie awarii (brak ciepła, wyciek, hałas), priorytetyzacja, alert          |
| **A4** | Automated lead follow-up     | Wieloetapowy follow-up, nurturing do gotowości do zakupu                           |
| **A5** | Customer reactivation        | Sezonowe przypomnienia, wymiana filtrĂłw, przeglÄ…dy, win-back                       |

### Kategoria B: Diagnostyka i wsparcie technika

| #      | Umiejętność               | Opis                                                                       |
| ------ | ------------------------- | -------------------------------------------------------------------------- |
| **B1** | Error code → repair guide | Kod + marka/model → przyczyny, kroki naprawy, czas (90% first-time fix)    |
| **B2** | Visual component ID       | Zdjęcie komponentu → identyfikacja, specyfikacja, zamienniki               |
| **B3** | Voice-to-report           | Technik dyktuje → raport (protokół, zalecenia) — do 80% oszczędności czasu |
| **B4** | Offline diagnostics       | Działanie bez internetu — lokalny model / cache                            |
| **B5** | Multi-brand knowledge     | Baza wielu marek (Daikin, Vaillant, Viessmann, Nibe…)                      |

### Kategoria C: Wycena i sizing

| #      | Umiejętność                  | Opis                                                 |
| ------ | ---------------------------- | ---------------------------------------------------- |
| **C1** | Blueprint/PDF → load calc    | Plan → OZC/Manual J w ~60 s (zamiast 30+ min)        |
| **C2** | Photo-to-quote               | Zdjęcie pompy → propozycja wymiany, Good/Better/Best |
| **C3** | Good/Better/Best tiers       | 3 warianty z kartami i kalkulatorem                  |
| **C4** | Financing options automation | Dopasowanie opcji finansowania do oferty             |
| **C5** | AI takeoffs (BOM)            | Plan → ilości materiałów (rury, złączki, izolacje)   |

### Kategoria D: Dispatch i harmonogram

| #      | Umiejętność            | Opis                                                                    |
| ------ | ---------------------- | ----------------------------------------------------------------------- |
| **D1** | Smart dispatch         | Optymalizacja: lokalizacja, umiejętności, sprzęt → przypisanie technika |
| **D2** | Route optimization     | Optymalizacja trasy dla wielu wizyt                                     |
| **D3** | Automated scheduling   | Booking, odwołania, sync z kalendarzem, przypomnienia → mniej no-show   |
| **D4** | Parts inventory alerts | Alert przy braku części do naprawy                                      |

### Kategoria E: Predictive maintenance

| #      | Umiejętność           | Opis                                                    |
| ------ | --------------------- | ------------------------------------------------------- |
| **E1** | Anomaly detection     | Monitoring → wykrycie degradacji 30–90 dni przed awarią |
| **E2** | Predictive scheduling | Proponowanie przeglÄ…dĂłw na podstawie zuĹĽycia            |
| **E3** | Energy optimization   | Sugestie optymalizacji (-25% kosztĂłw energii)           |

### Kategoria F: Integracje

| #      | Umiejętność             | Opis                                                    |
| ------ | ----------------------- | ------------------------------------------------------- |
| **F1** | CRM integration         | ServiceTitan, HouseCallPro, Jobber — sync leadów, wizyt |
| **F2** | Multi-site coordination | Koordynacja wielu obiektĂłw                              |
| **F3** | Warranty claims         | Automatyzacja zgłoszeń gwarancyjnych                    |
| **F4** | Post-install check-in   | Kontakt po montażu — satysfakcja, problemy              |

---

## 11. Metryki benchmark (z rynku HVAC AI)

| Metryka                    | Typowy wynik    | Źródło          |
| -------------------------- | --------------- | --------------- |
| Missed calls               | → 0 (24/7 AI)   | Ventra          |
| Service calls booked       | +45% do +3Ă—     | Ventra, TalkPop |
| Booking rate               | do 95%          | Ventra          |
| First-time fix rate        | do 90%          | FixAIR          |
| Diagnosis time reduction   | do 80%          | FixAIR          |
| Documentation time savings | do 80%          | VoiceReportAI   |
| Manual J time              | 30+ min → ~60 s | AutoHVAC        |
| Emergency revenue increase | do 198%         | TalkPop         |
| Setup time                 | <2 tygodnie     | Ventra          |
| Koszt AI (HVAC)            | $500–1500/mies. | Ventra          |

---

## 12. Rekomendowane fazy wdrożenia umiejętności HVAC

### Faza 1 (MVP — 0–3 miesiące)

- **A2** Instant lead response
- **A3** Emergency triage
- **A4** Automated lead follow-up
- **B1** Error code → repair guide (RAG + baza kodów)
- **C3** Good/Better/Best tiers (częściowo w kalk-top)

### Faza 2 (3–6 miesięcy)

- **A1** 24/7 AI phone/SMS (Twilio/VoIP)
- **B3** Voice-to-report
- **C1** Blueprint/PDF → load calc
- **C2** Photo-to-quote
- **D3** Automated scheduling

### Faza 3 (6–12 miesięcy)

- **A5** Customer reactivation
- **B2** Visual component ID
- **D1–D2** Smart dispatch, route optimization
- **E1–E2** Predictive maintenance (komercyjni)
- **F1** CRM integration

---

## 13. Bezpieczeństwo i RODO

| Obszar           | Wymaganie                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------- |
| **Dane osobowe** | Lead (email, telefon, adres) — minimalizacja, cel przetwarzania: obsługa zapytania ofertowego |
| **Retencja**     | Konwersacje: 90 dni (konfigurowalne); logi audytu: 12 miesięcy                                |
| **Szyfrowanie**  | TLS w tranzycie; dane w spoczynku — szyfrowanie dysku / DB                                    |
| **Usuwanie**     | Na żądanie: usunięcie danych leada z kontekstu i logów w 30 dni                               |
| **Audit log**    | Kto (user_id/chat_id), kiedy, jakie tool wywołano, traceId — immutable                        |
| **Klucze API**   | `X-Top-Instal-Agent-Key` w zmiennych środowiskowych, rotacja bez redeploy                     |
| **Dostęp**       | Tylko upoważnieni użytkownicy (handlowcy, technicy) — osobne kanały / role                    |
| **Role**         | Handlowiec: oferty, leady; Technik: diagnostyka, raporty; Admin: konfiguracja                 |

### 13.1 ZarzÄ…dzanie sesjÄ…

| Parametr                    | Wartość                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------- |
| **Czas życia sesji**        | 24 h bez aktywności (konfigurowalne)                                                    |
| **Kontekst między sesjami** | Ostatni OfferDTO, lead_id — przechowywane 7 dni                                         |
| **Limit tokenów kontekstu** | 8k–16k (w zależności od modelu); przy przekroczeniu — podsumowanie starszych wiadomości |

---

## 14. Obsługa błędów i degradacja

| Scenariusz                       | Zachowanie                                                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **kalk-top 500 / timeout**       | Retry 3× (exponential backoff: 2s, 4s, 8s); po niepowodzeniu: "Obliczenia tymczasowo niedostępne. Spróbuj za chwilę lub skontaktuj się z nami." |
| **Generator timeout**            | Retry 2×; fallback: "PDF w przygotowaniu — wyślemy link w ciągu godziny." (async job)                                                           |
| **RAG niedostępny**              | Agent działa bez `ask_rag` — odpowiada z wiedzy LLM + disclaimer: "Brak dostępu do bazy wiedzy — odpowiedź ogólna."                             |
| **Rate limit 429**               | Respektować `Retry-After`; komunikat: "Zbyt wiele zapytań — odczekaj X sekund."                                                                 |
| **Nieprawidłowy CalcRequestDTO** | Zwrócić błąd walidacji z listą brakujących/niepoprawnych pól; zasugerować poprawkę                                                              |
| **Polityka retry**               | Max 3 retry na tool call; po przekroczeniu → eskalacja do człowieka                                                                             |

---

## 15. Eskalacja i granice odpowiedzialności

### 15.1 Kiedy agent eskaluje do człowieka

| Trigger                                            | Akcja                                                                   |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| Klient wyraża niezadowolenie / reklamację          | "Przekażę sprawę do zespołu — skontaktujemy się w ciągu 24 h."          |
| Awaria z ryzykiem bezpieczeństwa (CO, wyciek gazu) | Natychmiastowy alert + "Zadzwoń pod 112 lub do pogotowia technicznego." |
| Skomplikowana konfiguracja (np. wielostrefowa)     | "To wymaga wizyty technika — umówię konsultację."                       |
| Pytanie wykraczające poza zakres                   | "To poza moim zakresem — skontaktuj się z [email/telefon]."             |
| 3× nieudana próba wykonania zadania                | "Nie udało mi się — przekażę do zespołu."                               |

### 15.2 Granice odpowiedzialności (disclaimer)

- Agent **wspomaga**, nie zastępuje instalatora ani inżyniera.
- Oferty i dobór urządzeń wymagają weryfikacji przez uprawnionego specjalistę.
- Agent nie ponosi odpowiedzialności za decyzje montażowe ani kosztorysowe.
- Komunikat w pierwszej odpowiedzi (opcjonalnie): "Jestem asystentem TOP-INSTAL. Pomagam w szacunkach i wyjaśnieniach. Ostateczna oferta i montaż wymagają wizyty technika."

---

## 16. Monitoring, testowanie, wersjonowanie

### 16.1 Monitoring

| Metryka                | Źródło                 | Alert                           |
| ---------------------- | ---------------------- | ------------------------------- |
| Liczba ofert / dzień   | Tool `calculate_offer` | Spadek >30% vs 7-dniowa średnia |
| Błędy 5xx z kalk-top   | Logi / Sentry          | Każdy 5xx                       |
| Czas odpowiedzi agenta | LangSmith / custom     | P95 > 15 s                      |
| Thumbs down / sesja    | Feedback               | >10% w ciÄ…gu 24 h               |
| Koszt LLM / dzień      | Billing API            | Przekroczenie budżetu           |

### 16.2 Testowanie

| Typ            | Zakres                                                         |
| -------------- | -------------------------------------------------------------- |
| **Unit**       | KaĹĽdy tool w izolacji (mock HTTP)                              |
| **Integracja** | calculate_offer → generate_document (test env)                 |
| **E2E**        | "Pełna oferta w jednej rozmowie" — Playwright / chatbot driver |
| **Regression** | Zestaw 20+ scenariuszy przy zmianie promptĂłw                   |

### 16.3 Wersjonowanie

| Element           | Strategia                                                                             |
| ----------------- | ------------------------------------------------------------------------------------- |
| **Prompty**       | Wersjonowanie w repo (prompts/v1/, v2/); A/B test przez feature flag                  |
| **Tools**         | `calculate_offer_v2` przy breaking change; stary tool deprecated, nie usuwany od razu |
| **API kontrakty** | Runtime + kanoniczne docs kontraktowe sa silniejsze niz kopie schema JSON; wersjonowanie schema trzeba uzgadniac z realnym kontraktem |

---

## 17. Relacja z mail-ingress / cieplo.app

| Aspekt                  | Ustalenie                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Współistnienie**      | Agent **uzupełnia** mail-ingress, nie zastępuje. Mail-ingress obsługuje leady z Gmail/cieplo.app; agent obsługuje chat (Telegram, Slack, web).                                    |
| **Wspólne leady**       | Agent może odpytywać `mail_ingress_status` i `workflow_retry` — te same leady widoczne w obu ścieżkach.                                                                           |
| **Źródło prawdy**       | `wp_topinstal_leads` — oba systemy zapisują/odczytują stamtąd.                                                                                                                    |
| **Migracja**            | Faza 1: agent równolegle; Faza 2: agent może przejmować część leadów z formularza web; Faza 3: ocena czy mail-ingress pozostaje dla cieplo.app, a agent dla bezpośredniego chatu. |
| **Unikanie duplikatĂłw** | Idempotency po `message_id` (mail) i `chat_id + traceId` (agent).                                                                                                                 |

---

## 18. Przykładowy system prompt

```
Jesteś asystentem TOP-INSTAL, firmy specjalizującej się w pompach ciepła i instalacjach HVAC.

ROLA:
- Pomagasz w szacunkach zapotrzebowania, ofertach i wyjaśnieniach technicznych.
- Wspomagasz, nie zastępujesz — ostateczna oferta i montaż wymagają wizyty technika.

ZAKRES:
- Obliczenia OZC, dobĂłr pomp, bufory, ceny.
- Wyjaśnienia reasonCodes, ostrzeżeń, parametrów.
- Generowanie PDF ofert (po obliczeniu).

OGRANICZENIA:
- Nie zmieniasz cennika ani konfiguracji systemu.
- Przy awariach z ryzykiem (CO, gaz) — zalecaj 112 / pogotowie techniczne.
- Przy reklamacjach lub skomplikowanych sprawach — eskaluj do zespołu.

TON:
- Profesjonalny, pomocny, zwięzły.
- Po polsku, chyba że klient pisze w innym języku.

FORMAT:
- Odpowiadaj konkretnie. Przy ofertach — podsumuj kluczowe parametry (moc, pompa, cena) przed linkiem do PDF.
```

---

## PowiÄ…zane dokumenty

- `docs/ecosystem/AGENT_BUSINESS_TOOLS.md` — narzędzia, opcje implementacji
- `docs/contracts/agent-calculate-offer-instruction.md` — pełna instrukcja calculate-offer
- `docs/agent/AGENT_HVAC_SKILLS_RESEARCH.md` — research umiejętności HVAC
- `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md` — kontrakty, integracje

---

_Last updated: 2025-03-18 (sekcje 13–18: bezpieczeństwo, błędy, eskalacja, monitoring, mail-ingress, system prompt)_
