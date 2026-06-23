# Progress — Reflex

The living log of what's built, what's in flight, and what's next. **Update this every work
session, in the same commit as the work.** When context is cleared, this is the first place
to look to see where things stand. Newest entry at the top.

---

## Status at a glance

| Area | State |
|---|---|
| Design system (Claude Design) | In progress — foundation set, portal + extension prompts handed off |
| Extension | DOM integration wired (top-of-card strip, cover/screening/composer fills) + REFLEX_DUMMY actions + v4 indigo theme; detail-page capture + kit-reskin pending |
| Database schema | **Live on Neon** — baseline applied; seeded 4 users + migrated 570 jobs / 570 assignments / 429 proposals from Airtable |
| Backend API | **`POST /auth/login` + `GET /board`** live & smoke-tested (JWT via jose, bcrypt via bcryptjs, Path-B board query incl. `quality`) |
| Cloudflare Worker — AI plane (`POST /generate`) | **Verified live in stub mode** (₹0.34 / ~1.5k tok per gen, Haiku 4.5); real mode + cache discount pending |
| Cloudflare Worker — ingestion (poller + classifier) | Not started |
| Auth + RLS | Not started |
| Portal app | **Live board wired** — login (JWT in localStorage) + `GET /board` render the rep's real jobs via an adapter; v4 indigo throughout. Detail-panel fields + claim/submit pending |

---

## Next up (in order)

1. ~~Apply `0000_baseline.sql` to Neon~~ ✅ done. Still pending: seed the four taxonomy
   tables (`tools`/`use_cases`/`departments`/`industries`) — currently empty; the migrated
   jobs have NULL taxonomy FKs until the classifier (or a backfill) assigns them.
2. ~~Backend auth (JWT) + board read~~ ✅ done **and the portal is wired to it** (login + live
   board). Remaining on this surface: detail-panel fields on `/board`, then claim (`claim_job`)
   + mark-submitted.
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

### 2026-06-23 — Portal wired to the live API (login + real board)
- **Did:** The portal now runs on real data. New `lib/api.ts` (`login` + `fetchBoard`, base from
  `VITE_API_BASE_URL`, default :8787; typed `UnauthorizedError`), `lib/auth.tsx` (small React
  Context + `localStorage` `reflex_token`/`reflex_user`), `lib/adapt-job.ts` (maps `/board`
  snake_case → the `Job` shape; budget built from the structured columns, `actionState` from
  `proposal_status`, honest `—`/empty for fields `/board` doesn't return — never faked).
  `LoginScreen.tsx` (v4 indigo, Enter-to-submit, inline 401 error). `App.tsx` gates on the token
  (login vs shell) and fetches the board on auth with loading/error+retry/empty states; a 401
  auto-signs-out. `JobBoard` takes real `jobs` (KPI strip derived from them); `Shell` sidebar
  shows the logged-in user + sign-out (was hardcoded "Neha"). Added the 4th **`watch`** quality
  pill (`ui.tsx`/`types.ts`) — 103 jobs use it. `vite-env.d.ts` for `import.meta.env`.
- **Verified:** `npm run typecheck` + `npm run build` green. Browser gate **passed** (Manish):
  Neha logs in → her **146** real jobs; KPIs match SQL; **Watch** pill renders; budgets build from
  the structured columns; wrong password → inline error; refresh persists; sign-out → login;
  Sachin → **245** (per-rep filtering proven). No mock data on the board.
- **Next:** detail-panel fields on `/board` (Option A — description, url, client_*); then
  claim/submit endpoints + RLS.
- **Notes:** Frontend holds only the JWT (localStorage; first-party only). Taxonomy chips +
  client spend/hire/payment left as honest empties — `/board` doesn't return them yet (Option A
  follow-up adds the client fields). `proposal_status` row badges key off `Submitted`/`In Contact`.

