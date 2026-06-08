# TOP-INSTAL Ecosystem Rules — Design Document

## 1. DESIGN PRINCIPLES

### Mały koszt kontekstowy

- Reguły stałe są krótkie (<150 linii łącznie per repo). Cursor ładuje je do każdej sesji; długie instrukcje konkurują z kodem i historią.
- Living document nie jest ładowany domyślnie — agent czyta go tylko przy zadaniach integracyjnych lub gdy sam to uzna za potrzebne.

### Myślenie systemowe mimo pracy lokalnej

- Globalna konstytucja ekosystemu jest replikowana do każdego repo (identyczna kopia). Działa nawet gdy otwarte jest tylko jedno repo.
- Lokalna reguła repo przypomina agentowi rolę modułu i granice; wymusza cross-repo impact check przed większymi zmianami.

### Rozdzielenie stałych zasad od bieżącego stanu

- Stałe zasady: ownership modułów, kanoniczne role, zakaz dublowania logiki, obowiązek sygnalizowania naruszeń. Te nie zmieniają się przy migracjach.
- Bieżący stan: kontrakty DTO, endpointy, trace semantics, legacy seams, ryzyka. Te żyją w living document.

### Minimalizacja dryfu architektonicznego

- Jedna wspólna konstytucja = jeden source of truth dla ról. Aktualizacja konstytucji wymaga świadomej decyzji i synchronizacji do wszystkich repo.
- Living document ma jasny update protocol; agent wie, kiedy ma go aktualizować, a kiedy nie.

### Łatwość aktualizacji przez agenta

- Update protocol jest egzekwowalny: konkretne przypadki yes/no. Agent nie musi interpretować ogólników.
- Szablony lokalnych reguł są parametryzowane; zmiana roli jednego repo = edycja jednego pliku.

### Brak "promptowego potwora"

- Żaden pojedynczy plik nie przekracza ~80 linii treściowej. AGENTS.md pozostaje repo-specific i nie duplikuje konstytucji ekosystemu.

---

## 2. PROPOSED FILE STRUCTURE

```
<repo-root>/
├── AGENTS.md                          # Repo-specific: tożsamość, tryb pracy, architektura lokalna
├── .cursor/
│   └── rules/
│       ├── 00-topinstal-ecosystem-constitution.mdc   # Identyczna kopia we wszystkich 4 repo
│       └── 10-repo-role.mdc                          # Różna per repo (rola, granice, lokalne zasady)
└── docs/
    ├── architecture/
    │   └── repo-rules.md                          # Canonical local architecture guidance
    ├── discovery/
    │   └── repo-discovery.md                      # Discovery artifact
    ├── contracts/
    │   ├── field-mapping.md                       # Mapping artifact
    │   └── dto-and-boundaries.md                  # DTO and contract boundary guide
    ├── plans/                                     # migration-plan.md offloaded (2026-06) — see docs/README.md
    └── ecosystem/
        ├── TOPINSTAL_ECOSYSTEM_STATE.md            # Living document (jeden wspólny lub snapshot)
        ├── TOPINSTAL_ECOSYSTEM_RULES_DESIGN.md     # Ten dokument — blueprint
        ├── TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md  # Protokół aktualizacji living doc
        └── templates/
            └── 10-repo-role-<repo-name>.mdc        # Szablony do skopiowania jako 10-repo-role.mdc
```

### Plik: `00-topinstal-ecosystem-constitution.mdc`

- **Lokalizacja:** `.cursor/rules/` w każdym z 4 repo
- **Cel:** Wymuszenie myślenia ekosystemowego, ownership check, contract impact check, zakaz dublowania logiki
- **Kiedy używany:** Zawsze (alwaysApply: true)
- **Kto aktualizuje:** Człowiek lub agent przy zmianie ról ekosystemu; po zmianie — synchronizacja do wszystkich repo

### Plik: `10-repo-role.mdc`

- **Lokalizacja:** `.cursor/rules/` w każdym repo (nazwa pliku ta sama, treść różna)
- **Cel:** Przypomnienie roli repo, czego nie robi, lokalne zasady, when unsure, do not assume ownership
- **Kiedy używany:** Zawsze (alwaysApply: true)
- **Kto aktualizuje:** Agent przy zmianach w repo, jeśli rola się zmienia; człowiek przy zmianie granic odpowiedzialności

### Plik: `TOPINSTAL_ECOSYSTEM_STATE.md`

