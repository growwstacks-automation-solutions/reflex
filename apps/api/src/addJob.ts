// POST /jobs/add — add a job the rep captured/edited on Upwork to Reflex, claimed by them.
// The extension sends an editable form of the job fields. The AI fields (verdict/quality/
// reason) are hardcoded defaults today but are editable in the form; taxonomy FKs need the
// taxonomy tables seeded, so they stay null for now. System fields (id, timestamps, owner)
// are set here, not by the client. Ownership is claimed race-safely via job_assignments.
import { neon } from "@neondatabase/serverless";
import { json } from "./http";
import { authUser } from "./auth";
import type { Env } from "./index";

interface AddBody {
  upwork_job_id?: string;
  title?: string;
  description?: string;
  url?: string;
  skills?: string[] | string;
  budget_text?: string;
  contract_type?: string;
  experience_level?: string;
  connects?: number | string;
  client_country?: string;
  client_city?: string;
  client_spend?: string;
  client_payment_verified?: boolean | null;
  // Structured budget / terms
  fixed_amount?: number | string;
  fixed_amount_max?: number | string;
  fixed_currency?: string;
  hourly_min?: number | string;
  hourly_max?: number | string;
  hourly_budget_type?: string;
  engagement_weeks?: number | string;
  posted_at?: string;
  // Client detail
  client_country_code?: string;
  client_timezone?: string;
  client_billing_type?: string;
  last_client_activity?: string;
  // Activity / competition
  has_bids?: boolean | null;
  bid_min_rate?: number | string;
  bid_avg_rate?: number | string;
  bid_max_rate?: number | string;
  invites_sent?: number | string;
  total_invited_to_interview?: number | string;
  total_hired?: number | string;
  total_offered?: number | string;
  total_unanswered_invites?: number | string;
  // Attachments
  attachments_count?: number | string;
  attachments_filenames?: string;
  // AI fields (editable; from /jobs/classify or the hardcoded defaults)
  verdict?: string;
  quality?: string;
  reason?: string;
  // Classification cost telemetry (from /jobs/classify; stored as-is)
  token_cost_inr?: number | string;
  cache_status?: string;
}

const VERDICTS = new Set(["relevant", "review", "irrelevant"]);
const VERDICT_SHORT: Record<string, string> = { relevant: "rel", review: "rev", irrelevant: "irr" };
const DEFAULT_REASON = "Added manually from the extension — pending classification.";

// "" -> null so we don't write empty strings; trims strings.
function s(v: unknown): string | null {
  const t = (v ?? "").toString().trim();
  return t === "" ? null : t;
}

