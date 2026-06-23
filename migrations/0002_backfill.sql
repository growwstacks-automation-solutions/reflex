-- ============================================================
-- Reflex — 0002_backfill.sql
-- One-time DATA backfill (not schema) — run AFTER 0001_expand_jobs.sql is applied.
-- Reloads the Airtable export into staging, truncates the prior load, and fans out
-- the full 53-column mapping into jobs (+ job_assignments + proposals) with type
-- transforms: "checked"->bool, day-first dates, numeric casts, ACTIVE->bool,
-- quality from its own column, reason stripped clean.
--
-- Reproducibility note: the two \copy lines read local files from ~/Downloads on
-- Manish's machine. This is a one-time migration of the current export, not a
-- portable migration. Re-running is safe (truncate … cascade clears the prior load).
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0002_backfill.sql
-- ============================================================

-- 1) staging (verbatim CSV, all text)
drop table if exists staging_jobs;
create table staging_jobs (
  job_id text, job_created text, create_time text, last_modified text, job_link text,
  proposal_status text, picked_by text, relevance text, quality text, classification_reason text,
  title text, description text, skills text, contract_type text, experience_level text,
  client_country text, fixed_amount text, fixed_amount_max text, fixed_currency text,
  hourly_min text, hourly_max text, hourly_budget_type text, engagement_weeks text,
  bid_avg_rate text, bid_min_rate text, bid_max_rate text, has_bids text, invites_sent text,
  total_invited_to_interview text, total_hired text, total_unanswered_invites text, total_offered text,
  last_client_activity text, client_country_code text, client_city text, client_timezone text,
  client_billing_type text, client_payment_verified text, attachments_count text, attachments_filenames text,
  connect_spent text, proposal_link text, proposal_datetime text, submitted_by text, connect_cost text,
  cache_status text, token_cost_inr text, create_proposal text, upwork_proposal_text text,
  cover_letter_links text, chat_url text, generation_status text, created_time_24h text
);
\copy staging_jobs from '/Users/manishmandot/Downloads/Imported table-Grid view (All) (2).csv' with (format csv, header true)
\copy staging_jobs from '/Users/manishmandot/Downloads/Imported table-Grid view (All) (1).csv' with (format csv, header true)

begin;

-- 2) clear prior load (the documented undo)
truncate proposals, job_assignments, jobs restart identity cascade;

-- 3) JOBS — all 53 columns, typed
insert into jobs (
  upwork_job_id, title, description, url, budget_text, client_country, posted_at, verdict, reason,
  ingested_at, source_modified_at, created_hour,
  proposal_status, picked_by_name, quality, skills,
  contract_type, experience_level, fixed_amount, fixed_amount_max, fixed_currency,
  hourly_min, hourly_max, hourly_budget_type, engagement_weeks,
  client_country_code, client_city, client_timezone, client_billing_type, client_payment_verified, last_client_activity,
  bid_avg_rate, bid_min_rate, bid_max_rate, has_bids, invites_sent,
  total_invited_to_interview, total_hired, total_unanswered_invites, total_offered,
  attachments_count, attachments_filenames,
  connect_spent, proposal_link, proposal_submitted_at, submitted_by_name, connect_cost,
  cache_status, token_cost_inr, airtable_create_proposal_url, proposal_text, cover_letter_links, chat_url, generation_status
)
select
  s.job_id,
  s.title,
  nullif(s.description, ''),
  nullif(s.job_link, ''),
  case
    when s.contract_type = 'FIXED' and nullif(s.fixed_amount,'') is not null
      then '$' || regexp_replace(s.fixed_amount, '\.0+$','') || ' fixed'
    when s.contract_type = 'HOURLY' and (nullif(s.hourly_min,'') is not null or nullif(s.hourly_max,'') is not null)
      then '$' || coalesce(regexp_replace(nullif(s.hourly_min,''),'\.0+$',''),'?') || '-'
              || coalesce(regexp_replace(nullif(s.hourly_max,''),'\.0+$',''),'?') || '/hr'
    else null
  end,
  nullif(s.client_country, ''),
  to_timestamp(nullif(s.job_created,''),   'DD/MM/YYYY HH12:MIam'),
  (case s.relevance when 'needs_review' then 'review' else s.relevance end)::job_verdict,
  nullif(s.classification_reason, ''),                         -- clean: quality no longer folded in
  to_timestamp(nullif(s.create_time,''),   'DD/MM/YYYY HH12:MIam'),
  to_timestamp(nullif(s.last_modified,''), 'DD/MM/YYYY HH12:MIam'),
  nullif(s.created_time_24h,'')::numeric::int,
  nullif(s.proposal_status, ''),
  nullif(s.picked_by, ''),
  nullif(s.quality, ''),                                       -- ★ its own column now
  case when nullif(s.skills,'') is null then null else string_to_array(s.skills, ', ') end,
  nullif(s.contract_type, ''),
  nullif(s.experience_level, ''),
  nullif(s.fixed_amount,'')::numeric,
  nullif(s.fixed_amount_max,'')::numeric,
  nullif(s.fixed_currency, ''),
  nullif(s.hourly_min,'')::numeric,
  nullif(s.hourly_max,'')::numeric,
  nullif(s.hourly_budget_type, ''),
  nullif(s.engagement_weeks,'')::numeric::int,
  nullif(s.client_country_code, ''),
  nullif(s.client_city, ''),
  nullif(s.client_timezone, ''),
  nullif(s.client_billing_type, ''),
  case when nullif(s.client_payment_verified,'') is null then null
       when s.client_payment_verified = 'ACTIVE' then true else false end,
  nullif(s.last_client_activity,'')::timestamptz,             -- already ISO
  nullif(s.bid_avg_rate,'')::numeric,
  nullif(s.bid_min_rate,'')::numeric,
  nullif(s.bid_max_rate,'')::numeric,
  (s.has_bids = 'checked'),                                    -- "checked" -> true, else false
  nullif(s.invites_sent,'')::numeric::int,
  nullif(s.total_invited_to_interview,'')::numeric::int,
  nullif(s.total_hired,'')::numeric::int,
  nullif(s.total_unanswered_invites,'')::numeric::int,
  nullif(s.total_offered,'')::numeric::int,
  nullif(s.attachments_count,'')::numeric::int,
  nullif(s.attachments_filenames, ''),
  nullif(s.connect_spent,'')::numeric::int,
  nullif(s.proposal_link, ''),
  to_timestamp(nullif(s.proposal_datetime,''), 'DD/MM/YYYY HH12:MIam'),
  nullif(s.submitted_by, ''),
  nullif(s.connect_cost,'')::numeric,                          -- decimal in source
  nullif(s.cache_status, ''),
  nullif(s.token_cost_inr,'')::numeric,
  nullif(s.create_proposal, ''),
  nullif(s.upwork_proposal_text, ''),
  nullif(s.cover_letter_links, ''),
  nullif(s.chat_url, ''),
  nullif(s.generation_status, '')
