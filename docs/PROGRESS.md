# Progress — Reflex

The living log of what's built, what's in flight, and what's next. **Update this every work
session, in the same commit as the work.** When context is cleared, this is the first place
to look to see where things stand. Newest entry at the top.

---

## Session log

### 2026-06-25 — Align portal with the asset matcher (loom format) after colleague's `/generate` change
- **Context:** a colleague added `matchAssets()` (`apps/api/src/matchAssets.ts`) — a single-job port
  of the n8n "Match Resources" node, called first in `POST /generate`. It scores `loom_videos` +
  `knowledge_base` against the job and **upserts** the top picks onto `jobs.looms` / `jobs.image_links`
  (idempotent — skips a job already matched). They also added `/jobs/add` + `/jobs/classify`
  (extension-facing; not part of the portal proposal flow).
- **Cross-check / gap found:** the matcher stores **looms as `"Title — https://loom.com/…"`** (em-dash
  + URL), not a bare URL — but our portal Work Samples row assumed a bare URL. So `linkLabel()` ran
  `new URL("Title — …")`, threw, and showed a garbled last-path-segment as the loom title, with the
  whole `"Title — url"` string in the URL line. `image_links` are bare URLs (already fine).
- **Did (frontend):** added `parseLoom()` to split `"Title — URL"` into a clean title + URL (tolerates
  a bare URL or a title-only string); the loom row now shows the real title and the URL separately, and
  toggles by the raw stored string (so attach/insert still round-trips). `assembleProposal` keeps the
  full `"Title — URL"` line in the exported text (correct there).
