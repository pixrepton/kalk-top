# Potencjalne nowoczesne wejscia AI do `calculate-offer` - backlog przyszlych wdrozen

> Status: vision
> Owner: TOP-INSTAL architecture direction
> Last verified against code/runtime: 2026-04-02 (market and documentation research)
> Source-of-truth level: L4
> Supersedes: none
> Related docs: `../TOPINSTAL_AI_OS_BLUEPRINT.md`, `../SOURCE_OF_TRUTH_INDEX.md`, `README.md`
>
> Runtime authority note: this is a future-options backlog, not a runtime contract document.
>
> Data syntezy: 2026-04-02.
>
> Cel: zachowac w jednym miejscu potencjalne nowoczesne kanaly wejscia, ktore w przyszlosci moga zasilać `POST /wp-json/topinstal/v1/calculate-offer`.

## 1. Zasada nadrzedna

Niezaleznie od tego, czy dane wejda przez:

- szybki formularz,
- chat,
- voice bota,
- WhatsApp,
- PDF lub skan,
- zdjecia,
- asystenta handlowego,

warstwa decyzyjna `kalk-top` pozostaje ta sama:

`dowolny kanal -> ekstrakcja / uzupelnienie danych -> ustrukturyzowany JSON -> CalcRequestDTO -> POST calculate-offer -> OfferDTO`

Nie budujemy osobnych silnikow liczenia dla poszczegolnych kanalow. AI i narzedzia zewnetrzne maja tylko doprowadzic dane do poprawnego `CalcRequestDTO`.

## 2. Najwazniejsze wspolczesne klocki technologiczne

### 2.1 Structured outputs

Najwazniejszy praktyczny klocek dla AI jako wejscia. Model powinien zwracac kontrolowany JSON zgodny z naszym wewnetrznym schematem pośrednim albo bezposrednio z `CalcRequestDTO`, zamiast "prawie poprawnego" tekstu.

Znaczenie dla TOP-INSTAL:

- stabilniejsze mapowanie rozmowy do danych,
- mniej bledow parsera,
- latwiejsza walidacja brakow,
- sensowna sciezka dla agentow z danymi pelnymi, czesciowymi i szczatkowymi.

## 2.2 Vision / multimodal

Nowoczesne modele potrafia analizowac wiele obrazow i dokumentow w jednym przeplywie. To otwiera wejscia typu:

- zdjecie kotlowni,
- zdjecie tabliczki znamionowej,
- zdjecie rzutu,
- skan swiadectwa energetycznego,
- PDF oferty konkurencji,
- zdjecie grzejnikow / rozdzielacza / jednostki zewnetrznej.

## 2.3 Voice agents

Voice boty webowe i telefoniczne sa juz praktyczne, nie tylko demonstracyjne. Moga prowadzic rozmowe kwalifikacyjna, dopytywac o braki i na koncu budowac request do backendu.

## 2.4 Document intelligence

Silniki do czytania PDF-ow, skanow i formularzy sa dojrzale. Dla TOP-INSTAL to dobry kanal wszedzie tam, gdzie klient ma dokumenty zamiast cierpliwosci do formularza.

## 2.5 Agentic automation

Warstwy typu workflow / automation dobrze nadaja sie do sklejania kanalow wejscia z backendem, bez budowania wszystkiego od zera w jednym customowym serwisie.

## 3. Kanoniczny wzorzec architektury

Rekomendowany wzorzec dla wszystkich nowych wejsc:

1. Kanal zbiera dane.
2. Warstwa AI / ekstrakcji zamienia dane na JSON posredni.
3. Normalizator mapuje JSON do `CalcRequestDTO`.
4. Walidator sprawdza braki i poziom pewnosci.
5. Integracja wysyla `POST /wp-json/topinstal/v1/calculate-offer`.
6. UI lub agent pokazuje `OfferDTO` wraz z ostrzezeniami i zalozeniami.

Warstwa AI nie powinna:

- liczyc mocy i cen poza backendem,
- zgadywac wyniku zamiast budowac request,
- pomijac jawnej informacji o brakach i zalozeniach.

