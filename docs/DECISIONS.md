# Decisions — Reflex

Locked decisions and the reasoning behind them. **Do not relitigate these** unless Manish
explicitly reopens one. Add a new entry whenever a real decision is made; never delete the
history. Newest at the bottom.

Format: what was decided · why · date.

---

### D1 — Name: Reflex
The system is named **Reflex**. Acting on a job before it goes cold is a reflex. Used as the
brand mark, the launcher, and every "In Reflex ✓" badge. · Locked.

### D2 — Database: Neon (+ R2 for assets)
Auth is plain email/password (no OTP), and asset files go to Cloudflare R2 — so Supabase's
bundled Auth/Storage no longer adds value. Neon's paid tier is cheaper ($19 vs $25) with
gentler auto-wake pausing that suits a small private tool. `pgvector` runs in the same Neon DB.
The team already runs R2 + Cloudflare on WorkWitness. · Locked.

### D3 — Auth: email + password + active flag (no OAuth, no OTP)
Private internal tool, few users. The `users.active` flag is the lock-out: an admin flips it,
the next request's `active` check fails, the person is locked out of portal and extension. No
OTP, no session juggling. · Locked.

### D4 — Extension distribution: Unlisted Chrome Web Store
Not public/searchable; install via direct link; one review then auto-updates. Avoids the
developer-mode nag of unpacked, without exposing it publicly. · Locked.

### D5 — Extension is fill-not-submit, reactive only
The extension fills Upwork fields; the **rep reviews and clicks Submit** themselves. It does
not auto-submit, does not auto-refresh tabs on a timer, does not harvest listings autonomously.
Reason: autonomous browser actions risk suspension of the reps' revenue-generating Upwork
accounts. Autonomous work goes server-side via official APIs instead. · Locked.

### D6 — Source of truth: Postgres, not Airtable
The team works inside the portal; jobs live in Postgres with round-robin shift assignment and
per-user views. Airtable ingestion is retired. · Locked.

### D7 — No LangGraph; one thread per job
Proposal/reply generation is a direct API call with retrieved context, not an agent graph.
Each job has one conversation thread (keyed by `job_id` + Upwork `room_id`/`message_id`) so
the cover letter and all screening answers share context. · Locked.

### D8 — Vector store: pgvector in the same DB
Retrieval is `pgvector` in Neon — no separate Pinecone/Weaviate. Retrieve the top 2–3 matches
per generation, never the whole proposal library, to keep prompts small. · Locked.

### D9 — Classifier: cheap model, constrained to existing taxonomy
Haiku 4.5 or DeepSeek, four-level (tool · use case · department · industry). The current
taxonomy lists are injected into the prompt so the model reuses existing labels and only
proposes a new one (status `pending`) when nothing matches. Prevents duplicate labels. · Locked.

### D10 — Ingestion lag fixed at the Worker, not scraped around
The job-lag bug is a polling-window problem in the ingestion layer. Fix it with a dedicated
Cloudflare Worker on a tight cron (retry/backoff), not by browser scraping. Postgres makes no
HTTP calls; n8n is an optional alternative host for the poller. · Locked.

### D11 — Assignment & action are separate facts
Ownership lives in `job_assignments` (history, with `released_at`). The action lives in
`proposals.submitted_at`. The 2-hour release triggers on lack of **action**, not assignment.
The release threshold is configurable (default 2h). · Locked.

### D12 — Design language: warm accent on a fast dashboard frame
Linear-like bones (dense, scannable) with a single terracotta accent (#D85A30) and warm-tinted
neutrals; Plus Jakarta Sans + JetBrains Mono (for IDs/connects/₹), Fraunces only on
login/empty states. Four-level taxonomy chips have a locked color mapping (tool=purple,
use case=teal, department=blue, industry=amber). Built for non-technical reps: one action per
view. · Locked.

### D13 — Portal framework: React + Vite (SPA), not Next.js
The portal is a dashboard that talks to a separate API and a Cloudflare Worker — all server
logic lives there, not in the portal. So Next.js's SSR, server components, and API routes are
unused weight here, while its Cloudflare adapter (@opennextjs/cloudflare / next-on-pages) adds
deploy complexity and version caveats. A Vite-built React SPA deploys to Cloudflare Pages (or
Workers static assets) as plain static files with no adapter. Cleaner for this architecture.
The extension is unaffected (MV3 vanilla JS). · Locked — supersedes the earlier Next.js choice.

---

*Open questions (not yet decided) — track here, move up when settled:*
- Embedding model + dimension (schema currently assumes 1536 / OpenAI small).
- Cron home for the release function (pg_cron in Neon vs Worker calling an endpoint).
- Whether classifier-proposed `pending` labels auto-promote or need admin confirmation.
