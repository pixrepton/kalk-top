# DECISIONS_GENERATOR_INTEGRATION.md

## 1) REST + AJAX compatibility
**Decision:** wprowadzono REST `offer-documents/generate`, ale zachowano `simple_generate`.

**Why:**
- agent i narzêdzia potrzebuj¹ stabilnego API,
- istniej¹cy UI nie mo¿e mieæ regresji.

**Implementation:**
- `simple_generate` deleguje do nowego use-case,
- legacy shape (`filename`, `download_url`) pozostaje.

## 2) One use-case for generation
**Decision:** centralny punkt logiki to `GenerateOfferDocumentUseCase`.

**Why:**
- brak duplikacji miêdzy REST i AJAX,
- spójne zachowanie walidacji/template/pdf/storage.

## 3) DTO + trace + error contract
**Decision:** ten sam styl integracyjny co `kalk-top`:
- `schemaVersion`, `traceId`,
- kontrakty request/response,
- error payload `{traceId,errorCode,message,details}`.

**Why:**
- pe³na kompatybilnoœæ architektoniczna miêdzy modu³ami.

## 4) Auth model
**Decision:** REST akceptuje nonce (UI) albo agent key (header `X-Top-Instal-Agent-Key`).

**Why:**
- UI WordPress i agent maj¹ ró¿ne potrzeby,
- minimalna z³o¿onoœæ, praktyczny model operacyjny.

## 5) Security cleanup
**Decision:** usuniêto hardcoded token/URL konwertera z domyœlnych wartoœci kodu.

**Why:**
- sekrety nie mog¹ byæ trwale osadzone w repo,
- konfiguracja przez option/env/constant.

## 6) Transitional mode for calculator alignment
**Decision:** dodano `mode=from-offer-dto` (przejœciowo mapowany do generator payload).

**Why:**
- docelowo kalkulator ma byæ source of truth,
- ten krok pozwala integrowaæ wynik kalkulatora bez dublowania pe³nych obliczeñ w generatorze.

## 7) Why not full rewrite of plugin file now
**Decision:** stary kod w `top-instal-generator.php` nie zosta³ usuniêty ca³kowicie, ale jest odciêty przez early delegation.

**Why:**
- bezpieczna migracja bez ryzyka regresji,
- szybki rollback,
- mo¿liwoœæ etapowego porz¹dkowania.
