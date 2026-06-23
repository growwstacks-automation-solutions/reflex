-- ============================================================
-- Reflex — 0001_expand_jobs.sql
-- Widen `jobs` to carry ALL 53 Airtable export columns with correct types.
-- Append-only migration. Apply with OWNER creds in your own terminal:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0001_expand_jobs.sql
--
-- Per Manish's call, EVERYTHING lands on `jobs` for now. Columns marked ⚑ are
-- really proposal-facts or generation-facts and a later 0002_split_proposal_fields.sql
-- can move them onto `proposals` keyed by job. Columns marked ⚑internal are
-- Airtable-derived/low-value and safe to drop in that later pass.
--
-- Already on jobs (from 0000, NOT re-added): upwork_job_id, title, description,
-- url (=job_link), budget_text, connects, client_country, client_spend, posted_at,
-- verdict (=Relevance), reason (=Classification Reason, backfilled clean), taxonomy FKs.
-- ============================================================

-- ---- identity & timestamps ----
alter table jobs add column if not exists ingested_at         timestamptz;  -- Create Time (n8n first saw it)
alter table jobs add column if not exists source_modified_at  timestamptz;  -- ⚑internal Last modified time
alter table jobs add column if not exists created_hour        integer;      -- ⚑internal Created Time (24h) hour bucket

-- ---- status, ownership, classification ----
alter table jobs add column if not exists proposal_status     text;         -- New Job / Submitted / In Contact
alter table jobs add column if not exists picked_by_name       text;        -- also drives job_assignments
alter table jobs add column if not exists quality             text;         -- ★ NEW good|medium|watch|poor
alter table jobs add constraint jobs_quality_check
  check (quality is null or quality in ('good','medium','watch','poor'));

-- ---- core content ----
alter table jobs add column if not exists skills              text[];       -- list field (empty in this export)

-- ---- budget / contract (structured — was collapsed into budget_text) ----
alter table jobs add column if not exists contract_type       text;         -- HOURLY|FIXED
alter table jobs add column if not exists experience_level    text;         -- INTERMEDIATE|EXPERT|ENTRY_LEVEL
alter table jobs add column if not exists fixed_amount        numeric;
alter table jobs add column if not exists fixed_amount_max    numeric;
alter table jobs add column if not exists fixed_currency      text;
alter table jobs add column if not exists hourly_min          numeric;
alter table jobs add column if not exists hourly_max          numeric;
alter table jobs add column if not exists hourly_budget_type  text;         -- NOT_PROVIDED|DEFAULT|MANUAL
alter table jobs add column if not exists engagement_weeks    integer;

-- ---- client intelligence ----
alter table jobs add column if not exists client_country_code      text;    -- US/SA/AE
alter table jobs add column if not exists client_city              text;
alter table jobs add column if not exists client_timezone          text;
alter table jobs add column if not exists client_billing_type      text;    -- BILL
alter table jobs add column if not exists client_payment_verified  boolean; -- ACTIVE -> true
alter table jobs add column if not exists last_client_activity     timestamptz;

-- ---- competition signals ----
alter table jobs add column if not exists bid_avg_rate               numeric;
alter table jobs add column if not exists bid_min_rate               numeric;
alter table jobs add column if not exists bid_max_rate               numeric;
alter table jobs add column if not exists has_bids                   boolean; -- "checked" -> true
alter table jobs add column if not exists invites_sent               integer;
alter table jobs add column if not exists total_invited_to_interview integer;
alter table jobs add column if not exists total_hired                integer;
alter table jobs add column if not exists total_unanswered_invites   integer;
alter table jobs add column if not exists total_offered              integer;

-- ---- attachments ----
alter table jobs add column if not exists attachments_count      integer;
alter table jobs add column if not exists attachments_filenames  text;       -- raw " | "-delimited list

-- ---- proposal / generation facts ⚑ (belong on proposals; here for now) ----
alter table jobs add column if not exists connect_spent          integer;     -- ⚑
alter table jobs add column if not exists proposal_link          text;        -- ⚑
alter table jobs add column if not exists proposal_submitted_at  timestamptz; -- ⚑
alter table jobs add column if not exists submitted_by_name      text;        -- ⚑
alter table jobs add column if not exists connect_cost           numeric;     -- ⚑ NOTE: spec said integer, data is decimal (e.g. 1.8) → numeric
alter table jobs add column if not exists cache_status           text;        -- ⚑ HIT/MISS
alter table jobs add column if not exists token_cost_inr         numeric;     -- ⚑ generation cost ₹
alter table jobs add column if not exists airtable_create_proposal_url text;  -- ⚑internal
alter table jobs add column if not exists proposal_text          text;        -- ⚑ Upwork Proposal Text
alter table jobs add column if not exists cover_letter_links     text;        -- ⚑
alter table jobs add column if not exists chat_url               text;        -- ⚑
alter table jobs add column if not exists generation_status      text;        -- ⚑
