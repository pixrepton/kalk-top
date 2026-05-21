# Umiejetnosci agenta dedykowane firmie instalacyjnej/HVAC - research 2025

> Status: vision
> Owner: repo owner
> Last verified against code/runtime: 2026-04-03 (metadata placement cleanup)
> Source-of-truth level: L4 - market research and future capability backlog
> Supersedes: none
> Related docs: `../TOPINSTAL_AI_OS_BLUEPRINT.md`, `../SOURCE_OF_TRUTH_INDEX.md`, `README.md`

> **Zrodlo:** Przeglad rynku AI dla HVAC/field service (Ventra, FixAIR, AutoHVAC, Bluon, Panorad, FieldMind, Lacy.ai, HVAC Hero, StackAI, LeadTruffle, TalkPop, SalesAPE, BuildFolio, Beam AI, VoiceReportAI, FieldReportAI).
> **Cel:** Lista umiejetnosci agenta oparta na sprawdzonych rozwiazaniach rynkowych, nie na zalozeniach.
>
> Ten dokument zbiera research rynkowy i inspiracje dla przyszlych zdolnosci agenta. Nie jest runtime authority dla obecnego repo `kalk-top`.
>
> Docelowo taki research powinien byc utrzymywany przy osobnym runtime/projekcie agenta, a nie mieszany z kanoniczna dokumentacja decyzji `kalk-top`.

---

## 1. Rozwiazania rynkowe - co robia konkretni dostawcy

### 1.1 Odpowiadanie na polaczenia i leady (24/7)

| Dostawca          | Funkcja                                                     | Metryki                                                                      |
| ----------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Ventra**        | AI phone answering, emergency dispatch, appointment booking | 3× więcej połączeń, 95% booking rate, <2 tyg. wdrożenie                      |
| **HVAC AI Agent** | 24/7 emergency dispatch, kwalifikacja (no heat/AC), booking | Zwrot kosztów w 3 awaryjnych połączeniach, ~$18k/mies. dodatkowego przychodu |
| **Lacy.ai**       | AI call & SMS, appointment scheduling, lead qualification   | Wielojęzyczność                                                              |
| **LeadTruffle**   | Odpowiedź w <5 s zamiast 30 s–2 min                         | 78% klientów zatrudnia pierwszą firmę, która odpowie                         |
| **TalkPop**       | Emergency lead qualification                                | 40% więcej wizyt, 2.9× awaryjnych połączeń, 198% wzrost przychodu z awarii   |
| **SalesAPE**      | AI lead booking, brzmi jak człowiek                         | Integracja ServiceTitan, HouseCallPro, Jobber                                |

**Wnioski dla TOP-INSTAL:** Agent powinien obsługiwać połączenia 24/7, kwalifikować awarie vs rutynowe, bookować wizyty, integrować się z kalendarzem/CRM.

---

### 1.2 Diagnostyka i wsparcie technika

| Dostawca                 | Funkcja                                               | Metryki                                                       |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------------------- |
| **FixAIR Copilot**       | AI diagnostyka na 150k+ dokumentach, 2M+ kodów błędów | 90% first-time fix, 80% skrócenie czasu diagnozy              |
| **FixAIR Assistant**     | Voice → raport w 2 min                                | Oszczędność czasu na papierach                                |
| **Bluon MasterMechanic** | 50k scenariuszy problem–rozwiązanie, RAG + RLHF       | Diagnostyka z języka naturalnego, EN/ES                       |
| **HVAC Hero**            | Dostęp do instrukcji, kodów błędów, danych części     | Wsparcie w terenie                                            |
| **HVACHat**              | 80k+ diagnoz, 550+ technikĂłw                          | Natychmiastowe troubleshooting                                |
| **Panorad AI**           | Fault detection, monitoring ciągły                    | 95% problemów wykrytych przed awarią, -40% kosztów utrzymania |