## 4. Potencjalne kanały wejscia

### 4.1 Szybkie formularze AI

Gotowe rozwiazania:

- Jotform AI Agents
- Typeform AI

Najlepsze zastosowania:

- landing pages,
- lead magnety,
- szybka prekwalifikacja,
- uproszczony estymator przed pelnym formularzem,
- "powiedz tylko kilka rzeczy o domu".

Mocne strony:

- szybkie wdrozenie,
- niski koszt startu,
- dobra konwersja dla prostych kampanii,
- mozliwosc laczenia klasycznego formularza z lekkim AI intake.

Ograniczenia:

- slabiej nadaja sie do bardzo zlozonych rozmow technicznych,
- zwykle wymagaja osobnego adaptera do `CalcRequestDTO`,
- trzeba pilnowac jawnych profili domyslnych i opisow "wynik orientacyjny".

Rekomendacja dla TOP-INSTAL:

- traktowac je jako warstwe "quick estimate",
- zbierac 5-8 odpowiedzi,
- reszte dopinac profilem domu,
- konczyc zawsze poprawnym requestem do backendu.

### 4.2 Chat intake na stronie

Gotowe rozwiazanie:

- Voiceflow

Najlepsze zastosowania:

- konwersacyjny intake zamiast klasycznego formularza,
- dopytywanie o braki,
- prowadzenie klienta krok po kroku,
- webchat z logika biznesowa i API actions.

Mocne strony:

- lepsze UX niz duzy formularz,
- naturalna sciezka do doprecyzowywania brakow,
- mozliwosc laczenia tekstu, wyborow i uploadow.

Ograniczenia:

- wymaga dobrze zaprojektowanego flow,
- bez warstwy structured outputs mozna utknac na "ladnej rozmowie bez pewnego JSON-a",
- nadal trzeba miec polityke profili domyslnych.

Rekomendacja dla TOP-INSTAL:

- dobre jako "doradca na stronie",
- szczegolnie sensowne tam, gdzie klient nie chce wypelniac duzego formularza naraz.

### 4.3 Voice intake na stronie i przez telefon

Gotowe rozwiazania:

- OpenAI Voice Agents
- Vapi

Najlepsze zastosowania:

- rozmowa glosowa z klientem,
- telefoniczny intake po leadzie,
- 24/7 przyjecie podstawowych danych,
- dopytanie o brakujace pola bez udzialu handlowca.

Mocne strony:

- bardzo niski prog wejscia dla klienta,
- dobre dla mobile-first,
- naturalna sciezka do follow-up po kampanii reklamowej,
- mozliwosc budowy voice concierge lub inbound call bot.

Ograniczenia:

- glos jest wygodny, ale mniej precyzyjny niz formularz dla danych technicznych,
- wymaga mocnej warstwy potwierdzen i streszczenia odpowiedzi,
- przy bardziej technicznych parametrach czesto trzeba przejsc do tekstu lub formularza.

Rekomendacja dla TOP-INSTAL:

- traktowac glos jako kanal otwierajacy i kwalifikujacy,
- na koncu i tak budowac strukture danych z potwierdzeniem kluczowych pol.

### 4.4 WhatsApp i wiadomosci asynchroniczne

Gotowe rozwiazania:

- Twilio WhatsApp
- Meta WhatsApp Business Platform

Najlepsze zastosowania:

- leady z reklam,
- asynchroniczna rozmowa z klientem,
- prosba o doslanie zdjec, PDF-u lub tabliczki,
- follow-up po niepelnym formularzu.

Mocne strony:

- wysoka wygoda dla klienta,
- naturalny kanal mobilny,
- dobra sciezka "doslij jeszcze zdjecie / rachunek / dokument".

Ograniczenia:

- rozmowa bywa rozciagnieta w czasie,
- trzeba pilnowac stanu sesji i brakow danych,
- potrzebne sa jasne statusy, co juz wiadomo, a czego jeszcze nie.

Rekomendacja dla TOP-INSTAL:

