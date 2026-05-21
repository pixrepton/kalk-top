# Funnel traceability (kalk-top)

## Where you see client journeys

WordPress admin (capability `manage_options`):

1. **TOP-INSTAL → Lejek** — session metrics and recent milestone events.
2. **TOP-INSTAL → Sukcesy** — grouped journeys (wynik → PDF → lead).
3. **TOP-INSTAL → Leady z kalkulatora** — contact payloads after form submit.

Tables (auto-created on `init` if missing):

- `{prefix}topinstal_calc_events` — anonymous funnel events.
- `{prefix}topinstal_calc_sessions` — UPSERT `formEngine.state` snapshot per `session_id` (on each successful `calculate-offer`).
- `{prefix}topinstal_leads` — lead upserts (email/phone) + immutable `building_profile_json` at handshake.
- `{prefix}topinstal_journey_notes` — operator notes per journey.

## Milestone events (what must fire)

| Client action                          | Event stored                                         | Source         |
| -------------------------------------- | ---------------------------------------------------- | -------------- |
| First backend OZC / offer after form   | `calc_result_view`                                   | `calc`         |
| Results screen rendered                | `calc_result_view`                                   | `calc`         |
| Configurator persisted canonical offer | `calc_result_view` (from `configurator_offer_ready`) | `configurator` |
| PDF generated                          | `pdf_generate_success`                               | `calc`         |
| PDF download click                     | `pdf_download_click`                                 | `calc`         |
| Contact form success                   | `lead_success`                                       | `calc`         |

Journey stage in **Sukcesy** uses `calc_result_view` (and legacy `calc_success` / `configurator_offer_ready` in SQL).

## Common reasons nothing appears

1. **Tables never created** — fixed: plugin runs `maybe_ensure_tracking_tables()` on `init` and before AJAX persist.
2. **Only `calc_success` in DB** — older builds; admin now treats `calc_success` as a result milestone. New builds map to `calc_result_view` in `analytics.js`.
3. **Configurator had no tracking** — fixed: `configurator_offer_ready` on `persistCanonicalOfferToConfigData`.
4. **Analytics queue not flushed** — requires `HEATPUMP_CONFIG.nonce` and `admin-ajax.php`; check browser Network for `heatpump_track_event` → `success: true`, `stored > 0`.
5. **No contact data** — journeys still appear in **Sukcesy** by `session_id` / `trace_id`; email/phone only after lead form.

## Verify locally

```powershell
npm run runtime:start   # if WP not running
npm run runtime:sync
```

1. Open calculator, complete calculation, open results.
2. In DevTools → Network, confirm `action=heatpump_track_event` with `calc_result_view`.
3. WP admin → **TOP-INSTAL → Sukcesy** → filter 7d → stage **wynik** or **pdf**.

Optional automated smoke:

```powershell
npm run test:e2e:install
npm run test:e2e
```

Set `PLAYWRIGHT_BASE_URL` / `PLAYWRIGHT_CALCULATOR_PATH` if not `http://127.0.0.1:8090/?page_id=5`.

## Production deploy checklist

- Deploy plugin + `runtime:sync` equivalent on server.
- Load any WP page once (runs table migration).
- Confirm **TOP-INSTAL** menu exists for admin user.
- Spot-check one real session in **Lejek** event list.
