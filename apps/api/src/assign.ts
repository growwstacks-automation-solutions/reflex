// Admin assignment endpoints:
//   GET  /reps         → active reps, for the admin's row-action picker (admin-only).
//   POST /jobs/assign  → (re)assign a job to a chosen rep via assign_job() (admin-only).
//
// Both are admin-gated: a rep's only assignment path stays "Assign to me" (claim_job).
// assign_job() (migration 0003) releases any current live owner as 'reassigned' and
// installs the target rep atomically, so an admin can move a job between reps.
import { neon } from "@neondatabase/serverless";
import { json } from "./http";
import { authUser } from "./auth";
import type { Env } from "./index";

export async function reps(req: Request, env: Env): Promise<Response> {
  if (!env.JWT_SECRET) return json({ error: "Server misconfigured: JWT_SECRET is not set." }, 500);
  if (!env.DATABASE_URL) return json({ error: "Server misconfigured: DATABASE_URL is not set." }, 500);

  const user = await authUser(req, env);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (user.role !== "admin") return json({ error: "Forbidden" }, 403);

  const sql = neon(env.DATABASE_URL);
  // Reps are the assignable users. Admins are excluded — jobs go to reps, not admins.
  const rows = (await sql`
    select id, full_name, role
    from users
    where active and role = 'rep'
    order by full_name
  `) as Array<{ id: string; full_name: string; role: string }>;

  return json({ reps: rows });
}

interface AssignBody {
  upwork_job_id?: string;
  user_id?: string;
}

export async function assignJob(req: Request, env: Env): Promise<Response> {
  if (!env.JWT_SECRET) return json({ error: "Server misconfigured: JWT_SECRET is not set." }, 500);
  if (!env.DATABASE_URL) return json({ error: "Server misconfigured: DATABASE_URL is not set." }, 500);

  const user = await authUser(req, env);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (user.role !== "admin") return json({ error: "Forbidden" }, 403);

  let body: AssignBody;
  try {
    body = (await req.json()) as AssignBody;
  } catch {
    return json({ error: 'Body must be JSON: { "upwork_job_id": "...", "user_id": "..." }.' }, 400);
  }
  const upworkJobId = (body.upwork_job_id ?? "").toString().trim();
  const targetUserId = (body.user_id ?? "").toString().trim();
  if (!upworkJobId || !targetUserId) {
    return json({ error: "upwork_job_id and user_id are required." }, 400);
  }

  const sql = neon(env.DATABASE_URL);

  // Resolve the internal job id from the Upwork id (the UI works in upwork_job_id).
  const jobRows = (await sql`
    select id from jobs where upwork_job_id = ${upworkJobId} limit 1
  `) as Array<{ id: string }>;
  const job = jobRows[0];
  if (!job) return json({ error: `Job not found: ${upworkJobId}` }, 404);

  try {
    // assign_job validates the target is an active user and reassigns atomically.
    await sql`select assign_job(${job.id}::uuid, ${targetUserId}::uuid)`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Assignment failed: ${message}` }, 400);
  }

  // Return the new owner's name so the UI can update the row without a full refetch.
  const ownerRows = (await sql`
    select full_name from users where id = ${targetUserId} limit 1
  `) as Array<{ full_name: string }>;

  return json({ ok: true, owner_name: ownerRows[0]?.full_name ?? null });
}
