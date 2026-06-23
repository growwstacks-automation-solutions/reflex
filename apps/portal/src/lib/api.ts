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
  posted_at: string | null;
  reason: string | null;
  proposal_status: string | null;
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

export async function fetchBoard(token: string): Promise<ApiBoardJob[]> {
  const res = await fetch(`${BASE}/board`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new UnauthorizedError("Session expired — please sign in again.");
  const data = (await res.json().catch(() => ({}))) as { jobs?: ApiBoardJob[]; error?: string };
  if (!res.ok) throw new Error(data.error || `Couldn't load the board (${res.status})`);
  return data.jobs || [];
}
