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

**`jobs`** — `id`, `upwork_job_id` (unique — idempotency key), `title`, `description`, `url`,
`budget_text`, `connects` (int), `client_country`, `client_spend`, `posted_at`,
`verdict` (`job_verdict`), `reason` (one-line), `tool_id`, `use_case_id`, `department_id`,
`industry_id` (FKs to the taxonomy), `created_at`.

**`job_assignments`** — ownership as history. `id`, `job_id`, `user_id`, `assigned_at`,
`released_at` (**NULL = currently owned**), `release_reason` (`timeout`|`manual`|`reassigned`).
Partial unique index `one_live_assignment_per_job` on `(job_id) WHERE released_at IS NULL`.

**`proposals`** — the ACTION. `id`, `job_id`, `user_id`, `cover_letter`, `token_cost_inr`,
`tokens`, **`submitted_at`** (NULL = drafted, not yet submitted on Upwork — this is what the
release clock checks), `created_at`, `updated_at`. Unique index `one_proposal_per_job`.

**`proposal_answers`** — screening Q&A tied to a proposal. `id`, `proposal_id`, `question`,
`answer`, `token_cost_inr`, `created_at`.

**`assets`** — `id`, `kind` (`asset_kind`), `label`, `url` (**R2 or Loom URL — never file
bytes**), `created_by`, `created_at`.

**`proposal_assets`** — M:N join. `(proposal_id, asset_id)` PK.

**`thread_messages`** — synced Upwork conversation, one thread per job. `id`, `job_id`,
`room_id`, `message_id` (**unique — idempotency key for the sync**), `sender` (`msg_sender`),
`body`, `sent_at`, `created_at`.

**`connects_ledger`** — append-only. `id`, `user_id`, `job_id`, `delta` (int; negative =
spent), `note`, `created_at`. "Connects left" is a computed/cached balance.

**`embeddings`** — pgvector. `id`, `source_kind` (`proposal`|`portfolio`), `source_id`,
`content`, `embedding` (`vector(1536)` — **change dim if you change the embedder**),
`created_at`. ivfflat index for cosine similarity.

---

## Functions (in Postgres)

- `claim_job(job, user)` → race-safe "Assign to me"; fails cleanly if already owned.
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
