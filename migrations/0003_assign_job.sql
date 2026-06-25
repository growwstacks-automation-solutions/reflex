-- ============================================================
-- 0003_assign_job — admin reassignment
-- ------------------------------------------------------------
-- claim_job() (0000) is the rep's "Assign to me": it inserts a live row and
-- FAILS if the job is already owned (the partial unique index rejects a 2nd
-- live claim). Admins need to move a job to ANY rep, including one that's
-- already owned — so this releases the current live owner (reason 'reassigned')
-- and inserts a fresh live assignment for the target rep, atomically.
--
-- Append-only. Applied by Manish with owner credentials.
-- ============================================================

-- assign_job: (re)assign a job to a specific rep.
--   * If the job has a live owner, release it (released_at = now,
--     release_reason = 'reassigned') first.
--   * Insert a new live assignment for the target user.
--   * Mirror the new owner into the DENORMALIZED jobs.picked_by_name so the list
--     (and anything reading that column, e.g. n8n/Airtable views) stays in sync —
--     this is the column the admin sees update from "Neha" to "Sarthak".
-- The whole body is atomic, so the partial unique index one_live_assignment_per_job
-- never sees two live rows. Assigning a job to the rep who already owns it is harmless
-- churn (release then re-insert) — callers should skip that.
--
-- NOTE on the name form: jobs.picked_by_name holds the rep's FIRST name ("Sarthak",
-- "Neha", "Sachin") — NOT users.full_name ("Sarthak Punasia"). We write split_part(
-- full_name, ' ', 1) to match the existing migrated values exactly.
create or replace function assign_job(p_job_id uuid, p_target_user_id uuid)
returns job_assignments
language plpgsql
as $$
declare
  v_row  job_assignments;
  v_name text;
begin
  -- Target must be a real, active user (don't assign to a locked-out teammate).
  select split_part(full_name, ' ', 1) into v_name
  from users where id = p_target_user_id and active;
  if v_name is null then
    raise exception 'target user % is not an active user', p_target_user_id
      using errcode = 'P0001';
  end if;

  -- Release the current live owner, if any.
  update job_assignments
     set released_at = now(), release_reason = 'reassigned'
   where job_id = p_job_id and released_at is null;

  -- Give it to the target rep.
  insert into job_assignments (job_id, user_id)
  values (p_job_id, p_target_user_id)
  returning * into v_row;

  -- Keep the denormalized mirror in sync (first-name form, matches existing data).
  update jobs set picked_by_name = v_name where id = p_job_id;

  return v_row;
end;
$$;
