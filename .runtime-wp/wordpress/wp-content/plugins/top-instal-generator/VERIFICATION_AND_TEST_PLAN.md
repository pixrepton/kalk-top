# Plan weryfikacji i testów – Top-Instal Generator

**Status:** Część weryfikacji i testów wykonana autonomicznie (ścieżka prices, konwerter PDF, PHP lint, synchronizacja kopii). Testy w przeglądarce nadal do wykonania ręcznie.

---

## 1. Zaimplementowane zmiany (podsumowanie)

| # | Funkcjonalność | Pliki | Status wdrożenia |
|---|----------------|-------|------------------|
| 1 | Błąd inline „Brak ceny dla takiej konfiguracji zbiornika” | `top-instal-generator.php`, `generator.css`, `generator.js` | ✅ Wdrożone |
| 2 | Suma ceny: pompa + zbiornik + bufor + installation_net + hydraulic + fundament 300 | `top-instal-generator.php` (ładowanie prices), `generator.js` (updateTotalPrice) | ✅ Wdrożone |
| 3 | Konwerter PDF: URL i token z ustawień WP, pole `files`, nagłówek X-Converter-Token | `top-instal-generator.php` (blok PDF) | ✅ Wdrożone |

---

## 2. Weryfikacja statyczna (przegląd kodu) – WYKONANE

- [x] **Ścieżka do prices.json**  
  **Zweryfikowane:** z katalogu `top-instal-generatorr/` `realpath(TOP_INSTAL_PLUGIN_PATH . '../main/konfigurator/prices.json')` zwraca poprawną ścieżkę do `main/konfigurator/prices.json`. Na czystym WordPressie (bez katalogu `main/`) plugin ładuje **wbudowany fallback** `prices-fallback.json` z katalogu pluginu – pełne ceny CWU, bufora, instalacji, hydrauliki, fundamentu i VAT bez potrzeby wgrywania zewnętrznego pliku.

- [ ] **Placeholder {{PRC}} w szablonach**  
  W repozytorium nie ma plików `.docx` (szablony prawdopodobnie poza repo). W PHP cena trafia do `{{PRC}}`. Skrypt `check_prc.php` służy do sprawdzenia placeholderów w szablonie (wymaga pliku `szablon-1f-split.docx` w katalogu).

- [x] **Struktura pluginu**  
  **Zweryfikowane:** plugin działa jako samodzielna jednostka w katalogu `top-instal-generatorr/` z wszystkimi wymaganymi plikami (PHP, JS, CSS, JSON).

---

## 3. Testy ręczne (do wykonania u Ciebie)

### 3.1. Błąd inline – zbiornik

1. Otwórz stronę z generatorem (WordPress z shortcode’em).
2. Włącz **Zbiornik CWU**, wybierz pojemność **250 litrów**, producent **Galmet** (emalia).  
   **Oczekiwanie:** czerwona ramka na polach zbiornika + komunikat „Brak ceny dla takiej konfiguracji zbiornika”.
3. Zmień producenta na **Thermatec** (inox) przy 250 L.  
   **Oczekiwanie:** błąd znika (inox ma 250 w prices).
4. Ustaw **400 litrów** + **Thermatec**.  
   **Oczekiwanie:** błąd znowu się pokazuje (inox nie ma 400 w prices).
5. Kliknij **Generuj** przy widocznym błędzie.  
   **Oczekiwanie:** submit zablokowany, przewinięcie do komunikatu błędu.

### 3.2. Suma ceny

1. Wybierz **Pompa ciepła**, moc np. **7 kW**, zbiornik **200 L**, producent **Trinnity**, bufor **100 L**, zestaw np. **KIT-WC07K3E5**.
2. W polu „Cena (zł brutto)” sprawdź wartość.  
   **Oczekiwanie:**  
   `(cena KIT z kits.json + cwu.emalia[200] + buffer[100].sprzeglo + 11000 + 3700 + 300) * 1.08`  
   np. dla 12207 + 2750 + 1750 + 11000 + 3700 + 300 = 31707 netto → brutto 34243 (zaokrąglone).
