# REST Auth and Agent Key Verification

Runtime source:

- `gmail-agent/test-results/runtime_audit_results.json`
- Local URL: `http://127.0.0.1:8091/wp-json/topinstal/v1/offer-documents/generate`

## 1. Auth matrix for generator endpoint

| Scenario         | Request auth                                | Expected                | Actual                  | Result |
| ---------------- | ------------------------------------------- | ----------------------- | ----------------------- | ------ |
| No auth          | none                                        | `401 AUTH_REQUIRED`     | `401 AUTH_REQUIRED`     | PASS   |
| Bad key          | `X-Top-Instal-Agent-Key: bad-key`           | `403 AGENT_KEY_INVALID` | `403 AGENT_KEY_INVALID` | PASS   |
| Nonce            | `X-Topinstal-Nonce: <valid>`                | `200 success`           | `200 success`           | PASS   |
| Good key         | `X-Top-Instal-Agent-Key: doc-agent-key-xyz` | `200 success`           | `200 success`           | PASS   |
| Validation error | good key + invalid payload                  | `400 VALIDATION_ERROR`  | `400 VALIDATION_ERROR`  | PASS   |

Observed payload contract on errors:

```json
{
  "traceId": "doc-auth-matrix-1",
  "errorCode": "AUTH_REQUIRED|AGENT_KEY_INVALID|VALIDATION_ERROR",
  "message": "...",
  "details": { "errors": [] }
}
```

## 2. `top_instal_agent_api_key` read and usage

Exact option key:

- `top_instal_agent_api_key`

Exact read path:

- `.runtime-wp/wordpress/wp-content/plugins/top-instal-generator/wp-adapter/services/GeneratorConfigWp.php`
- `TopInstal_Generator_Config_Wp::get_agent_api_key()`
- delegates to `get_string('top_instal_agent_api_key', 'TOP_INSTAL_AGENT_API_KEY', '')`
- precedence in `get_string`: `constant -> env -> get_option -> default`

Exact validation path:

- `.runtime-wp/wordpress/wp-content/plugins/top-instal-generator/wp-adapter/rest/GenerateOfferDocumentController.php`
- `TopInstal_GenerateOfferDocument_Controller::verify_auth()`
- compares header `X-Top-Instal-Agent-Key` with config value (`hash_equals`)

Runtime proof:

- option-only read test returned `option-key-1`
- env-only read test returned `env-key-1`
- HTTP auth accepted configured key and rejected wrong key

Result: **PASS**

## 3. `calculate-offer` auth sanity matrix

Endpoint:

- `POST /wp-json/topinstal/v1/calculate-offer`

Observed:

- no auth -> `401 AUTH_REQUIRED` (PASS)
- bad key -> `403 AGENT_KEY_INVALID` (PASS)
- good key (`calc-agent-key-xyz`) -> `200 OfferDTO` (PASS)
