# CLAUDE.md — Reflex

> This file is loaded into **every** Claude Code session automatically. It is the
> project's memory. When the conversation is cleared or compacted, you rebuild your
> understanding from this file and the docs it points to — never from chat history.
> Read this top to bottom at the start of any session before acting.

---

## What Reflex is

Reflex is a productivity layer on top of Upwork for a small, non-technical sales team
(Neha, Sarthak, Sachin as reps; Manish as founder/admin). It has two surfaces:

- **Web portal** — the team's home base (job board, conversations, proposals, reporting, assets).
- **Chrome extension** — an overlay on Upwork itself (check jobs, generate proposals, suggested replies).

Behind them: a backend API, a Neon Postgres database, a Cloudflare Worker for ingestion and
AI, and Cloudflare R2 for asset files. The goal of the product is speed and confidence for
reps who are **not technical** — every screen resolves to one obvious action; all machinery
(classification, retrieval, token math, shift-based assignment) is hidden.

---

## Start-of-session checklist (do this first, every time)

1. Read this file fully.
2. Read `docs/ARCHITECTURE.md` for the system shape and the layer boundaries.
3. Read `docs/PROGRESS.md` to see what's done and what's in flight.
4. Read `docs/DECISIONS.md` for locked decisions you must not relitigate.
5. Only then start work. If anything in chat conflicts with these files, **the files win** —
   they are the source of truth; chat is ephemeral.

---

## The doc tree (where truth lives)

| File | Purpose | When you update it |
|---|---|---|
| `CLAUDE.md` (this) | Standing rules + session bootstrap | Rarely — only when a rule changes |
| `docs/ARCHITECTURE.md` | System design, layers, data flow | When the shape of the system changes |
| `docs/SCHEMA.md` | Tables, columns, enums, functions (mirrors the SQL) | When a migration changes the DB |
| `docs/DECISIONS.md` | Locked decisions + the reasoning (ADR-style) | When a real decision is made |
| `docs/PROGRESS.md` | What's built, what's next, known debt | **Every work session, in the same commit** |
| `docs/RUNBOOK.md` | How to run, build, test, deploy locally | When a command or step changes |
| `README.md` | Human-facing overview + quickstart | When onboarding facts change |

---

## Golden rules (non-negotiable — carried from how this team works)

### Security
- **Never put production credentials in code or in any prompt.** No DB passwords, no
  service-role keys, no JWT secrets, no API keys. Manish runs privileged commands in his
  own terminal (`export PGPASSWORD=…` then `unset`). You write and stage; he applies.
- **The front end never holds a secret.** Extension/portal call the API; the API holds the
  JWT; the Worker holds the Upwork + model keys. No key ever reaches the browser.
- An exposed/printed key is **compromised** — say so and have it rotated; don't reuse it.

### Database
- **Never assume schema by convention.** Before any `UPDATE`, status literal, or column
  reference, read the real column list and enum from `docs/SCHEMA.md` (and the migration).
  Example: a proposal's action is `submitted_at`, not an `updated_at`; verdict is the
  `job_verdict` enum; taxonomy status is `taxonomy_status`.
- Migrations are **append-only files**. The baseline is frozen; every change is a new
  `NNNN_description.sql`. Manish applies them with owner credentials, never you.

### Layer boundaries (do not cross them)
- **Postgres** does set-based, race-safe data logic only (claim, release, board). It makes
  **no** network calls.
- **Cloudflare Worker** does everything with a network or model call: Upwork polling, message
  sync, classification, proposal/reply generation, embeddings. **Never** put these in Postgres
  or in the extension.
- **API** ties them together, holds the JWT, enforces RLS via a per-request `app.user_id`.
- The extension is **reactive only** — it reads what's on the rep's screen and acts on a click.
  It never auto-refreshes tabs, never harvests on a timer, never auto-submits. Autonomous work
  is server-side through official APIs. This split protects the reps' Upwork accounts.

### Workflow
- **Verify before stacking.** Make one change, confirm it works, then move on. Don't pile
  unverified work.
- **Every close-out commit includes a `docs/PROGRESS.md` update** in the same commit.
- You write and stage; **Manish reviews every diff and runs builds/migrations himself.** No
  commits, deploys, or applied migrations without his explicit action.
- Match the existing patterns in the repo. Don't introduce a new style where one exists.

---

## Tech stack (fixed)

- **Portal:** Next.js (App Router, TypeScript)
- **Extension:** Manifest V3, vanilla JS (no build step)
- **API:** TypeScript backend (route handlers / serverless)
- **DB:** Neon Postgres 17 + `pgvector` (same DB — no separate vector store)
- **Ingestion/AI:** Cloudflare Worker on cron; OpenRouter (Haiku 4.5 / DeepSeek for classify
  + generation); embeddings via a cheap model
- **Storage:** Cloudflare R2 (asset files; only URLs stored in Postgres)
- **Messaging/data:** Upwork official APIs (job search + Messages); never scraping

---

## Subagents available (in `.claude/agents/`)

Delegate to keep this main session focused. They return summaries, not raw file dumps.

- **explorer** — read-only; map the codebase, find call sites, answer "where is X". Use before big changes.
- **schema-guard** — verify any DB change against `docs/SCHEMA.md` + the migrations before it's written.
- **implementer** — write code following repo patterns; scoped to edit/write/bash.
- **reviewer** — read-only; review a diff for security, layer-boundary violations, and the golden rules.
- **doc-keeper** — keep `docs/PROGRESS.md` and the other docs in sync after work lands.

When in doubt about the current state, ask `explorer` to read the docs and report, rather
than guessing.

---

## If you are resuming with no context

Someone cleared the conversation. That's expected and fine. Do this:
1. Read this file, then `docs/PROGRESS.md`, then `docs/ARCHITECTURE.md`.
2. Look at the last few entries in `docs/PROGRESS.md` — that's where work left off.
3. Confirm the next step with Manish before writing code.
You do not need the old conversation. Everything you need is in these files.
