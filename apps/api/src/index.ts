import { generate } from "./generate";
import { costInr } from "./pricing";
import { STUB_JOB, applyOverrides, fetchJob, type JobInput, type JobOverrides } from "./job";
import { CORS, json } from "./http";
import { login, authUser } from "./auth";
import { board } from "./board";
import { checkJobs } from "./check";
import { reps, assignJob } from "./assign";
import { addJob } from "./addJob";
import { matchAssets } from "./matchAssets";
import { classify, type ClassifyJob } from "./classify";
import { extractClientName } from "./clientName";
import { persistProposalDraft } from "./saveProposal";
import { proposalDraft } from "./proposalDraft";
import { jobSubmitted } from "./submitted";
import { fillLoomPlaceholders } from "./looms";
import { syncMessages, suggestReply } from "./messages";
import { loadPortfolioIndex } from "./portfolio";
import { listPortfolios, createPortfolio, updatePortfolio, deletePortfolio, reorderPortfolios } from "./portfolios";

export interface Env {
  // Secrets (NOT in wrangler.toml): .dev.vars locally, `wrangler secret put` in prod.
  ANTHROPIC_API_KEY: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  // Secret: URL that mints an Upwork access token for the Messages API (returns [{accessToken}]).
  // .dev.vars locally, `wrangler secret put UPWORK_TOKEN_URL` in prod.
  UPWORK_TOKEN_URL: string;
  // Non-secret config ([vars] in wrangler.toml).
  ANTHROPIC_MODEL: string;
  USD_TO_INR: string;
  REFLEX_GENERATION_STUB: string;
  // Optional: our Upwork user id — lets the message sync label our own messages as "us" vs "client".
  UPWORK_VIEWER_ID?: string;
}

interface GenerateBody extends JobOverrides {
  job_id?: string;
}

const MAX_TOKENS = 2048;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(req.url);
    const route = `${req.method} ${url.pathname}`;
    if (route === "POST /auth/login") return login(req, env);
    if (route === "GET /board") return board(req, env);
    if (route === "GET /reps") return reps(req, env);
    if (route === "POST /jobs/assign") return assignJob(req, env);
    if (route === "POST /generate") return generateHandler(req, env);
    if (route === "POST /jobs/check") return checkJobs(req, env);
    if (route === "POST /jobs/proposal") return proposalDraft(req, env);
    if (route === "POST /jobs/add") return addJob(req, env);
    if (route === "POST /jobs/submitted") return jobSubmitted(req, env);
    if (route === "POST /jobs/classify") return classifyHandler(req, env);
    if (route === "POST /jobs/client-name") return clientNameHandler(req, env);
    if (route === "POST /messages/sync") return syncMessages(req, env);
    if (route === "POST /messages/suggest") return suggestReply(req, env);
    if (route === "GET /portfolios") return listPortfolios(req, env);
    if (route === "POST /portfolios") return createPortfolio(req, env);
    if (route === "POST /portfolios/update") return updatePortfolio(req, env);
    if (route === "POST /portfolios/delete") return deletePortfolio(req, env);
    if (route === "POST /portfolios/reorder") return reorderPortfolios(req, env);
    return json({ error: "Not found." }, 404);
  },
};

