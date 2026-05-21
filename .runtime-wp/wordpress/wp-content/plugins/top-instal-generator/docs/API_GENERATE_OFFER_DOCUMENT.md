# API_GENERATE_OFFER_DOCUMENT.md

## Endpoint
- Method: `POST`
- URL: `/wp-json/topinstal/v1/offer-documents/generate`
- Content-Type: `application/json`

## Auth
Dopuszczalne s¹ dwa modele auth:
1. Nonce (UI):
   - `X-Topinstal-Nonce` (preferowane)
   - lub `X-WP-Nonce`
2. Agent key:
   - `X-Top-Instal-Agent-Key`
   - wartoœæ z opcji `top_instal_agent_api_key` (lub env/constant `TOP_INSTAL_AGENT_API_KEY`).

## Request DTO

### Minimal (`direct-config`)
```json
{
  "schemaVersion": "1.0",
  "traceId": "doc-001",
  "mode": "direct-config",
  "documentType": "offer_document",
  "outputFormat": "pdf",
  "payload": {
    "installationType": "heat_pump",
    "kitModel": "KIT-WC07K3E5",
    "powerKw": 7,
    "tank": {
      "enabled": true,
      "capacity": "200",
      "manufacturer": "Trinnity"
    },
    "buffer": {
      "enabled": true,
      "capacity": "100-150"
    },
    "pricing": {
      "customPriceGross": 41000
    }
  },
  "context": {
    "source": "agent",
    "channel": "internal_api"
  }
}
```

### `from-offer-dto`
```json
{
  "schemaVersion": "1.0",
  "traceId": "doc-002",
  "mode": "from-offer-dto",
  "outputFormat": "pdf",
  "offerDto": {
    "engineering": {
      "selection": { "pumpModel": "KIT-WC07K3E5", "capacity_kW": 7 },
      "buffer": { "liters": 100, "setupType": "PARALLEL" }
    },
    "pricing": {
      "totals": { "gross": 41000 }
    }
  }
}
```

## Response DTO (success)
```json
{
  "schemaVersion": "1.0",
  "traceId": "doc-001",
  "status": "success",
  "document": {
    "format": "pdf",
    "filename": "Oferta-PC-Panasonic_2026-03-06_08-00-00_doc001.pdf",
    "downloadUrl": "https://example.com/wp-content/uploads/top-instal-offers/...pdf",
    "mimeType": "application/pdf"
  },
  "meta": {
    "generatedAt": "2026-03-06T08:00:00Z",
    "templateKey": "szablon-3f-split-cwu-bufor",
    "mode": "direct-config",
    "documentType": "offer_document",
    "converter": "gotenberg"
  },
  "warnings": []
}
```

## Error contract
```json
{
  "traceId": "doc-001",
  "errorCode": "VALIDATION_ERROR",
  "message": "Invalid OfferDocumentRequestDTO payload.",
  "details": {
    "errors": [
      {
        "field": "payload.kitModel",
        "code": "REQUIRED",
        "message": "kitModel is required for heat_pump installation."
      }
    ]
  }
}
```

## Common statuses
- `400` `VALIDATION_ERROR`
- `401` `AUTH_REQUIRED`
- `403` `AGENT_KEY_INVALID`
- `404` `KIT_NOT_FOUND`
- `429` `RATE_LIMITED`
- `500` `DOCUMENT_GENERATION_FAILED` / adapter errors

## cURL examples

### Agent key
```bash
curl -X POST "https://twoja-domena.pl/wp-json/topinstal/v1/offer-documents/generate" \
  -H "Content-Type: application/json" \
  -H "X-Top-Instal-Agent-Key: <AGENT_API_KEY>" \
  -d '{
    "schemaVersion":"1.0",
    "mode":"direct-config",
    "outputFormat":"pdf",
    "payload":{
      "installationType":"heat_pump",
      "kitModel":"KIT-WC07K3E5"
    }
  }'
```

### Nonce
```bash
curl -X POST "https://twoja-domena.pl/wp-json/topinstal/v1/offer-documents/generate" \
  -H "Content-Type: application/json" \
  -H "X-Topinstal-Nonce: <NONCE>" \
  -d '{"schemaVersion":"1.0","mode":"direct-config","payload":{"installationType":"heat_pump","kitModel":"KIT-WC07K3E5"}}'
```
