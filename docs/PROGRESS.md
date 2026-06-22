# Progress — Reflex

The living log of what's built, what's in flight, and what's next. **Update this every work
session, in the same commit as the work.** When context is cleared, this is the first place
to look to see where things stand. Newest entry at the top.

---

## Status at a glance

| Area | State |
|---|---|
| Design system (Claude Design) | In progress — foundation set, portal + extension prompts handed off |
| Extension UI scaffold | Built (mocked, loadable) — pending rename to Reflex + real wiring |
| Database schema | Written (`migrations/0000_baseline.sql`) — **not yet applied** |
| Backend API | Not started |
| Cloudflare Worker (ingestion + AI) | Not started |
| Auth + RLS | Not started |
| Portal app | Not started |

---

## Next up (in order)

1. Apply `0000_baseline.sql` to Neon (Manish, owner creds). Seed the four taxonomy tables
   from the current Airtable categories.
2. Backend: auth (email/password → JWT, active check) + board read (`board_for_user`) + claim
   (`claim_job`). This makes the portal job board come alive.
3. Cloudflare Worker: job poller + classifier (fixes the lag, fills the board).
4. Proposal generation (RAG) + mark-submitted + the release cron.
5. Message sync + conversations + suggested reply.
6. Reporting aggregates, then embed-on-win.

---

## Known debt / open items

- RLS policies described in `docs/SCHEMA.md` but not yet written (needs auth wired first).
- Embedding dimension hard-coded to 1536; revisit when the embedder is chosen.
- Extension scaffold still named "Relay"; rename to Reflex across files + icons.
- Cron home for `release_stale_assignments` not yet chosen (pg_cron vs Worker).

---

## Session log

> Template for each entry — copy this block to the top when you finish a session:
>
> ### YYYY-MM-DD — <short title>
> - **Did:** what changed (files, features).
> - **Verified:** how it was checked (Manish runs builds/migrations himself).
> - **Next:** the immediate next step.
> - **Notes:** anything the next session needs to know.

### (seed) — Project bootstrapped
- **Did:** Created the scaffold — `CLAUDE.md`, the `docs/` tree (ARCHITECTURE, SCHEMA,
  DECISIONS, PROGRESS, RUNBOOK), README, and the five subagents in `.claude/agents/`.
  Schema baseline written. Design prompts for portal + extension handed to Claude Design.
- **Verified:** Schema parses clean (14 tables, 4 functions, 8 indexes).
- **Next:** Apply the baseline migration to Neon and seed taxonomy.
- **Notes:** Nothing applied to any environment yet. All decisions to date are in DECISIONS.md.
