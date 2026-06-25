// Shared types for the Reflex generation Worker.

export interface Env {
  // secrets (from .dev.vars locally / wrangler secret put in prod)
  ANTHROPIC_API_KEY: string;
  DATABASE_URL: string;
  // non-secret vars (from wrangler.toml [vars])
  ANTHROPIC_MODEL: string;
  USD_TO_INR: string;
  REFLEX_GENERATION_STUB: string;
}

// A job as the Worker reads it — column names mirror the LIVE jobs table
// (Airtable/n8n-derived). Taxonomy FKs are resolved to names via job.ts joins.
export interface JobData {
  upwork_job_id: string;
  title: string;
  description: string;
  budget_text: string | null;
  connects: number | null;
  client_country: string | null;
  client_spend: string | null;
  client_payment_verified: boolean | null;
  experience_level: string | null;
  skills: string[] | null;
  verdict: string | null;       // job_verdict enum: relevant | review | irrelevant
  reason: string | null;        // the "why this job" line (real column)
  quality: string | null;       // good | medium | poor (TEXT in the real DB, not an enum)
  tool: string | null;          // tools.name
  use_case: string | null;      // use_cases.name
  department: string | null;    // departments.name
  industry: string | null;      // industries.name
}

// What the extension/portal POSTs. screening_questions + client_name are
// captured on the Upwork page (not stored in jobs), so they come in the body.
export interface GenerateRequest {
  job_id: string;
  screening_questions?: string[];
  client_name?: string | null;
}

// Anthropic usage block (cache fields present only when caching is active).
export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface ScreeningAnswer {
  question: string;
  answer: string;
}

export interface PortfolioRec {
  title: string;
  reason: string;
  where?: string;
}

export interface GenerateResult {
  cover_letter: string;
  screening_answers: ScreeningAnswer[];
  portfolio_recommendations: PortfolioRec[];
  client_name_used: string | null;
  cost_inr: number;
  usage: Usage;
  stub: boolean;  // true = the stub job was used (DB not queried)
}
