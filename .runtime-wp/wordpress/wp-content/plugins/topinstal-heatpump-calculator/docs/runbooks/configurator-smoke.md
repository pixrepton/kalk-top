# Smoke: kalkulator → konfigurator → podsumowanie

Krótka checklista przed release (manual). Środowisko: działający WP z wtyczką, backend `calculate-offer` zgodnie z deployem.

1. Otwórz stronę ze shortcode kalkulatora.
2. Wypełnij formularz kalkulatora minimalnym poprawnym zestawem danych i uruchom obliczenia.
3. Sprawdź, że wyniki ładują się bez błędów w konsoli przeglądarki.
4. Przejdź do zakładki / widoku konfiguratora maszynowni.
5. Wybierz pompę (krok 1) — karta ma stan „Wybrano”, obrazek się ładuje lub pokazuje bezpieczny fallback.
6. Przejdź przez zasobnik CWU zgodnie z flow (w tym skip AIO jeśli dotyczy).
7. **Parametry hydrauliczne:** uzupełnij pola (strefowanie / HT / biwalencja wg typu instalacji) tak, by krok był kompletny.
8. Dokończ dobór bufora / hydrauliki CO gdy krok jest aktywny.
9. Przejdź kolejne kroki (cyrkulacja, Service Cloud, posadowienie, reduktor, woda) wg potrzeby.
10. Otwórz krok podsumowania konfiguratora — tabela **„Konfiguracja zestawu”** (nad / obok szczegółów cenowych) zawiera wiersz **Parametry hydrauliczne** ze statusem Wybrano / Wymagane oraz skrótem odpowiedzi.
11. Na ekranie oferty końcowej: sprawdź **Cena inwestycji (brutto)** — albo kwota, albo zrozumiały komunikat (np. wycena części zestawu).
12. Rozwiń **„Pokaż szczegóły pozycji”** — w środku jest **tylko** tabela breakdownu cen (VAT/netto), bez checklisty konfiguracji.
13. Sprawdź sekcję **„Wybrane urządzenia”** — zdjęcia głównych komponentów (pompa, CWU, bufor) lub brak sekcji, jeśli brak wyborów.
14. Kliknij **Pobierz ofertę PDF** lub **Wyślij PDF** — potwierdź, że akcja kończy się sukcesem lub czytelnym komunikatem (bez crasha UI).
15. Otwórz formularz kontaktu z intencją — pola i walidacja działają.
16. Odśwież stronę i powtórz krótko: brak czerwonych błędów w konsoli, brak 404 na `dom.png` / `split-k.png` przy poprawnym deployu assetów.

**Uwaga:** Pełna weryfikacja PDF/generatora poza tym repozytorium nie jest w zakresie tego runbooka.
