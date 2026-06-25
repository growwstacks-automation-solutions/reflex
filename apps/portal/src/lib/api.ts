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
  relevance?: "all" | "relevant" | "review";
  quality?: string[]; // good | medium | watch | poor
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
}

/** A page of board jobs + the total matching count (for the pager) + scope-wide KPIs. */
export interface BoardPage {
  jobs: ApiBoardJob[];
  total: number;
  page: number;
  pageSize: number;
  stats: BoardStats;
}

export async function fetchBoard(token: string, query: BoardQuery = {}): Promise<BoardPage> {
  const p = new URLSearchParams();
  if (query.tab) p.set("tab", query.tab);
  if (query.page) p.set("page", String(query.page));
  if (query.pageSize) p.set("page_size", String(query.pageSize));
  if (query.relevance) p.set("relevance", query.relevance);
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
    stats: data.stats ?? { on_board: 0, relevant: 0, review: 0, submitted: 0 },
  };
}