3. Zaznacz **Bufor** i wybierz **100–150 L**.  
   **Oczekiwanie:** cena bufora jak dla 150 L (sprzęgło 2050), suma się przelicza.
4. Wybierz zestaw **AIO** (np. KIT-ADC07K3E5).  
   **Oczekiwanie:** w sumie części hydrauliczne 2700 zamiast 3700; cena się zmienia.

### 3.3. Cena w dokumencie

1. Wygeneruj ofertę w formacie **DOCX** (żeby nie zależeć od konwertera).
2. Pobierz plik, otwórz w Wordzie.
3. Wyszukaj w dokumencie kwotę (lub placeholder, jeśli coś nie zostało podmienione).  
   **Oczekiwanie:** w miejscu ceny jest ta sama kwota (ze spacjami jako separatorami tysięcy), co w polu „Cena (zł brutto)” w generatorze.

### 3.4. Konwerter PDF

**Test autonomiczny wykonany:** wysłano `test_minimal.docx` na `<PDF_CONVERTER_URL>` z nagłówkiem `X-Converter-Token`. Odpowiedź HTTP 200, zapisany plik ma nagłówek `%PDF-1.7` i rozmiar ~20 KB – konwerter działa poprawnie. W pluginie ustaw URL i token, aby „Generuj PDF” z formularza korzystał z konwertera.

1. W WordPress: **Ustawienia → Top-Instal Generator** ustaw:
   - **URL konwertera PDF:** `<PDF_CONVERTER_URL>`
   - **Token:** `<SET_IN_CONFIG>`
2. Zapisz ustawienia.
3. W generatorze wybierz **Format wyjściowy: PDF (.pdf)** i kliknij **Generuj**.
4. **Oczekiwanie:** pobrany plik ma rozszerzenie `.pdf` i otwiera się jako PDF (nie DOCX).
5. Jeśli nadal dostajesz DOCX: włącz **Debug log** w ustawieniach, wygeneruj ponownie, sprawdź w `top-instal-generatorr/curl_debug.txt` (lub w logach PHP) kod HTTP i ewentualny błąd cURL.

### 3.5. Konwerter niedostępny / brak ustawień

1. Wyczyść URL konwertera (zostaw puste), zapisz.
2. Wybierz **Generuj PDF** i generuj.  
   **Oczekiwanie:** pobierany jest plik DOCX (fallback), w logach PHP wpis o braku URL/tokenu.

---

## 4. Opcjonalne testy automatyczne

- **PHP:** prosty test jednostkowy (np. PHPUnit) dla ścieżki do `prices.json` i dla tablicy `$replacements` (czy `{{PRC}}` jest ustawione).
- **JS:** w Node lub w przeglądarce (np. QUnit) – mock `topInstal.prices` i sprawdzenie, że `updateTotalPrice()` zwraca oczekiwaną sumę dla zestawu danych wejściowych.
- **Konwerter:** skrypt (np. curl lub PHP z cURL) wysyłający testowy DOCX na `<PDF_CONVERTER_URL>` z tokenem i weryfikujący, że odpowiedź to PDF (nagłówek Content-Type lub magic bytes `%PDF`).

---

## 5. Podsumowanie

- **Zaimplementowane:** błąd inline, suma ceny (z prices), cena w dokumencie ({{PRC}}), poprawka konwertera PDF (ustawienia WP + `files` + token).
- **Nie wykonane:** testy w przeglądarce, test wygenerowanego dokumentu, test live na konwerterze, weryfikacja ścieżki do `prices.json` w docelowym środowisku.
- **Do zrobienia po Twojej stronie:**  
  1) testy z sekcji 3 (najważniejsze).  
- **Fallback cen:** przy „czystym” WP (bez `main/konfigurator/prices.json`) plugin używa pliku `prices-fallback.json` z katalogu pluginu – pełne ceny bez ręcznego wgrywania.

Jeśli chcesz, mogę w kolejnym kroku przygotować konkretne przypadki testowe (np. tabelkę: wybór formularza → oczekiwana kwota netto/brutto) albo skrypt curl do testu konwertera.