- **Lokalizacja:** `docs/ecosystem/` w kalk-top (lub wspólny katalog współdzielony, np. `topinstal-ecosystem/`)
- **Cel:** Bieżący stan: ownership, kontrakty, integracje, trace/auth/retry, ryzyka, legacy
- **Kiedy używany:** Przy zadaniach integracyjnych, zmianach DTO, nowych integracjach, odkryciu ryzyk
- **Kto aktualizuje:** Agent według update protocol; człowiek przy większych zmianach architektonicznych

### Plik: `AGENTS.md`

- **Lokalizacja:** Root każdego repo
- **Cel:** Tożsamość agenta, tryb pracy, architektura lokalna, DoD — bez duplikowania konstytucji ekosystemu
- **Kiedy używany:** Cursor ładuje przy starcie sesji
- **Kto aktualizuje:** Agent przy zmianach w repo; powinien odwoływać się do "ecosystem constitution" zamiast wklejać jej treść

---

## 3. GLOBAL ECOSYSTEM RULE

Zobacz `.cursor/rules/00-topinstal-ecosystem-constitution.mdc` — gotowy tekst jest tam wdrożony.

---

## 4. LOCAL REPO RULE TEMPLATE

Zobacz `templates/10-repo-role-<repo>.mdc` — gotowe szablony dla kalk-top, top-instal-generator, topinstal-mail-ingress, rag-chat-asystent.

---

## 5. LIVING DOCUMENT DESIGN

### Po co istnieje

Living document przechowuje **zmienne** informacje o ekosystemie: aktualne kontrakty, endpointy, integracje, trace semantics, ryzyka, legacy seams. Stałe zasady (role, ownership) są w konstytucji; stan systemu — tutaj.

### Czym różni się od stałej reguły

- Reguła: "kalk-top jest source of truth" — stała.
- Living doc: "CalcRequestDTO v1.2 ma pola X, Y; OfferDTO v1.1 zwraca Z" — zmienne.

### Sekcje living document

1. **Ownership matrix** — kto jest ownerem czego (może się zmieniać przy refaktorach)
2. **Cross-repo contracts** — DTO, envelope, schema versions
3. **Integrations** — kto z kim się łączy, endpointy, auth
4. **Trace / auth / retry semantics** — wspólne konwencje
5. **Active risks** — znane ryzyka systemowe
6. **Legacy seams** — co jest w trakcie migracji, co deprecated

### Co wolno wpisywać

- Zmiany kontraktów (nowe pola, wersje schema)
- Nowe integracje lub usunięcie starych
- Zmiany ownershipu
- Odkryte ryzyka systemowe
- Aktualizacje trace/auth/retry
- Legacy seams i ich status

### Czego wpisywać nie wolno

- Ogólne zasady architektoniczne (te są w konstytucji)
- Opisy pojedynczych plików lub funkcji
- Duplikaty README
- Marketingowe opisy
- Informacje, które zmieniają się przy każdym commicie (np. "ostatni deploy")

---

## 6. UPDATE PROTOCOL

Zobacz `TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md` — pełna treść z tabelami YES/NO i decision flow.

---

## 7. REQUIRED RESPONSE FORMAT FOR FUTURE TASKS

Zobacz `TOPINSTAL_ECOSYSTEM_TASK_RESPONSE_FORMAT.md` — szablon tabeli: local impact, cross-repo impact, ownership check, contract impact, ecosystem doc update.

---

## 8. RECOMMENDATION: AGENTS.MD VS .CURSOR/RULES

| Treść                                             | Gdzie                                                                     | Uzasadnienie                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Tożsamość agenta, cel repo, tryb pracy            | AGENTS.md                                                                 | Cursor ładuje AGENTS.md jako główny kontekst; to naturalne miejsce na "kim jesteś" i "jak pracujesz" |
| Stałe zasady ekosystemu (role, ownership, zakazy) | .cursor/rules/00-\*.mdc                                                   | Krótkie, egzekwowalne; Cursor stosuje reguły automatycznie; alwaysApply zapewnia widoczność          |
| Rola repo, granice, lokalne zasady                | .cursor/rules/10-\*.mdc                                                   | Repo-specific; uzupełnia konstytucję o kontekst lokalny                                              |
| Bieżący stan (kontrakty, integracje, ryzyka)      | TOPINSTAL_ECOSYSTEM_STATE.md                                              | Zmienne; nie obciąża każdej sesji; agent czyta on-demand                                             |
| Szczegóły implementacyjne, migracje               | docs/architecture/\*, docs/discovery/\*, docs/contracts/\*, docs/plans/\* | Repo-specific; nie mieszamy z ekosystemem                                                            |

**Model najstabilniejszy długoterminowo:**

