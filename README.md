# Slug, Title, and Keyword Cleanup API

A highly secure Cloudflare Worker API for text manipulation, keyword clustering, entity extraction, and web metadata fetching. This project implements strict rate limits, SSRF guards, IDempotency checks, and validation using TypeScript, Hono, and Zod.

## Features

- **Text API**: Slugification, Normalize Titles, Fuzzy Keyword Clustering, Basic Entity Extraction (Emails, Phrases)
- **Metadata API**: Securely fetch web metadata parsing Open Graph, schema.org JSON-LD, Favicons, and canonical tags, utilizing HTMLRewriter.
- **Security Baseline**:
  - Token bucket rate limiting (Free, Pro, Agency) per-IP and per-API key via KV.
  - Strict SSRF guards preventing private IPs (`10.x`, `192.168.x`, `localhost`) and restricting protocols to `http/https`.
  - Content size limit (e.g. 128KB on Text API).
  - Auth scopes (`metadata:read`, `text:write`).

## Requirements

- Node.js 18+
- Wrangler CLI

## Setup Local Dev

1. Install dependencies

```bash
npm install
```

2. Run locally using wrangler dev

```bash
npm run dev
```

## Running Tests, Linting, and Typechecking

```bash
npm run test
npm run lint
npm run typecheck
```

## Deployment

Deploying the worker to Cloudflare requires an active account.

```bash
npm run deploy
```

> **Note on KV Namespaces:** You must bind a KV namespace in `wrangler.jsonc` named `KV` to handle API Key storing and Rate limiting state.

## Sample Request

**Extract Slug:**

```bash
curl -X POST http://localhost:8787/v1/text/slug \
  -H "Authorization: Bearer <your-key>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-unique-key" \
  -d '{"text": "A Hello World Example!"}'
```

**Cluster Keywords:**

```bash
curl -X POST http://localhost:8787/v1/text/cluster-keywords \
  -H "Authorization: Bearer <your-key>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-unique-key-2" \
  -d '{"keywords": ["marketing", "marketng", "sales", "sale"]}'
```

**Fetch Metadata:**

```bash
curl -X GET "http://localhost:8787/v1/metadata?url=https://example.com" \
  -H "Authorization: Bearer <your-key>"
```

## Creating an API Key

Keys are stored in the KV namespace in a hash format.
`apikey:<sha256_of_key_string>` mapping to:

```json
{
  "key_id": "key_1",
  "prefix": "test",
  "plan": "free",
  "scopes": ["text:write", "metadata:read"],
  "status": "active",
  "created_at": 1690000000000
}
```
