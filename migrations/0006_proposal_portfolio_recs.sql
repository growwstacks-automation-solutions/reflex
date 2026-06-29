-- ============================================================
-- Reflex — 0006_proposal_portfolio_recs.sql
-- Persist the AI's "suggested proposal points" (portfolio_recommendations) on the proposal
-- draft so they RESTORE when the rep reopens a job — same as the cover letter, answers, and
-- attachments. Stored as jsonb: an array of { title, page, position, why } (what /generate
-- returns from the portfolio index).
--
-- The draft writer fills this in a separate, guarded statement, so the proposal still saves
-- if this column doesn't exist yet — applying the migration just turns on restore for the
-- suggested points.
--
-- Append-only migration. Apply with OWNER creds in your own terminal:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0006_proposal_portfolio_recs.sql
-- ============================================================

alter table proposals add column if not exists portfolio_recommendations jsonb;
