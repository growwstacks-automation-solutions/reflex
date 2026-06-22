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
  apps/portal         React/Vite portal
  apps/extension      Manifest V3 Chrome extension
  apps/api            backend API
  worker/             Cloudflare Worker (ingestion + AI)
  migrations/         NNNN_*.sql, append-only; 0000_baseline.sql is frozen
  docs/               source-of-truth docs
  .claude/agents/     subagents
```
(Adjust to the actual structure as it's built; keep this section current.)

---

## Environment

Secrets live in environment variables / `.env.local` (gitignored) and in the Worker's secret
store — **never in code, never in a prompt.** Expected variables (names only):

- API: `DATABASE_URL` (Neon), `JWT_SECRET`
- Worker: `UPWORK_API_TOKEN`, `OPENROUTER_API_KEY`, `R2_*` (account, bucket, keys), `DATABASE_URL`
- Portal/extension: only a public API base URL — no secrets.

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

---

## Run locally (fill in as apps are built)

- Portal: `cd apps/portal && npm install && npm run dev`
- API: `cd apps/api && npm install && npm run dev`
- Worker: `cd worker && npm install && npx wrangler dev`
- Extension: load `apps/extension` unpacked via `chrome://extensions` (Developer mode →
  Load unpacked). Reload from that page after edits.

---

## Test & verify

- Run the test suite before any close-out: `npm test` (per app).
- **Manish verifies builds and migrations himself, with his own eyes, live** — not on relayed
  output. Claude Code writes and stages; Manish runs and confirms; commit only after verified.

---

## Deploy (fill in when deploy targets are set)

- Portal → (Cloudflare Pages / Vercel — TBD)
- Worker → `npx wrangler deploy`
- Extension → package and upload to the Chrome Web Store as **Unlisted**.

Before any multi-instance or production deploy: confirm secrets are pinned via env/secret
store, not committed.
