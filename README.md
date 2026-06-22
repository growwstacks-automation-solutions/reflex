# Reflex

A productivity layer on top of Upwork for a small sales team. Reflex helps reps see a job,
know instantly whether it's worth pursuing, and act in one click — generating a proposal or
replying to a client — without the slow copy-paste work they do today.

It has two surfaces:
- **Web portal** — the team's home base: a shared job board, client conversations, proposals,
  reporting, and a shared asset library.
- **Chrome extension** — an overlay on Upwork itself: check whether a job is already tracked,
  generate proposals inline, and get one-click suggested replies on message threads.

The reps are not technical, so the product hides all its machinery (classification, retrieval,
shift-based assignment, token accounting) behind simple, single-action screens.

---

## How it's built (one line)

A React/Vite portal and a Manifest V3 extension talk to a TypeScript API backed by Neon Postgres
(with `pgvector` for retrieval). A Cloudflare Worker handles Upwork ingestion, message sync,
and AI generation; Cloudflare R2 stores asset files. Everything Upwork-facing that the
extension does is reactive and human-confirmed; all automated polling is server-side through
Upwork's official APIs.

---

## Working in this repo

This project is built with **Claude Code**, and its memory and conventions live in markdown so
any session — even after the conversation is cleared — can pick up where the last one left off.

**Read these in order before contributing or directing Claude Code:**
1. `CLAUDE.md` — standing rules and the session bootstrap (loaded automatically by Claude Code).
2. `docs/ARCHITECTURE.md` — the system shape and layer boundaries.
3. `docs/SCHEMA.md` — tables, columns, enums, functions.
4. `docs/DECISIONS.md` — locked decisions (don't relitigate these).
5. `docs/PROGRESS.md` — current state and what's next.
6. `docs/RUNBOOK.md` — how to run, build, test, deploy.

The source of truth is these files, not chat history. If they ever conflict, the files win.

---

## Quickstart (once apps exist)

See `docs/RUNBOOK.md` for the exact commands. In short: install per-app, run the API and
portal dev servers, run the Worker with `wrangler dev`, and load the extension unpacked.
Migrations are applied by the project owner with database credentials kept out of all tooling.

---

## Status

See `docs/PROGRESS.md` for the live status board and session log.
