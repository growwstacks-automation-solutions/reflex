import { neon } from "@neondatabase/serverless";
import type { ScreeningAnswer, PortfolioPick } from "./generate";
import { parseLoom } from "./looms";

/**
 * Persist a generated proposal as a DRAFT so it can be reused instead of re-generated.
 *
 * One row per job (the `proposals.one_proposal_per_job` unique index): we UPSERT keyed by
 * the internal job id, so Generate creates the draft and Regenerate overwrites the same row.
 * `submitted_at` is left untouched (NULL = drafted, not yet submitted on Upwork — set later by
 * the message/proposal sync or a "Mark as submitted" action, never by this draft write).
 *
 * Screening answers live in the child `proposal_answers` table; we replace them wholesale
 * (delete + reinsert) so a regenerate doesn't accumulate stale answers.
 *
 * Attachments (the matched work samples /generate already produced — image_links from the
 * knowledge base, looms from the loom library) are SNAPSHOTTED into the existing M:N tables:
 * each URL is upserted as an `assets` row (deduped by the assets_url_uniq index) and linked in
 * `proposal_assets`. We don't re-query the source libraries — we persist what generation gave us,
 * so the draft keeps exactly the attachments it was generated with until a Regenerate overwrites them.
 *
 * NB: this is a draft cache. Failing to persist must NOT fail generation — the caller logs and
 * continues (the rep still gets their proposal; it just isn't saved for reuse this time).
 */
export async function persistProposalDraft(
  databaseUrl: string,
  jobIdParam: string, // upwork_job_id or internal uuid (whatever /generate received)
  userId: string,
  coverLetter: string,
  tokenCostInr: number,
  tokens: number,
  screeningAnswers: ScreeningAnswer[],
  imageLinks: string[] = [],
  looms: string[] = [],
  portfolioRecs: PortfolioPick[] = [],
): Promise<void> {
  const sql = neon(databaseUrl);

  // Resolve the internal job id (proposals.job_id references jobs.id, not the Upwork id).
  const jobRows = (await sql`
    select id from jobs where upwork_job_id = ${jobIdParam} or id::text = ${jobIdParam} limit 1
  `) as Array<{ id: string }>;
  if (jobRows.length === 0) throw new Error(`job not found for proposal persist: ${jobIdParam}`);
  const jobId = jobRows[0].id;

  // UPSERT the draft. ON CONFLICT (job_id) matches the one_proposal_per_job unique index.
  const propRows = (await sql`
    insert into proposals (job_id, user_id, cover_letter, token_cost_inr, tokens)
    values (${jobId}, ${userId}, ${coverLetter}, ${tokenCostInr}, ${tokens})
    on conflict (job_id) do update set
      cover_letter   = excluded.cover_letter,
      token_cost_inr = excluded.token_cost_inr,
      tokens         = excluded.tokens,
      updated_at     = now()
    returning id
  `) as Array<{ id: string }>;
  const proposalId = propRows[0].id;

  // Replace screening answers (delete + reinsert) so regenerate doesn't leave stale rows.
  await sql`delete from proposal_answers where proposal_id = ${proposalId}`;
  for (const a of screeningAnswers) {
    if (!a || !a.question) continue;
    await sql`
      insert into proposal_answers (proposal_id, question, answer)
      values (${proposalId}, ${a.question}, ${a.answer ?? ""})
    `;
  }

  // Persist the AI's suggested portfolio points so they restore with the draft. Guarded: if the
  // portfolio_recommendations column (migration 0006) isn't applied, the core save already
  // succeeded — we just log and skip (fresh generates still show them from the model response).
  try {
    await sql`
      update proposals set portfolio_recommendations = ${JSON.stringify(portfolioRecs || [])}::jsonb
      where id = ${proposalId}
    `;
  } catch (err) {
    console.warn(
      "[persistProposalDraft] portfolio recs skipped:",
      err instanceof Error ? err.message : String(err),
    );
  }

  // Snapshot the matched attachments into assets + proposal_assets (the M:N link). Wrapped in
  // its own guard: if it fails, the cover-letter + answers are already saved — we log and skip.
  // NB: we dedupe assets by url with a SELECT-then-INSERT (not ON CONFLICT) so this works
  // WITHOUT the optional assets_url_uniq index (migration 0005 just hardens it against races).
  try {
    // Clean slate for this proposal (delete the join rows; the shared assets stay).
    await sql`delete from proposal_assets where proposal_id = ${proposalId}`;

    const items: Array<{ kind: "image" | "loom"; label: string; url: string }> = [];
    imageLinks.filter(Boolean).forEach((url, i) =>
      items.push({ kind: "image", label: `Work sample ${i + 1}`, url: String(url).trim() }),
    );
    looms.filter(Boolean).forEach((raw) => {
      const { label, url } = parseLoom(String(raw));
      if (url) items.push({ kind: "loom", label, url });
    });

    for (const it of items) {
      if (!it.url) continue;
      // Reuse an existing asset row for this url, else create one.
      const existing = (await sql`
        select id from assets where url = ${it.url} limit 1
      `) as Array<{ id: string }>;
      let assetId: string;
      if (existing.length > 0) {
        assetId = existing[0].id;
      } else {
        const created = (await sql`
          insert into assets (kind, label, url, created_by)
          values (${it.kind}, ${it.label}, ${it.url}, ${userId})
          returning id
        `) as Array<{ id: string }>;
        assetId = created[0].id;
      }
      await sql`
        insert into proposal_assets (proposal_id, asset_id)
        values (${proposalId}, ${assetId})
        on conflict do nothing
      `;
    }
  } catch (err) {
    console.warn(
      "[persistProposalDraft] attachments skipped:",
      err instanceof Error ? err.message : String(err),
    );
  }
}
