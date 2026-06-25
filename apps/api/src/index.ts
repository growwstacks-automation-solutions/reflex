import { generate } from "./generate";
import { costInr } from "./pricing";
import { STUB_JOB, applyOverrides, fetchJob, type JobInput, type JobOverrides } from "./job";
import { CORS, json } from "./http";
import { login } from "./auth";
import { board } from "./board";
import { checkJobs } from "./check";
import { addJob } from "./addJob";

export interface Env {
  // Secrets (NOT in wrangler.toml): .dev.vars locally, `wrangler secret put` in prod.
  ANTHROPIC_API_KEY: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  // Non-secret config ([vars] in wrangler.toml).
  ANTHROPIC_MODEL: string;
  USD_TO_INR: string;
  REFLEX_GENERATION_STUB: string;
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
    if (route === "POST /generate") return generateHandler(req, env);
    if (route === "POST /jobs/check") return checkJobs(req, env);
    if (route === "POST /jobs/add") return addJob(req, env);
    return json({ error: "Not found." }, 404);
  },
};

async function generateHandler(req: Request, env: Env): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "Server misconfigured: ANTHROPIC_API_KEY is not set." }, 500);
  }

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
      const found = await fetchJob(env.DATABASE_URL, body.job_id, overrides);
      if (!found) return json({ error: `Job not found: ${body.job_id}` }, 404);
      job = found;
    }

    const { proposal, usage } = await generate(env.ANTHROPIC_API_KEY, model, MAX_TOKENS, job);
    const { cost_inr } = costInr(model, usage, usdToInr);
    const tokens =
      usage.input_tokens +
      usage.output_tokens +
      usage.cache_creation_input_tokens +
      usage.cache_read_input_tokens;

    return json({ ...proposal, cost_inr, tokens, usage, model, stub });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Generation failed: ${message}` }, 500);
  }
}
