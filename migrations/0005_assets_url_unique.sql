-- ============================================================
-- Reflex — 0005_assets_url_unique.sql
-- OPTIONAL hardening. A unique index on assets.url. The proposal-draft writer
-- (saveProposal.ts) already dedupes assets by url in code (SELECT-then-INSERT), so
-- attachment linking works WITHOUT this index — applying it just guarantees no two
-- asset rows share a url under concurrent generates (a race the code can't fully close).
--
-- Context: /generate snapshots its matched image_links + looms into `assets` (one row
-- per URL) and links them to the draft via `proposal_assets` (the existing M:N table).
--
-- NB: if `assets` already holds duplicate urls this index creation will fail —
-- dedupe first (keep one row per url) before applying. The table is expected to be
-- empty / small today (matched samples have lived on jobs.looms/image_links, not here).
--
-- Append-only migration. Apply with OWNER creds in your own terminal:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0005_assets_url_unique.sql
-- ============================================================

create unique index if not exists assets_url_uniq on assets (url);
