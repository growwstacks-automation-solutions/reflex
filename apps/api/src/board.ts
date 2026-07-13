// GET /board — the board scoped to who's asking, with server-side paging/filter/sort.
//
// Scope (decided 2026-06-25):
//   • rep   → jobs they currently own  +  jobs nobody currently owns (available).
//             They do NOT see other reps' in-progress jobs.
//   • admin → every job, regardless of owner.
// Ownership is computed PER ROW relative to the requester (is_mine / is_available /
// owner_name) from the single live assignment (released_at IS NULL — at most one per
// job by the partial unique index one_live_assignment_per_job). A job with no live
// owner is "available".
//
// Paging (added 2026-06-25): the dataset is 1000+ rows, so the tab/relevance/quality
// filters, search, sort, and LIMIT/OFFSET all run in Postgres now (they used to run in
// the browser over the whole payload). Response: { jobs, total, page, page_size }.
//
// Built with the neon http function's ordinary-call form sql(text, params) — the parameterized
// (non-template) form — so the WHERE/ORDER clauses can be composed dynamically while every value
// stays bound ($1…). (NB: it's sql(text, params), NOT sql.query(...); the http client has no
// .query method in @neondatabase/serverless 0.10.x — that lives on Pool/Client only.)
// board_for_user() stays rejected: it lacks the post-0001 columns and the per-requester
// scope, and widening it would be a schema change.
import { neon } from "@neondatabase/serverless";
import { json } from "./http";
import { authUser } from "./auth";
import type { Env } from "./index";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

// Whitelist of sortable columns → SQL expression. Never interpolate a raw client string
// into ORDER BY; we only ever emit one of these fixed expressions.
const SORT_COLUMNS: Record<string, string> = {
  posted: "j.posted_at",
  created: "j.created_at",
  budget: "coalesce(j.fixed_amount, j.hourly_max, j.hourly_min, 0)",
  connects: "j.connects",
};

// is_mine compares the live owner to the requester. $N is wherever the user id is bound
// (always $1 here, but kept as a placeholder for clarity).
const selectCols = (userP: string) => `
  j.upwork_job_id, j.title, j.verdict, j.quality, j.budget_text,
  j.contract_type, j.fixed_amount, j.hourly_min, j.hourly_max,
  j.client_country, j.client_country_code, j.connects, j.connect_spent,
  j.posted_at, j.created_at, j.reason, j.proposal_status,
  j.description, j.url, j.client_spend, j.client_city, j.client_timezone,
  j.client_billing_type, j.client_payment_verified, j.last_client_activity,
  (a.user_id = ${userP}) as is_mine,
  (a.user_id is null) as is_available,
  owner.full_name as owner_name`;

const FROM_JOINS = `
  from jobs j
  left join job_assignments a on a.job_id = j.id and a.released_at is null
  left join users owner on owner.id = a.user_id`;

function clampInt(raw: string | null, def: number, min: number, max: number): number {
  const n = raw == null ? NaN : parseInt(raw, 10);
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
}

