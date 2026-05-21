# WordPress self-hosted + MCP (jak WordPress.com, ale u siebie)

WordPress.com udostępnia MCP na poziomie konta ([ogłoszenie z marca 2026](https://wordpress.com/blog/2026/03/20/ai-agent-manage-content/)). Na **własnym hostingu** odpowiednikiem jest oficjalny ekosystem **WordPress.org**: plugin **[MCP Adapter](https://github.com/WordPress/mcp-adapter)** + **[Abilities API](https://github.com/WordPress/abilities-api)**, a w Cursorze (i innych klientach MCP) — mostek **`@automattic/mcp-wordpress-remote`**, który łączy się z endpointem HTTP MCP na Twojej stronie.

To jest obecnie **najbliższy** model „tak jak MCP na WordPress.com”: standard MCP, narzędzia/resources/prompts wynikające z abilities, kontrola uprawnień po stronie WordPressa.

## Wymagania

- WordPress z działającym **REST API** (`/wp-json/`).
- **HTTPS** na produkcji (Application Passwords i bezpieczny MCP).
- Konto użytkownika WP z odpowiednią rolą (np. Administrator / Editor — zależnie od tego, co chcesz wystawić agentowi).
- **[Application Password](https://make.wordpress.org/core/2020/11/05/application-passwords-integration/)**: _Użytkownicy → Profil_ → wygeneruj hasło aplikacji (nie używaj głównego hasła).

### Hosting współdzielony (np. Hostido)

Na typowym hostingu masz **publiczną domenę + HTTPS** i panel do WordPressa — to jest **idealny przypadek pod tryb HTTP** (Cursor u Ciebie na PC łączy się po internecie z `https://twoja-domena.pl/...`; **nie** musisz mieć WP-CLI ani SSH).

- Włącz **SSL** w panelu Hostido (często Let’s Encrypt jednym kliknięciem). Application Passwords i sensowne MCP zakładają **HTTPS**.
- Wtyczki (**Abilities API**, **MCP Adapter**) zainstaluj przez **Wtyczki → Dodaj nową** albo **Wyślij wtyczkę na serwer** (paczka `.zip` z [GitHub Releases](https://github.com/WordPress/mcp-adapter/releases), jeśli nie budujesz przez Composer na serwerze).
- Sprawdź w przeglądarce: `https://twoja-domena.pl/wp-json/` — powinno zwrócić listę tras REST. Jeśli jest błąd, w WP ustaw **bezpośrednie odnośniki** (permalinki), nie „surowe” `?p=123`.
- Jeśli coś blokuje żądania (rzadkie: mod_security / reguły WAF), w razie 403 na `/wp-json/mcp/...` napisz do supportu Hostido z prośbą o przepuszczenie ścieżki REST — podaj konkretny URL endpointu MCP z wtyczki.
- Przed instalacją nowych wtyczek zrób **kopię zapasową** (panel Hostido lub wtyczka backup).

## 1. Instalacja po stronie WordPressa

### Zalecane (oficjalna ścieżka)

1. Zainstaluj zależności zgodnie z [README MCP Adapter](https://github.com/WordPress/mcp-adapter):
   - pakiet **[wordpress/abilities-api](https://github.com/WordPress/abilities-api)**,
   - pakiet **[wordpress/mcp-adapter](https://github.com/WordPress/mcp-adapter)**.

   Typowo: `composer require wordpress/abilities-api wordpress/mcp-adapter` w **wtyczce motywu**, która ładuje Composer (albo wtyczka dedykowana pod MCP), **albo** pobierz [Release](https://github.com/WordPress/mcp-adapter/releases) i zainstaluj jak zwykłą wtyczkę, potem `composer install` w katalogu wtyczki — dokładna procedura jest w repozytorium.

2. Po aktywacji domyślny serwer MCP wystawia endpoint HTTP (z dokumentacji adaptera):

   ```text
   https://TWOJA-DOMENA.pl/wp-json/mcp/mcp-adapter-default-server
   ```

   Dokładna ścieżka może się różnić, jeśli skonfigurujesz własny serwer; wtedy użyj URL z panelu / dokumentacji wtyczki.

3. Opcjonalnie: **WP-CLI** na tym samym serwerze, jeśli chcesz tryb **STDIO** (patrz niżej).

### Starsza alternatywa (community)

Projekt **[mcp-wp/mcp-server](https://mcp-wp.github.io/docs/mcp-server/installation)** wystawiał `wp-json/mcp/v1/mcp`; część materiałów wskazuje migrację w stronę adaptera WordPress.org. Nowe instalacje planuj pod **WordPress/mcp-adapter**.

## 2. Połączenie z Cursorem — tryb HTTP (najlepszy dla self-hosted zdalnie)

Cursor czyta konfigurację MCP z `.cursor/mcp.json` (projekt) lub globalnie. Użyj oficjalnego wzorca z [MCP Adapter — MCP Client Configuration](https://github.com/WordPress/mcp-adapter): proces lokalny `npx` + zmienne środowiskowe z **URL do endpointu MCP** oraz **Application Password**.

Przykład (wartości **nie** commituj; użyj pliku lokalnego lub sekretów):

```json
{
  "mcpServers": {
    "wordpress-selfhosted": {
      "command": "npx",
      "args": ["-y", "@automattic/mcp-wordpress-remote@latest"],
      "env": {
        "WP_API_URL": "https://twoja-domena.pl/wp-json/mcp/mcp-adapter-default-server",
        "WP_API_USERNAME": "twoj_login_wp",
        "WP_API_PASSWORD": "xxxx xxxx xxxx xxxx xxxx xxxx",
        "LOG_FILE": ""
      }
    }
  }
}
```

- **`WP_API_URL`**: pełny URL endpointu MCP z Twojej instalacji (jak w logu po instalacji adaptera / w dokumentacji wersji).
- **`WP_API_USERNAME`**: login WordPressa (użytkownika, dla którego wygenerowałeś Application Password).
- **`WP_API_PASSWORD`**: wygenerowane hasło aplikacji (ze spacjami lub bez — wg wymagań klienta).

Szablon bez sekretów: [cursor-mcp-wordpress.example.json](./cursor-mcp-wordpress.example.json).

Po zapisaniu **zrestartuj Cursor** (MCP ładuje się przy starcie).

## 3. Połączenie — tryb STDIO (gdy WordPress jest lokalnie na tym samym komputerze)

Jeśli masz **WP-CLI** i lokalną ścieżkę do WordPressa (np. `.runtime-wp/wordpress`), możesz uruchomić serwer MCP przez:

```bash
wp mcp-adapter serve --server=mcp-adapter-default-server --user=twoj_login
```

W `mcp.json` (fragment z [README MCP Adapter](https://github.com/WordPress/mcp-adapter)):

```json
{
  "mcpServers": {
    "wordpress-local-stdio": {
      "command": "wp",
      "args": [
        "--path=C:/sciezka/do/wordpress",
        "mcp-adapter",
        "serve",
        "--server=mcp-adapter-default-server",
        "--user=twoj_login"
      ]
    }
  }
}
```

Ścieżka `--path` musi wskazywać **root WordPressa** (katalog z `wp-config.php`). To omija potrzebę `npx` i hasła w env, ale działa sensownie tylko wtedy, gdy WP jest lokalnie dostępny dla WP-CLI.

## 4. Bezpieczeństwo

- Osobne konto / Application Password tylko pod agenta; minimalna rola (np. Editor zamiast Administrator, jeśli wystarczy).
- Nie commituj `.cursor/mcp.json` z hasłami — użyj `.gitignore` lub lokalnego override (globalny `mcp.json` w profilu użytkownika).
- Na produkcji wymuszaj HTTPS; rozważ ograniczenie dostępu do `/wp-json/mcp/…` (firewall, Basic Auth warstwy serwera) jeśli endpoint ma być tylko dla Ciebie.

## 5. Relacja do `kalk-top`

Ten repozytorium to wtyczka kalkulatora; **MCP Adapter** to osobna warstwa całego WordPressa (treści, abilities, inne wtyczki). Możesz mieć **obie** rzeczy na jednej instalacji: MCP do zarządzania treścią / abilities, oraz dotychczasowe REST kalkulatora (`/wp-json/topinstal/v1/…`) do oferty — bez konfliktu, o ile konfigurujesz auth i uprawnienia osobno.

## 6. Diagnostyka

- Sprawdź, czy REST odpowiada: `GET https://twoja-domena.pl/wp-json/`
- Sprawdź endpoint MCP (metoda/zakres z dokumentacji MCP Adapter dla Twojej wersji).
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector) (wspomniany też w starszej dokumentacji mcp-wp) — do debugowania sesji MCP.
