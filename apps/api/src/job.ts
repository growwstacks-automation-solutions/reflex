import { neon } from "@neondatabase/serverless";

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
