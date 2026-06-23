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
| Portal app | v4 re-theme in progress — indigo theme layer + sidebar done; component refresh (buttons/pills/KPI cards) pending |

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

### 2026-06-23 — Portal v4 re-theme (theme layer + sidebar)
- **Did:** Added the v4 "energetic" theme token layer (`src/styles/theme-v4.css` — indigo primary,
  cool canvas, solid status colors, dimensional shadows, larger radii) imported after the base
  tokens; updated the sidebar (Shell.tsx) to v4 (solid-indigo active nav + glow, indigo-tint
  hover, brand-mark glow, live dot). `::selection` → indigo.
- **Verified:** `npm run typecheck` clean; visible on the running dev server.
- **Next:** v4 component refresh — Button (indigo + glow), solid relevance/quality pills,
  dimensional KPI cards, filter tones, row hover, + the other screens.
- **Notes:** Re-themes everything token-driven; components that hardcode terracotta or tint-pills
  (Button, RelevanceBadge, QualityChip, KpiStrip) still need the refresh for the full v4 look.

### 2026-06-23 — Portal Phase 3: workspace, bell, other screens + AppV3 root
- **Did:** Ported ProposalWorkspaceV3 (two-column workspace, regenerate confirm, copy/insert),
  BellPopup (real bell + Important-actions dropdown, replacing the stub), and OtherScreens
  (Conversations, Reporting, Assets) to typed TSX via parallel agents; wrote the real `App.tsx`
  AppV3 state machine (screens, peek, workspace, bell deep-links) replacing the interim root.
- **Verified:** `npm run typecheck` clean across the whole portal. In-browser eyeball via the
  running dev server pending.
- **Next:** Backend wiring — the portal is feature-complete on mock data; `lib/mock-data.ts` is
  the seam to swap for real API calls. (Extension UI revamp also in flight.)
- **Notes:** Portal UI is now the full v3 design, mock-data driven. Faithful 1:1 ports.

### 2026-06-23 — Portal Phase 2: Shell + Job board + detail peek
- **Did:** Ported ShellV3 (Sidebar / PageHeader / NAV), JobBoardV3 (board + KPI strip + filters +
  compact rows + skeleton/empty states), and JobDetailPeek (slide-in panel) to typed TSX via
  parallel agents; wired an interim `App.tsx` root (sidebar + board + peek + theme; other screens
  are placeholders) and a `bell.tsx` BellButton stub. Static integration check clean — all `@/`
  imports resolve, no window/global residue.
- **Verified:** `npm install` + `npm run typecheck` clean (added `@types/node` for the Vite
  config); `npm run dev` serves at :3000 and the whole module graph (incl. the `@/` alias)
  transforms. In-browser visual eyeball still pending Manish.
- **Next:** Phase 3 — ProposalWorkspaceV3, BellPopup (real bell), OtherScreens (Conversations,
  Proposals, Reporting, Assets), and the full AppV3 state machine replacing the interim root.
- **Notes:** `App.tsx` is an interim Phase-2 root; the real AppV3 state machine lands in Phase 3.
  BellButton is a stub (icon + badge); BellPopup replaces it.

### 2026-06-23 — Portal Phase 1: design primitives + mock data
- **Did:** Ported the portal-v3 primitives to typed TSX (via parallel agents):
  `components/icons.tsx` (RXIcons — 32 line icons), `components/ds/{Button,TaxonomyChip,RelevanceBadge}.tsx`
  + barrel, `components/ui.tsx` atoms (Card, QualityChip, Avatar, Ownership, Mono, CopyButton,
  Eyebrow), and `lib/types.ts` + `lib/mock-data.ts` (`data.js` typed — the API seam). Styling
  kept 1:1 (CSS vars + inline).
- **Verified:** Not yet — run `cd apps/portal && npm install && npm run typecheck` (Claude has no
  node_modules, so `tsc` wasn't run). Primitives only; nothing visual yet.
- **Next:** Phase 2 — Shell + Job board + detail peek.
- **Notes:** Faithful ports; only additive type annotations. `RXIconName` is the literal union.

### 2026-06-23 — Portal scaffold (React + Vite) + design foundation
- **Did:** Scaffolded `apps/portal` as a **React + Vite + TypeScript** SPA (reversing the
  earlier Next.js plan — see D13). Brought the portal-v3 design foundation into the app:
  `tokens/{fonts,colors,typography,spacing}.css` + `globals.css` (base reset/keyframes) carried
  verbatim from the Claude Design "Reflex Design System" project; wired `data-theme` light/dark
  and a Phase-0 placeholder screen.
- **Verified:** Not yet — Manish runs `cd apps/portal && npm install && npm run dev` and eyeballs
  fonts + tokens + the light/dark toggle. Nothing committed; staged for review.
- **Next:** Phase 1 — port primitives (icons, ui atoms, shared DS components Button /
  TaxonomyChip / RelevanceBadge) and `data.js` → typed `lib/mock-data.ts`.
- **Notes:** Styling locked to CSS variables + inline styles (faithful 1:1 port); routing is
  in-memory screen state first, real routes later. Neon CLI authenticated (org Growwstacks,
  project `Reflex` / divine-unit-90472716); DB stays out of the portal — the frontend holds no
  secret, only the API talks to Neon.

### (stack) — Portal framework switched to React + Vite
- **Did:** recorded D13; updated CLAUDE.md, ARCHITECTURE.md, RUNBOOK.md, README.md to React/Vite.
- **Next:** scaffold apps/portal as a Vite + React + TypeScript SPA.
- **Notes:** extension unaffected (MV3). Server logic stays in the API + Worker.

### (seed) — Project bootstrapped
- **Did:** Created the scaffold — `CLAUDE.md`, the `docs/` tree (ARCHITECTURE, SCHEMA,
  DECISIONS, PROGRESS, RUNBOOK), README, and the five subagents in `.claude/agents/`.
  Schema baseline written. Design prompts for portal + extension handed to Claude Design.
- **Verified:** Schema parses clean (14 tables, 4 functions, 8 indexes).
- **Next:** Apply the baseline migration to Neon and seed taxonomy.
- **Notes:** Nothing applied to any environment yet. All decisions to date are in DECISIONS.md.