- bardzo dobry kanal dla dogrywania brakujacych danych po szybkim formularzu,
- moze byc lacznikiem miedzy marketingiem a pelna kalkulacja.

### 4.5 Dokumenty, PDF-y, skany, swiadectwa

Gotowe rozwiazania:

- Azure Document Intelligence
- Google Document AI
- Unstructured

Najlepsze zastosowania:

- swiadectwa energetyczne,
- PDF-y z audytow,
- skany formularzy,
- rzuty i zestawienia,
- dokumenty od klienta lub od konkurencji.

Mocne strony:

- mniej recznego przepisywania,
- dobra sciezka dla klienta, ktory "ma dokument, ale nie chce odpowiadac na 30 pytan",
- sensowna baza pod prefill formularza i dopytanie tylko o luki.

Ograniczenia:

- ekstrakcja dokumentu nie oznacza jeszcze gotowego `CalcRequestDTO`,
- trzeba miec mapowanie dokument -> pola posrednie -> DTO,
- dla wielu dokumentow i tak potrzebne beda pytania uzupelniajace.

Rekomendacja dla TOP-INSTAL:

- bardzo mocne wejscie B2C i B2B,
- szczegolnie dobre jako "przeslij dokument, a my przygotujemy wstepna kalkulacje".

### 4.6 Zdjecia i photo-first intake

Gotowe klocki:

- OpenAI Vision / image understanding

Najlepsze zastosowania:

- identyfikacja urzadzenia ze zdjecia,
- odczyt tabliczki znamionowej,
- rozpoznanie typu emitera,
- wstepna ocena kotlowni,
- prefill danych do rozmowy lub formularza.

Mocne strony:

- bardzo niski prog wejscia dla klienta,
- dobre jako wsparcie dla formularza lub chatu,
- przyspiesza prace handlowca.

Ograniczenia:

- vision nie powinno samodzielnie zgadywac twardych danych geometrycznych,
- zdjecia powinny sluzyc do prefillu i doprecyzowania, nie do udawania pelnej dokumentacji technicznej.

Rekomendacja dla TOP-INSTAL:

- traktowac jako warstwe wspierajaca, nie jedyne zrodlo prawdy.

### 4.7 Asystent sprzedazy / operatora wewnetrznego

Potencjalne polaczenia:

- chat operatora,
- dokument upload,
- voice note,
- structured outputs,
- adapter do `CalcRequestDTO`.

Najlepsze zastosowania:

- handlowiec rozmawia z klientem i w locie buduje wstepna kalkulacje,
- operator dosyla brakujace dane do backendu bez przepisywania wszystkiego recznie,
- AI podpowiada, czego jeszcze brakuje do sensownego requestu.

Mocne strony:

- duzy wzrost produktywnosci wewnetrznej,
- dobre zanim wdrozy sie pelny customer-facing voice/chat.

Rekomendacja dla TOP-INSTAL:

- to moze byc najbezpieczniejszy pierwszy etap AI, bo czlowiek nadal nadzoruje wynik.

### 4.8 Orkiestracja i workflow

Gotowe rozwiazania:

- Make AI Agents
- n8n

Najlepsze zastosowania:

- spinanie formularzy, uploadow, dokumentow, WhatsAppa i voice,
- uruchamianie adaptera do `CalcRequestDTO`,
- retry, routing, tagowanie leadow, powiadomienia dla handlowca.

Mocne strony:

- szybkie MVP,
- dobra warstwa automatyzacji bez pisania calej orkiestracji od zera.

Ograniczenia:

- logika krytyczna i walidacyjna nie powinna zyc tylko w no-code flow,
- trzeba pilnowac, zeby kontrakt z `kalk-top` pozostawal centralny i testowalny.

## 5. Zestawy wdrozen referencyjnych

### 5.1 Najszybszy szybki start

- Jotform AI Agents
- Make
- cienki adapter do `CalcRequestDTO`

Po co:

- szybkie formularze AI,
- landingi,
- szybka prekwalifikacja leadow,
- niski koszt i krótki time-to-value.

### 5.2 Najlepsze UX na stronie

