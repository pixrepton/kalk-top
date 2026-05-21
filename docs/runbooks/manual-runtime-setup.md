# Manual Runtime Setup

Only the runtime/secrets wiring below should remain manual after the current codebase changes.

## 1. Mail-ingress runtime (`topinstal-mail-ingress`)

1. Fill `.env` using the canonical names from [`RUNTIME_CONFIG_MATRIX.md`](RUNTIME_CONFIG_MATRIX.md) (this folder).
2. Create real Gmail OAuth credentials and set:
   `TOPINSTAL_GMAIL_CLIENT_ID`, `TOPINSTAL_GMAIL_CLIENT_SECRET`, `TOPINSTAL_GMAIL_REFRESH_TOKEN`.
3. Set the calculator ingress target and auth:
   `TOPINSTAL_MAIL_BACKEND_URL`, `TOPINSTAL_MAIL_BACKEND_AGENT_KEY`.
4. Set writable storage paths if the defaults are not appropriate:
   `TOPINSTAL_MAIL_SQLITE_PATH`, `TOPINSTAL_MAIL_LOCK_PATH`, `TOPINSTAL_MAIL_LOG_PATH`.
5. Initialize local storage:
   `php topinstal-mail-ingress/bin/init-storage.php`
6. Run worker preflight before enabling cron:
   `php topinstal-mail-ingress/bin/preflight.php`
7. Schedule polling:
   `php topinstal-mail-ingress/bin/poll-gmail.php`

## 2. Calculator / WordPress runtime (`kalk-top`)

1. Activate/deploy the calculator plugin containing the mail-ingress workflow.
2. Set the calculator agent key used by mail-ingress:
   `TOPINSTAL_CALC_AGENT_API_KEY` or WP option `topinstal_calc_agent_api_key`.
3. Confirm the workflow flag is enabled:
   `TOPINSTAL_MAIL_INGRESS_WORKFLOW_ENABLED=1` or WP option `topinstal_mail_ingress_workflow_enabled`.
4. Set the internal review mailbox:
   `TOPINSTAL_MAIL_INGRESS_REVIEW_RECIPIENT` or WP option `topinstal_mail_ingress_review_recipient`.
5. Set generator connectivity:
   `TOPINSTAL_MAIL_INGRESS_GENERATOR_BASE_URL` or `TOPINSTAL_MAIL_INGRESS_GENERATOR_ENDPOINT`,
   plus `TOPINSTAL_MAIL_INGRESS_GENERATOR_KEY`.
   Preferred direct form:
   `TOPINSTAL_AGENT_OFFER_DOCUMENTS_ENDPOINT=https://www.topinstal.com.pl/pdf/wp-json/topinstal/v1/offer-documents/generate`
   and `TOPINSTAL_AGENT_OFFER_DOCUMENTS_KEY=...` also remain supported as legacy aliases.
   If no endpoint override is provided, kalk-top now falls back to the repo default:
   `https://www.topinstal.com.pl/pdf/wp-json/topinstal/v1/offer-documents/generate`
   Keep the key outside repo even if you accept the default endpoint in code.
6. Configure `wp_mail` delivery for the environment:
   SMTP plugin, transactional relay, or equivalent production mail transport.
7. Run the calculator-side workflow preflight endpoint:
   `GET /wp-json/topinstal/v1/mail-ingress/workflow-preflight`

### Local repo runtime

- `npm run runtime:sync` no longer mirrors/copies the plugin into `.runtime-wp`.
- Instead it rebuilds `.runtime-wp/wordpress/wp-content/plugins/topinstal-heatpump-calculator` as a link-based view of the canonical repo root:
  - top-level files use NTFS hard links
  - top-level directories use NTFS junctions
- This means local WordPress reads the same source files that you edit in the repo root.
- `npm run runtime:start` still calls `runtime:sync` first, but that step now refreshes links instead of creating a second copied plugin tree.

## 3. Generator runtime (`top-instal-generator`)

1. Activate/deploy the generator plugin exposing:
   `POST /wp-json/topinstal/v1/offer-documents/generate`
2. Set the runtime auth key expected by the generator route.
3. If PDF generation depends on an external converter, set the real converter URL/token in the generator runtime.

Recommended `wp-config.php` split:

```php
// kalk-top
define('TOPINSTAL_AGENT_OFFER_DOCUMENTS_KEY', '...secret...');
define('TOPINSTAL_MAIL_INGRESS_GENERATOR_TIMEOUT', 120);

// top-instal-generator
define('TOP_INSTAL_AGENT_API_KEY', '...same-secret...');
define('TOP_INSTAL_PDF_CONVERTER_URL', 'https://converter.example');
define('TOP_INSTAL_PDF_CONVERTER_TOKEN', '...converter-secret...');
```

The endpoint may be left unset in `kalk-top` if the repo default host is correct for that environment.

## 4. Final staging checks

1. Run mail-ingress preflight (in the **topinstal-mail-ingress** checkout):
   `php topinstal-mail-ingress/bin/preflight.php`
2. Run calculator workflow preflight:
   `curl -H "X-Top-Instal-Agent-Key: YOUR_CALC_AGENT_KEY" https://YOUR-WP/wp-json/topinstal/v1/mail-ingress/workflow-preflight`
3. Run the live smoke in the **mail-ingress** repo (not `kalk-top`):
   - `npm run test:mail-ingress-live` from **kalk-top** only prints a pointer to the external package; it does not execute Gmail/live integration.
   - Use the real script from `topinstal-mail-ingress` for live smoke and idempotency checks.
4. Repeat the same smoke with the same `TOPINSTAL_MAIL_LIVE_MESSAGE_ID` to confirm idempotency.

## 5. Evidence-first workflow

- Use Browser when the change affects visible UI, flow transitions, browser console, or network behavior.
- Use Debug Mode when the bug is reproducible but the root cause is unclear.
- When reporting runtime success, include what was actually run and what evidence was observed.
