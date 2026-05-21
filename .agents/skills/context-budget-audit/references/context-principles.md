# Context principles — skrót (bez pełnych context-fundamentals / context-optimization)

Źródło inspiracji: odzysk `context-fundamentals` + `context-optimization`, **skondensowane** pod audyt TOP-INSTAL.

## Budżet uwagi

Kontekst to **skończony budżet** tokenów na jedno wywołanie — nie magazyn bez kosztu. Informacja na środku długiego kontekstu jest **słabiej** „widoczna” niż na początku/końcu (lost-in-the-middle).

## Progressive disclosure

1. Router / nazwy skilli — **L1**.
2. Wybrane `SKILL.md` — **L2**.
3. `references/` — **L3** tylko gdy zadanie tego wymaga.

## Jakość vs ilość

- Preferuj **identyfikatory** (ścieżki, nazwy komend) nad wklejaniem całych logów.
- Wyniki narzędzi → po przetworzeniu **maskuj** lub **skróć**; zachowaj możliwość ponownego odczytu z dysku.

## Optymalizacja (priorytet ryzyka)

1. **Stabilny prefix** promptu (cache-friendly) — dynamiczne na końcu.
2. **Maskowanie obserwacji** — po ekstrakcji wniosków zamień ściany tekstu na referencje.
3. **Kompakcja** historii przy wysokim zapełnieniu okna — **stratywnie**, nie kasując promptu systemowego bez świadomości ryzyka.
4. **Partycjonowanie** — sub-agenci tylko gdy oszczędność > koszt koordynacji.

## Rule of thumb

Projektuj tak, by **najmniejszy** zestaw tokenów wspierał **bieżącą decyzję** — reszta na żądanie.
