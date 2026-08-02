# Converter VPS – DOCX → PDF (Gotenberg)

Konwerter DOCX→PDF dla pluginu **Top-Instal Generator**. Na serwerze działa Gotenberg (LibreOffice) + Nginx (reverse proxy, token, limity).

**Serwer:** VPS Hetzner, IP `46.224.235.86` – to ten sam host, na którym stoi konwerter używany przez plugin.

---

## SSH – dostęp do VPS Hetzner (konwerter)

- **Klucz publiczny** do tego serwera jest w pliku: **`topinstal-vps.pub`** (w tym katalogu).
- To klucz **Hetzner / VPS konwertera** – służy do logowania na serwer, gdzie działa konwerter PDF.

**Logowanie na VPS (gdy masz dopasowany klucz prywatny):**

```bash
ssh -i /ścieżka/do/prywatnego_klucza topinstal-vps@46.224.235.86
# lub np. root@46.224.235.86 – zależnie od konfiguracji użytkownika na serwerze
```

Na serwerze klucz publiczny musi być w `~/.ssh/authorized_keys` użytkownika, pod którym się logujesz.

---

## Deploy na tym serwerze (46.224.235.86)

- **Port:** Nginx nasłuchuje na **8080** (Caddy zajmuje 80).
- **Healthcheck:** `<PDF_CONVERTER_HEALTH_URL>` → 200 OK
- **Konwersja:** `POST <PDF_CONVERTER_URL>` z nagłówkiem `X-Converter-Token`

---

## Ustawienia pluginu WordPress

W panelu WP: **Ustawienia → Top-Instal Generator** wpisz:

| Pole | Wartość |
|------|--------|
| **URL konwertera PDF** | `<PDF_CONVERTER_URL>` |
| **Token konwertera (X-Converter-Token)** | `<SET_IN_CONFIG>` |

(Zapisz te dane w bezpiecznym miejscu – token jest też w pliku `.env` na serwerze w `~/converter-vps/.env`.)

---

## Komendy na serwerze

```bash
# Wejście (klucz: topinstal-vps – plik topinstal-vps.pub w tym katalogu)
ssh -i ~/.ssh/topinstal-vps root@46.224.235.86
# lub: ssh root@46.224.235.86   jeśli klucz jest domyślny w ssh-agent

# Katalog konwertera
cd ~/converter-vps

# Status
docker compose ps

# Logi
docker compose logs -f

# Restart
docker compose --env-file .env restart

# Zatrzymanie
docker compose --env-file .env down

# Uruchomienie
docker compose --env-file .env up -d
```

---

## Testy curl (z dowolnej maszyny z dostępem do serwera)

```bash
# Healthcheck
curl -s -o /dev/null -w "%{http_code}" <PDF_CONVERTER_HEALTH_URL>
# Oczekiwane: 200

# Konwersja DOCX → PDF (podstaw swój plik zamiast test.docx)
curl -X POST <PDF_CONVERTER_URL> \
  -H "X-Converter-Token: <SET_IN_CONFIG>" \
  -F "files=@test.docx" \
  -o result.pdf
```

---

## Opcjonalnie: HTTPS i domena

Jeśli chcesz użyć domeny (np. `converter.twojadomena.pl`) i HTTPS:

1. Ustaw rekord DNS A dla domeny na `46.224.235.86`.
2. W Caddy (już na serwerze) dodaj reverse proxy z domeny na `http://127.0.0.1:8080` dla ścieżek `/convert` i `/health`.
3. W ustawieniach pluginu WP zmień URL na `https://twoja-domena.pl/convert` (token bez zmian).

Pliki w tym katalogu: `docker-compose.yml`, `nginx/` (config z tokenem jest już na serwerze, w repo jest placeholder `<SECRET_TOKEN>`).

