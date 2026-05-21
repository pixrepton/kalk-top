# Runtime Config Matrix

Canonical source of truth for staging/production wiring of the mail-ingress -> calculator -> generator -> review-email workflow.

## Mail-Ingress Runtime (`topinstal-mail-ingress`)

| Name | Required | Secret | Example | Purpose | Default / Alias |
| --- | --- | --- | --- | --- | --- |
| `TOPINSTAL_MAIL_ENV` | optional | no | `production` | Runtime mode label for logs/health output. | default `production` |
| `TOPINSTAL_MAIL_SOURCE_MODULE` | optional | no | `topinstal-mail-ingress` | Envelope `source_module`. | default `topinstal-mail-ingress` |
| `TOPINSTAL_MAIL_PAYLOAD_TYPE` | optional | no | `cieplo_app_lead_v1` | Envelope `payload_type`. | default `cieplo_app_lead_v1` |
| `TOPINSTAL_MAIL_KERNEL_SCHEMA_VERSION` | optional | no | `1.0` | Envelope schema version. | default `1.0` |
| `TOPINSTAL_MAIL_POLL_LIMIT` | optional | no | `10` | Max Gmail messages per batch. | default `10`, alias `POLL_LIMIT` |
| `TOPINSTAL_GMAIL_CLIENT_ID` | yes | yes | `123.apps.googleusercontent.com` | Gmail OAuth client id. | alias `GMAIL_CLIENT_ID` |
| `TOPINSTAL_GMAIL_CLIENT_SECRET` | yes | yes | `secret-value` | Gmail OAuth client secret. | alias `GMAIL_CLIENT_SECRET` |
| `TOPINSTAL_GMAIL_REFRESH_TOKEN` | yes | yes | `1//refresh-token` | Active Gmail refresh token. | alias `GMAIL_REFRESH_TOKEN` |
| `TOPINSTAL_GMAIL_REFRESH_TOKEN_PREVIOUS` | optional | yes | `1//previous-token` | Grace token during rotation. | alias `GMAIL_REFRESH_TOKEN_PREVIOUS` |
| `TOPINSTAL_GMAIL_REFRESH_TOKEN_PREVIOUS_VALID_UNTIL` | optional | no | `1767225600` | Unix timestamp until previous token stays valid. | default `0`, alias `GMAIL_REFRESH_TOKEN_PREVIOUS_VALID_UNTIL` |
| `TOPINSTAL_GMAIL_USER_EMAIL` | optional | no | `me` | Gmail API user id. | default `me`, alias `GMAIL_USER_EMAIL` |
| `TOPINSTAL_GMAIL_QUERY` | optional | no | `is:unread (cieplo.app OR cieplowlasciwie.pl) -label:TOPINSTAL_PROCESSED` | Gmail search query used by the poller. | alias `GMAIL_QUERY` |
| `TOPINSTAL_GMAIL_LABEL_PROCESSED` | optional | no | `TOPINSTAL_PROCESSED` | Label added after finalization. | default `TOPINSTAL_PROCESSED`, alias `GMAIL_LABEL_PROCESSED` |
| `TOPINSTAL_GMAIL_LABEL_NEEDS_REVIEW` | optional | no | `TOPINSTAL_NEEDS_REVIEW` | Label added when human review is needed. | default `TOPINSTAL_NEEDS_REVIEW`, alias `GMAIL_LABEL_NEEDS_REVIEW` |
| `TOPINSTAL_GMAIL_TIMEOUT` | optional | no | `25` | Gmail API timeout in seconds. | default `25`, alias `GMAIL_TIMEOUT` |
| `TOPINSTAL_MAIL_BACKEND_URL` | yes | no | `https://stage.example/wp-json/topinstal/v1/mail-ingress/cieplo-app` | Calculator ingress endpoint hit by the worker. | alias `BACKEND_URL` |
| `TOPINSTAL_MAIL_BACKEND_AGENT_KEY` | yes | yes | `calc-agent-key` | Calculator agent key sent by mail-ingress. | alias `BACKEND_AGENT_KEY` |
| `TOPINSTAL_MAIL_BACKEND_TIMEOUT` | optional | no | `25` | Timeout for ingress dispatch requests. | default `25`, alias `BACKEND_TIMEOUT` |
| `TOPINSTAL_MAIL_SQLITE_PATH` | yes | no | `/srv/topinstal/var/mail-ingress.sqlite` | SQLite state path for idempotency/retries. | default `topinstal-mail-ingress/var/mail-ingress.sqlite`, alias `SQLITE_PATH` |
| `TOPINSTAL_MAIL_LOCK_PATH` | optional | no | `/srv/topinstal/var/worker.lock` | Lock file path if your runner uses it. | default `topinstal-mail-ingress/var/worker.lock`, alias `LOCK_PATH` |
| `TOPINSTAL_MAIL_LOG_PATH` | optional | no | `/srv/topinstal/var/mail-ingress.log` | Structured log file path. | default `topinstal-mail-ingress/var/mail-ingress.log`, alias `LOG_PATH` |

## Calculator / WordPress Runtime (`kalk-top`)