**Wnioski dla TOP-INSTAL:** Agent powinien rozpoznawać kody błędów, proponować kroki naprawy, identyfikować komponenty ze zdjęcia, generować raporty z głosu.

---

### 1.3 Wycena, sizing, oferty

| Dostawca       | Funkcja                                                               | Metryki                                       |
| -------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| **AutoHVAC**   | Blueprint → Manual J w ~60 s, "two-brain" (deterministyczny + vision) | ACCA-compliant, $47/mies. vs $200+ tradycyjne |
| **HVAC Quote** | Instant pricing, Good/Better/Best, pre-kwalifikacja leadĂłw            | Setup <15 min                                 |
| **BuildFolio** | Photo-to-Quote: zdjęcie urządzenia → propozycja wymiany               | SEER 14/16/20, kalkulator płatności           |
| **Beam AI**    | AI takeoffs z planów dla HVAC estimating                              | Automatyzacja ilości materiałów               |

**Wnioski dla TOP-INSTAL:** Agent powinien: ekstrahować dane z planów/PDF, dobierać urządzenia z foto, generować warianty Good/Better/Best, integrować finansowanie.

---

### 1.4 Field service i dokumentacja

| Dostawca          | Funkcja                                                    | Metryki                                           |
| ----------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| **FieldMind**     | Autonomous dispatch, voice-to-report, real-time monitoring | 25% dnia technika na admin → redukcja             |
| **VoiceReportAI** | Głos → gotowy dokument                                     | 30–40% dnia na dokumentację → do 80% oszczędności |
| **FieldReportAI** | Wideo/zdjęcia/audio → raport                               | Raport w <1 min                                   |
| **Vivoka**        | Voice reports offline, 99% accuracy                        | Działa bez internetu                              |

**Wnioski dla TOP-INSTAL:** Agent powinien: generować raporty z głosu, obsługiwać tryb offline, używać szablonów branżowych.

---

### 1.5 Predictive maintenance i monitoring

| Dostawca           | Funkcja                                | Metryki                                                  |
| ------------------ | -------------------------------------- | -------------------------------------------------------- |
| **Panorad AI**     | Ciągły monitoring, wykrywanie anomalii | -25% kosztów energii, 90% awarii zapobiegniętych         |
| **OxMaint**        | IoT + AI analytics                     | Wykrycie 30–90 dni przed awarią, -38% kosztów utrzymania |
| **CoolAutomation** | HVAC predictive maintenance            | Edge + cloud                                             |

**Wnioski dla TOP-INSTAL:** Dla klientĂłw komercyjnych / wieloobiektowych: monitoring, alerty, harmonogram przeglÄ…dĂłw.

---

### 1.6 Lead follow-up i reaktivacja

| Dostawca    | Funkcja                                                               | Metryki                                   |
| ----------- | --------------------------------------------------------------------- | ----------------------------------------- |
| **Ventra**  | Quote request follow-up, financing automation, post-install check-ins | Customer reactivation, seasonal campaigns |
| **Ventra**  | Customer win-back, maintenance reminders                              | +60% customer callbacks                   |
| **StackAI** | Service request intake, dispatch, job documentation                   | Enterprise, on-premise                    |

**Wnioski dla TOP-INSTAL:** Agent powinien: automatycznie follow-up po zapytaniu ofertowym, przypominać o przeglądach, reanimować nieaktywnych klientów.

---

## 2. Ulepszona lista umiejętności HVAC (na podstawie researchu)

### Kategoria A: Obsługa klienta i leadów (priorytet wysoki)

