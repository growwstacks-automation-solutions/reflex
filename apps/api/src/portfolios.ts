// Portfolio management endpoints (portal "Portfolio" tab), backed by the live `portfolios` table:
//   GET  /portfolios          → list all rows (page_number ASC, position ASC). Any signed-in user.
//   POST /portfolios          → create a row (cascade insert).        (editors only)
//   POST /portfolios/update   → edit a row (title/tools + optional move). (editors only)
//   POST /portfolios/delete   → delete a row (compacts pages).        (editors only)
//   POST /portfolios/reorder  → drag-drop reorder ({ order: id[] }).  (editors only)
//
// PAGING MODEL: the portfolio is one ordered list (page_number ASC, position ASC). Pages are
// FIXED chunks of 10 — position 1..10 within a page — mirroring Upwork's profile-highlights
// pages. Every mutation re-sequences the whole list into chunks of 10, so a page always holds 10
// (except the last): inserting into a full page pushes its last item to the top of the next page,
// cascading down; deleting pulls the following items up. `resequence()` is the single source of
// truth for (page_number, position).
//
// The live table's `id` is an INTEGER serial (not a uuid). The four content columns are the source
// of the prompt's PORTFOLIO_INDEX; after every mutation loadPortfolioIndex() rebuilds the in-memory
// index. Write access is limited to editors (Manish + Sarthak); everyone else is view-only.
import { neon } from "@neondatabase/serverless";
import { json } from "./http";
import { authUser, type AuthClaims } from "./auth";
import { loadPortfolioIndex } from "./portfolio";
import type { Env } from "./index";

const PER_PAGE = 10;

// First names allowed to create/edit/delete portfolio items (matched against users.full_name,
// case-insensitive). Everyone else can only view. Adjust this list to change who can manage.
const EDITORS = ["manish", "sarthak"];

interface PortfolioBody {
  id?: number | string;
  portfolio_title?: string;
  tools_used?: string;
  page_number?: number | string;
  position?: number | string;
  order?: Array<number | string>;
}

/** True if the signed-in user is allowed to write (their full_name's first name is an EDITOR). */
async function canEdit(env: Env, claims: AuthClaims): Promise<boolean> {
  const sql = neon(env.DATABASE_URL);
  const rows = (await sql`
    select full_name from users where id = ${claims.sub} limit 1
  `) as Array<{ full_name: string }>;
  const first = (rows[0]?.full_name ?? "").trim().toLowerCase().split(/\s+/)[0];
  return EDITORS.includes(first);
}

/** Rebuild the in-memory index from the DB. Non-fatal: a reindex failure is logged, the write stands. */
async function reindex(env: Env): Promise<void> {
  try {
    await loadPortfolioIndex(env.DATABASE_URL);
  } catch (err) {
    console.warn("[portfolios] reindex failed:", err instanceof Error ? err.message : String(err));
  }
}

/** Fetch every portfolio row, ordered for both the table view and the index. */
async function listRows(env: Env) {
  const sql = neon(env.DATABASE_URL);
  return (await sql`
    select id, portfolio_title, tools_used, page_number, position
    from portfolios
    order by page_number, position
  `) as Array<{ id: number; portfolio_title: string; tools_used: string; page_number: number; position: number }>;
}

/** The current global order of ids (page_number ASC, position ASC). */
async function orderedIds(env: Env): Promise<number[]> {
  const sql = neon(env.DATABASE_URL);
  const rows = (await sql`select id from portfolios order by page_number, position`) as Array<{ id: number }>;
  return rows.map((r) => Number(r.id));
}

/**
 * Rewrite (page_number, position) for the whole table from a flat ordered id list, as chunks of
 * PER_PAGE. One statement (UPDATE ... FROM VALUES) — safe here because there's no unique index on
 * (page_number, position) (verified: only the PK on id).
 */
async function resequence(env: Env, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const sql = neon(env.DATABASE_URL);
  const tuples: string[] = [];
  const params: number[] = [];
  ids.forEach((id, i) => {
    const pg = Math.floor(i / PER_PAGE) + 1;
    const pos = (i % PER_PAGE) + 1;
    const b = params.length;
    tuples.push(`($${b + 1}::int, $${b + 2}::int, $${b + 3}::int)`);
    params.push(id, pg, pos);
  });
  const text =
    `update portfolios as p set page_number = v.pg, position = v.pos, updated_at = now() ` +
    `from (values ${tuples.join(", ")}) as v(id, pg, pos) where p.id = v.id`;
  // Ordinary-call (parameterized, non-template) form — the signature the neon http client supports.
  await (sql as unknown as (t: string, p: unknown[]) => Promise<unknown>)(text, params);
}

/** Validate + normalize the four required fields. Returns an error string or the clean values. */
function validate(body: PortfolioBody): { error: string } | {
  portfolio_title: string;
  tools_used: string;
  page_number: number;
  position: number;
} {
  const portfolio_title = (body.portfolio_title ?? "").toString().trim();
  const tools_used = (body.tools_used ?? "").toString().trim();
  const page_number = Number(body.page_number);
  const position = Number(body.position);

  if (!portfolio_title) return { error: "Portfolio Title is required." };
  if (!tools_used) return { error: "Tools Used is required." };
  if (!Number.isInteger(page_number) || page_number < 1) return { error: "Page Number must be a whole number ≥ 1." };
  if (!Number.isInteger(position) || position < 1) return { error: "Position must be a whole number ≥ 1." };

  return { portfolio_title, tools_used, page_number, position };
}

