# Legacy Compatibility Verification

Source: real runtime tests from `gmail-agent/test-results/runtime_audit_results.json`.

## 1. `get_kits` (legacy AJAX)

Request:

```http
POST /wp-admin/admin-ajax.php
Content-Type: application/x-www-form-urlencoded

action=get_kits
nonce=8065a5a0c1
power_type=1fazowe
tank_capacity=200
power_kw=9
```

Observed response:

```json
{
  "success": true,
  "data": {
    "KIT-WC09K3E5": { "name": "KIT-WC09K3E5", "price": 14700 },
    "KIT-WC09K3E8": { "name": "KIT-WC09K3E8", "price": 15500 },
    "KIT-WC09K9E8": { "name": "KIT-WC09K9E8", "price": 15500 },
    "KIT-WXC09K3E5": { "name": "T-CAP 9kW 1-fazowy", "price": 17146 },
    "KIT-WXC09K3E8": { "name": "T-CAP 9kW 3-fazowy", "price": 18971 }
  }
}
```

Final handler:

- `.runtime-wp/wordpress/wp-content/plugins/top-instal-generator/wp-adapter/ajax/KitsAjaxController.php`
- `TopInstal_Ajax_Kits_Controller::handle_get_kits`

Frontend compatibility:

- Expected: `success=true` + `data` map for kits.
- Runtime: shape is compatible with generator frontend.

Result: **PASS**

## 2. `simple_generate` (legacy AJAX)

Request:

```http
POST /wp-admin/admin-ajax.php
Content-Type: application/x-www-form-urlencoded

action=simple_generate
nonce=8065a5a0c1
data={"installation_type":"heat_pump","kit_model":"KIT-WC09K3E8","power_kw":9,"has_cwu":true,"tank_capacity":"200","tank_manufacturer":"Trinnity","has_buffer":false,"buffer_capacity":"none","custom_price":34243,"floor_area":120,"heating_type":"water","building_type":"house","custom_price_floor":15000,"output_format":"pdf"}
```

Observed response:

```json
{
  "success": true,
  "data": {
    "filename": "Oferta-PC-Panasonic_2026-03-06_19-53-56_65b3d588-66a.pdf",
    "download_url": "http://127.0.0.1:8090/wp-content/uploads/top-instal-offers/Oferta-PC-Panasonic_2026-03-06_19-53-56_65b3d588-66a.pdf",
    "traceId": "65b3d588-66a4-44db-a9ce-49a0e6ee7a50",
    "document": { "format": "pdf", "mimeType": "application/pdf" },
    "meta": { "mode": "direct-config", "converter": "gotenberg" },
    "warnings": []
  }
}
```

Final handler:

- `.runtime-wp/wordpress/wp-content/plugins/top-instal-generator/wp-adapter/ajax/GenerateOfferDocumentAjaxController.php`
- `TopInstal_Ajax_GenerateOfferDocument_Controller::handle_simple_generate`
- internally delegates to `execute_and_respond` -> `TopInstal_GenerateOfferDocument_UseCase::execute`

Frontend compatibility:

- Required fields preserved: `data.filename`, `data.download_url`.
- Additional structured fields (`traceId`, `document`, `meta`) do not break legacy contract.

Runtime PDF check:

- Download URL returned HTTP 200
- `Content-Type: application/pdf`

Result: **PASS**