- AGENTS.md = krótki (do ~100 linii), repo-specific, z odwołaniem do konstytucji ekosystemu
- .cursor/rules/ = 2 pliki stałe (konstytucja + rola repo), każdy <80 linii
- Living document = jeden plik, aktualizowany według protocol, bez rozrostu

---

## 9. 5 NAJCZĘSTSZYCH BŁĘDÓW, KTÓRYM SYSTEM MA ZAPOBIEGAĆ

1. **Przenoszenie logiki między modułami** — np. kalkulacja w generatorze, parsing maila w kalk-top
2. **Ciche zmiany DTO/envelope** — zmiana kontraktu bez aktualizacji living doc i bez sygnalizowania konsumentom
3. **Brak cross-repo impact check** — zmiana w jednym repo łamie integrację w drugim
4. **Dublowanie odpowiedzialności** — np. generator zaczyna "rozumieć" logikę doboru pomp
5. **Mieszanie stałych zasad ze stanem** — konstytucja zawiera "obecnie endpoint X" zamiast "kalk-top jest source of truth"

---

## 10. 5 SYGNAŁÓW DEGENERACJI REGUŁ

1. **Reguły przekraczają 150 linii łącznie** — agent przestaje je stosować konsekwentnie
2. **Living document ma >300 linii** — nikt go nie utrzymuje, staje się nieaktualny
3. **Konstytucja różni się między repo** — dryf, brak synchronizacji
4. **Update protocol ma >20 wyjątków** — zbyt skomplikowany, agent nie wie kiedy aktualizować
5. **AGENTS.md duplikuje konstytucję** — redundancja, ryzyko rozjazdu

---

## FINAL ARTIFACTS (gotowe do użycia)

### A. Gotowy tekst globalnej reguły

Plik: `.cursor/rules/00-topinstal-ecosystem-constitution.mdc` — wdrożony we wszystkich 4 repo.

### B. Gotowy szablon lokalnej reguły repo

Pliki: `templates/10-repo-role-kalk-top.mdc`, `templates/10-repo-role-top-instal-generator.mdc`, `templates/10-repo-role-topinstal-mail-ingress.mdc`, `templates/10-repo-role-rag-chat-asystent.mdc` — mail-ingress template copy now lives canonically under `gmail-agent/docs/ecosystem/templates/`, while the outer-root file is only a pointer stub.

### C. Gotowy szablon living document

Plik: `TOPINSTAL_ECOSYSTEM_STATE.md` — wdrożony w kalk-top/docs/ecosystem/.

### D. Gotowy update protocol

Plik: `TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md` — wdrożony w kalk-top i skopiowany do docs/ecosystem/ w top-instal-generator, topinstal-mail-ingress, rag-chat-asystent.

### E. Proponowana struktura plików

```
kalk-top/
├── AGENTS.md
├── .cursor/rules/
│   ├── 00-topinstal-ecosystem-constitution.mdc
│   └── 10-repo-role.mdc
└── docs/
    ├── architecture/
    │   └── repo-rules.md
    ├── discovery/
    │   └── repo-discovery.md
    ├── contracts/
    │   ├── field-mapping.md
    │   └── dto-and-boundaries.md
    ├── plans/                                     # offloaded — see docs/README.md
    └── ecosystem/
        ├── TOPINSTAL_ECOSYSTEM_RULES_DESIGN.md
        ├── TOPINSTAL_ECOSYSTEM_STATE.md
        ├── TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md
        ├── TOPINSTAL_ECOSYSTEM_TASK_RESPONSE_FORMAT.md
        └── templates/
            ├── 10-repo-role-kalk-top.mdc
            ├── 10-repo-role-top-instal-generator.mdc
            ├── 10-repo-role-topinstal-mail-ingress.mdc
            └── 10-repo-role-rag-chat-asystent.mdc

top-instal-generator/, topinstal-mail-ingress/, rag-chat-asystent/
├── AGENTS.md (z sekcją Ekosystem)
├── .cursor/rules/
│   ├── 00-topinstal-ecosystem-constitution.mdc
│   └── 10-repo-role.mdc
└── docs/ecosystem/
    ├── README.md (wskazuje na kalk-top)
    └── TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md
```

### F. Wdrożenie

Wdrożenie wykonane we wszystkich 4 repo. Konstytucja i reguły repo są w `.cursor/rules/`. Living document w kalk-top. Przy zmianach ról — synchronizuj `00-topinstal-ecosystem-constitution.mdc` do wszystkich repo. Living document aktualizuj według update protocol.
