# Reflex API — generation Worker

Cloudflare Worker that turns a job into a proposal. One route: **`POST /generate`**.

It loads the job (from Neon, or a built-in stub), builds the prompt from
`src/reflex-proposal-prompt.template.txt` (stable block cached, per-job block filled),
calls Claude Haiku 4.5, parses the JSON, computes the ₹ cost, and returns it. The extension
and portal call this; it holds the Anthropic key + Neon connection (the browser never does).

## Run locally

```bash
cd apps/api
npm install
cp .dev.vars.example .dev.vars      # then put your real ANTHROPIC_API_KEY in .dev.vars
npm run typecheck
npm run dev                          # wrangler dev → http://localhost:8787
```

Test it (a POST — a browser GET to `/` correctly 404s):

```bash
curl -sX POST http://localhost:8787/generate \
  -H 'content-type: application/json' \
  -d '{"job_id":"STUB-0001","screening_questions":["Have you built lead-nurture automations in GHL?"]}'
```

Expect JSON: `cover_letter`, `screening_answers`, up to 4 `portfolio_recommendations`,
`client_name_used`, a non-zero `cost_inr`, and `usage`.

## Modes & secrets

- `REFLEX_GENERATION_STUB` (wrangler.toml) = `"true"` uses the stub job (no DB). Flip to
  `"false"` once `0000_baseline.sql` + `0001_job_fields.sql` are applied to Neon.
- Secrets live in `.dev.vars` locally (gitignored) and `wrangler secret put` in production —
  never in code, never committed.

## Notes

- Schema-faithful: `src/job.ts` reads the real columns from migrations 0000 + 0001 and
  resolves the four taxonomy FKs to names.
- Prompt caching is wired (`cache_control` on the system block) but won't discount until the
  real ~74-item portfolio index makes the cached prefix large enough for Haiku.
- Pricing rates in `src/pricing.ts` are marked TODO(verify) — confirm before trusting ₹ in prod.
