-- ============================================================
-- Reflex — baseline schema (0000_baseline.sql)
-- Target: Neon Postgres 17 + pgvector
--
-- Apply with OWNER credentials in your own terminal — never paste
-- the DB password into Claude Code or any AI tool. Claude Code writes
-- and stages migrations; you apply them.
--
-- Reading order: extensions -> taxonomy -> users -> jobs -> assignment
-- -> proposals/assets -> thread -> ledger -> embeddings -> indexes
-- -> functions -> the assignment/release logic (the important part).
-- ============================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "vector";      -- pgvector, same DB (no separate vector store)

-- ------------------------------------------------------------
-- 1. TAXONOMY — four canonical reference tables
-- The classifier picks an existing row by default and only inserts a
-- new one when nothing matches. This is what keeps reporting clean.
-- `status` lets a classifier-proposed label sit pending until confirmed.
-- ------------------------------------------------------------
create type taxonomy_status as enum ('approved', 'pending');

create table tools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  status      taxonomy_status not null default 'approved',
  created_at  timestamptz not null default now()
);
create table use_cases (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  status      taxonomy_status not null default 'approved',
  created_at  timestamptz not null default now()
);
create table departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  status      taxonomy_status not null default 'approved',
  created_at  timestamptz not null default now()
);
create table industries (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  status      taxonomy_status not null default 'approved',
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. USERS — email/password auth, active flag, shift windows
-- `active=false` is the lock-out for a departing teammate.
-- shift_start/shift_end are time-of-day windows that drive auto-assignment.
-- ------------------------------------------------------------
create type user_role as enum ('rep', 'admin');

create table users (
  id             uuid primary key default gen_random_uuid(),
  email          text not null unique,
  password_hash  text not null,
  full_name      text not null,
  role           user_role not null default 'rep',
  active         boolean not null default true,
  shift_start    time,                 -- e.g. 02:00 (Sachin)
  shift_end      time,                 -- e.g. 10:00 ; may wrap past midnight
  last_active_at timestamptz,
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. JOBS — ingested from Upwork, classified, the heart of the board
-- verdict/reason come from the classifier. The four *_id columns are the
-- four-level taxonomy. upwork_job_id is unique so ingestion is idempotent.
-- ------------------------------------------------------------
create type job_verdict as enum ('relevant', 'review', 'irrelevant');

create table jobs (
  id              uuid primary key default gen_random_uuid(),
  upwork_job_id   text not null unique,          -- the natural key from Upwork
  title           text not null,
  description     text,
  url             text,
  budget_text     text,                          -- raw, e.g. "$1.5k-3k"
  connects        integer,                       -- connects required to apply
  client_country  text,
  client_spend    text,
  posted_at       timestamptz,

  verdict         job_verdict,
  reason          text,                          -- one-line classifier reason
  tool_id         uuid references tools(id),
  use_case_id     uuid references use_cases(id),
  department_id   uuid references departments(id),
  industry_id     uuid references industries(id),

  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. JOB_ASSIGNMENTS — ownership as history, not a column
-- A live assignment has released_at IS NULL. Releasing stamps released_at
-- rather than deleting, so you keep the full chain of who held a job.
-- Partial unique index: at most ONE live assignment per job.
-- ------------------------------------------------------------
create table job_assignments (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references jobs(id) on delete cascade,
  user_id      uuid not null references users(id),
  assigned_at  timestamptz not null default now(),
  released_at  timestamptz,                       -- null = currently owned
  release_reason text                             -- 'timeout' | 'manual' | 'reassigned'
);
create unique index one_live_assignment_per_job
  on job_assignments (job_id) where released_at is null;

-- ------------------------------------------------------------
-- 5. PROPOSALS — the ACTION. submitted_at is what stops the release clock.
-- One live proposal per job (the rep can regenerate the draft in place).
-- ------------------------------------------------------------
create table proposals (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references jobs(id) on delete cascade,
  user_id       uuid not null references users(id),
  cover_letter  text,
  token_cost_inr numeric(10,4),                   -- shown in the UI
  tokens        integer,
  submitted_at  timestamptz,                      -- null = drafted, not yet submitted on Upwork
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index one_proposal_per_job on proposals (job_id);

-- screening question answers live with the proposal, sharing the job's thread
create table proposal_answers (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references proposals(id) on delete cascade,
  question      text not null,
  answer        text,
  token_cost_inr numeric(10,4),
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 6. ASSETS — screenshots, portfolio images, Loom videos
-- Files live in Cloudflare R2. Only the URL is stored here (locked rule).
-- ------------------------------------------------------------
create type asset_kind as enum ('image', 'loom', 'portfolio');

create table assets (
  id          uuid primary key default gen_random_uuid(),
  kind        asset_kind not null,
  label       text not null,
  url         text not null,                      -- R2 URL or Loom URL — never file bytes
  created_by  uuid references users(id),
  created_at  timestamptz not null default now()
);

-- which assets a proposal attached (many-to-many)
create table proposal_assets (
  proposal_id uuid not null references proposals(id) on delete cascade,
  asset_id    uuid not null references assets(id) on delete cascade,
  primary key (proposal_id, asset_id)
);

-- ------------------------------------------------------------
-- 7. THREAD_MESSAGES — synced Upwork conversation, one thread per job
-- room_id + message_id come from the Upwork Messages API. The unique
-- constraint on message_id makes the 5-10 min sync idempotent.
-- ------------------------------------------------------------
create type msg_sender as enum ('client', 'us');

create table thread_messages (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid references jobs(id) on delete cascade,
  room_id       text not null,                    -- Upwork room
  message_id    text not null unique,             -- Upwork message id — idempotency key
  sender        msg_sender not null,
  body          text,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index thread_by_job on thread_messages (job_id, sent_at);

-- ------------------------------------------------------------
-- 8. CONNECTS_LEDGER — every connect spend, per user per job
-- Append-only. "Connects left" is a balance you compute or cache.
-- ------------------------------------------------------------
create table connects_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id),
  job_id      uuid references jobs(id) on delete set null,
  delta       integer not null,                   -- negative = spent, positive = granted
  note        text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 9. EMBEDDINGS — pgvector, for retrieving past winning proposals
-- Only winning/strong proposals get embedded (on win). Retrieval pulls
-- top 2-3 by similarity so prompts stay small — never the whole library.
-- 1536 dims = OpenAI text-embedding-3-small; change to match your model.
-- ------------------------------------------------------------
create table embeddings (
  id          uuid primary key default gen_random_uuid(),
  source_kind text not null,                       -- 'proposal' | 'portfolio'
  source_id   uuid,                                -- e.g. proposals.id
  content     text not null,                       -- the chunk that was embedded
  embedding   vector(1536),
  created_at  timestamptz not null default now()
);
create index embeddings_ann on embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ------------------------------------------------------------
-- 10. SUPPORTING INDEXES for the board's hot queries
-- ------------------------------------------------------------
create index jobs_verdict_idx        on jobs (verdict);
create index jobs_posted_idx         on jobs (posted_at desc);
create index assignments_user_live   on job_assignments (user_id) where released_at is null;
create index proposals_submitted_idx on proposals (submitted_at);

-- ============================================================
-- FUNCTIONS — the assignment & release engine
-- These run server-side. Two homes (decide per function):
--   * Postgres functions (below) for set-based DB logic: claiming,
--     releasing, computing the board. Atomic, race-safe, close to data.
--   * Cloudflare Worker (NOT here) for anything touching the network:
--     Upwork polling, AI calls, embeddings. Postgres should never make
--     HTTP calls.
-- ============================================================

-- 10a. Claim a job (Assign to me) — race-safe via the partial unique index.
-- Fails cleanly if someone else already holds it.
create or replace function claim_job(p_job_id uuid, p_user_id uuid)
returns job_assignments
language plpgsql
as $$
declare
  v_row job_assignments;
begin
  insert into job_assignments (job_id, user_id)
  values (p_job_id, p_user_id)
  returning * into v_row;          -- unique index rejects a second live claim
  return v_row;
exception when unique_violation then
  raise exception 'job % is already assigned', p_job_id using errcode = 'P0001';
end;
$$;

-- 10b. Auto-assign a freshly ingested job to whoever is on shift now.
-- Shift windows may wrap midnight, so the check handles both cases.
create or replace function auto_assign_on_shift(p_job_id uuid)
returns void
language plpgsql
as $$
declare
  v_user uuid;
  v_now  time := (now() at time zone 'Asia/Kolkata')::time;
begin
  select id into v_user from users
  where active and shift_start is not null and shift_end is not null
    and (
      (shift_start <= shift_end and v_now >= shift_start and v_now < shift_end) or
      (shift_start >  shift_end and (v_now >= shift_start or v_now < shift_end))   -- wraps midnight
    )
  order by last_active_at nulls first       -- gentle round-robin within a shift
  limit 1;

  if v_user is not null then
    insert into job_assignments (job_id, user_id) values (p_job_id, v_user)
    on conflict do nothing;                 -- skip if somehow already claimed
  end if;
end;
$$;

-- 10c. Release jobs that have been owned >2h with NO submitted proposal.
-- This is the core rule: release triggers on lack of ACTION, not assignment.
-- Run on a schedule (pg_cron, or a Worker cron calling this). Threshold
-- is a parameter so admin can tune it.
create or replace function release_stale_assignments(p_hours int default 2)
returns integer
language plpgsql
as $$
declare
  v_count int;
begin
  with stale as (
    select a.id
    from job_assignments a
    left join proposals p
      on p.job_id = a.job_id and p.submitted_at is not null
    where a.released_at is null
      and p.id is null                                   -- not actioned
      and a.assigned_at < now() - make_interval(hours => p_hours)
  )
  update job_assignments a
     set released_at = now(), release_reason = 'timeout'
    from stale
   where a.id = stale.id;
  get diagnostics v_count = row_count;
  return v_count;                                         -- how many were freed
end;
$$;

-- 10d. The board, computed for one user. Returns every job with its
-- live owner and whether it's been actioned, so the UI can split into
-- "Assigned to me" vs "Available" without N+1 queries.
create or replace function board_for_user(p_user_id uuid)
returns table (
  job_id        uuid,
  title         text,
  verdict       job_verdict,
  reason        text,
  owner_id      uuid,
  owner_name    text,
  is_mine       boolean,
  is_available  boolean,
  actioned      boolean,
  was_released  boolean
)
language sql stable
as $$
  select
    j.id,
    j.title,
    j.verdict,
    j.reason,
    a.user_id                                   as owner_id,
    u.full_name                                 as owner_name,
    (a.user_id = p_user_id)                     as is_mine,
    (a.id is null)                              as is_available,
    (p.submitted_at is not null)                as actioned,
    exists (                                    -- previously timed-out and freed
      select 1 from job_assignments r
      where r.job_id = j.id and r.release_reason = 'timeout'
    )                                           as was_released
  from jobs j
  left join job_assignments a on a.job_id = j.id and a.released_at is null
  left join users u           on u.id = a.user_id
  left join proposals p       on p.job_id = j.id
  where j.verdict is distinct from 'irrelevant'   -- irrelevant stays filtered
  order by j.posted_at desc;
$$;

-- ============================================================
-- RLS NOTE (implement after auth is wired)
-- Neon is plain Postgres, so you enforce per-user access with RLS the
-- same way: enable RLS on every table, set a request-time claim
-- (e.g. SET app.user_id = '<uuid>' from a verified JWT in the API layer),
-- and write policies against it. Reps see all jobs (shared board) but
-- can only WRITE proposals/answers on jobs they currently own; admin
-- bypasses. Owner-credential operations (migrations, this file) always
-- run as Manish, never through the app role.
-- ============================================================
