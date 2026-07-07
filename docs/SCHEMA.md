# Schema — Reflex

Human-readable mirror of `migrations/0000_baseline.sql`. **Before any `UPDATE`, status
literal, or column reference, check it here (and against the migration).** Never assume a
column or value by convention. Keep this file in sync whenever a migration changes the DB.

Target: Neon Postgres 17 + `pgvector`.

---

## Enums

- `taxonomy_status` — `approved` | `pending`
- `user_role` — `rep` | `admin`
- `job_verdict` — `relevant` | `review` | `irrelevant`
- `asset_kind` — `image` | `loom` | `portfolio`
- `msg_sender` — `client` | `us`

---

## Tables

**Taxonomy (4 reference tables):** `tools`, `use_cases`, `departments`, `industries`
- each: `id`, `name` (unique), `status` (`taxonomy_status`, default `approved`), `created_at`
- The classifier picks an existing `name`; only inserts a new row (status `pending`) when
  nothing matches. This is what keeps reporting clean.

**`users`** — `id`, `email` (unique), `password_hash`, `full_name`, `role` (`user_role`),
`active` (bool — **`false` is the lock-out**), `shift_start` (time), `shift_end` (time, may
wrap midnight), `last_active_at`, `created_at`.

**`jobs`** — ⚠️ The LIVE table is **richer than `0000_baseline.sql`** — it mirrors the
Airtable / n8n structure (~60 cols). **The live DB is the source of truth; `0000` is the
historical baseline.** Key columns the app uses:
- identity/content: `id`, `upwork_job_id` (unique — idempotency key), `title`, `description`,
  `url`, `skills` (text[]), `posted_at`, `created_at`, `ingested_at`, `source_modified_at`
- classification: `verdict` (`job_verdict`), `reason` (the "why this job" line),
  **`quality`** (TEXT — `good`/`medium`/`poor`, NOT an enum), `tool_id`, `use_case_id`,
  `department_id`, `industry_id` (FKs to taxonomy)
- budget/terms: `budget_text`, `connects`, `connect_cost`, `connect_spent`, `contract_type`,
  `experience_level`, `engagement_weeks`, `hourly_min/max`, `fixed_amount`/`_max`/`fixed_currency`,
  `hourly_budget_type`, `bid_min/avg/max_rate`, `has_bids`
- client: `client_country`/`_code`, `client_city`, `client_timezone`, `client_spend`,
  `client_billing_type`, `client_payment_verified` (bool), `total_hired`, `total_offered`,
  `total_invited_to_interview`, `total_unanswered_invites`, `invites_sent`, `last_client_activity`
- DENORMALIZED proposal/assignment (Airtable-style — see note): `picked_by_name`,
  `submitted_by_name`, `proposal_text`, `proposal_status`, `proposal_submitted_at`,
  `proposal_link`, `generation_status`, `cache_status`, `token_cost_inr`,
  `airtable_create_proposal_url`, `chat_url`, `cover_letter_links`, `attachments_count`,
  `attachments_filenames`