// Accept only a plain YYYY-MM-DD date; anything else → null (the value is bound as a param, but
// we keep the input clean and predictable).
function validDate(raw: string | null): string | null {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export async function board(req: Request, env: Env): Promise<Response> {
  if (!env.JWT_SECRET) return json({ error: "Server misconfigured: JWT_SECRET is not set." }, 500);
  if (!env.DATABASE_URL) return json({ error: "Server misconfigured: DATABASE_URL is not set." }, 500);

  const user = await authUser(req, env);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const q = url.searchParams;
  const isAdmin = user.role === "admin";

  // ── Parse + validate query params ──────────────────────────────────────────
  const page = clampInt(q.get("page"), 1, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = clampInt(q.get("page_size"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const tab = (q.get("tab") || "all").toLowerCase(); // mine | available | all
  const relevance = (q.get("relevance") || "all").toLowerCase(); // all | relevant | review
  const quality = q.getAll("quality").map((s) => s.toLowerCase()).filter(Boolean); // good|medium|watch|poor
  const search = (q.get("search") || "").trim();
  // Date range over the Created date (jobs.created_at). Values are YYYY-MM-DD (inclusive both ends).
  const dateFrom = validDate(q.get("from"));
  const dateTo = validDate(q.get("to"));
  const sortKey = (q.get("sort") || "posted").toLowerCase();
  const dir = (q.get("dir") || "desc").toLowerCase() === "asc" ? "asc" : "desc";

  const sortExpr = SORT_COLUMNS[sortKey] || SORT_COLUMNS.posted;

  // ── Build the WHERE clause + its bound params ──────────────────────────────
  // CRITICAL: each query must be given EXACTLY the params its text references by $N.
  // A query string with no $N must get an empty params array, or Postgres rejects it
  // ("bind message supplies N parameters, but prepared statement requires 0"). The user
  // id is therefore pushed into `params` ONLY when a clause actually references it — which
  // is why admin-on-the-"all"-tab (no WHERE) ends up with an empty params array.
  const params: unknown[] = [];
  const where: string[] = [];
  // Lazily bind the user id and return its $N (memoized so repeated uses share one bind).
  let userPlaceholder: string | null = null;
  const userP = (): string => {
    if (userPlaceholder === null) {
      params.push(user.sub);
      userPlaceholder = `$${params.length}`;
    }
    return userPlaceholder;
  };

  // Role/tab scope.
  if (!isAdmin) {
    // Rep base scope: own OR unowned.
    where.push(`(a.user_id = ${userP()} or a.user_id is null)`);
  }
  if (tab === "mine") {
    where.push(`a.user_id = ${userP()}`);
  } else if (tab === "available") {
    where.push(`a.user_id is null`);
  }
  // tab === "all" → no extra ownership filter (within the role scope above).

  // Relevance (the "All" tab still shows irrelevant; the specific filters narrow it).
  if (relevance === "relevant") {
    where.push(`j.verdict = 'relevant'`);
  } else if (relevance === "review") {
    // 'review' plus the legacy 'needs_review' rows + un-classified NULLs read as "needs review".
    where.push(`(j.verdict = 'review' or j.verdict = 'needs_review' or j.verdict is null)`);
  } else if (relevance === "irrelevant") {
    where.push(`j.verdict = 'irrelevant'`);
  }

  // Quality (multi-select).
  if (quality.length) {
    params.push(quality);
    where.push(`lower(j.quality) = any($${params.length})`);
  }

  // Free-text search over title + description.
  if (search) {
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    where.push(`(j.title ilike ${p} or j.description ilike ${p})`);
  }

  // Date range over jobs.created_at (inclusive). `to` covers the whole day.
  if (dateFrom) {
    params.push(dateFrom);
    where.push(`j.created_at >= $${params.length}::date`);
  }
  if (dateTo) {
    params.push(dateTo);
    where.push(`j.created_at < ($${params.length}::date + interval '1 day')`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const sql = neon(env.DATABASE_URL);

  // ── Total (for page count) — references only the WHERE params built above ──
  const countRows = (await sql(
    `select count(*)::int as total ${FROM_JOINS} ${whereSql}`,
    [...params],
  )) as Array<{ total: number }>;
  const total = countRows[0]?.total ?? 0;

  // ── The page itself — selectCols also needs the user id, so ensure it's bound ──
  const isMineP = userP(); // binds $N if not already bound (e.g. admin/all had none)
  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);
  const limitP = `$${params.length - 1}`;
  const offsetP = `$${params.length}`;

  const rows = (await sql(
    `select ${selectCols(isMineP)}
     ${FROM_JOINS}
     ${whereSql}
     order by ${sortExpr} ${dir} nulls last, j.upwork_job_id ${dir}
     limit ${limitP} offset ${offsetP}`,
    params,
  )) as Array<Record<string, unknown>>;

  // KPI counts over the *role/tab scope* (NOT the current filters/page) so the strip is
  // stable while the rep narrows by relevance/quality. Reuses only $1 (the user id) plus
  // the role/tab WHERE — the relevance/quality/search/limit params are excluded here.
  // Built with the same lazy-binding discipline as the main query so the date range can be applied
  // to the KPI counts too (the strip reflects the selected range). Each $N is bound only when used.
  const statsParams: unknown[] = [];
  const statsWhere: string[] = [];
  let sUserPlaceholder: string | null = null;
  const sUserP = (): string => {
    if (sUserPlaceholder === null) {
      statsParams.push(user.sub);
      sUserPlaceholder = `$${statsParams.length}`;
    }
    return sUserPlaceholder;
  };
  if (!isAdmin) statsWhere.push(`(a.user_id = ${sUserP()} or a.user_id is null)`);
  if (tab === "mine") statsWhere.push(`a.user_id = ${sUserP()}`);
  else if (tab === "available") statsWhere.push(`a.user_id is null`);
  if (dateFrom) {
    statsParams.push(dateFrom);
    statsWhere.push(`j.created_at >= $${statsParams.length}::date`);
  }
  if (dateTo) {
    statsParams.push(dateTo);
    statsWhere.push(`j.created_at < ($${statsParams.length}::date + interval '1 day')`);
  }
  const statsWhereSql = statsWhere.length ? `where ${statsWhere.join(" and ")}` : "";

  const statsRows = (await sql(
    `select
       count(*)::int as on_board,
       count(*) filter (where j.verdict = 'relevant')::int as relevant,
       count(*) filter (where j.verdict in ('review','needs_review') or j.verdict is null)::int as review,
       count(*) filter (where j.proposal_status = 'Submitted')::int as submitted,
       coalesce(sum(j.connect_spent), 0)::int as connect_spent
     ${FROM_JOINS} ${statsWhereSql}`,
    statsParams,
  )) as Array<{ on_board: number; relevant: number; review: number; submitted: number; connect_spent: number }>;
  const stats = statsRows[0] ?? { on_board: 0, relevant: 0, review: 0, submitted: 0, connect_spent: 0 };

  return json({ jobs: rows, total, page, page_size: pageSize, stats });
}
