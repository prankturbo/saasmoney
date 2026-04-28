# Intégration OneShot API (gemini-2.5 flash) — Système de remboursement

## Overview

- **Où intégrer** : `src/app/api/refund-ai/route.ts` via le module `src/lib/oneshot.ts`
- **Pourquoi** : remplacer OpenAI pour les réponses IA de remboursement sans changer le contrat API existant côté front (`POST /api/refund-ai`)
- **Contrainte** : workflow OneShot obligatoire en 2 étapes (create job puis polling status)

Le flux implémenté est : **create job → polling → lecture de `result.textResponse`**.

## Auth

Toutes les requêtes vers OneShot utilisent :

- Header : `x-api-key: YOUR_API_KEY`
- Base URL : `https://api.oneshotapi.com`

Variable serveur recommandée :

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

Si `options.referenceFileIds` est utilisé :

1. `POST /v1/uploads/sign` avec `filename`, `contentType`, `sizeBytes`
2. Upload binaire direct vers `uploadUrl` (méthode `PUT`) avec `requiredHeaders`
3. `POST /v1/uploads/complete` avec `fileId`
4. Utiliser le `fileId` dans `options.referenceFileIds`

## Errors

Codes principaux :

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

Dans ce projet, ce flux est implémenté dans `src/lib/oneshot.ts` et appelé par `src/app/api/refund-ai/route.ts`.