async function generateHandler(req: Request, env: Env): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "Server misconfigured: ANTHROPIC_API_KEY is not set." }, 500);
  }

  // Auth-gated: we record the draft against the signed-in rep (proposals.user_id) so it can be
  // reused instead of re-generated. Stub mode still works without a DB, but the rep must be signed in.
  const claims = await authUser(req, env);
  if (!claims) return json({ error: "Unauthorized" }, 401);

  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return json({ error: 'Body must be JSON, e.g. { "job_id": "..." }.' }, 400);
  }
  if (!body.job_id) return json({ error: "Missing job_id." }, 400);

  const overrides: JobOverrides = {
    screening_questions: body.screening_questions,
    client_name_hint: body.client_name_hint,
    budget: body.budget,
    type: body.type,
    experience: body.experience,
    duration: body.duration,
    skills: body.skills,
    client_context: body.client_context,
  };

  const stub = env.REFLEX_GENERATION_STUB === "true";
  const model = env.ANTHROPIC_MODEL || "claude-haiku-4-5";
  const usdToInr = Number.parseFloat(env.USD_TO_INR || "86") || 86;

  try {
    let job: JobInput;
    if (stub) {
      job = applyOverrides(STUB_JOB, overrides);
    } else {
      if (!env.DATABASE_URL) {
        return json({ error: "Server misconfigured: DATABASE_URL is not set (real mode)." }, 500);
      }

      // 0. Rebuild PORTFOLIO_INDEX from the `portfolios` table so the prompt always uses the
      //    latest list (managed from the portal). Non-fatal — on failure the last-loaded value
      //    (or the hardcoded fallback) stands, so generation never breaks.
      await loadPortfolioIndex(env.DATABASE_URL).catch((err) =>
        console.warn("[portfolio] load failed, using existing index:", err instanceof Error ? err.message : String(err)),
      );
      // 1. Match work samples first (upserts jobs.looms / jobs.image_links). Non-fatal.
      await runAssetMatch(env.DATABASE_URL, body.job_id);
      // 2. Fetch the job (now reads the freshly-matched looms/image_links) — unchanged.
      const found = await fetchJob(env.DATABASE_URL, body.job_id, overrides);
      if (!found) return json({ error: `Job not found: ${body.job_id}` }, 404);
      job = found;
    }

    const { proposal, usage } = await generate(env.ANTHROPIC_API_KEY, model, MAX_TOKENS, job);

    // The model emits two loom PLACEHOLDERS in the cover letter; substitute the real matched
    // looms (jobs.looms, top 2) here so the rep copies a letter with working links. Done before
    // persist + response so both carry the final text.
    proposal.cover_letter = fillLoomPlaceholders(proposal.cover_letter, job.looms ?? []);

    const { cost_inr } = costInr(model, usage, usdToInr);
    const tokens =
      usage.input_tokens +
      usage.output_tokens +
      usage.cache_creation_input_tokens +
      usage.cache_read_input_tokens;

    // Persist the draft so the rep can reuse it instead of regenerating. Real mode only (stub
    // has no DB row to attach to). Non-fatal: a write failure logs but still returns the proposal.
    if (!stub && env.DATABASE_URL) {
      await persistProposalDraft(
        env.DATABASE_URL,
        body.job_id,
        claims.sub,
        proposal.cover_letter,
        cost_inr,
        tokens,
        proposal.screening_answers,
        job.image_links ?? [],
        job.looms ?? [],
        proposal.portfolio_recommendations ?? [],
      ).catch((err) =>
        console.warn("[persistProposalDraft] failed:", err instanceof Error ? err.message : String(err)),
      );
    }

    return json({
      ...proposal,
      // Work-sample links for this job (from the jobs.looms / jobs.image_links columns).
      // Not part of the generated text — the UI uses them to populate the Work Samples picker.
      looms: job.looms ?? [],
      image_links: job.image_links ?? [],
      cost_inr,
      tokens,
      usage,
      model,
      stub,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Log the full error server-side so a 500 is diagnosable in the wrangler log (the client
    // only sees the message string). Includes the stack when available.
    console.error("[generate] failed:", err instanceof Error ? err.stack || err.message : String(err));
    return json({ error: `Generation failed: ${message}` }, 500);
  }
}

/**
 * Score loom_videos + knowledge_base against the job and upsert the top picks onto
 * jobs.looms / jobs.image_links. Non-fatal: a matching failure is logged but must not
 * block proposal generation (the proposal proceeds with whatever assets the job has).
 */
async function runAssetMatch(databaseUrl: string, jobId: string): Promise<void> {
  try {
    const m = await matchAssets(databaseUrl, jobId);
    console.log("[matchAssets]", jobId, m.skipped ? "skipped (already matched)" : m.debug,
      "looms:", m.looms.length, "images:", m.image_links.length);
  } catch (err) {
    console.warn("[matchAssets] failed:", err instanceof Error ? err.message : String(err));
  }
}

// POST /jobs/classify — run the GrowwStacks relevance classifier on a captured (not-yet-added)
// job. Auth-gated; no DB write here — the extension shows the result, then /jobs/add persists
// verdict/quality/reason + token_cost_inr + cache_status when the rep confirms.
async function classifyHandler(req: Request, env: Env): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "Server misconfigured: ANTHROPIC_API_KEY is not set." }, 500);
  }
  const claims = await authUser(req, env);
  if (!claims) return json({ error: "Unauthorized" }, 401);

  let job: ClassifyJob;
  try {
    job = (await req.json()) as ClassifyJob;
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }
  if (!job.title && !job.description) {
    return json({ error: "Need at least a title or description to classify." }, 400);
  }

  const model = env.ANTHROPIC_MODEL || "claude-haiku-4-5";
  const usdToInr = Number.parseFloat(env.USD_TO_INR || "86") || 86;
  try {
    const result = await classify(env.ANTHROPIC_API_KEY, model, job, usdToInr);
    console.log("[classify]", result.relevance_raw, "/", result.quality_raw,
      "->", result.verdict, "/", result.quality, "·", result.cache_status,
      "· ₹", result.cost_inr, "·", result.tokens, "tokens");
    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Classification failed: ${message}` }, 500);
  }
}

// POST /jobs/client-name — extract the client's first name from their public reviews (feedback
// past freelancers left about them) so the proposal can greet them by name. Auth-gated; no DB
// write. Empty reviews (e.g. the apply page or a brand-new client with no history) short-circuit
// to { client_name: null } with NO model call — the greeting then falls back to "Hey there".
async function clientNameHandler(req: Request, env: Env): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "Server misconfigured: ANTHROPIC_API_KEY is not set." }, 500);
  }
  const claims = await authUser(req, env);
  if (!claims) return json({ error: "Unauthorized" }, 401);

  let body: { reviews?: unknown };
  try {
    body = (await req.json()) as { reviews?: unknown };
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }

  const reviews = Array.isArray(body.reviews)
    ? body.reviews.map((r) => String(r).trim()).filter(Boolean).slice(0, 8)
    : [];
  if (reviews.length === 0) return json({ client_name: null });

  const model = env.ANTHROPIC_MODEL || "claude-haiku-4-5";
  const usdToInr = Number.parseFloat(env.USD_TO_INR || "86") || 86;
  try {
    const result = await extractClientName(env.ANTHROPIC_API_KEY, model, reviews, usdToInr);
    console.log("[clientName]", result.client_name ?? "(none)", "· ₹", result.cost_inr, "·", result.tokens, "tokens");
    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Client-name extraction failed: ${message}` }, 500);
  }
}
