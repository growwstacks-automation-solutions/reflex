/**
 * Thin client for the Reflex Worker API.
 * Base URL from VITE_API_BASE_URL (non-secret frontend config), default localhost:8787.
 * The portal holds only the JWT returned by login — never the Worker's secrets.
 */
const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

export interface ApiUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface LoginResult {
  token: string;
  user: ApiUser;
}

/** A board row exactly as GET /board returns it (snake_case). Numerics may arrive as strings. */
export interface ApiBoardJob {
  upwork_job_id: string;
  title: string;
  verdict: string;
  quality: string;
  budget_text: string | null;
  contract_type: string | null;
  fixed_amount: number | string | null;
  hourly_min: number | string | null;
  hourly_max: number | string | null;
  client_country: string | null;
  client_country_code: string | null;
  connects: number | string | null;
  connect_spent: number | string | null; // connects spent on the submitted proposal
  posted_at: string | null; // when the job was posted on Upwork
  created_at: string | null; // when the row was created in our DB
  reason: string | null;
  proposal_status: string | null;
  // ownership relative to the requesting user (computed server-side from the live assignment)
  is_mine: boolean | null;
  is_available: boolean | null;
  owner_name: string | null;
  // detail-panel fields (Option A) — used by the slide-in JobDetailPeek, not the list rows
  description: string | null;
  url: string | null;
  client_spend: string | null;
  client_city: string | null;
  client_timezone: string | null;
  client_billing_type: string | null;
  client_payment_verified: boolean | null;
  last_client_activity: string | null;
}

/** Thrown on a 401 from a protected endpoint so the app can boot the user back to login. */
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<LoginResult> & { error?: string };
  if (!res.ok) throw new Error(data.error || `Login failed (${res.status})`);
  return data as LoginResult;
}

/** Server-side board query params. All filtering/sorting/paging now runs in Postgres. */
export interface BoardQuery {
  tab?: "mine" | "available" | "all";
  page?: number;
  pageSize?: number;
  relevance?: "all" | "relevant" | "review" | "irrelevant";
  quality?: string[]; // good | medium | watch | poor
  from?: string | null; // created_at range start (YYYY-MM-DD, inclusive)
  to?: string | null; // created_at range end (YYYY-MM-DD, inclusive)
  search?: string;
  sort?: "posted" | "created" | "budget" | "connects";
  dir?: "asc" | "desc";
}

/** Board KPI counts over the role/tab scope (not the current filters/page). */
export interface BoardStats {
  on_board: number;
  relevant: number;
  review: number;
  submitted: number;
  connect_spent?: number; // sum of jobs.connect_spent over the scope (Worker stats must return it)
}

/** A page of board jobs + the total matching count (for the pager) + scope-wide KPIs. */
export interface BoardPage {
  jobs: ApiBoardJob[];
  total: number;
  page: number;
  pageSize: number;
  stats: BoardStats;
}

/** An assignable rep, for the admin's row-action picker. */
export interface Rep {
  id: string;
  full_name: string;
  role: string;
}

/** GET /reps — active reps (admin-only). */
export async function fetchReps(token: string): Promise<Rep[]> {
  const res = await fetch(`${BASE}/reps`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new UnauthorizedError("Session expired — please sign in again.");
  const data = (await res.json().catch(() => ({}))) as { reps?: Rep[]; error?: string };
  if (!res.ok) throw new Error(data.error || `Couldn't load reps (${res.status})`);
  return data.reps || [];
}

/** POST /jobs/assign — (re)assign a job to a rep (admin-only). Returns the new owner name. */
export async function assignJobToRep(
  token: string,
  upworkJobId: string,
  userId: string,
): Promise<{ ok: boolean; owner_name: string | null }> {
  const res = await fetch(`${BASE}/jobs/assign`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ upwork_job_id: upworkJobId, user_id: userId }),
  });
  if (res.status === 401) throw new UnauthorizedError("Session expired — please sign in again.");
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; owner_name?: string | null; error?: string };
  if (!res.ok) throw new Error(data.error || `Assignment failed (${res.status})`);
  return { ok: !!data.ok, owner_name: data.owner_name ?? null };
}

/** One screening Q&A as the model returns it. */
export interface ApiScreeningAnswer {
  question: string;
  answer: string;
}

/** A portfolio item the model recommends attaching. */
export interface ApiPortfolioPick {
  title: string;
  page: number;
  position: number;
  why: string;
}

