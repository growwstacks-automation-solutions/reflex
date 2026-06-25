-- ============================================================
-- Reflex — 0004_job_work_samples.sql
-- Per-job work-sample links the rep can attach to a proposal:
--   * looms        — Loom walkthrough URLs for this job
--   * image_links  — image/screenshot URLs for this job
-- Both are ARRAYS (a job can carry several looms and several images), matching
-- the existing `skills text[]` convention. The proposal workspace reads these two
-- columns to populate its Work Samples picker (previously hardcoded demo assets).
--
-- Append-only migration. Apply with OWNER creds in your own terminal:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0004_job_work_samples.sql
-- ============================================================

alter table jobs add column if not exists looms        text[];   -- Loom walkthrough URLs
alter table jobs add column if not exists image_links  text[];   -- image / screenshot URLs
