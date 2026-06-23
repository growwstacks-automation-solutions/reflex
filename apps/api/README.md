# Reflex API — proposal generation (Cloudflare Worker)

The AI plane. `POST /generate` turns one Upwork job into a ready-to-edit proposal via Claude
(Haiku 4.5) with prompt caching, and returns the rupee cost. The Anthropic key lives **only**
here — the extension and portal never see it.

## Endpoint

`POST /generate`

```jsonc
// request
{
  "job_id": "string",                  // required — Upwork job id (idempotency key) or internal uuid
  "screening_questions": ["..."],      // optional — captured from the job page (not stored in the DB)
  "client_name_hint": "Jacob",         // optional — AI-suggested first name; used only if present, never invented
  "budget": "...", "type": "...", "experience": "...", "duration": "...",
  "skills": "...", "client_context": "..."   // optional page-captured overrides
}
```

```jsonc
// response
{
  "cover_letter": "string",
  "screening_answers": [{ "question": "...", "answer": "..." }],
  "portfolio_recommendations": [{ "title": "...", "page": 1, "position": 1, "why": "..." }],
  "client_name_used": "string | null",
  "cost_inr": 0.42,
  "tokens": 1234,
  "usage": { "input_tokens": 0, "output_tokens": 0, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0 },
  "model": "claude-haiku-4-5",
  "stub": true
}
```

## Modes

- **Stub** (`REFLEX_GENERATION_STUB="true"`, default): ignores the DB, uses a hardcoded sample
  job. Proves the Claude call + prompt + cost math before Neon exists.
- **Real** (`"false"`): looks the job up in Neon by `upwork_job_id` / `id`. Needs `DATABASE_URL`.

## The prompt

`src/reflex-proposal-prompt.template.txt` is the editable prompt — change wording there, no code
changes. The code splits it at the `[DYNAMIC BLOCK]` marker: the cached block (instructions +
portfolio index) is sent first with `cache_control`, the per-job block fills the `{{slots}}` and
is sent after the breakpoint. Caching only discounts once the cached block exceeds ~4096 tokens
on Haiku 4.5 (i.e. once the real 74-item portfolio index replaces the sample) — until then the
cost is correct, just with no cache savings.

## Secrets

Never in `wrangler.toml`. Local: `.dev.vars` (gitignored — copy from `.dev.vars.example`).
Prod: `wrangler secret put ANTHROPIC_API_KEY` and `wrangler secret put DATABASE_URL`.

## Run / test / deploy

```bash
cd apps/api
npm install
npm run typecheck
npm run dev                 # http://localhost:8787

# smoke test (stub mode — needs a real key in .dev.vars)
curl -sX POST http://localhost:8787/generate \
  -H 'content-type: application/json' \
  -d '{"job_id":"STUB-0001"}' | jq

npm run deploy              # after `wrangler secret put ...`
```

## Cost

`USD_TO_INR` ([vars] in `wrangler.toml`) × the token-usage breakdown × per-MTok rates in
`src/pricing.ts` (Haiku 4.5: $1 in / $5 out; cache write 1.25×, cache read 0.1×). Cached
generations visibly cost less — the `usage` block shows the fresh-vs-cached split.