- work samples (migration `0004`): `looms` (text[] — Loom walkthrough URLs), `image_links`
  (text[] — image/screenshot URLs). The proposal workspace reads these to populate its
  Work Samples picker; both are arrays (a job can carry several of each). **These are a
  derived cache** — `matchAssets()` (see below) fills them by scoring `loom_videos` +
  `knowledge_base` against the job. Both NULL = not yet matched; both `{}`/populated =
  matched (the matcher always writes both together, and skips a job that's already matched).

> **Normalized vs denormalized:** `jobs` carries denormalized `proposal_*`/`picked_by_name`
> fields (what n8n writes), AND the normalized `job_assignments` + `proposals` tables exist.
> **Decision: ownership is claimed through `job_assignments` + `claim_job()` (race-safe via the
> partial unique index); the denormalized `jobs` fields mirror it for display/n8n.** Don't
> assign by writing `jobs.picked_by_name` alone — that loses the one-owner guarantee.

**`job_assignments`** — ownership as history. `id`, `job_id`, `user_id`, `assigned_at`,
`released_at` (**NULL = currently owned**), `release_reason` (`timeout`|`manual`|`reassigned`).
Partial unique index `one_live_assignment_per_job` on `(job_id) WHERE released_at IS NULL`.

**`proposals`** — the ACTION. `id`, `job_id`, `user_id`, `cover_letter`, `token_cost_inr`,
`tokens`, **`submitted_at`** (NULL = drafted, not yet submitted on Upwork — this is what the
release clock checks), `created_at`, `updated_at`. Unique index `one_proposal_per_job`.
**Written by `POST /generate`** (`saveProposal.ts`) — UPSERTed by `job_id` so generating creates
the draft and regenerating overwrites the same row; the extension restores it via
`POST /jobs/proposal` instead of re-calling the model. `/generate` is auth-gated (records `user_id`).

**`proposal_answers`** — screening Q&A tied to a proposal. `id`, `proposal_id`, `question`,
`answer`, `token_cost_inr`, `created_at`. Also written by `/generate` (replaced on each regenerate).

**`assets`** — `id`, `kind` (`asset_kind`), `label`, `url` (**R2 or Loom URL — never file
bytes**), `created_by`, `created_at`. Optional unique index **`assets_url_uniq`** on `url`
(migration `0005`) — the proposal-draft writer already dedupes assets by `url` in code
(SELECT-then-INSERT), so linking works without it; the index just hardens against duplicate
urls under concurrent generates.

**`proposal_assets`** — M:N join. `(proposal_id, asset_id)` PK. **Populated by `POST /generate`**
(`saveProposal.ts`): the matched `image_links` (kind `image`) + `looms` (kind `loom`) **and the
suggested portfolio points** (kind `portfolio` — title in `assets.label`, page/position encoded in
a synthetic `portfolio://pN/iM` url) are snapshotted into `assets` (deduped by url) and linked here
to the draft, so they all restore via `POST /jobs/proposal`. Replaced wholesale on each regenerate.
No new column needed — reuses the existing `asset_kind` enum.

**`thread_messages`** — synced Upwork conversation, one thread per job. `id`, `job_id`
(nullable — a room can sync before its job is in Reflex), `room_id`, `message_id` (**unique —
idempotency key for the sync**), `sender` (`msg_sender`), `body`, `sent_at`, `created_at`.
**Written by `POST /messages/sync`** (`messages.ts`): the extension sends the `room_id` (parsed
from the rep's Upwork thread URL); the Worker mints a token from `UPWORK_TOKEN_URL` (POST →
`{accessToken}`), then hits the **Upwork GraphQL API** (`https://api.upwork.com/graphql` — NOT
`www.upwork.com`, which bot-challenges): `roomStories(filter:{roomId_eq})` for the messages and
`room(id){ topic vendorProposal{ marketplaceJobPosting{ id } } }` for the job link. Messages UPSERT
`on conflict (message_id) do nothing`. **The room→job link is `jobs.upwork_job_id =
marketplaceJobPosting.id`** — NOT `chat_url` (which is empty across the entire jobs table). The link
is nullable (the job may not be in Reflex). **`POST /messages/suggest`** reads the linked job + its
proposal + this thread and returns a Claude `{summary, reply}` for the rep to copy (never auto-sent).
Migration `0006` added **`jobs.messages_synced_at`** (timestamptz) — stamped every sync so the panel
shows "Last synced" even when a sync finds no new messages.

**`connects_ledger`** — append-only. `id`, `user_id`, `job_id`, `delta` (int; negative =
spent), `note`, `created_at`. "Connects left" is a computed/cached balance.

**`embeddings`** — pgvector. `id`, `source_kind` (`proposal`|`portfolio`), `source_id`,
`content`, `embedding` (`vector(1536)` — **change dim if you change the embedder**),
`created_at`. ivfflat index for cosine similarity.

### Work-sample reference tables (source for the asset matcher)

These two tables are the **source library** the n8n workflow and `matchAssets()` score a job
against to fill `jobs.looms` / `jobs.image_links`. They are populated outside the app (n8n /
manual upload); the app only **reads** them. ⚠️ Not in `0000_baseline.sql` — they live in the
live Neon DB; column names below are authoritative for the matcher and must stay in sync.

**`loom_videos`** — Loom walkthrough library. Columns used: `id`, `title`, `new_link`
(the Loom URL). Matcher scores `title` against the job's keywords; formats matches as
`"Title — new_link"`.

**`knowledge_base`** — project/screenshot library. Columns used: `id`, `project_id`,
`use_case`, `description`, `major_apps`, `secondary_apps`, `screenshot_urls` (text[] of image
URLs). Matcher scores `use_case + description + major_apps + secondary_apps`; pulls
`screenshot_urls` from the top matches into `image_links` (flat, max 4).

> **`matchAssets()`** (`apps/api/src/matchAssets.ts`) — single-job port of the n8n "Match
> Resources" node. Called first in `POST /generate`: tokenizes the job's
> `title/description/reason/skills`, scores both reference tables (platform tokens weighted
> ×3), keeps the **top 2** of each, and **upserts** the formatted arrays onto the job's
> `looms` / `image_links`. Idempotent — skips a job whose `looms` and `image_links` are
> already non-null. The portal UI is unchanged: it still reads the two columns.

---

## Functions (in Postgres)

- `claim_job(job, user)` → race-safe "Assign to me"; fails cleanly if already owned.
- `assign_job(job, target_user)` → **admin reassignment** (migration `0003`): releases any live
  owner (`release_reason = 'reassigned'`) then inserts a live assignment for `target_user`,
  atomically. Validates the target is an `active` user. Use this (not `claim_job`) to move an
  already-owned job between reps.
- `auto_assign_on_shift(job)` → assigns a new job to whoever is on shift now (handles
  midnight-wrapping windows; round-robin by `last_active_at`).
- `release_stale_assignments(hours=2)` → frees jobs owned >N hours with no submitted
  proposal; returns count freed. Run on a schedule.
- `board_for_user(user)` → the whole board in one query: per job, the live owner, is_mine,
  is_available, actioned, was_released. Excludes `irrelevant`.

---

## RLS (to implement after auth is wired)

Enable RLS on every table; set `app.user_id` per request from a verified JWT in the API.
Reps read the shared board but write `proposals`/`proposal_answers` only on jobs they
currently own; admin bypasses. Owner-credential operations always run as Manish.
