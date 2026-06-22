# Architecture — Reflex

The authoritative description of how Reflex is built. If chat or memory conflicts with this, this wins.

---

## The five planes

```
Upwork surface        search pages · proposal form · Messages API (official)
        │
Ingestion plane       Cloudflare Worker (cron): job poller · message sync · embed-on-win
        │
Core backend          API (JWT, RLS) + Neon Postgres (+ pgvector). R2 holds asset files.
        │
AI plane              classifier · proposal writer (RAG) · conversation analyzer  (cheap models)
        │
Presentation plane    Web portal (cockpit) · Chrome extension (Upwork overlay)
```

Each plane is independent — you can change one without touching the others. The API is the
only component that talks to both the database and the Worker, and it is the only place the
JWT lives.

---

## Layer responsibilities (the boundaries Claude Code must respect)

**Postgres (Neon)** — set-based, race-safe data logic only. Owns: `claim_job`,
`auto_assign_on_shift`, `release_stale_assignments`, `board_for_user`. Makes **no** network
calls. Holds `pgvector` for retrieval (no separate vector DB).

**Cloudflare Worker** — everything with a network or model call:
- Job poller: polls the Upwork job-search API on a tight cron, inserts jobs idempotently
  (this is where the current job-lag bug is fixed — a clean polling window with retry/backoff),
  then classifies and auto-assigns.
- Message sync: polls the Upwork Messages API every 5–10 min, upserts `thread_messages`
  idempotently on `message_id`. Sanctioned API, no scraping risk.
- AI generation: classification, proposal/reply/summary (RAG), embeddings.

**API / backend** — request/response layer the portal and extension call. Holds the JWT,
re-checks `users.active` on every request (the lock-out), enforces RLS via a per-request
`app.user_id` claim, and exposes reads (board, job detail, conversations, reporting) and
writes (claim, save/regenerate proposal, mark submitted, attach assets, log connects).

**Presentation** — portal (React + Vite) and extension (MV3). Neither holds a secret; both call
the API with a token obtained at login.

---

## Core data flows

**Job ingestion → board**
Worker polls Upwork → inserts `jobs` (idempotent on `upwork_job_id`) → classifier sets
`verdict`/`reason` + the four taxonomy FKs (picking existing labels, proposing new ones as
`pending`) → `auto_assign_on_shift` assigns to whoever is on shift → the job appears on the
rep's board via `board_for_user`.

**Assignment & release (the core mechanic)**
Ownership lives in `job_assignments` as history (a live row has `released_at IS NULL`). The
*action* — a submitted proposal — lives in `proposals.submitted_at`. `release_stale_assignments`
frees any job owned >2h with **no submitted proposal**: release keys off lack of *action*,
not assignment. Released jobs reappear in "Available". A partial unique index guarantees at
most one live owner per job, so "Assign to me" is race-safe.

**Proposal generation (token-budgeted RAG)**
Rep clicks generate → Worker embeds the job → similarity search over `embeddings` returns the
top 2–3 past winners → only those + the job description go to the model → returns draft +
token cost in ₹. Same path for suggested replies (job + proposal + thread) and summaries.

**Conversation sync → suggested reply**
Worker replicates Upwork messages into `thread_messages` (one thread per job). The suggested-reply
feature reads the job + the proposal sent + the whole thread, all sharing context.

---

## The two safety lines (define the whole risk model)

1. The **extension is reactive and human-present only** — reads what's on the rep's screen,
   acts on a click. No timer-based tab refresh, no harvesting, no auto-submit. Every
   Upwork-facing write has a human in the loop.
2. All **autonomous, on-a-timer work is server-side through official APIs** — the job poller
   and message sync run in the Worker against Upwork's APIs, never through a logged-in browser.

Autonomous work is sanctioned; browser work is human-driven. That split is what protects the
reps' Upwork accounts.

---

## Why these choices (pointers; full reasoning in DECISIONS.md)

- **Neon over Supabase** — auth is plain email/password (no OTP needed), assets go to R2; the
  reasons to bundle Supabase Auth/Storage evaporated, and Neon's paid tier is cheaper with
  gentler pausing.
- **pgvector, not a separate vector store** — retrieval lives in the same DB; no extra service.
- **Worker cron, not Postgres, for polling** — Postgres has no business making HTTP calls;
  the lag bug is a polling problem and belongs in a Worker. n8n is an optional alternative host.
- **No LangGraph** — direct API calls; one thread per job is enough.
- **React + Vite SPA, not Next.js** — all server logic lives in the API and Worker, so Next.js's
  SSR/server components/API routes are unused weight and its Cloudflare adapter is avoided; a
  Vite SPA deploys to Cloudflare as static files. See D13.