### 2026-06-23 — API: auth + board slice (`POST /auth/login`, `GET /board`)
- **Did:** Two endpoints on `apps/api`. **`POST /auth/login`** verifies the bcrypt hash (`bcryptjs`),
  gates on `active`, issues a 7-day HS256 JWT (`jose`) `{sub,email,role}`; **indistinguishable 401**
  for unknown-email vs wrong-password, **403** for disabled, 400 for malformed. **`GET /board`**
  verifies the Bearer JWT and runs a **parameterized Path-B query** (`jobs ⋈ job_assignments` on the
  rep's `user_id`, live assignments only) returning the rich card columns **incl. `quality`**, ordered
  `posted_at desc`. New shared `http.ts` (CORS+json), `auth.ts`, `board.ts`; `index.ts` routing
  extended; `Env`/CORS/`.dev.vars.example` gained `JWT_SECRET`.
- **Verified:** `tsc` clean; deps `jose` + `bcryptjs` added. Full smoke suite **T1–T9 green** — login
  returns a 7d token with **no hash**; wrong-pw and unknown-email both 401 (byte-identical);
  malformed→400; inactive→403 (toggled + reset to active). Board: **245 jobs for Sachin**, every row
  has `quality`, ordered desc, and **board count == direct SQL (245)**; no/garbage token→401.
- **Next:** wire the portal (login screen + swap `mock-data.ts` → `fetch /board` with the token);
  then claim/submit endpoints; RLS hardening.
- **Notes:** Path B chosen over `board_for_user()` — that function is stale (lacks the post-0001
  columns), returns the whole board not the rep's, and widening it would be a schema change. RLS
  still off (future hardening). `JWT_SECRET` lives in env only; secrets load at wrangler startup.

### 2026-06-23 — DB live: baseline applied + users seeded + Airtable jobs migrated
- **Did:** Applied `0000_baseline.sql` to Neon (14 tables, 5 enums, 4 functions — Manish ran
  `psql -f` with owner creds). Seeded **4 users** (Manish admin + Neha/Sachin/Sarthak reps;
  passwords bcrypt-hashed in-DB via pgcrypto `crypt()`/`gen_salt('bf',10)`). Migrated the
  Airtable Upwork-jobs export (two CSVs, **570 rows**) via a `staging_jobs` table + ordered
  `INSERT…SELECT` fan-out: **570 jobs** (verdict ← Relevance with `needs_review`→`review`,
  Quality folded into `reason` as a `[…]` prefix, `budget_text` composed from fixed/hourly,
  `posted_at` parsed from `DD/MM/YYYY HH12:MIam`), **570 job_assignments** (owner ← `Picked by`),
  **429 proposals** (Submitted + In Contact rows; `submitted_at` ← Proposal Date Time,
  `token_cost_inr` ← Token Cost INR). Staging dropped after load.
- **Verified:** Counts match source exactly (verdict 442/66/62; assignments Sachin 245 /
  Sarthak 179 / Neha 146). Smoke-tested through the real `board_for_user()` → 508 board rows
  (62 irrelevant filtered), 418 actioned, 0 available. All 570 have a reason; 451 have a budget.
- **Next:** Backend auth + `GET /board` so the portal consumes this live data; seed the 4 taxonomy
  tables; flip Worker `REFLEX_GENERATION_STUB="false"` to read real jobs.
- **Notes:** No `quality` column in schema → Quality preserved as a `reason` prefix; recommend a
  later `0001_add_job_quality.sql` to split it into its own column. Dates stored as UTC from the
  naive `DD/MM/YYYY` strings (no source tz). 🔑 The Neon password used is still the exposed one —
  rotate now that real data is in.

### 2026-06-23 — API: proposal generation Worker (`POST /generate`)
- **Did:** Scaffolded `apps/api/` as a Cloudflare Worker. `POST /generate` builds the prompt from
  the editable `reflex-proposal-prompt.template.txt` (split at `[DYNAMIC BLOCK]`: cached
  instructions + portfolio index → cached `system`; per-job `{{slots}}` → `user`), calls Claude
  **Haiku 4.5** via `@anthropic-ai/sdk` with `cache_control` on the cached block, parses the JSON
  proposal defensively, computes **₹ cost** from the token-usage breakdown, and returns
  `{cover_letter, screening_answers, portfolio_recommendations, client_name_used, cost_inr, tokens, usage}`.
  **Stub mode** (`REFLEX_GENERATION_STUB="true"`) uses a hardcoded job (no DB); **real mode**
  reads Neon via `@neondatabase/serverless` by `upwork_job_id`/`id`. Key held server-side only
  (`.dev.vars` local / `wrangler secret put` prod). CORS enabled for the extension. Renamed a
  stray `apps/api/dev.vars` → `.dev.vars` (the un-dotted name was **not** gitignored — key-leak risk).
- **Verified:** Not run by Claude (no node_modules; needs the Anthropic key). Manish runs
  `npm install && npm run typecheck && npm run dev` and the curl smoke test in `apps/api/README.md`.
- **Next:** flip `REFLEX_GENERATION_STUB="false"` after `0000_baseline.sql` is applied; wire the
  real 74-item portfolio index (then caching actually discounts); point the extension at the
  endpoint (flip `REFLEX_DUMMY=false`).
- **Notes:** Screening questions / client-name hint aren't in the schema — they come from the
  request body (the extension captures them on the page). Reactive-only: generation never submits.


> Template for each entry — copy this block to the top when you finish a session:
>
> ### YYYY-MM-DD — <short title>
> - **Did:** what changed (files, features).
> - **Verified:** how it was checked (Manish runs builds/migrations himself).
> - **Next:** the immediate next step.
> - **Notes:** anything the next session needs to know.

### 2026-06-23 — Extension: DOM integration, dummy mode, v4 indigo
- **Did:** Wired the content script to the real Upwork anchors (`docs/UPWORK-ANCHORS.md`):
  top-of-card Reflex strip (debounced, idempotent, survives SPA pagination), cover-letter +
  screening fills (native setter), Tiptap composer (editor-aware). Added `REFLEX_DUMMY` mode +
  `dummyData` so the flow is live pre-backend: search Generate → opens the job **detail** page,
  Add to Reflex flips state, proposal page **"Generate & prefill everything"** sets profile
  (freelancer) + rate ($30) + rate-increase (Never) + cover + all screening + image attach, plus
  a portfolio-picks list. Applied Manish's **verified** proposal selectors (`#step-rate`, custom
  rate-increase dropdown, file input). Re-themed the whole extension to **v4 indigo**.
- **Verified:** `node --check` clean. NOT live-tested on Upwork by Claude — Manish reloads the
  unpacked extension and tests on real pages.
- **Next:** detail-page Reflex strip + job/client capture + AI client-name suggestion (spec
  sections 2–4, dummy); reconcile panel/launcher to the `ui_kits/extension` kit; replace the
  ImageKit placeholder URLs; move the verified selectors into `UPWORK-ANCHORS.md`.
- **Notes:** Reactive-only — no auto-submit, no crawling. Generated prose marked "[SAMPLE …]".

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
