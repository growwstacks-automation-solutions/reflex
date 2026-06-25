import { neon } from "@neondatabase/serverless";
import { json } from "./http";

/**
 * CHECK_JOBS — per-card status for the extension's Listing / Job strips.
 * The extension sends the upwork_job_id of every visible job; we return a status
 * for each one we HAVE in the DB. Ids we don't return are treated by the extension
 * as "Not in Reflex yet". Read-only; no auth (the shared board is visible to all).
 *
 * Response: { statuses: { [upwork_job_id]: {
 *   connected, inReflex, verdict: "rel"|"rev"|"irr", quality: "good"|"medium"|"poor",
 *   chips, ownership: "mine"|"other"|"available", owner, actioned: "none"|"submitted"
 * } } }
 */
const VERDICT_MAP: Record<string, string> = {
  relevant: "rel",
  review: "rev",
  irrelevant: "irr",
};

export async function checkJobs(req: Request, env: { DATABASE_URL: string }): Promise<Response> {
  let body: { jobIds?: unknown };
  try {
    body = (await req.json()) as { jobIds?: unknown };
  } catch {
    return json({ error: "Body must be JSON, e.g. { \"jobIds\": [\"...\"] }." }, 400);
  }
  const jobIds = Array.isArray(body.jobIds) ? body.jobIds.map(String).filter(Boolean) : [];
  if (!jobIds.length) return json({ statuses: {} }, 200);
  if (!env.DATABASE_URL) return json({ error: "Server misconfigured: DATABASE_URL is not set." }, 500);

  try {
    const sql = neon(env.DATABASE_URL);
    const rows = (await sql`
      select
        j.upwork_job_id,
        j.verdict::text          as verdict,
        j.quality,
        j.picked_by_name,
        j.proposal_submitted_at,
        t.name                   as tool,
        uc.name                  as use_case,
        d.name                   as department,
        ind.name                 as industry
      from jobs j
      left join tools       t   on t.id   = j.tool_id
      left join use_cases   uc  on uc.id  = j.use_case_id
      left join departments d   on d.id   = j.department_id
      left join industries  ind on ind.id = j.industry_id
      where j.upwork_job_id = any(${jobIds})
    `) as Array<Record<string, unknown>>;

    const statuses: Record<string, unknown> = {};
    for (const r of rows) {
      const id = String(r.upwork_job_id);
      const owner = (r.picked_by_name as string) || "";
      const chips = [r.tool, r.use_case, r.department, r.industry].filter(Boolean).join(" · ");
      statuses[id] = {
        connected: true,
        inReflex: true,
        verdict: VERDICT_MAP[String(r.verdict || "")] || "rev",
        quality: (r.quality as string) || "medium",
        chips,
        // Without auth we can't tell "mine" from "other" — owned vs available only.
        // TODO(auth): compare picked_by_name to the logged-in user for "mine".
        ownership: owner ? "other" : "available",
        owner: owner || undefined,
        actioned: r.proposal_submitted_at ? "submitted" : "none",
      };
    }
    return json({ statuses }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
}