/** Parse the row id from a body: the live table uses an integer serial id. */
function parseId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Global (0-based) list index for a target page/position slot. */
function slotIndex(page: number, position: number): number {
  return (page - 1) * PER_PAGE + (position - 1);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function guard(env: Env): Response | null {
  if (!env.JWT_SECRET) return json({ error: "Server misconfigured: JWT_SECRET is not set." }, 500);
  if (!env.DATABASE_URL) return json({ error: "Server misconfigured: DATABASE_URL is not set." }, 500);
  return null;
}

/** Auth + (optional) editor gate. Returns the claims to proceed, or a Response to short-circuit. */
async function authorize(req: Request, env: Env, requireEditor: boolean): Promise<AuthClaims | Response> {
  const bad = guard(env);
  if (bad) return bad;
  const user = await authUser(req, env);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (requireEditor && !(await canEdit(env, user))) {
    return json({ error: "You don't have permission to manage portfolios." }, 403);
  }
  return user;
}

async function parseBody(req: Request): Promise<PortfolioBody | Response> {
  try {
    return (await req.json()) as PortfolioBody;
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }
}

export async function listPortfolios(req: Request, env: Env): Promise<Response> {
  const auth = await authorize(req, env, false);
  if (auth instanceof Response) return auth;
  return json({ portfolios: await listRows(env) });
}

export async function createPortfolio(req: Request, env: Env): Promise<Response> {
  const auth = await authorize(req, env, true);
  if (auth instanceof Response) return auth;
  const body = await parseBody(req);
  if (body instanceof Response) return body;
  const v = validate(body);
  if ("error" in v) return json({ error: v.error }, 400);

  const sql = neon(env.DATABASE_URL);
  const ids = await orderedIds(env);
  const insertAt = clamp(slotIndex(v.page_number, v.position), 0, ids.length);

  const ins = (await sql`
    insert into portfolios (portfolio_title, tools_used, page_number, position)
    values (${v.portfolio_title}, ${v.tools_used}, ${v.page_number}, ${v.position})
    returning id
  `) as Array<{ id: number }>;
  const newId = Number(ins[0].id);

  ids.splice(insertAt, 0, newId);
  await resequence(env, ids);
  await reindex(env);
  return json({ ok: true, id: newId, portfolios: await listRows(env) });
}

export async function updatePortfolio(req: Request, env: Env): Promise<Response> {
  const auth = await authorize(req, env, true);
  if (auth instanceof Response) return auth;
  const body = await parseBody(req);
  if (body instanceof Response) return body;
  const id = parseId(body.id);
  if (id === null) return json({ error: "A valid id is required." }, 400);
  const v = validate(body);
  if ("error" in v) return json({ error: v.error }, 400);

  const sql = neon(env.DATABASE_URL);
  const upd = (await sql`
    update portfolios
    set portfolio_title = ${v.portfolio_title}, tools_used = ${v.tools_used}, updated_at = now()
    where id = ${id}
    returning id
  `) as Array<{ id: number }>;
  if (upd.length === 0) return json({ error: `Portfolio not found: ${id}` }, 404);

  // Move the row to the requested page/position slot if it changed, then re-sequence into chunks of 10.
  const ids = await orderedIds(env);
  const cur = ids.indexOf(id);
  const target = clamp(slotIndex(v.page_number, v.position), 0, ids.length - 1);
  if (cur !== -1 && cur !== target) {
    ids.splice(cur, 1);
    ids.splice(target, 0, id);
    await resequence(env, ids);
  }
  await reindex(env);
  return json({ ok: true, id, portfolios: await listRows(env) });
}

export async function deletePortfolio(req: Request, env: Env): Promise<Response> {
  const auth = await authorize(req, env, true);
  if (auth instanceof Response) return auth;
  const body = await parseBody(req);
  if (body instanceof Response) return body;
  const id = parseId(body.id);
  if (id === null) return json({ error: "A valid id is required." }, 400);

  const sql = neon(env.DATABASE_URL);
  const del = (await sql`delete from portfolios where id = ${id} returning id`) as Array<{ id: number }>;
  if (del.length === 0) return json({ error: `Portfolio not found: ${id}` }, 404);

  // Compact the remaining rows so pages stay full (10 each).
  await resequence(env, await orderedIds(env));
  await reindex(env);
  return json({ ok: true, portfolios: await listRows(env) });
}

export async function reorderPortfolios(req: Request, env: Env): Promise<Response> {
  const auth = await authorize(req, env, true);
  if (auth instanceof Response) return auth;
  const body = await parseBody(req);
  if (body instanceof Response) return body;
  if (!Array.isArray(body.order)) return json({ error: "order must be an array of ids." }, 400);

  // Build a complete, de-duped order from the client's list, appending any ids it omitted so the
  // re-sequence always covers every row (a partial order would leave stale page/position values).
  const existing = new Set(await orderedIds(env));
  const seen = new Set<number>();
  const finalOrder: number[] = [];
  for (const raw of body.order) {
    const id = parseId(raw);
    if (id !== null && existing.has(id) && !seen.has(id)) {
      finalOrder.push(id);
      seen.add(id);
    }
  }
  for (const id of existing) if (!seen.has(id)) finalOrder.push(id);

  await resequence(env, finalOrder);
  await reindex(env);
  return json({ ok: true, portfolios: await listRows(env) });
}