from staging_jobs s;

-- 4) JOB_ASSIGNMENTS (570 — owner from Picked by)
insert into job_assignments (job_id, user_id, assigned_at)
select j.id, u.id, j.posted_at
from staging_jobs s
join jobs j  on j.upwork_job_id = s.job_id
join users u on u.email = case s.picked_by
                            when 'Sarthak' then 'sarthak.punasiya@growwstacks.com'
                            when 'Sachin'  then 'sachin.karma@growwstacks.com'
                            when 'Neha'    then 'neha.j@growwstacks.com'
                          end;

-- 5) PROPOSALS (429 — Submitted + In Contact)
insert into proposals (job_id, user_id, cover_letter, token_cost_inr, submitted_at)
select j.id, u.id,
       nullif(s.upwork_proposal_text, ''),
       nullif(s.token_cost_inr, '')::numeric,
       to_timestamp(nullif(s.proposal_datetime,''), 'DD/MM/YYYY HH12:MIam')
from staging_jobs s
join jobs j  on j.upwork_job_id = s.job_id
join users u on u.email = case coalesce(nullif(s.submitted_by,''), s.picked_by)
                            when 'Sarthak' then 'sarthak.punasiya@growwstacks.com'
                            when 'Sachin'  then 'sachin.karma@growwstacks.com'
                            when 'Neha'    then 'neha.j@growwstacks.com'
                          end
where s.proposal_status in ('Submitted','In Contact');

-- ---- verification ----
select 'jobs' tbl, count(*) from jobs
union all select 'job_assignments', count(*) from job_assignments
union all select 'proposals', count(*) from proposals;

select quality, count(*) from jobs group by 1 order by count(*) desc;
select verdict, count(*) from jobs group by 1 order by 1;

-- type spot-checks: no "checked"/dd-mm text leaked into typed columns
select count(*) filter (where has_bids) as has_bids_true,
       count(*) filter (where client_payment_verified) as pay_verified_true,
       count(*) filter (where fixed_amount is not null) as with_fixed,
       count(*) filter (where hourly_min is not null) as with_hourly,
       count(*) filter (where bid_max_rate is not null) as with_bids_data,
       max(posted_at)::date as latest_post,
       max(last_client_activity)::date as latest_activity
from jobs;

select upwork_job_id, quality, verdict, contract_type,
       coalesce(fixed_amount::text, hourly_min||'-'||hourly_max) as budget,
       has_bids, client_country_code, left(reason,40) as reason
from jobs order by posted_at desc nulls last limit 6;

commit;

drop table staging_jobs;