- Voiceflow
- Typeform AI lub prosty quick form
- upload zdjec / dokumentow
- adapter do `CalcRequestDTO`

Po co:

- konwersacyjny intake z dopytywaniem,
- lepsze UX niz duzy formularz,
- dobra sciezka dla klienta B2C.

### 5.3 Najbardziej AI-native i skalowalne

- OpenAI Structured Outputs
- OpenAI Vision
- OpenAI Voice Agents lub Vapi
- Twilio WhatsApp lub webchat
- n8n lub Make
- wewnetrzny adapter i polityka domyslnych profili

Po co:

- pelna kontrola architektury,
- jeden rdzen normalizacji dla wielu kanalow,
- najlepsza baza pod dlugofalowa rozbudowe.

## 6. Proponowana kolejnosc wdrozen dla TOP-INSTAL

### Faza 1 - szybki efekt biznesowy

1. Szybki formularz AI / quick estimator.
2. Dokument-first prefill: PDF, skan, swiadectwo.
3. Wewnetrzny asystent handlowca do domykania brakow.

### Faza 2 - wejscia konwersacyjne

1. Chat intake na stronie.
2. WhatsApp intake.
3. Dosylanie zdjec i dokumentow w toku rozmowy.

### Faza 3 - voice

1. Voice intake na stronie.
2. Inbound phone bot.
3. Hybryda glos + tekst + dokumenty.

### Faza 4 - jedna warstwa wielokanalowa

1. Wspolny normalizator do `CalcRequestDTO`.
2. Wspolna polityka uzupelniania brakow.
3. Wspolny `traceId` i `context`.
4. Wspolne dashboardy jakosci danych i konwersji.

## 7. Twarde zasady projektowe dla przyszlych wdrozen

### 7.1 Zawsze normalizowac do jednego backendu

Kazdy kanal ma konczyc sie tym samym wywolaniem:

`POST /wp-json/topinstal/v1/calculate-offer`

### 7.2 Nie liczyc na froncie ani w promptach

AI nie powinno:

- liczyc ceny,
- liczyc doboru,
- liczyc OZC,
- symulowac `OfferDTO`.

To robi backend.

### 7.3 Miec polityke brakow danych

Kazdy kanal AI powinien miec jasna polityke:

- co uznajemy za dane pewne,
- co wymaga pytania uzupelniajacego,
- co wolno uzupelnic profilem domyslnym,
- kiedy wynik pokazujemy jako orientacyjny.

### 7.4 Rozdzielic "extract" od "decide"

- extract: formularz / chat / voice / dokument / vision wydobywa dane,
- decide: `kalk-top` wylicza oferte.

### 7.5 Uzywac `traceId` i `context`

Kazdy nowy kanal powinien dodawac:

- zrodlo wejscia,
- typ kanalu,
- wersje flow,
- nazwe profilu domyslnego,
- poziom pewnosci / completeness,
- identyfikator sesji lub konwersacji.

## 8. Antywzorce

- osobny silnik liczenia w chatbotcie albo formularzu,
- "luźna notatka" zamiast strukturyzacji do DTO,
- brak jawnych zalozen przy szybkim formularzu,
- udawanie pelnej precyzji przy danych szczatkowych,
- bezposrednie laczenie wielu vendorow do backendu bez jednej warstwy normalizacji,
- traktowanie vision jako zrodla pewnych danych technicznych bez potwierdzenia,
- workflow no-code jako jedyne miejsce krytycznej logiki mapowania.

## 9. Co warto przechowywac jako metadane kazdego wejscia

- `source_channel`
- `source_vendor`
- `conversation_id`
- `traceId`
- `input_mode` (`full`, `partial`, `fragmentary`, `document_first`, `voice_first`)
- `default_profile`
- `confidence_level`
- `missing_fields`
- `human_review_required`

## 10. Krotka macierz decyzji

