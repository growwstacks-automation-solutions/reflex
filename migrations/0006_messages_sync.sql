-- 0006_messages_sync.sql — support the extension's Messages sync + suggested-reply flow.
-- Append-only (the baseline is frozen). Manish applies this with owner credentials.
--
-- thread_messages already exists (0000_baseline.sql §7) and is idempotent on message_id, so
-- the sync itself needs no new table. The one thing it can't express is "when did we last
-- sync THIS room" when a sync finds no new messages (thread_messages.created_at only moves on
-- an actual insert). We track that per job so the panel can show an honest "Last synced" time.

alter table jobs add column if not exists messages_synced_at timestamptz;   -- last Upwork Messages sync for this job's room
