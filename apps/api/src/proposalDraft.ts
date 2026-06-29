import { neon } from "@neondatabase/serverless";
import { json } from "./http";

/**
 * GET-the-draft for ONE job — used by the extension to RESTORE a previously generated proposal
 * instead of calling the model again. The Listing/Job cards learn a draft exists from
 * /jobs/check (the lightweight `drafted` flag); this returns the full stored content for the
 * single open job so the panel can render it directly.
 *
 * Body: { job_id }  (upwork_job_id or internal uuid)
 * Response: { drafted, submitted, cover_letter, screening_answers: [{question, answer}],
 *             token_cost_inr, tokens, updated_at, looms, image_links, portfolio_recommendations,
 *             job: { title, description, budget, type, posted } }
 * `job` (the DB's display facts) is returned whenever the job exists — even with no draft — so the
 * extension's Job-tab card can show the real title/budget/posted on the apply page (where the
 * page DOM doesn't expose them).
 * Attachments come from the proposal's LINKED assets (proposal_assets → assets) — the exact
 * set snapshotted at generation. If a draft predates the linking (no proposal_assets rows), we
 * fall back to the job's cached jobs.looms / jobs.image_links so older drafts still show samples.
 * Read-only; no auth (the shared board/proposal is visible to the team, same as /jobs/check).
 */

// Postgres text[] -> clean string[] (tolerates a "{a,b}" array literal or a bare string).
function toLinks(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string" && v.startsWith("{")) {
    return v
      .replace(/^\{|\}$/g, "")
      .split(",")
      .map((s) => s.replace(/^"|"$/g, "").trim())
      .filter(Boolean);
  }
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  return [];
}
export async function proposalDraft(req: Request, env: { DATABASE_URL: string }): Promise<Response> {
  let body: { job_id?: unknown };
  try {
    body = (await req.json()) as { job_id?: unknown };
  } catch {
    return json({ error: 'Body must be JSON, e.g. { "job_id": "..." }.' }, 400);
  }
  const jobId = body.job_id ? String(body.job_id) : "";
  if (!jobId) return json({ error: "Missing job_id." }, 400);
  if (!env.DATABASE_URL) return json({ error: "Server misconfigured: DATABASE_URL is not set." }, 500);

  try {
    const sql = neon(env.DATABASE_URL);
    // Start from the JOB (left join the proposal) so we can return the job's display facts even
    // when there's no draft yet — the extension uses them for the Job-tab card on the apply page,
    // where the page DOM doesn't expose the real title/budget/posted.
    const rows = (await sql`
      select
        j.title,
        j.description,
        j.budget_text,
        j.contract_type,
        j.posted_at,
        j.proposal_submitted_at,
        j.looms,
        j.image_links,
        p.id                     as proposal_id,
        p.cover_letter,
        p.token_cost_inr,
        p.tokens,
        p.submitted_at,
        p.updated_at
      from jobs j
      left join proposals p on p.job_id = j.id
      where j.upwork_job_id = ${jobId} or j.id::text = ${jobId}
      limit 1
    `) as Array<Record<string, unknown>>;

    if (rows.length === 0) {
      // Job isn't in Reflex at all.
      return json({ drafted: false, submitted: false }, 200);
    }
    const r = rows[0];

    // Job display facts (the card reads these on the apply page). Description is clamped in the UI,
    // so a 320-char snippet is plenty.
    const desc = (r.description as string) || "";
    const job = {
      title: (r.title as string) || "",
      description: desc.length > 320 ? desc.slice(0, 320) : desc,
      budget: (r.budget_text as string) || "",
      type: (r.contract_type as string) || "",
      posted: r.posted_at ?? null, // ISO timestamp; the extension formats it
    };

    // No proposal drafted yet — still hand back the job facts (+ submitted flag from the mirror).
    if (!r.proposal_id) {
      return json({ drafted: false, submitted: !!r.proposal_submitted_at, job }, 200);
    }

    const proposalId = r.proposal_id as string;
    const answers = (await sql`
      select question, answer from proposal_answers
      where proposal_id = ${proposalId}
      order by created_at asc
    `) as Array<{ question: string; answer: string }>;

    // Linked attachments (the set snapshotted at generation). Loom rows are returned as
    // "Label — URL" so the extension shows the title; images are bare URLs.
    const linked = (await sql`
      select a.kind, a.label, a.url
      from proposal_assets pa
      join assets a on a.id = pa.asset_id
      where pa.proposal_id = ${proposalId}
    `) as Array<{ kind: string; label: string; url: string }>;

    // Suggested portfolio points — the `portfolio`-kind links. The synthetic url encodes
    // page/position ("portfolio://pN/iM"); the label is the sample title.
    const portfolio_recommendations = linked
      .filter((a) => a.kind === "portfolio")
      .map((a) => {
        const m = String(a.url || "").match(/p(\d+)\/i(\d+)/);
        return {
          title: a.label || "",
          page: m ? Number(m[1]) : null,
          position: m ? Number(m[2]) : null,
          why: "",
        };
      });

    let image_links: string[];
    let looms: string[];
    if (linked.length > 0) {
      image_links = linked.filter((a) => a.kind === "image").map((a) => a.url);
      looms = linked
        .filter((a) => a.kind === "loom")
        .map((a) => (a.label ? `${a.label} — ${a.url}` : a.url));
    } else {
      // Older draft (no links) — fall back to the job's cached work samples.
      image_links = toLinks(r.image_links);
      looms = toLinks(r.looms);
    }

    return json(
      {
        drafted: true,
        submitted: !!(r.submitted_at || r.proposal_submitted_at),
        cover_letter: (r.cover_letter as string) || "",
        screening_answers: answers.map((a) => ({ question: a.question, answer: a.answer })),
        token_cost_inr: r.token_cost_inr ?? null,
        tokens: r.tokens ?? null,
        updated_at: r.updated_at ?? null,
        looms,
        image_links,
        portfolio_recommendations,
        job,
      },
      200,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
}
