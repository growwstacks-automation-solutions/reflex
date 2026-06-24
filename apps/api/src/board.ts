// GET /board — the logged-in rep's jobs (Path B: parameterized jobs ⋈ job_assignments).
// board_for_user() was rejected in discovery: it returns the whole board and lacks the
// post-0001 columns (quality, budget, client intel) the card UI needs, and widening it
// would be a schema change. A direct query is simpler and needs no RLS plumbing.
import { neon } from "@neondatabase/serverless";
import { json } from "./http";
import { authUser } from "./auth";
import type { Env } from "./index";

export async function board(req: Request, env: Env): Promise<Response> {
  if (!env.JWT_SECRET) return json({ error: "Server misconfigured: JWT_SECRET is not set." }, 500);
  if (!env.DATABASE_URL) return json({ error: "Server misconfigured: DATABASE_URL is not set." }, 500);

  const user = await authUser(req, env);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const sql = neon(env.DATABASE_URL);
  // Parameterized: the user id is bound, never interpolated. released_at is null = live owner.
  const jobs = (await sql`
    select
      j.upwork_job_id, j.title, j.verdict, j.quality, j.budget_text,
      j.contract_type, j.fixed_amount, j.hourly_min, j.hourly_max,
      j.client_country, j.client_country_code, j.connects,
      j.posted_at, j.reason, j.proposal_status,
      -- detail-panel fields (Option A): description, real Upwork url, richer client intel.
      -- Taxonomy FKs are null in the migrated data, so they stay out of the payload.
      j.description, j.url, j.client_spend, j.client_city, j.client_timezone,
      j.client_billing_type, j.client_payment_verified, j.last_client_activity
    from jobs j
    join job_assignments a on a.job_id = j.id and a.released_at is null
    where a.user_id = ${user.sub}
    order by j.posted_at desc nulls last
  `) as Array<Record<string, unknown>>;

  return json({ jobs });
}
