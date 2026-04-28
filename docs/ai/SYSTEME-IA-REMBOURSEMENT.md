# Système IA Remboursement — OneShot API (gemini-2.5 flash)

## Overview

- **Où intégrer** : `src/app/api/refund-ai/route.ts` avec `src/lib/oneshot.ts`
- **Pourquoi** : conserver le workflow remboursement existant (admin refuse → IA prend le relais) en remplaçant le provider OpenAI
- **Contrainte** : polling obligatoire (`POST /v1/jobs` puis `GET /v1/jobs/:id`)

Le endpoint public de l’app reste inchangé : `POST /api/refund-ai`.

## Auth

Base API : `https://api.oneshotapi.com`

Header requis :

```http
x-api-key: YOUR_API_KEY
```

Variable serveur :

```bash
ONESHOT_API_KEY=YOUR_API_KEY
```

## Create

### Endpoint

`POST https://api.oneshotapi.com/v1/jobs`

### cURL

```bash
curl -X POST "https://api.oneshotapi.com/v1/jobs" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "model": "gemini-2.5",
    "messages": [
      { "role": "system", "content": "Tu es un assistant expert comptable." },
      { "role": "user", "content": "Analyse ce document." },
      { "role": "user", "content": "Donne-moi un resume + les actions prioritaires." }
    ],
    "temperature": 0.7,
    "max_tokens": 2048,
    "options": {
      "modelVariant": "flash",
      "referenceFileIds": ["uuid-1", "uuid-2"]
    }
  }'
```

### JSON request

```json
{
  "model": "gemini-2.5",
  "messages": [
    {
      "role": "system",
      "content": "Tu es un assistant expert comptable."
    },
    {
      "role": "user",
      "content": "Analyse ce document."
    },
    {
      "role": "user",
      "content": "Donne-moi un resume + les actions prioritaires."
    }
  ],
  "temperature": 0.7,
  "max_tokens": 2048,
  "options": {
    "modelVariant": "flash",
    "referenceFileIds": ["uuid-1", "uuid-2"]
  }
}
```

### JSON create response

```json
{
  "id": "a7bc6f76-1fb9-4cd8-9a23-ff7f2e4f2d8d",
  "status": "pending",
  "model": "gemini-2.5",
  "createdAt": "2026-04-08T10:40:00.000Z",
  "credits": {
    "charged": 1,
    "balance": 42,
    "pricing": null
  }
}
```

## Status

### Endpoint

`GET https://api.oneshotapi.com/v1/jobs/:id`

### cURL

```bash
curl -X GET "https://api.oneshotapi.com/v1/jobs/a7bc6f76-1fb9-4cd8-9a23-ff7f2e4f2d8d" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY"
```

### JSON completed response

```json
{
  "id": "a7bc6f76-1fb9-4cd8-9a23-ff7f2e4f2d8d",
  "status": "completed",
  "model": "gemini-2.5",
  "result": {
    "textResponse": "1) Definir ICP...",
    "modelVariant": "flash",
    "modelName": "gemini-2.5-flash",
    "usageMetadata": {
      "promptTokenCount": 120,
      "candidatesTokenCount": 340,
      "totalTokenCount": 460
    }
  },
  "error": null
}
```

## Upload Flow

Si des fichiers de référence sont utilisés :

1. `POST /v1/uploads/sign` avec `filename`, `contentType`, `sizeBytes`
2. Upload binaire direct vers `uploadUrl` (method `PUT`) avec `requiredHeaders`
3. `POST /v1/uploads/complete` avec `fileId`
4. Utiliser le `fileId` dans `options.referenceFileIds`

## Errors

- `400 validation_error`
- `401 missing_auth`
- `402 insufficient_credits`
- `403 invalid_api_key|forbidden`
- `404 job_not_found|file_not_found`
- `409 file_expired|file_not_ready`
- `422 unsupported_model|dynamic_pricing_rule_not_found|validation_error|invalid_content_type|invalid_size`
- `429 queue_full|rate_limited`
- `500 internal`

## Usage Flow

1. Créer le job via `POST /v1/jobs`.
2. Récupérer `id`.
3. Poller `GET /v1/jobs/:id` toutes les 2-5 secondes.
4. Sur `completed`, lire `result.textResponse`.
5. Sur `failed`, afficher `error.code` + `error.message`.

Dans l’app SaaS Money :

- Admin refuse une conversation → `ai_handled=true`
- Le front déclenche `POST /api/refund-ai`
- La route appelle OneShot (create + poll)
- La réponse est insérée dans `refund_messages`
