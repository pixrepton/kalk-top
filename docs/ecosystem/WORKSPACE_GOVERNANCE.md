# TOP-INSTAL — porządek workspace i dokumentacja nadrzędna

**Cel:** jeden spójny opis **wielu repozytoriów** na Desktopie / w organizacji: co jest źródłem prawdy, jak płyną leady i oferty, gdzie trzymać eksperymenty, jak pracować w Cursorze.

**Kanoniczny stan kontraktów i integracji:** zawsze najpierw `TOPINSTAL_ECOSYSTEM_STATE.md` (living document). Ten plik uzupełnia go o **porządek ludzki i narzędziowy**, nie zmienia DTO.

---

## 1. Repozytoria kanoniczne (źródło prawdy kodu)

| Repo                              | Rola                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| **kalk-top**                      | Obliczenia, dobór, ceny, `CalcRequestDTO` → `OfferDTO`, integracja z generatorem                |
| **top-instal-generator**          | Render DOCX/PDF z `OfferDTO` (`from-offer-dto` itd.)                                            |
| **topinstal-mail-ingress**        | Gmail → envelope `cieplo_app_lead_v1` → dispatch                                                |
| **topinstal-cieplo-orchestrator** | VPS: po ingressie — HTML cieplo.app → `CalcRequestDTO` → kalk-top → generator → mail wewnętrzny |
| **RAG Chat Asystent**             | Baza wiedzy, retrieval, grounding (nie właściciel oferty)                                       |
| **agent-zordon**                  | Chat LLM + narzędzia (wywołania kalk / generator / RAG); orkiestracja, nie logika biznesowa     |

Zmiany kontraktów (DTO, REST, auth) → procedura w `TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md`.

---

## 2. Porządek na dysku (Desktop / dev) — wdrożone

**Uwaga:** folder **`TOP-INSTAL`** na Desktopie użytkownika to zasoby firmowe (grafika, PDF, umowy), **nie** korzeń dev. Archiwum i meta-workspace są w osobnym katalogu.

**Stan (2026-03-24):**

```text
Desktop/
  TOPINSTAL-WORKSPACE/           # meta: README + multi-root Cursor
    README.md
    TOPINSTAL.code-workspace     # File → Open Workspace from File…
    _archive/
      PROJEKTY-DEV/              # przeniesione eksperymenty
      moved-from-kalk-top/       # fragmenty — nie źródło prawdy
  kalk-top/                      # kanoniczne repa (jak dotąd, obok)
  top-instal-generator/
  topinstal-mail-ingress/
  topinstal-cieplo-orchestrator/
  RAG Chat Asystent/
  agent-zordon/
  …
```

Repozytoria **nie** były przenoszone do środka `TOPINSTAL-WORKSPACE` (żeby nie psuć ścieżek, git, skryptów). Multi-root workspace używa **względnych ścieżek** `../kalk-top` itd. z pliku `TOPINSTAL.code-workspace`.

**Czego unikać:** edycji kodu w `_archive/` — tylko świadomy merge do właściwego repozytorium.

---

## 3. Cursor / multi-root workspace

- **Plik workspace:** `Desktop/TOPINSTAL-WORKSPACE/TOPINSTAL.code-workspace` — otwórz w Cursorze: _File → Open Workspace from File…_
- Zawiera foldery: `kalk-top`, `top-instal-generator`, `topinstal-mail-ingress`, `topinstal-cieplo-orchestrator`, `RAG Chat Asystent`, `agent-zordon`, oraz folder meta `TOPINSTAL-WORKSPACE`.
- **Nie dodawaj** `_archive` do workspace (został poza repami — szum dla AI i wyszukiwania).
- Duże `node_modules` można dalej wykluczać w ustawieniach; w pliku workspace jest podstawowy `files.exclude` dla `node_modules`.

---

## 4. Krótka mapa przepływów (gdzie szukać)

| Przepływ                     | Ścieżka                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| Użytkownik w WP / kalkulator | **kalk-top** → generator (PDF krok 10)                                                    |
| Lead z maila (cieplo.app)    | **mail-ingress** → (URL z env) **orchestrator** lub **kalk-top** → dalej kalk + generator |
| Wyjaśnienia z bazy           | **RAG Chat Asystent**; chat z toolami **agent-zordon**                                    |

Szczegóły endpointów: `TOPINSTAL_ECOSYSTEM_STATE.md` §3.

---

## 5. Dokumenty wizualne i pomocnicze

| Plik                                          | Zastosowanie                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md` | Kontrakty, integracje, ryzyka — **źródło prawdy**                        |
| `docs/ecosystem/ECOSYSTEM_MAP.html`           | Otwórz w przeglądarce — diagramy Mermaid (spójne z §1–§3)                |
| `docs/ecosystem/AGENT_BUSINESS_TOOLS.md`      | Narzędzia agenta (kalk / generator / RAG), realizacja w **agent-zordon** |

---

## 6. Utrzymanie

- Po zmianie ścieżki dispatch (mail-ingress → orchestrator vs kalk), **zaktualizuj** `TOPINSTAL_ECOSYSTEM_STATE.md`.
- Po dodaniu nowego „oficjalnego” repozytorium w ekosystemie: wpis w §1 tego pliku + wiersz w macierzy w `TOPINSTAL_ECOSYSTEM_STATE.md`.
- **Nie** duplikuj pełnych list DTO tutaj — link do `schemas/` i `TOPINSTAL_ECOSYSTEM_STATE.md`.

---

_Last updated: 2026-03-24 (wdrożenie: TOPINSTAL-WORKSPACE + \_archive na Desktopie)_