/** POST /generate response — the AI proposal + this job's work-sample links + cost. */
export interface GenerateResult {
  cover_letter: string;
  screening_answers: ApiScreeningAnswer[];
  portfolio_recommendations: ApiPortfolioPick[];
  client_name_used: string | null;
  // work-sample links pulled from jobs.looms / jobs.image_links (arrays)
  looms: string[];
  image_links: string[];
  cost_inr: number;
  tokens: number;
  model: string;
  stub: boolean;
}

/** Optional page-captured fields the caller may pass to enrich generation. */
export interface GenerateOptions {
  screening_questions?: string[];
  client_name_hint?: string;
}

/**
 * POST /generate — generate a real proposal for a job via the Worker (Claude Haiku).
 * `jobId` is the Upwork job id (== Job.id in the portal); screening questions, if known,
 * are passed so the model answers them in the same thread.
 */
export async function generateProposal(
  token: string,
  jobId: string,
  opts: GenerateOptions = {},
): Promise<GenerateResult> {
  const res = await fetch(`${BASE}/generate`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ job_id: jobId, ...opts }),
  });
  if (res.status === 401) throw new UnauthorizedError("Session expired — please sign in again.");
  const data = (await res.json().catch(() => ({}))) as Partial<GenerateResult> & { error?: string };
  if (!res.ok) throw new Error(data.error || `Couldn't generate the proposal (${res.status})`);
  return {
    cover_letter: data.cover_letter ?? "",
    screening_answers: data.screening_answers ?? [],
    portfolio_recommendations: data.portfolio_recommendations ?? [],
    client_name_used: data.client_name_used ?? null,
    looms: data.looms ?? [],
    image_links: data.image_links ?? [],
    cost_inr: data.cost_inr ?? 0,
    tokens: data.tokens ?? 0,
    model: data.model ?? "",
    stub: data.stub ?? false,
  };
}

/** Per-job status from the already-deployed POST /jobs/check (reads jobs.picked_by_name etc.). */
export interface JobCheckStatus {
  owner?: string; // jobs.picked_by_name — the assignee's first name
  ownership: "mine" | "other" | "available";
  actioned: "none" | "generated" | "submitted";
  drafted: boolean;
  submitted: boolean;
}

/**
 * POST /jobs/check — batch status for the given Upwork job ids. Read-only, no auth required, and
 * already live on the deployed Worker, so the board can enrich its rows (assignee + pipeline
 * status from the denormalized jobs.picked_by_name / proposal state) with no Worker change.
 */
export async function checkJobs(jobIds: string[]): Promise<Record<string, JobCheckStatus>> {
  if (!jobIds.length) return {};
  const res = await fetch(`${BASE}/jobs/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobIds }),
  });
  const data = (await res.json().catch(() => ({}))) as { statuses?: Record<string, JobCheckStatus>; error?: string };
  if (!res.ok) throw new Error(data.error || `Couldn't check jobs (${res.status})`);
  return data.statuses || {};
}

export async function fetchBoard(token: string, query: BoardQuery = {}): Promise<BoardPage> {
  const p = new URLSearchParams();
  if (query.tab) p.set("tab", query.tab);
  if (query.page) p.set("page", String(query.page));
  if (query.pageSize) p.set("page_size", String(query.pageSize));
  if (query.relevance) p.set("relevance", query.relevance);
  if (query.from) p.set("from", query.from);
  if (query.to) p.set("to", query.to);
  if (query.search) p.set("search", query.search);
  if (query.sort) p.set("sort", query.sort);
  if (query.dir) p.set("dir", query.dir);
  for (const qv of query.quality || []) p.append("quality", qv);

  const qs = p.toString();
  const res = await fetch(`${BASE}/board${qs ? `?${qs}` : ""}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new UnauthorizedError("Session expired — please sign in again.");
  const data = (await res.json().catch(() => ({}))) as {
    jobs?: ApiBoardJob[];
    total?: number;
    page?: number;
    page_size?: number;
    stats?: BoardStats;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || `Couldn't load the board (${res.status})`);
  return {
    jobs: data.jobs || [],
    total: data.total ?? (data.jobs?.length || 0),
    page: data.page ?? query.page ?? 1,
    pageSize: data.page_size ?? query.pageSize ?? 50,
    stats: data.stats ?? { on_board: 0, relevant: 0, review: 0, submitted: 0, connect_spent: 0 },
  };
}