| #      | Umiejętność                      | Inspiracja                  | Opis dla agenta TOP-INSTAL                                                                                            |
| ------ | -------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **A1** | **24/7 AI phone/SMS answering**  | Ventra, Lacy, HVAC AI Agent | Odpowiadanie na połączenia i SMS 24/7, kwalifikacja awaria vs rutynowe, booking wizyt, przekierowanie awarii na dyżur |
| **A2** | **Instant lead response (<5 s)** | LeadTruffle                 | Natychmiastowa odpowiedź na formularz/czat — 78% klientów wybiera pierwszą odpowiedź                                  |
| **A3** | **Emergency triage**             | TalkPop, HVAC AI Agent      | Rozpoznawanie awarii (brak ciepła, wyciek, hałas), priorytetyzacja, alert do technika                                 |
| **A4** | **Automated lead follow-up**     | Ventra                      | Wieloetapowy follow-up po zapytaniu ofertowym, nurturing do momentu gotowości do zakupu                               |
| **A5** | **Customer reactivation**        | Ventra                      | Reaktywacja: sezonowe przypomnienia, wymiana filtrĂłw, przeglÄ…dy, win-back kampanie                                    |

---

### Kategoria B: Diagnostyka i wsparcie technika (priorytet wysoki)

| #      | Umiejętność                   | Inspiracja                      | Opis dla agenta TOP-INSTAL                                                     |
| ------ | ----------------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| **B1** | **Error code → repair guide** | FixAIR, Bluon, HVACHat          | Kod błędu + marka/model → najczęstsze przyczyny, kroki naprawy, szacowany czas |
| **B2** | **Visual component ID**       | FixAIR                          | Zdjęcie komponentu → identyfikacja, specyfikacja, zamienniki                   |
| **B3** | **Voice-to-report**           | FixAIR Assistant, VoiceReportAI | Technik dyktuje → agent generuje raport (protokół, zalecenia, zdjęcia)         |
| **B4** | **Offline diagnostics**       | Vivoka                          | Działanie bez internetu — lokalny model / cache instrukcji                     |
| **B5** | **Multi-brand knowledge**     | FixAIR                          | Baza wielu marek (Daikin, Vaillant, Viessmann, Nibe…) — jeden interfejs        |

---

### Kategoria C: Wycena i sizing (priorytet wysoki)

| #      | Umiejętność                      | Inspiracja             | Opis dla agenta TOP-INSTAL                                                    |
| ------ | -------------------------------- | ---------------------- | ----------------------------------------------------------------------------- |
| **C1** | **Blueprint/PDF → load calc**    | AutoHVAC               | Plan/PDF → ekstrakcja pomieszczeń, wymiarów → OZC/Manual J w ~60 s            |
| **C2** | **Photo-to-quote**               | BuildFolio             | Zdjęcie istniejącej pompy/urządzenia → propozycja wymiany, Good/Better/Best   |
| **C3** | **Good/Better/Best tiers**       | HVAC Quote, BuildFolio | 3 warianty (ekonomiczny/standard/premium) z wizualnymi kartami i kalkulatorem |
| **C4** | **Financing options automation** | Ventra, HVAC Quote     | Automatyczne dopasowanie opcji finansowania do oferty                         |
| **C5** | **AI takeoffs (BOM)**            | Beam AI                | Plan → ilości materiałów (rury, złączki, izolacje)                            |

---

### Kategoria D: Dispatch i harmonogram (priorytet średni)

| #      | Umiejętność                | Inspiracja        | Opis dla agenta TOP-INSTAL                                                         |
| ------ | -------------------------- | ----------------- | ---------------------------------------------------------------------------------- |
| **D1** | **Smart dispatch**         | Ventra, FieldMind | Optymalizacja: lokalizacja, umiejętności, sprzęt, ruch → przypisanie technika      |
| **D2** | **Route optimization**     | FieldMind         | Optymalizacja trasy dla wielu wizyt w ciÄ…gu dnia                                   |
| **D3** | **Automated scheduling**   | Ventra            | Booking, odwołania, przełożenia, sync z kalendarzem, przypomnienia → mniej no-show |
| **D4** | **Parts inventory alerts** | Ventra (Repair)   | Alert gdy brak części do planowanej naprawy                                        |