- **Did (API):** hardened `job.ts` `toLinks` to also parse a Postgres `"{a,b}"` array-literal string
  (parity with the matcher's `toArrayText`), so looms/images survive whatever shape the driver returns.
- **Verified:** portal `tsc` + `vite build` green; API `tsc` green.
- **Next:** unchanged from below — apply `0004`, eyeball a real generate (now exercises the matcher),
  confirm `loom_videos` + `knowledge_base` are populated so matches actually return picks.

### 2026-06-25 — Proposal workspace runs on real AI (`/generate`) + per-job work samples
- **What:** "Generate proposal" in the portal now calls the live `POST /generate` Worker (Claude
  Haiku) instead of showing the static `RX_DATA.proposal`/`assets` demo. The cover letter, screening
  answers, and ₹ cost are all real; the Work Samples picker reads each job's own loom/image links.
- **Did (DB, migration `0004_job_work_samples.sql`):** two new array columns on `jobs` —
  **`looms text[]`** (Loom URLs) and **`image_links text[]`** (image/screenshot URLs), matching the
  existing `skills text[]` convention. Mirrored in SCHEMA.md. **Manish to apply `0004` formally.**
- **Did (API):** `job.ts` `fetchJob` now also selects `looms, image_links`, coerces them to clean
  string arrays, and carries them on `JobInput` (NOT sent to the model — UI metadata). `index.ts`
  `/generate` returns `looms` + `image_links` alongside the proposal. No prompt change.
- **Did (frontend):** `api.ts` `generateProposal(token, jobId, opts)` → `GenerateResult`
  (cover_letter, screening_answers, portfolio_recommendations, looms, image_links, cost_inr, …).
  `ProposalWorkspace.tsx` rewired: the `generating` status now fires the real fetch (replacing the
  fake 1.5s timer); results seed the editable cover/screening fields; new **`error`** status with a
  retry; `WorkSamples` renders the job's DB looms/image_links (toggle-to-attach) instead of demo
  assets; the aggregate ₹ cost shows in the proposal header; a 401 signs the rep out. `Copy all` /
  `.txt` / `PDF` / `Mark as submitted` all operate on the real generated text.
- **Verified:** portal `tsc` + `vite build` green; API `tsc` + `wrangler dry-run` green (live cfg is
  `REFLEX_GENERATION_STUB="false"`, model `claude-haiku-4-5-20251001`, so real mode is already on).
  **Not yet live-eyeballed in the browser** — needs the Worker running with `ANTHROPIC_API_KEY` +
  `DATABASE_URL`, and `0004` applied so `looms`/`image_links` exist (until applied, the SELECT errors).
- **Next:** apply `0004`; eyeball a real generate in the browser; persist the draft/attachments to
  `proposals`/`proposal_assets` + wire mark-submitted to the DB (currently still local state). Pass
  screening questions through when the extension captures them (the API already accepts them).
- **Notes:** Reactive-only unchanged — generation never submits. Stub mode (`STUB_JOB`) has no
  looms/image_links, so the picker is simply hidden there. `RX_DATA.proposal`/`assets` are still used
  by the Assets screen; only the workspace stopped depending on them.

### 2026-06-25 — Admin reassignment: assign any job to any rep (inline picker)
- **What:** admins can now (re)assign a job to any rep from the job board, and the denormalized
  `jobs.picked_by_name` updates with it (the column the admin watches go from "Neha" → "Sarthak").
- **Did (DB, migration `0003_assign_job.sql`):** new `assign_job(p_job_id, p_target_user_id)` —
  validates the target is an `active` rep, releases any live owner (`release_reason='reassigned'`),
  inserts a fresh live assignment, and mirrors the new owner's **first name** into
  `jobs.picked_by_name` (matches the existing data form — `picked_by_name` is "Sarthak", not the
  full_name "Sarthak Punasia"). Whole body is atomic, so the partial unique index never sees two
  live rows. Mirrored in SCHEMA.md. claim_job (Assign to me) is unchanged.
- **Did (API):** `assign.ts` — `GET /reps` (active reps, **admin-only 403 otherwise**) and
  `POST /jobs/assign` `{upwork_job_id, user_id}` (admin-only) → resolves the internal job id, calls
  `assign_job`, returns the new `owner_name`. Routed in `index.ts`.
- **Did (frontend):** `api.ts` `fetchReps` + `assignJobToRep`; `App.tsx` detects admin
  (`auth.user.role`), fetches the rep list once, and an `onAssignToRep` handler persists + updates the
  row in place; `JobBoard.tsx` — for admins on non-actioned jobs, the row action cell shows a
  **rep `<select>`** (current owner preselected, "Reassign…"/"Assign to…") instead of "Assign to me".
  Reps keep their single "Assign to me" button (admin-only feature). Decided: portal dropdown is the
  single entry point; the reverse direction (editing the column → trigger) was rejected as fragile.
- **Verified:** portal `tsc`+`build`, API `tsc`+`wrangler dry-run` all green. **Live function test on
  Neon** (then state RESTORED): a job owned by Neha (`picked_by_name`="Neha") → `assign_job(…,Sarthak)`
  → live owner Sarthak, **`picked_by_name`="Sarthak"**, 1 release reason 'reassigned'; restored to
  Neha after. `GET /reps` live returns 401 unauth (admin gate wired). assign_job is in the DB via the
  test's CREATE OR REPLACE — **Manish should still apply `0003` formally** so it's tracked.
- **Next:** rep "Assign to me" still only mutates local state (no `claim_job` call yet) — wire that +
  mark-submitted. Optionally reflect a reassign by refetching the page so a reassigned-away job leaves
  a rep's filtered view.
- **Notes:** Admin assign is offered only for `not-actioned` jobs (submitted/conversation keep their
  status display). The picker matches the current owner by name; if `picked_by_name` ever diverges
  from a rep first-name it just won't preselect — assignment still works.

### 2026-06-25 — Fix: admin board "Failed to fetch" (parameter-binding bug in paged query)
- **Problem:** after pagination landed, **admin** (Shubham/Manish) got "Couldn't load the board —
  Failed to fetch". Root cause: the count + stats queries were given `[user.sub]` as a param, but on
  the admin "all" tab their SQL has **no `$N` placeholder** (empty WHERE) → Postgres rejected it
  ("bind message supplies 1 parameters, but prepared statement requires 0"), the Worker threw, and
  the browser surfaced it as a network "Failed to fetch".
- **Did (`apps/api/src/board.ts`):** bind the user id **lazily** — `userP()` pushes `user.sub` and
  returns its `$N` only when a clause actually references it; `selectCols` became a fn taking that
  placeholder. Now each query (count / rows / stats) is handed **exactly** the params its text uses;
  admin/all binds zero params for count+stats and one (`$1`, for `is_mine`) for the rows query.
- **Verified:** API `tsc` + `wrangler dry-run` green. Simulated the Worker's exact logic on live Neon
  across all role/tab/filter combos — **ADMIN/all = 1297**, admin/all+relevant = 734 (KPI on_board
  still 1297), rep/all = 726, rep/available = 85, rep/mine+good = 0 — **no bind errors**.
- **Next:** unchanged (claim + mark-submitted). **Restart `wrangler dev`** to pick up the fix.

### 2026-06-25 — Server-side board pagination (filter/sort/page in Postgres) + exact timestamps
- **Problem:** the board loaded the rep's whole dataset (864 rows) / admin's 1288 in one fetch and
  did all tab/relevance/quality filtering + sorting in the browser — slow at 1000+ rows.
- **Did (backend `apps/api/src/board.ts`):** rewrote `GET /board` to page/filter/sort **in Postgres**.
  Query params: `tab` (mine/available/all), `page`, `page_size` (default 50, max 100), `relevance`
  (all/relevant/review), repeated `quality`, `search` (title+description ILIKE), `sort`
  (posted/created/budget/connects) + `dir`. Built with `sql.query(text, params)` (parameterized,
  not template) so WHERE/ORDER compose dynamically while every value stays bound (`$1`…); ORDER only
  ever emits a whitelisted column expression. Returns `{ jobs, total, page, page_size, stats }` —
  **`stats`** is a scope-wide (role/tab, not page) KPI aggregate (on_board/relevant/review/submitted)
  so the KPI strip stays correct without fetching all rows. Role scope unchanged (rep = own+available,
  admin = all); irrelevant still included.
- **Did (frontend):** `api.ts` `fetchBoard(token, query)` → `BoardPage` (jobs/total/page/pageSize/stats);
  `JobBoard.tsx` is now **controlled** — `BoardControls` (tab/relevance/quality/sort/dir/page) lifted to
  `App.tsx`, which refetches the page on any control change (changing a filter/sort/tab resets to page 1;
  paging keeps the rest). Added a compact **Pager** ("from–to of total", windowed page numbers, prev/next).
  KPI strip + table count now read server `stats`/`total`. Dropped the dead client-side filter/sort code
  and the non-functional Category pills (taxonomy FKs are null in the data). Also switched Posted/Created
  columns to **exact date + time** (`exactDateTime` in `adapt-job.ts`, e.g. "25 Jun 2026, 6:56 PM") per
  request — widened both cols to 132px, allow wrap.
- **Verified:** portal `tsc` + `vite build` green; API `tsc` + `wrangler dry-run` green. **Live Neon
  check** of the exact dynamic queries: rep page1 = 50 rows of total 864 (stats 408/106/133 — matches the
  UI KPIs); mine+relevant+good = 37; admin = 1288; search "hubspot" = 177. `is_mine` comes back NULL for
  non-owned rows (NULL = $1) — the adapter treats that as falsy, so ownership resolves correctly.
- **Next:** claim (`claim_job`) + mark-submitted endpoints. If paging feels slow under load, consider a
  composite index on `jobs(verdict, posted_at desc)`; the existing `jobs_posted_idx` covers the default sort.
- **Notes:** Page size 50 (PAGE_SIZE in App.tsx + DEFAULT_PAGE_SIZE in board.ts). Local "Assign to me"
  still only mutates page state (no DB write yet). Search param is wired end-to-end on the API but the
  filter bar has no search input yet — add one when needed.

### 2026-06-25 — Board scope fix (rep own+available / admin all) + Posted vs Created columns
- **Problem:** `GET /board` `INNER JOIN`ed `job_assignments` on the requester, so it returned
  **only the rep's own live assignments** — Neha saw **146** of **1282** jobs, the "All"/"Available"
  tabs filtered that same 146 (ownership was hardcoded `"mine"` in the adapter, so they were no-ops),
  and **admins saw nothing** (Manish/Shubham have 0 live assignments).
- **Did (backend `apps/api/src/board.ts`):** Rewrote the query to `LEFT JOIN` the single live
  assignment (`released_at IS NULL`) + `users` for the owner name, and scope by role:
  **rep → `a.user_id = me OR a.user_id IS NULL`** (own + unowned/available, *not* other reps'
  in-progress jobs); **admin → no filter** (all jobs). Irrelevant jobs are now **included** (the
  "All" tab shows them dimmed). Added `created_at` to the SELECT and per-row `is_mine` /
  `is_available` / `owner_name`. Still fully parameterized (user id bound).
- **Did (frontend):** `api.ts` typed the new fields; `adapt-job.ts` computes real `ownership`
  (`mine`/`available`/`other`) + `owner` (avatar for admin viewing another rep's job) and adds
  `createdAgo`/`createdAt`; `types.ts` gained `createdAgo` + raw `postedAt`/`createdAt` (for sorting);
  `JobBoard.tsx` added a **Created** column (sortable) beside **Posted** ("Posted" = Upwork
  `posted_at`, "Created" = our DB `created_at`), shared `GRID` template across header/row/skeleton,
  honest timestamp-based sort for both; `mobile.css` hides the new col on mobile; mock-data given
  `createdAgo`.
- **Verified:** portal `tsc` + `vite build` green; API `tsc` + `wrangler deploy --dry-run` green.
  **Read-only Neon check** confirms the fix: total **1282** jobs (730 relevant / 402 irrelevant /
  66 review / 82 null / 2 legacy `needs_review`); live assignments — Sachin 245, Sarthak 179,
  Neha 146, both admins 0; **712 available**. New queries return **Neha 858 (146 mine + 712
  available)** and **admin 1282** — matches expectations.
- **Next:** claim (`claim_job`) + mark-submitted endpoints (the "Assign to me" button still only
  mutates local state). Consider backfilling the 82 NULL + 2 `needs_review` verdicts to the enum.
- **Notes:** No DB/schema change. Scope decided with Manish: reps see own+available only (not other
  reps' jobs); admins see everything; irrelevant shown (dimmed) on "All". `user.role` already rides
  the JWT, so no auth change needed.

---

## Handover — start here (2026-06-24)

Picking this up fresh? Read `CLAUDE.md` → this file → `docs/RUNBOOK.md` ("First-time setup").
Current state: the **portal runs on live data** — login (JWT) + `GET /board` render each rep's
real jobs, and the detail panel shows description / client snapshot / a real "Open on Upwork"
link. The API Worker (`apps/api`) serves `/auth/login` + `/board` + `/generate` on **:8787**
(wrangler dev); the portal is Vite on **:3000**; the Neon DB is live (570 jobs migrated).

- **Immediate next:** claim (`claim_job`) + mark-submitted endpoints — see "Next up" below.
- **Not yet eyeballed:** the Option A detail-panel browser gate (typecheck + build are green, but
  no one has visually confirmed the panel renders the new fields live). Worth a 1-minute check.
- **Local-only (not in git):** `apps/api/.dev.vars` (secrets — from Manish) and the commit
  secret-guard (`git config core.hooksPath .githooks`). Both covered in RUNBOOK first-time setup.

---

## Status at a glance

| Area | State |
|---|---|
| Design system (Claude Design) | In progress — foundation set, portal + extension prompts handed off |
| Extension | Phase 0+1 done — anchors doc, full indigo theme (popup too), detail-page strip + job/client capture + AI client-name suggestion (dummy). Backend wiring (Phases 2–5) pending the API |
| Database schema | Written (`0000_baseline.sql` + `0001_job_fields.sql`) — **not yet applied** |
| Backend API | Generation Worker rebuilt (`apps/api`, `POST /generate`, stub mode, typechecks + dry-run builds clean). Auth/board/claim not started |
| Cloudflare Worker (ingestion + AI) | Not started |
| Extension | DOM integration wired (top-of-card strip, cover/screening/composer fills) + REFLEX_DUMMY actions + v4 indigo theme; detail-page capture + kit-reskin pending |
| Database schema | **Live on Neon** — baseline applied; seeded 4 users + migrated 570 jobs / 570 assignments / 429 proposals from Airtable |
| Backend API | **`POST /auth/login` + `GET /board`** live & smoke-tested (JWT via jose, bcrypt via bcryptjs, Path-B board query incl. `quality` + detail-panel fields: description, url, client intel) |
| Cloudflare Worker — AI plane (`POST /generate`) | **Verified live in stub mode** (₹0.34 / ~1.5k tok per gen, Haiku 4.5); real mode + cache discount pending |
| Cloudflare Worker — ingestion (poller + classifier) | Not started |
| Auth + RLS | Not started |
| Portal app | **Live board + detail panel wired** — login (JWT in localStorage) + `GET /board` render the rep's real jobs via an adapter; detail peek shows description, real Upwork link, client snapshot. claim/submit pending |

---

## Next up (in order)

1. ~~Apply `0000_baseline.sql` to Neon~~ ✅ done. Still pending: seed the four taxonomy
   tables (`tools`/`use_cases`/`departments`/`industries`) — currently empty; the migrated
   jobs have NULL taxonomy FKs until the classifier (or a backfill) assigns them.
2. ~~Backend auth (JWT) + board read + portal wiring + detail-panel fields~~ ✅ done. Remaining on
   this surface: claim (`claim_job`) + mark-submitted endpoints, then RLS hardening.
3. Cloudflare Worker: job poller + classifier (fixes the lag, fills the board).
4. Proposal generation (RAG) + mark-submitted + the release cron.
5. Message sync + conversations + suggested reply.
6. Reporting aggregates, then embed-on-win.

---

## Known debt / open items

- RLS policies described in `docs/SCHEMA.md` but not yet written (needs auth wired first).
- Embedding dimension hard-coded to 1536; revisit when the embedder is chosen.
- Cron home for `release_stale_assignments` not yet chosen (pg_cron vs Worker).
- Extension image-attach uses placeholder ImageKit URLs (marked TODO) + needs a host
  permission for the asset host before real attach works.
- Extension detail-page sub-selectors (client spend/rating/hire-rate) are best-effort
  text-pattern reads, marked TODO(verify) — confirm on the live site when wiring Phase 4.

---

## Session log

### 2026-06-24 — Detail-panel fields on /board (Option A)
- **Did:** Enriched the slide-in JobDetailPeek with real data. Extended the `GET /board` SELECT
  (`board.ts`) with 8 columns — `description, url, client_spend, client_city, client_timezone,
  client_billing_type, client_payment_verified, last_client_activity` — join/filter/order
  unchanged, still parameterized. Typed them on `ApiBoardJob` (`api.ts`); added `url?` to `Job`
  (`types.ts`); the adapter (`adapt-job.ts`) maps description→desc, url→`Job.url`, client_spend→
  spend, city+country→location, client_payment_verified→"Verified"/"Unverified". "Open on Upwork"
  (`JobDetailPeek.tsx`) opens the real `url` in a new tab (`noopener`), disabled when null.
- **Verified:** API Worker `tsc` + portal `tsc`/`vite build` all green; column names checked
  against the migrations. Browser gate (panel eyeball) **not yet confirmed** — committed/pushed
  ahead of it at Manish's call; the live SELECT first runs on board load.
- **Next:** claim (`claim_job`) + mark-submitted endpoints; then RLS.
- **Notes:** No DB change. Taxonomy chips + client **hire-rate** stay honest empties — no source
  columns (`total_hired` is a count, not a rate); the taxonomy FKs are null in the migrated data.

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

### 2026-06-23 — Extension safety hardening (account-protection audit)
- **Did:** Audited every Upwork-facing line in the files changed this session. Findings: the
  only **automatic** activity on an Upwork page is reading the DOM + one `fetch` to the Reflex
  API (**localhost**, not upwork.com). No `setInterval`/polling, no automated requests to
  Upwork, no auto-submit/refresh. The image `fetch` (ImageKit) and `window.open`/`.click()`
  fills run **only on an explicit human click** (the prefill/Generate buttons). Hardened:
  added a **kill-switch** (`REFLEX_ENABLED` — `false` disables ALL injection instantly) + a
  written SAFETY CONTRACT at the top of content.js; **removed the Google-Fonts webfont fetch**
  (was the only automatic 3rd-party request on Upwork pages — now uses the system font stack).
- **Verified:** `node --check` clean; re-grep confirms auto-network = localhost only, no
  setInterval, no upwork.com requests.
- **Context:** two **newly-created** Upwork accounts were blocked; an established account
  (other member) is unaffected. The extension makes zero requests Upwork can observe during
  browsing, so it has no mechanism to cause a block — the pattern points to Upwork's
  new-account / multi-account detection, not the code.
- **Next:** keep testing on established accounts only; never create fresh accounts to test.

### 2026-06-23 — Live DB = source of truth; CHECK_JOBS wired (DB → card strips)
- **Did:** Adopted the **live Neon schema** as source of truth (the real `jobs` table is
  ~60 cols, Airtable/n8n-derived). Retired migration `0001` (the real table already has
  `reason` + `quality` text). Fixed the Worker to the real columns (`reason`, `quality`,
  `skills`, `client_payment_verified`, `experience_level`). Resynced SCHEMA.md to the real
  `jobs` table + recorded the normalized-vs-denormalized rule (claim via `job_assignments`,
  mirror to `jobs.picked_by_name`). **Built `POST /jobs/check`** (`src/check.ts`): looks up
  jobs by `upwork_job_id` (== the tile's `data-test-key`), returns per-card status
  (inReflex/verdict/quality/chips/owner/actioned). **Wired the extension:** `background.js`
  proxies `CHECK_JOBS` to the Worker; `content.js` injects strips in a "checking…" state then
  batches all visible tile ids into one call and updates each strip with real DB data
  (`REFLEX_LIVE` flag, independent of `REFLEX_DUMMY`). Added localhost host_permissions.
- **Verified:** Worker `npm run typecheck` exit 0; extension `node --check` + manifest JSON ok.
  NOT run live — needs `DATABASE_URL` in `apps/api/.dev.vars` + the Worker running (Manish).
- **Next:** run the test loop (Worker up → reload extension → real strips on Upwork). Then
  auth (so ownership shows "mine"), then ADD_JOB/GENERATE_PROPOSAL wiring.
- **Notes:** ownership shows "Assigned · <picked_by_name>" / "Available" until auth tells us
  who the rep is. `quality` is mapped defensively (good/high→good, med→medium, poor/low→poor).

### 2026-06-23 — Rebuilt the generation Worker (apps/api) + migration 0001
- **Did:** Recreated `apps/api` (Cloudflare Worker) on this checkout — it existed only on the
  Mac, uncommitted, so `git pull` couldn't bring it. `POST /generate`: loads the job (stub or
  Neon), builds the prompt from `src/reflex-proposal-prompt.template.txt` (cached system block
  + per-job user block), calls Haiku 4.5 via the Messages API with `cache_control`, parses JSON
  defensively, computes ₹ cost from the token split. Schema-faithful — `src/job.ts` reads the
  real 0000+0001 columns and joins the 4 taxonomy FKs to names. Anthropic-direct (plain fetch),
  Neon via `@neondatabase/serverless`. Added migration `0001_job_fields.sql`
  (`reason_for_selection` text + `job_quality` enum + filter index) and mirrored it in SCHEMA.md.
- **Verified:** `npm install` + `npm run typecheck` clean; `wrangler deploy --dry-run` builds
  the bundle (226 KiB) clean. NOT run live — needs a real `ANTHROPIC_API_KEY` in `.dev.vars`
  (Manish). `.dev.vars`/`node_modules` confirmed gitignored.
- **Next:** Apply `0000` + `0001` to Neon. Put the key in `.dev.vars`, run the stub `curl`,
  read the cover letter, tune the template. Then auth/board/claim, then flip stub → Neon.
- **Notes:** Pricing rates in `src/pricing.ts` are TODO(verify). Caching won't discount until
  the real ~74-item portfolio index makes the cached prefix large enough for Haiku.

### 2026-06-23 — Extension Phase 0 + 1 (housekeeping + detail page)
- **Did:** **Phase 0** — created `docs/UPWORK-ANCHORS.md` (all 5 page anchors + the 4 verified
  proposal-page selectors + fill-method notes, single source of truth); finished the indigo
  re-theme (`popup.css` was still terracotta → indigo; killed two stray terracotta refs +
  dead tokens in `content.css`; README "terracotta" → "indigo"); marked the placeholder
  ImageKit URLs with a TODO. **Phase 1** — detail-page work in `content.js`: inject a Reflex
  strip into `[data-ev-sublocation='jobdetails']` (panel + full page), capture the job +
  client snapshot on detail-open (spend/rating/hire-rate/location/payment-verified, best-effort
  text reads), and an AI client-name suggestion from on-page reviews that the rep **confirms**
  (never auto-inserted). All reactive, all dummy-simulated; new `.rfx-detail` CSS in the v4 tokens.
- **Verified:** `node --check` clean on content/background/popup JS; no `terra`/hex terracotta
  left in styles. NOT live-tested on Upwork by Claude — Manish reloads the unpacked extension.
- **Next:** Phase 2 (real auth → JWT) and Phase 3 (`getJobData` → `CHECK_JOBS`) — both blocked
  on the backend API. Until then the DOM layer is complete and testable on real Upwork.
- **Notes:** Reactive-only — no auto-submit, no portfolio popup-driving, no timer harvest.

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
