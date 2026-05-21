# Top-Instal Generator

**Generator ofert HVAC** – wtyczka WordPress do tworzenia ofert na pompy ciepła Panasonic w formacie DOCX i PDF, z interfejsem w stylu Windows 95.

---

## Spis treści

- [Dla użytkownika](#dla-uzytkownika)
  - [Opis i funkcje](#opis-i-funkcje)
  - [Wymagania i instalacja](#wymagania-i-instalacja)
  - [Użycie](#uzycie)
  - [Konfiguracja PDF](#konfiguracja-pdf)
  - [Rozwiązywanie problemów](#rozwiazywanie-problemow)
- [Dla dewelopera](#dla-dewelopera)
  - [Struktura projektu](#struktura-projektu)
  - [Architektura i przepływ danych](#architektura-i-przeplyw-danych)
  - [API, hooki, stałe](#api-hooki-stale)
  - [Dane i pliki konfiguracyjne](#dane-i-pliki-konfiguracyjne)
  - [Testy i walidacja](#testy-i-walidacja)
  - [Rozszerzanie i wdrożenie](#rozszerzanie-i-wdrozenie)
- [Changelog i licencja](#changelog-i-licencja)

---

# Dla użytkownika

## Opis i funkcje

Generator umożliwia:
- **Wybór zestawu** – pompy Split (1F/3F), ALL-IN-ONE 185L/260L, T-CAP, z filtrowaniem po mocy i zbiorniku CWU.
- **Konfigurację** – zbiornik CWU (checkbox + pojemność + producent), bufor (checkbox + pojemność/zakres), cena brutto (obliczana automatycznie lub ręczna).
- **Generowanie oferty** – w formacie **DOCX** (Word) lub **PDF** (przez zewnętrzny konwerter). Placeholdery w szablonie są automatycznie zastępowane.

Interfejs jest responsywny (mobile/tablet/desktop) i stylizowany na Windows 95.

---

## Wymagania i instalacja

### Wymagania

| Wymaganie | Wersja / szczegóły |
|-----------|--------------------|
| WordPress | 5.0+ |
| PHP | 7.4+ |
| Rozszerzenia PHP | zip, xml, gd, curl |
| Composer | tylko do zbudowania `vendor/` (folder można wgrać gotowy) |

### Instalacja krok po kroku

1. Skopiuj cały folder **`top-instal-generatorr`** do `wp-content/plugins/`.
2. Upewnij się, że w katalogu pluginu jest folder **`vendor/`** (zależności Composer).  
   Jeśli go nie ma: w katalogu pluginu uruchom `composer install`.
3. W panelu WordPress: **Wtyczki → Zainstalowane wtyczki** → znajdź **„Top-Instal Generator”** → **Aktywuj**.
4. (Opcjonalnie) Umieść szablony DOCX w katalogu pluginu (patrz sekcja [Szablony dokumentów](#szablony-dokumentów) w części dla dewelopera).

---

## Użycie

### Dodanie generatora na stronę

W treści strony lub wpisu dodaj shortcode:

```
[top_instal_offer_generator]
```

### Proces generowania oferty

1. **Typ instalacji** – Pompa ciepła (domyślnie).
2. **Moc pompy** – 3 / 5 / 7 / 9 / 12 / 16 kW.
3. **Zbiornik CWU** – włącz/wyłącz; pojemność (150–400 L lub ALL-IN-ONE 185L/260L); producent (gdy CWU włączone).  
   Przy braku ceny dla danej konfiguracji pojawi się komunikat błędu i generowanie będzie zablokowane.
4. **Bufor** – włącz/wyłącz; pojemność lub zakres (np. 100–150 L).
5. **Zestaw** – lista zestawów ładowana dynamicznie (zależnie od mocy i CWU).
6. **Cena** – pole „Cena (zł brutto)” wypełniane automatycznie; można edytować.
7. **Format** – **PDF (.pdf)** lub **Word (.docx)**.
8. **Generuj Ofertę** – po kliknięciu pojawi się link do pobrania pliku.

---

## Konfiguracja PDF

- **Domyślnie** wtyczka ma wpisane URL i token konwertera – po wyborze „PDF” i kliknięciu „Generuj” oferta jest konwertowana na PDF bez dodatkowej konfiguracji.
- Aby **zmienić** adres konwertera lub token: **Ustawienia → Top-Instal Generator** – uzupełnij **URL konwertera PDF** i **Token (X-Converter-Token)** i zapisz.
- Jeśli konwerter jest niedostępny lub ustawienia są puste, użytkownik otrzyma plik **DOCX** zamiast PDF (fallback).

---

## Rozwiązywanie problemów

| Problem | Co zrobić |
|--------|-----------|
| **„Composer dependencies missing”** | Do katalogu pluginu dołóż folder `vendor/` lub uruchom w nim `composer install`. |
| **Zamiast PDF pobiera się DOCX** | Sprawdź **Ustawienia → Top-Instal Generator** (URL i token). Włącz „Włącz logowanie diagnostyczne” i po ponownej próbie sprawdź plik `curl_debug.txt` w katalogu pluginu. |
| **Brak zestawów na liście** | Sprawdź, czy w katalogu pluginu jest plik `kits.json` i czy ma poprawną składnię (np. `php validate-json.php`). |
| **„Brak ceny dla takiej konfiguracji zbiornika”** | Wybrana para pojemność + producent nie ma ceny w `prices.json` / `prices-fallback.json`. Wybierz inną pojemność lub producenta, albo dopisz ceny (dla deweloperów). |
| **Błąd przy generowaniu** | Sprawdź logi PHP/WordPress oraz (dla PDF) `curl_debug.txt`. Upewnij się, że katalog `wp-content/uploads/` jest zapisywalny i że plugin może utworzyć `wp-content/uploads/top-instal-offers/`. |

---

# Dla dewelopera

## Struktura projektu

```
top-instal-generatorr/
├── top-instal-generator.php   # Główny plik wtyczki (shortcode, AJAX, ustawienia, konwersja PDF)
├── generator.js               # Logika formularza, AJAX, kalkulacja ceny, walidacja CWU
├── generator.css              # Style (Win95, responsywność, błędy inline)
├── kits.json                  # Baza zestawów pomp (ceny netto), sekcje 1f/3f, AIO, T-CAP
├── prices-fallback.json       # Ceny CWU/bufor/instalacja/hydraulika/fundament/VAT (fallback)
├── szablon-*.docx             # Szablony ofert (nazewnictwo – patrz niżej)
├── vendor/                    # Composer (PHPWord, ZipArchive itd.)
├── converter-vps/             # Konfiguracja VPS konwertera DOCX→PDF (Gotenberg, Nginx)
│   ├── README.md              # SSH, deploy, testy curl
│   ├── docker-compose.yml
│   ├── nginx/
│   └── topinstal-vps.pub      # Klucz SSH do VPS Hetzner
├── validate-json.php          # Walidacja kits.json i prices-fallback.json (CLI)
├── test-converter-and-generator.php  # Test konwertera i konfiguracji PDF (CLI)
├── create_minimal_docx.php    # Tworzenie minimalnego DOCX do testów
├── check_prc.php              # Narzędzie do sprawdzania placeholderów w szablonie DOCX
├── .gitignore
├── README.md                  # Ten plik
├── VERIFICATION_AND_TEST_PLAN.md
├── DEPLOYMENT_READY.md
└── AUTONOMIC_VERIFICATION_REPORT.md
```

Pliki generowane w czasie działania (nie w repo): `wp-content/uploads/top-instal-offers/*.docx|*.pdf`, `curl_debug.txt`, `test_minimal.docx`, `test_converter_output.pdf`.

---

## Architektura i przepływ danych

### Przepływ przy generowaniu oferty

1. **Front (generator.js)**  
   Zbiera dane z formularza (w tym `output_format` z radia PDF/DOCX), waliduje konfigurację zbiornika (`checkTankConfigPrice`). Wysyła `POST` na `admin-ajax.php` z `action=simple_generate`, `nonce` i `data=JSON.stringify({...})`.

2. **Backend (top-instal-generator.php)**  
   - `handle_simple_generate()`: weryfikacja nonce, parsowanie `data`, sanitizacja, walidacja (zestaw, cena, format).  
   - Wczytanie zestawu z `kits.json`, wybór szablonu DOCX (Split 1F/3F, AIO 185/260, z/bez CWU, z/bez bufora).  
   - Skopiowanie szablonu do `uploads/top-instal-offers/`, otwarcie jako ZIP, podmiana placeholderów w `word/document.xml` (z XML-escape).  
   - Jeśli `output_format === 'pdf'`: wywołanie zewnętrznego konwertera (URL + token z opcji WP lub stałe domyślne), POST z plikiem DOCX, zapis odpowiedzi jako PDF; przy błędzie – zwrot DOCX.  
   - Odpowiedź JSON: `filename`, `download_url`.

3. **Front**  
   Wyświetla link do pobrania (`download_url`).

### Zabezpieczenia

- **AJAX:** `check_ajax_referer('top_instal_nonce', 'nonce')` w obu akcjach (`get_kits`, `simple_generate`).
- **Wejście:** `sanitize_text_field()` / `intval()` na polach z `input_data`; `in_array($output_format, ['docx','pdf'])`.
- **DOCX:** wartości placeholderów przez `htmlspecialchars(..., ENT_QUOTES | ENT_XML1, 'UTF-8')`.
- **Ustawienia WP:** `esc_url_raw`, `esc_attr` przy wyświetlaniu; zapis przez `register_setting` z sanitize.

### Konwerter PDF

- **Endpoint:** konfigurowalny w WP (domyślnie: `<PDF_CONVERTER_URL>`).
- **Autoryzacja:** nagłówek `X-Converter-Token`.
- **Body:** multipart, pole `files` z plikiem DOCX (Gotenberg).
- **Fallback:** brak URL/tokenu lub błąd HTTP → zwracany jest DOCX; w logu wpis o błędzie.

---

## API, hooki, stałe

### Stałe PHP

| Stała | Znaczenie |
|-------|-----------|
| `TOP_INSTAL_PLUGIN_PATH` | Katalog pluginu (plugin_dir_path). |
| `TOP_INSTAL_PLUGIN_URL` | URL katalogu pluginu. |
| `TOP_INSTAL_PLUGIN_VERSION` | Wersja (np. 1.0.0). |
| `TOP_INSTAL_PDF_CONVERTER_URL_DEFAULT` | Domyślny URL konwertera. |
| `TOP_INSTAL_PDF_CONVERTER_TOKEN_DEFAULT` | Domyślny token konwertera. |

### Akcje AJAX (front → backend)

| Action | Opis | Parametry (POST) |
|--------|------|-------------------|
| `get_kits` | Pobranie listy zestawów (filtrowanej). | `nonce`, `power_type`, `tank_capacity`, `power_kw` |
| `simple_generate` | Wygenerowanie oferty DOCX/PDF. | `nonce`, `data` (JSON: installation_type, kit_model, tank_*, buffer_*, custom_price, output_format, …) |

Oba: `wp_ajax_*` i `wp_ajax_nopriv_*` (dostęp bez logowania).

### Obiekt JS `topInstal` (wp_localize_script)

- `ajaxurl` – URL do `admin-ajax.php`
- `nonce` – do wysyłki w każdym żądaniu
- `prices` – obiekt cen (cwu.emalia/inox, buffer, installation_net, hydraulic_components_*, foundation, vat_rate) do kalkulacji i walidacji CWU

### Hooki WordPress

- `wp_enqueue_scripts` → rejestracja CSS/JS i `topInstal`.
- `init` → rejestracja shortcode `top_instal_offer_generator`.
- `admin_menu` → strona ustawień **Top-Instal Generator** (opcje).
- `admin_init` → rejestracja opcji (URL konwertera, token, debug log).
- `register_activation_hook` → utworzenie katalogu `uploads/top-instal-offers` przy aktywacji.

---

## Dane i pliki konfiguracyjne

### kits.json

- **Sekcje:** `1fazowe`, `3fazowe`, `all_in_one_185`, `all_in_one_260`, `all_in_one_2strefowy`, `tcap_1fazowe`, `tcap_3fazowe`, `tcap_aio_260`.
- **Format wpisu:** `"KIT-ID": { "name", "power", "voltage", "indoor_unit", "outdoor_unit", "price" }` – ceny **netto**.
- Mapowanie zbiornika CWU na sekcję: `none` / 150–400 → zestawy split (bez AIO); `185-aio` → `all_in_one_185`; `260-aio` / `260-tcap` → `all_in_one_260` + `tcap_aio_260`.

### Ceny (prices)

- **Źródło:** `realpath(TOP_INSTAL_PLUGIN_PATH . '../main/konfigurator/prices.json')`; jeśli niedostępny → `prices-fallback.json` w katalogu pluginu.
- **Struktura (używane pola):** `cwu.emalia`, `cwu.inox`, `buffer` (klucze pojemności, w tym `sprzeglo`), `foundation`, `installation_net`, `hydraulic_components_aio`, `hydraulic_components_split`, `vat_rate`.

### Szablony dokumentów

Nazwy plików zgodne z logiką w PHP:

- **Split 1F:** `szablon-1f-split.docx`, `szablon-1f-split-cwu.docx`, `szablon-1f-split-bufor.docx`, `szablon-1f-split-cwu-bufor.docx`
- **Split 3F:** `szablon-3f-split.docx`, `szablon-3f-split-cwu.docx`, `szablon-3f-split-bufor.docx`, `szablon-3f-split-cwu-bufor.docx`
- **AIO 185L:** `szablon-1f-aio-cwu.docx`, `szablon-1f-aio-cwu-bufor.docx`, `szablon-3f-aio-cwu185.docx`, `szablon-3f-aio-cwu185-bufor.docx`
- **AIO 260L (w tym T-CAP 260):** `szablon-3f-aio-cwu260.docx`, `szablon-3f-aio-cwu260-bufor.docx`

### Placeholdery w szablonach DOCX

| Placeholder | Zawartość |
|-------------|-----------|
| `{{MOC}}` | Moc (kW). |
| `{{KIT}}` | Identyfikator zestawu. |
| `{{INDOOR}}` | Jednostka wewnętrzna. |
| `{{OUTDOOR}}` | Jednostka zewnętrzna. |
| `{{CWU}}` | Opis zbiornika CWU. |
| `{{TANK}}` | Producent zbiornika. |
| `{{BFR}}` | Pojemność bufora (np. „100 litrów” lub „brak - nie rekomendowany”). |
| `{{PRC}}` | Cena brutto (z spacjami jako separatorami tysięcy). |

Wartości są escapowane do XML przed wstawieniem do `word/document.xml`.

---

## Testy i walidacja

- **Składnia PHP:**  
  `php -l top-instal-generator.php`

- **JSON:**  
  `php validate-json.php`  
  Sprawdza `kits.json`, `prices-fallback.json` i (jeśli istnieje) `../main/konfigurator/prices.json`.

- **Konwerter PDF i konfiguracja:**  
  `php test-converter-and-generator.php`  
  Weryfikuje: stałe PDF w pluginie, health konwertera, konwersję DOCX→PDF (z tokenem), oraz wynik `validate-json.php`. Wymaga dostępu do sieci.

- **Placeholdery w DOCX:**  
  Skrypt `check_prc.php` – wymaga pliku szablonu w katalogu (np. `szablon-1f-split.docx`).

Szczegółowy plan testów: `VERIFICATION_AND_TEST_PLAN.md`.

---

## Rozszerzanie i wdrożenie

### Dodawanie zestawów

1. Edycja `kits.json`: nowy wpis w odpowiedniej sekcji (np. `1fazowe`, `tcap_aio_260`).
2. Ewentualnie nowy szablon DOCX, jeśli inna kombinacja CWU/bufor.

### Dodawanie / zmiana szablonów

1. Nowy plik `.docx` z placeholderami `{{NAZWA}}` w katalogu pluginu.
2. W `top-instal-generator.php` – rozszerzenie warunków wyboru `$template_name` w `handle_simple_generate()` (blok „Logika wyboru szablonu”).

### Zmiana konwertera PDF

- W kodzie: stałe `TOP_INSTAL_PDF_CONVERTER_*_DEFAULT`.
- W WordPress: **Ustawienia → Top-Instal Generator** (nadpisują domyślne po zapisie).

### Wdrożenie na produkcję

1. Wgranie katalogu pluginu (z `vendor/` i szablonami DOCX).
2. Aktywacja wtyczki.
3. Sprawdzenie uprawnień do zapisu w `wp-content/uploads/` (katalog `top-instal-offers` tworzony przy aktywacji).
4. Opcjonalnie: konfiguracja URL/token konwertera w ustawieniach WP.
5. Krótki test: shortcode na stronie, wybór zestawu, generowanie DOCX i PDF.

Szczegóły gotowości: `DEPLOYMENT_READY.md`.

---

# Changelog i licencja

### Ważne zmiany (m.in. refaktoryzacja 2025-09, uzupełnienia 2026)

- Kompatybilność PHP 7.4 (brak `match`/`str_contains` w krytycznych miejscach).
- Logika w `generator.js`; brak inline script w shortcode.
- CWU: checkbox + pojemność + producent; bufor: checkbox + pojemności/zakresy.
- T-CAP 260L traktowany jak AIO 260L (wspólna lista i szablony).
- Nazwy plików z timestamp; czyszczenie plików starszych niż 30 dni.
- XML-escape placeholderów w DOCX.
- Konwerter PDF: domyślne URL i token w pluginie; opcje WP; pole `files`; fallback do DOCX.
- Ceny: ładowanie z `main/konfigurator/prices.json` lub `prices-fallback.json`; automatyczna kalkulacja ceny; walidacja brakujących cen zbiorników (błąd inline).
- UI: styl Win95, responsywność, dostępność.

**Wersja:** 1.0.0  
**Licencja:** GPL v2 or later  
**Kontakt:** support@topinstal.com.pl