---

### Kategoria E: Predictive maintenance (priorytet średni — komercyjni)

| #      | Umiejętność               | Inspiracja       | Opis dla agenta TOP-INSTAL                                         |
| ------ | ------------------------- | ---------------- | ------------------------------------------------------------------ |
| **E1** | **Anomaly detection**     | Panorad, OxMaint | Monitoring parametrów → wykrycie degradacji 30–90 dni przed awarią |
| **E2** | **Predictive scheduling** | Panorad          | Proponowanie przeglÄ…dĂłw na podstawie zuĹĽycia i historii            |
| **E3** | **Energy optimization**   | Panorad          | Sugestie optymalizacji zuĹĽycia energii (-25% kosztĂłw)              |

---

### Kategoria F: Integracje i operacje (priorytet średni)

| #      | Umiejętność                 | Inspiracja            | Opis dla agenta TOP-INSTAL                                         |
| ------ | --------------------------- | --------------------- | ------------------------------------------------------------------ |
| **F1** | **CRM integration**         | Ventra, SalesAPE      | ServiceTitan, HouseCallPro, Jobber — sync leadów, wizyt, raportów  |
| **F2** | **Multi-site coordination** | Ventra (Commercial)   | Koordynacja wielu obiektĂłw, harmonogramy, kontrakty                |
| **F3** | **Warranty claims**         | Ventra (Custom)       | Automatyzacja zgłoszeń gwarancyjnych                               |
| **F4** | **Post-install check-in**   | Ventra (Installation) | Automatyczny kontakt po montażu — satysfakcja, ewentualne problemy |

---

## 3. Metryki z rynku (benchmark)

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

## 4. Rekomendacje dla agenta TOP-INSTAL

### Faza 1 (MVP — 0–3 miesiące)

- **A2** Instant lead response
- **A3** Emergency triage (awaria vs rutynowe)
- **A4** Automated lead follow-up
- **B1** Error code → repair guide (RAG + baza kodów)
- **C3** Good/Better/Best tiers (już częściowo w kalk-top)

### Faza 2 (3–6 miesięcy)

- **A1** 24/7 AI phone/SMS (integracja z Twilio/VoIP)
- **B3** Voice-to-report
- **C1** Blueprint/PDF → load calc (rozszerzenie OZC)
- **C2** Photo-to-quote
- **D3** Automated scheduling

### Faza 3 (6–12 miesięcy)

- **A5** Customer reactivation
- **B2** Visual component ID
- **D1–D2** Smart dispatch, route optimization
- **E1–E2** Predictive maintenance (dla klientów komercyjnych)
- **F1** CRM integration

---

## 5. Źródła

- [Ventra](https://www.ventrahq.com/) — AI dla HVAC
- [FixAIR](https://fixair.ai/) — diagnostyka, voice-to-report
- [AutoHVAC](https://autohvac.ai/) — Manual J z blueprintów
- [Bluon MasterMechanic](https://www.bluon.ai/) — diagnostyka RAG
- [Panorad AI](https://panorad.ai/) — fault detection, predictive maintenance
- [HVAC Hero](https://www.hvac-hero.com/) — wsparcie technika
- [HVAC AI Agent](https://www.hvacaiagent.com/) — 24/7 emergency
- [Lacy.ai](https://www.lacy.ai/) — AI call/SMS
- [LeadTruffle](https://www.leadtruffle.co/) — instant response
- [TalkPop](https://www.talkpop.ai/) — emergency qualification
- [BuildFolio](https://build-folio.com/) — photo-to-quote
- [VoiceReportAI](https://voicereportai.com/) — voice-to-report
- [FieldReportAI](https://www.fieldreportai.com/) — media → raport
- [FieldMind](https://fieldmind-5.polsia.app/) — field service AI
- [StackAI](https://www.stack-ai.com/) — enterprise HVAC

---

_Last updated: 2025-03-18_