// Typed coercers for the optional numeric/boolean/timestamp columns. Anything blank
// or unparseable becomes null so we never write garbage to a typed column.
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function int(v: unknown): number | null {
  const n = num(v);
  return n == null ? null : Math.trunc(n);
}
function bool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}
function ts(v: unknown): string | null {
  const t = s(v);
  if (!t) return null;
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

export async function addJob(req: Request, env: Env): Promise<Response> {
  if (!env.DATABASE_URL) return json({ error: "Server misconfigured: DATABASE_URL is not set." }, 500);

  const claims = await authUser(req, env);
  if (!claims) return json({ error: "Unauthorized" }, 401);

  let body: AddBody;
  try {
    body = (await req.json()) as AddBody;
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }

  const upworkId = s(body.upwork_job_id);
  const title = s(body.title);
  if (!upworkId) return json({ error: "Missing upwork_job_id." }, 400);
  if (!title) return json({ error: "Missing title." }, 400);

  // Normalize the editable fields.
  const skills = Array.isArray(body.skills)
    ? body.skills.map((x) => String(x).trim()).filter(Boolean)
    : typeof body.skills === "string" && body.skills.trim()
      ? body.skills.split(",").map((x) => x.trim()).filter(Boolean)
      : null;
  const connectsNum =
    body.connects != null && body.connects !== "" ? Math.trunc(Number(body.connects)) : NaN;
  const connects = Number.isFinite(connectsNum) ? connectsNum : null;
  const paymentVerified =
    typeof body.client_payment_verified === "boolean" ? body.client_payment_verified : null;
  const verdict = VERDICTS.has(String(body.verdict)) ? String(body.verdict) : "review";
  const quality = s(body.quality) || "medium";
  const reason = s(body.reason) || DEFAULT_REASON;

  const sql = neon(env.DATABASE_URL);

  // Who is adding (ownership + the denormalized display name).
  const users = (await sql`
    select id, full_name from users where id = ${claims.sub} limit 1
  `) as Array<{ id: string; full_name: string }>;
  const user = users[0];
  if (!user) return json({ error: "Unknown user." }, 401);

  // Insert when new; if the job already exists keep its (possibly classified) data.
  const existing = (await sql`
    select id from jobs where upwork_job_id = ${upworkId} limit 1
  `) as Array<{ id: string }>;

  let jobId: string;
  if (existing.length) {
    jobId = existing[0].id;
  } else {
    const inserted = (await sql`
      insert into jobs (
        upwork_job_id, title, description, url, skills, budget_text, contract_type,
        experience_level, connects, client_country, client_city, client_spend,
        client_payment_verified, verdict, quality, reason,
        fixed_amount, fixed_amount_max, fixed_currency, hourly_min, hourly_max, hourly_budget_type,
        engagement_weeks, posted_at, client_country_code, client_timezone, client_billing_type,
        last_client_activity, has_bids, bid_min_rate, bid_avg_rate, bid_max_rate, invites_sent,
        total_invited_to_interview, total_hired, total_offered, total_unanswered_invites,
        attachments_count, attachments_filenames, token_cost_inr, cache_status,
        ingested_at, created_at
      ) values (
        ${upworkId}, ${title}, ${s(body.description)}, ${s(body.url)}, ${skills}::text[],
        ${s(body.budget_text)}, ${s(body.contract_type)}, ${s(body.experience_level)},
        ${connects}, ${s(body.client_country)}, ${s(body.client_city)}, ${s(body.client_spend)},
        ${paymentVerified}, ${verdict}::job_verdict, ${quality}, ${reason},
        ${num(body.fixed_amount)}, ${num(body.fixed_amount_max)}, ${s(body.fixed_currency)},
        ${num(body.hourly_min)}, ${num(body.hourly_max)}, ${s(body.hourly_budget_type)},
        ${int(body.engagement_weeks)}, ${ts(body.posted_at)}::timestamptz, ${s(body.client_country_code)},
        ${s(body.client_timezone)}, ${s(body.client_billing_type)}, ${ts(body.last_client_activity)}::timestamptz,
        ${bool(body.has_bids)}, ${num(body.bid_min_rate)}, ${num(body.bid_avg_rate)}, ${num(body.bid_max_rate)},
        ${int(body.invites_sent)}, ${int(body.total_invited_to_interview)}, ${int(body.total_hired)},
        ${int(body.total_offered)}, ${int(body.total_unanswered_invites)}, ${int(body.attachments_count)},
        ${s(body.attachments_filenames)}, ${num(body.token_cost_inr)}, ${s(body.cache_status)},
        now(), now()
      )
      returning id
    `) as Array<{ id: string }>;
    jobId = inserted[0].id;
  }

  // Claim for the signed-in rep — race-safe via the partial unique index
  // one_live_assignment_per_job (job_id WHERE released_at IS NULL).
  await sql`
    insert into job_assignments (job_id, user_id)
    values (${jobId}, ${user.id})
    on conflict do nothing
  `;

  const owners = (await sql`
    select u.id, u.full_name
    from job_assignments ja
    join users u on u.id = ja.user_id
    where ja.job_id = ${jobId} and ja.released_at is null
    limit 1
  `) as Array<{ id: string; full_name: string }>;
  const liveOwner = owners[0];
  const mine = !!liveOwner && liveOwner.id === user.id;

  if (mine) {
    await sql`update jobs set picked_by_name = ${user.full_name} where id = ${jobId}`;
  }

  // Same shape the extension's CHECK_JOBS strips already understand.
  const status = {
    connected: true,
    inReflex: true,
    verdict: VERDICT_SHORT[verdict] || "rev",
    quality,
    chips: "",
    ownership: mine ? "mine" : "other",
    owner: liveOwner ? liveOwner.full_name : undefined,
    actioned: "none",
  };
  return json({ ok: true, jobId, existed: existing.length > 0, status }, 200);
}
