# Runbook — Reflex

How to run, build, test, and deploy. Update this whenever a command or step changes. Keep it
exact — copy-pasteable commands, not prose.

> Conventions for this team: Manish runs everything from a Mac terminal (and PowerShell on
> Windows, where `curl.exe` is used because plain `curl` is aliased). Privileged commands
> (migrations, owner-credential ops) are run by Manish in his own terminal — never by Claude
> Code, never with credentials pasted into any tool.

---

## Repo layout (target)

```
/                     repo root (this CLAUDE.md, docs/, .claude/)
  apps/portal         React + Vite SPA (portal)
  apps/extension      Manifest V3 Chrome extension
  apps/api            backend API — a Cloudflare Worker (auth + board + AI generate); wrangler dev :8787
  worker/             ingestion/poller Worker (not built yet — see PROGRESS)
  migrations/         NNNN_*.sql, append-only; 0000_baseline.sql is frozen
  docs/               source-of-truth docs
  .claude/agents/     subagents
```
(Adjust to the actual structure as it's built; keep this section current.)

---

## Environment

Secrets live in gitignored local files and in the Worker's secret store — **never in code,
never in a prompt.** Where they live + variable names:

- **API Worker** (`apps/api`): local values go in `apps/api/.dev.vars` (gitignored);
  `apps/api/.dev.vars.example` is the committed placeholder template. Variables:
  `DATABASE_URL` (Neon), `JWT_SECRET` (any long random string), `ANTHROPIC_API_KEY` (for `/generate`).
  Production: `npx wrangler secret put <NAME>`. Secrets load at wrangler **startup** — restart dev after editing `.dev.vars`.
- **Ingestion Worker** (future): `UPWORK_API_TOKEN`, `OPENROUTER_API_KEY`, `R2_*`, `DATABASE_URL`.
- **Portal** (`apps/portal`): `VITE_API_BASE_URL` only (non-secret; defaults to `http://localhost:8787`
  in code, so a local `.env` is optional). `.env.example` documents it. No secret ever reaches the browser.

---

## Database

- Apply a migration (Manish only, owner creds):
  ```bash
  export PGPASSWORD='...'           # owner password, in Manish's terminal only
  psql "$DATABASE_URL" -f migrations/0000_baseline.sql
  unset PGPASSWORD
  ```
- Add a change: create a **new** `migrations/NNNN_description.sql`. Never edit the baseline.
- After any schema change, update `docs/SCHEMA.md` in the same commit.
- **Applied so far:** `0000_baseline.sql` (14 tables), `0001_expand_jobs.sql` (jobs → 53 columns +
  `quality`), `0002_backfill.sql` (570 Airtable jobs / 570 assignments / 429 proposals). The DB is live.

---

## First-time setup (new machine)

1. Clone, then install deps in both apps: `cd apps/api && npm install`, and `cd apps/portal && npm install`.
2. Create the API secrets file from the template: `cp apps/api/.dev.vars.example apps/api/.dev.vars`,
   then fill in the real `DATABASE_URL` / `JWT_SECRET` / `ANTHROPIC_API_KEY` — **get these from Manish;
   they are never committed or pasted into chat.**
3. Enable the commit secret-guard (git hooks aren't cloned): `git config core.hooksPath .githooks`.
   It blocks any commit whose staged diff contains an Anthropic key, Neon password, or Neon host.
4. Start both servers (see "Run locally") and smoke-test the login → board loop.

---

## Run locally (fill in as apps are built)

Run the two servers in separate terminals:

- **API Worker:** `cd apps/api && npm install && npm run dev` → wrangler dev on **:8787**
  (needs `apps/api/.dev.vars`; see Environment). Up-check:
  `curl -s -o /dev/null -w "%{http_code}\n" localhost:8787/board` → **401** (auth enforced) = healthy.
- **Portal:** `cd apps/portal && npm install && npm run dev` → Vite on **:3000**
  (`npm run build` runs `tsc --noEmit && vite build`, emits static `dist/`).
- **Extension:** load `apps/extension` unpacked via `chrome://extensions` (Developer mode →
  Load unpacked). Reload from that page after edits.

Smoke-test the live loop: open http://localhost:3000 → log in as a rep → the board shows that
rep's real jobs from Neon; click a row → detail panel shows description + client snapshot +
"Open on Upwork". (Rep credentials come from Manish — never pasted into chat.)

---

## Test & verify

- Run the test suite before any close-out: `npm test` (per app).
- **Manish verifies builds and migrations himself, with his own eyes, live** — not on relayed
  output. Claude Code writes and stages; Manish runs and confirms; commit only after verified.

---

## Deploy (fill in when deploy targets are set)

- Portal → Cloudflare Pages (or Workers static assets). `npm run build` emits static files; no adapter needed.
- Worker → `npx wrangler deploy`
- Extension → package and upload to the Chrome Web Store as **Unlisted**.

Before any multi-instance or production deploy: confirm secrets are pinned via env/secret
store, not committed.