| Name / Option | Required | Secret | Example | Purpose | Default / Notes |
| --- | --- | --- | --- | --- | --- |
| `TOPINSTAL_CALC_AGENT_API_KEY` or WP option `topinstal_calc_agent_api_key` | yes | yes | `calc-agent-key` | Auth for `POST /mail-ingress/cieplo-app` and diagnostics endpoints. | legacy alias `TOP_INSTAL_AGENT_API_KEY` still accepted in controller fallback |
| `TOPINSTAL_MAIL_INGRESS_WORKFLOW_ENABLED` or option `topinstal_mail_ingress_workflow_enabled` | optional | no | `1` | Feature flag for deterministic backend workflow. | default enabled |
| `TOPINSTAL_MAIL_INGRESS_REVIEW_RECIPIENT` or option `topinstal_mail_ingress_review_recipient` | yes | no | `review@topinstal.pl` | Internal-only mailbox for review emails. | legacy fallback `topinstal_agent_review_email` / `AGENT_REVIEW_EMAIL` |
| `TOPINSTAL_MAIL_INGRESS_REVIEW_SUBJECT_PREFIX` or option `topinstal_mail_ingress_review_subject_prefix` | optional | no | `[TOP-INSTAL][MailIngress Review]` | Prefix for internal review subjects. | default shown |
| `TOPINSTAL_MAIL_INGRESS_CIEPLO_FETCH_TIMEOUT` or option `topinstal_mail_ingress_cieplo_fetch_timeout` | optional | no | `35` | Timeout when fetching `cieplo_url`. | default `35` |
| `TOPINSTAL_MAIL_INGRESS_CIEPLO_USER_AGENT` or option `topinstal_mail_ingress_cieplo_user_agent` | optional | no | `TOPINSTAL-MailIngressWorkflow/1.0` | User-Agent sent to `cieplo.app`. | default shown |
| `TOPINSTAL_MAIL_INGRESS_GENERATOR_BASE_URL` or option `topinstal_mail_ingress_generator_base_url` | optional | no | `https://www.topinstal.com.pl/pdf` | Base URL used to build generator endpoint. | normalized and built to `/wp-json/topinstal/v1/offer-documents/generate` |
| `TOPINSTAL_MAIL_INGRESS_GENERATOR_ENDPOINT` or option `topinstal_mail_ingress_generator_endpoint` | optional | no | `https://www.topinstal.com.pl/pdf/wp-json/topinstal/v1/offer-documents/generate` | Preferred full generator endpoint override. | takes precedence over base URL and repo default |
| `TOPINSTAL_AGENT_OFFER_DOCUMENTS_ENDPOINT` or option `topinstal_agent_offer_documents_endpoint` | optional legacy | no | `https://www.topinstal.com.pl/pdf/wp-json/topinstal/v1/offer-documents/generate` | Legacy full endpoint alias still supported by kalk-top. | used when the preferred full endpoint is unset |
| `TOPINSTAL_MAIL_INGRESS_GENERATOR_KEY` or option `topinstal_mail_ingress_generator_key` | yes | yes | `generator-agent-key` | Preferred auth key used for generator REST call. | legacy fallback `TOPINSTAL_AGENT_OFFER_DOCUMENTS_KEY` |
| `TOPINSTAL_MAIL_INGRESS_GENERATOR_TIMEOUT` or option `topinstal_mail_ingress_generator_timeout` | optional | no | `120` | Timeout for generator REST call. | default `120`, clamped to `5..300` |
| `wp_mail` / SMTP runtime | yes | depends | SMTP plugin or transactional mail relay | Delivers internal review email. | code only checks runtime readiness; real delivery must be verified in staging |

Default endpoint when no override is set:
`https://www.topinstal.com.pl/pdf/wp-json/topinstal/v1/offer-documents/generate`

Recommendation:
- keep the endpoint default in repo unless a given environment needs a different generator host
- keep the generator key outside repo in `wp-config.php`, env, or WP options

## Generator Runtime (`top-instal-generator`)

| Name / Runtime | Required | Secret | Example | Purpose | Default / Notes |
| --- | --- | --- | --- | --- | --- |
| Generator REST route | yes | no | `/wp-json/topinstal/v1/offer-documents/generate` | Existing seam used by calculator workflow. | mode must support `from-offer-dto` |
| Generator auth key | yes | yes | `generator-agent-key` | Must match calculator-side generator key. | exact storage depends on generator plugin runtime |
| Converter URL / token | required if generator returns PDF through converter | yes | `https://converter.example` | PDF conversion backing service. | leave unset only if your generator runtime has another working PDF path |

## Cron / Scheduling / Operations

| Item | Required | Secret | Example | Purpose | Default / Notes |
| --- | --- | --- | --- | --- | --- |
| Mail-ingress poll schedule | yes | no | `* * * * * php /srv/topinstal/topinstal-mail-ingress/bin/poll-gmail.php` | Polls Gmail and dispatches ingress envelopes. | run `bin/preflight.php` first |
| Plugin activation | yes | no | activate calculator + generator plugins | Required for REST routes / workflow classes. | manual deploy task |
| Staging smoke env vars | yes | no | `TOPINSTAL_MAIL_LIVE_*` | Used by `npm run test:mail-ingress-live`. | see smoke doc |
