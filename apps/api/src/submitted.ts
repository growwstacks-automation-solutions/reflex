import { neon } from "@neondatabase/serverless";
import { json } from "./http";
import { authUser } from "./auth";
import type { Env } from "./index";

/**
 * POST /jobs/submitted — record that a proposal was SENT on Upwork.
 *
 * The extension captures the job (from the `/apply` URL cipher) + connects (from the bidding-box
 * "Total: N Connects") into the tab's sessionStorage. After the rep submits, Upwork navigates the
 * SAME tab to `…/nx/proposals/<proposalId>?success`; the extension reads that proposal id, pairs it
 * with the remembered job id, shows a confirm card, and posts here on the rep's "Confirm & Save".
 *
 * Auth-gated (records which rep). Pure DB write — no Upwork/model call, so it lives in the API, not
 * the Worker. Idempotent: re-posting the same proposal_id won't double-count connects (the ledger
 * insert is deduped by the proposal id in `note`), and the job/proposal updates are set-to-same.
 *
 * Body: { upwork_job_id, proposal_id, proposal_link, connects_spent }
 */
export async function jobSubmitted(req: Request, env: Env): Promise<Response> {
  const claims = await authUser(req, env);
  if (!claims) return json({ error: "Unauthorized" }, 401);
  if (!env.DATABASE_URL) return json({ error: "Server misconfigured: DATABASE_URL is not set." }, 500);

  let body: { upwork_job_id?: unknown; proposal_id?: unknown; proposal_link?: unknown; connects_spent?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'Body must be JSON, e.g. { "upwork_job_id": "..." }.' }, 400);
  }
  const jobId = body.upwork_job_id ? String(body.upwork_job_id) : "";
  const proposalId = body.proposal_id ? String(body.proposal_id) : "";
  const proposalLink = body.proposal_link ? String(body.proposal_link) : "";
  const connectsRaw = Number(body.connects_spent);
  const connects = Number.isFinite(connectsRaw) ? Math.trunc(connectsRaw) : null;
  if (!jobId) return json({ error: "Missing upwork_job_id." }, 400);

  try {
    const sql = neon(env.DATABASE_URL);
    const jobs = (await sql`
      select id from jobs where upwork_job_id = ${jobId} or id::text = ${jobId} limit 1
    `) as Array<{ id: string }>;
    if (jobs.length === 0) return json({ error: "Job isn't in Reflex — add it first." }, 404);
    const jid = jobs[0].id;

    // Rep display name for the denormalized mirror (claims carry only sub/email).
    const users = (await sql`
      select full_name, email from users where id = ${claims.sub} limit 1
    `) as Array<{ full_name: string; email: string }>;
    const repName = (users[0] && (users[0].full_name || users[0].email)) || claims.email || "";

    // Denormalized job mirror — the Airtable/board-style fields (proposal_status text is
    // "New Job / Submitted / In Contact"; connect_spent is an integer).
    await sql`
      update jobs set
        proposal_submitted_at = now(),
        proposal_status       = 'Submitted',
        proposal_link         = ${proposalLink || null},
        connect_spent         = ${connects},
        submitted_by_name     = ${repName}
      where id = ${jid}
    `;

    // Normalized proposals row: flip the draft to submitted (only if a draft exists and is unsent).
    await sql`update proposals set submitted_at = now(), updated_at = now() where job_id = ${jid} and submitted_at is null`;

    // Connects ledger (append-only; negative delta = spent). Dedupe by the proposal id in `note`
    // so a page reload / re-post can't double-spend the connects.
    if (connects && connects > 0 && proposalId) {
      const existing = (await sql`
        select 1 from connects_ledger where job_id = ${jid} and note like ${"%" + proposalId + "%"} limit 1
      `) as Array<unknown>;
      if (existing.length === 0) {
        await sql`
          insert into connects_ledger (user_id, job_id, delta, note)
          values (${claims.sub}, ${jid}, ${-connects}, ${"Proposal submitted " + proposalId})
        `;
      }
    }

    return json({ ok: true }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
}