| Opcja | Najlepsza do | Szybkosc wdrozenia | Zlozonosc | Uwagi |
| --- | --- | --- | --- | --- |
| Jotform AI Agents | szybkie leady i landingi | wysoka | niska | najlepszy szybki start |
| Typeform AI | quick forms premium UX | wysoka | niska | dobre dla marketingu |
| Voiceflow | chat intake na stronie | srednia | srednia | najlepszy conversational UX |
| OpenAI Voice Agents | voice intake | srednia | srednia | mocna sciezka voice-native |
| Vapi | voice / phone bot | srednia | srednia | dobre pod telefonie i voice |
| Twilio WhatsApp | komunikacja mobilna | srednia | srednia | bardzo mocny kanal follow-up |
| Azure Document Intelligence | dokumenty i skany | srednia | srednia | mocny enterprise document path |
| Google Document AI | dokumenty i OCR pipeline | srednia | srednia | mocna alternatywa enterprise |
| Unstructured | ingestion dokumentow | srednia | srednia | dobre jako warstwa przetwarzania |
| Make AI Agents | szybkie workflow MVP | wysoka | niska | dobry klej integracyjny |
| n8n | bardziej elastyczna orkiestracja | srednia | srednia | dobry balans miedzy kontrola i szybkoscia |

## 11. Rekomendacja strategiczna dla TOP-INSTAL

Jesli priorytetem jest szybki efekt:

- uruchomic szybki formularz AI,
- dokument-first prefill,
- wewnetrznego asystenta handlowca.

Jesli priorytetem jest UX i konwersja:

- wdrozyc chat intake na stronie,
- dodac upload zdjec i dokumentow,
- pozniej rozszerzyc o WhatsApp.

Jesli priorytetem jest architektura na lata:

- oprzec wszystko o `structured outputs`,
- miec jeden wewnetrzny JSON posredni,
- miec jeden adapter do `CalcRequestDTO`,
- miec wspolne zasady domyslnych profili i poziomu pewnosci.

## 12. Zrodla do ponownego sprawdzenia przed zakupem / wdrozeniem

Vendorzy i funkcje zmieniaja sie szybko. Przed realnym zakupem trzeba odswiezyc:

- funkcje,
- limity,
- zgodnosc z RODO i hostingiem danych,
- kanal wdrozenia w Polsce,
- integracje,
- model kosztowy.

Linki referencyjne wykorzystane w researchu z 2026-04-02:

- OpenAI Structured Outputs: <https://openai.com/index/introducing-structured-outputs-in-the-api/>
- OpenAI Vision: <https://developers.openai.com/api/docs/guides/images-vision>
- OpenAI Voice Agents: <https://openai.github.io/openai-agents-js/guides/voice-agents/>
- Voiceflow: <https://www.voiceflow.com/>
- Vapi: <https://docs.vapi.ai/quickstart/introduction>
- Jotform AI Agents: <https://www.jotform.com/ai/agents/>
- Typeform AI: <https://www.typeform.com/ai>
- Twilio WhatsApp: <https://www.twilio.com/en-us/messaging/channels/whatsapp>
- Meta WhatsApp Business Platform: <https://developers.facebook.com/docs/whatsapp/>
- Azure Document Intelligence: <https://azure.microsoft.com/en-us/products/ai-foundry/tools/document-intelligence>
- Google Document AI: <https://docs.cloud.google.com/document-ai/docs>
- Unstructured: <https://docs.unstructured.io/welcome>
- Make AI Agents: <https://www.make.com/en/ai-agents>
- n8n AI docs: <https://docs.n8n.io/advanced-ai/>

## 13. Relacja do kanonicznych dokumentow repo

Ten dokument nie zmienia:

- kontraktu `calculate-offer`,
- `CalcRequestDTO`,
- `OfferDTO`,
- auth,
- walidacji runtime.

Kanoniczna prawda runtime pozostaje w:

- `docs/contracts/README_NOWE_WEJSCIA_CALCULATE_OFFER.md`
- `docs/contracts/API_CALCULATE_OFFER.md`
- `docs/contracts/agent-calculate-offer-instruction.md`

Ten plik sluzy jako backlog i mapa mozliwych przyszlych wdrozen AI / multimodal / conversational.
