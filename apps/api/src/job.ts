import { neon } from "@neondatabase/serverless";
import type { Env, JobData } from "./types";

// A realistic stub so the prompt can be tested before Neon is live.
// Shape matches JobData exactly (the columns from 0000 + 0001).
export const STUB_JOB: JobData = {
  upwork_job_id: "STUB-0001",
  title: "Build a GoHighLevel automation for lead nurture",
  description:
    "We're a real-estate team and need a GoHighLevel setup that captures leads from our web forms, runs a multi-step email + SMS nurture sequence, moves leads through pipeline stages automatically, and ties in calendar booking so follow-up never slips. Clear budget, hiring now. Please share a relevant example.",
  budget_text: "$1.5k–3k",
  connects: 4,
  client_country: "United States",
  client_spend: "$80K+",
  client_payment_verified: true,
  experience_level: "Intermediate",
  skills: ["GoHighLevel", "Marketing Automation", "Lead Generation"],
  verdict: "relevant",
  reason: "Strong match: GHL + automation, our core service. Clear budget, client hiring now.",
  quality: "good",
  tool: "GoHighLevel",
  use_case: "Lead nurture",
  department: "Marketing",
  industry: "Real estate",
};

// Load a real job from Neon by Upwork id (or internal uuid), resolving the four
// taxonomy FKs to their names. Read-only; column names mirror the migrations.
export async function loadJob(env: Env, jobId: string): Promise<JobData | null> {
  const sql = neon(env.DATABASE_URL);
  const rows = (await sql`
    select
      j.upwork_job_id,
      j.title,
      j.description,
      j.budget_text,
      j.connects,
      j.client_country,
      j.client_spend,
      j.client_payment_verified,
      j.experience_level,
      j.skills,
      j.verdict::text          as verdict,
      j.reason,
      j.quality,
      t.name                   as tool,
      uc.name                  as use_case,
      d.name                   as department,
      ind.name                 as industry
    from jobs j
    left join tools       t   on t.id   = j.tool_id
    left join use_cases   uc  on uc.id  = j.use_case_id
    left join departments d   on d.id   = j.department_id
    left join industries  ind on ind.id = j.industry_id
    where j.upwork_job_id = ${jobId} or j.id::text = ${jobId}
    limit 1
  `) as JobData[];

  return rows[0] ?? null;

/** Everything the prompt's dynamic block needs about one job. */
export interface JobInput {
  title: string;
  description: string;
  budget?: string;
  type?: string;
  experience?: string;
  duration?: string;
  skills?: string;
  client_context?: string;
  /** AI-suggested client first name (confirmable, never fabricated). Empty = none. */
  client_name_hint?: string;
  screening_questions: string[];
}

/** Optional page-captured fields the caller (extension) may pass to enrich a job. */
export interface JobOverrides {
  screening_questions?: string[];
  client_name_hint?: string;
  budget?: string;
  type?: string;
  experience?: string;
  duration?: string;
  skills?: string;
  client_context?: string;
}

/** Hardcoded sample used when REFLEX_GENERATION_STUB === "true" (proves the Claude call, no DB). */
export const STUB_JOB: JobInput = {
  title: "Build a Claude-powered product recommendation API",
  description:
    "We run a mid-size e-commerce store and want a small API that takes a shopper's recent " +
    "activity and returns 3-5 product recommendations using Claude. Needs to be fast, " +
    "well-documented, and easy for our existing Node backend to call. Bonus if you can show a " +
    "working demo. We've tried rules-based recommendations and they underperform.",
  budget: "$2,000 fixed",
  type: "Fixed-price",
  experience: "Expert",
  duration: "1 to 3 months",
  skills: "Anthropic Claude, Node.js, REST APIs, recommendation systems",
  client_context: "United States · $50k+ spent · 4.9 rating · payment verified · 80% hire rate",
  client_name_hint: "",
  screening_questions: [
    "Have you built recommendation or matching systems with LLMs before? Describe one.",
    "How would you keep per-request latency low while calling Claude on every request?",
  ],
};

/** Apply caller-supplied overrides onto a job (used in both stub and real mode). */
export function applyOverrides(job: JobInput, o: JobOverrides): JobInput {
  return {
    ...job,
    budget: o.budget ?? job.budget,
    type: o.type ?? job.type,
    experience: o.experience ?? job.experience,
    duration: o.duration ?? job.duration,
    skills: o.skills ?? job.skills,
    client_context: o.client_context ?? job.client_context,
    client_name_hint: o.client_name_hint ?? job.client_name_hint,
    screening_questions:
      o.screening_questions && o.screening_questions.length > 0
        ? o.screening_questions
        : job.screening_questions,
  };
}

/**
 * Real mode: look the job up in Neon by Upwork id (idempotency key) or internal uuid.
 * Screening questions / client-name hint are NOT in the schema — they come from `overrides`
 * (captured by the extension on the job page). Returns null if no row matches.
 */
export async function fetchJob(
  databaseUrl: string,
  jobId: string,
  overrides: JobOverrides,
): Promise<JobInput | null> {
  const sql = neon(databaseUrl);
  const rows = (await sql`
    select title, description, budget_text, client_country, client_spend
    from jobs
    where upwork_job_id = ${jobId} or id::text = ${jobId}
    limit 1
  `) as Array<Record<string, unknown>>;
  if (rows.length === 0) return null;

  const r = rows[0];
  const country = (r.client_country as string) ?? "";
  const spend = (r.client_spend as string) ?? "";
  const clientContext = [country, spend].filter(Boolean).join(" · ");

  const base: JobInput = {
    title: (r.title as string) ?? "",
    description: (r.description as string) ?? "",
    budget: (r.budget_text as string) ?? undefined,
    client_context: clientContext || undefined,
    screening_questions: [],
  };
  return applyOverrides(base, overrides);
}
