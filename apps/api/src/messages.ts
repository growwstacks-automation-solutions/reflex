// Messages sync + suggested reply — the Messages tab of the extension panel.
//
//  POST /messages/sync     { room_id } -> pull the room's messages from Upwork into thread_messages
//  POST /messages/suggest  { room_id } -> job + proposal + thread -> Claude -> { summary, reply }
//
// Both are auth-gated (a signed-in rep). The sync is the sanctioned, human-clicked equivalent of
// the server cron: it fetches through Upwork's official Messages API (never the browser), upserts
// idempotently on message_id, and links to a job via jobs.chat_url. Suggested reply is generated
// for the rep to COPY and send manually — Reflex never sends on Upwork (docs/DECISIONS.md D5).

import Anthropic from "@anthropic-ai/sdk";
import { neon } from "@neondatabase/serverless";
import { json } from "./http";
import { authUser } from "./auth";
import { costInr, type Usage } from "./pricing";
import { fetchUpworkToken, fetchRoomInfo, fetchRoomMessages, type UpworkMessage } from "./upworkMessages";
import type { Env } from "./index";

const SUGGEST_MAX_TOKENS = 1024;

function roomIdFrom(body: unknown): string {
  const b = (body ?? {}) as Record<string, unknown>;
  return b.room_id ? String(b.room_id).trim() : "";
}

interface JobRow {
  id: string;
  title: string | null;
  description: string | null;
  budget_text: string | null;
  cover_letter: string | null;
  messages_synced_at: string | null;
}

// The room -> job link is the marketplace job-posting id (== jobs.upwork_job_id), read from the
// room's vendorProposal. (jobs.chat_url is empty across the whole table, so it can't be used.)
async function jobByPostingId(databaseUrl: string, postingId: string): Promise<JobRow | null> {
  if (!postingId) return null;
  const sql = neon(databaseUrl);
  const rows = (await sql`
    select j.id, j.title, j.description, j.budget_text, j.messages_synced_at, p.cover_letter
    from jobs j
    left join proposals p on p.job_id = j.id
    where j.upwork_job_id = ${postingId}
    limit 1
  `) as JobRow[];
  return rows[0] ?? null;
}

/** For suggest: reuse the job the sync already linked to this room (via thread_messages.job_id). */
async function jobFromThread(databaseUrl: string, roomId: string): Promise<JobRow | null> {
  const sql = neon(databaseUrl);
  const rows = (await sql`
    select j.id, j.title, j.description, j.budget_text, j.messages_synced_at, p.cover_letter
    from jobs j
    left join proposals p on p.job_id = j.id
    where j.id = (
      select job_id from thread_messages
      where room_id = ${roomId} and job_id is not null
      limit 1
    )
    limit 1
  `) as JobRow[];
  return rows[0] ?? null;
}

// --- POST /messages/sync -----------------------------------------------------

export async function syncMessages(req: Request, env: Env): Promise<Response> {
  const claims = await authUser(req, env);
  if (!claims) return json({ error: "Unauthorized" }, 401);
  if (!env.DATABASE_URL) return json({ error: "Server misconfigured: DATABASE_URL is not set." }, 500);
  if (!env.UPWORK_TOKEN_URL) return json({ error: "Server misconfigured: UPWORK_TOKEN_URL is not set." }, 500);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body must be JSON, e.g. { "room_id": "..." }.' }, 400);
  }
  const roomId = roomIdFrom(body);
  if (!roomId) return json({ error: "Missing room_id." }, 400);

  try {
    // 1. Mint a token, then read the room's job link + its messages through the official API.
    const token = await fetchUpworkToken(env.UPWORK_TOKEN_URL);
    const info = await fetchRoomInfo(token, roomId);
    const messages: UpworkMessage[] = await fetchRoomMessages(token, roomId, env.UPWORK_VIEWER_ID || "");

    const sql = neon(env.DATABASE_URL);

    // 2. Link to a job via the posting id (nullable — the job may not be in Reflex).
    const job = await jobByPostingId(env.DATABASE_URL, info.postingId);
    const jobId = job?.id ?? null;

    // 3. Upsert idempotently on message_id. `returning id` on a do-nothing conflict yields only
    //    the rows actually inserted, so its length is the count of NEW messages this sync.
    let inserted = 0;
    for (const m of messages) {
      const r = (await sql`
        insert into thread_messages (job_id, room_id, message_id, sender, body, sent_at)
        values (${jobId}, ${roomId}, ${m.message_id}, ${m.sender}, ${m.body}, ${m.sent_at})
        on conflict (message_id) do nothing
        returning id
      `) as Array<{ id: string }>;
      inserted += r.length;
    }

    // 4. Stamp the sync time on the job (honest "Last synced" even when 0 new messages arrived).
    let lastSyncedAt: string | null = null;
    if (jobId) {
      const upd = (await sql`
        update jobs set messages_synced_at = now() where id = ${jobId}
        returning messages_synced_at
      `) as Array<{ messages_synced_at: string }>;
      lastSyncedAt = upd[0]?.messages_synced_at ?? null;
    }

    return json({
      ok: true,
      room_id: roomId,
      job_id: jobId,
      // Prefer the matched job title; else the room's own topic / posting title so the panel
      // still shows what conversation this is even when the job isn't in Reflex.
      job_title: job?.title || info.postingTitle || info.topic || null,
      room_title: info.topic || null,
      posting_id: info.postingId || null,
      fetched: messages.length,
      synced: inserted, // new messages stored this run
      last_synced_at: lastSyncedAt,
      linked: !!jobId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Message sync failed: ${message}` }, 500);
  }
}

// --- POST /messages/suggest --------------------------------------------------

interface SuggestResult {
  summary: string;
  reply: string;
}

/** Defensive parse (mirrors generate.ts): strip fences, slice to the outer object, JSON.parse. */
function parseSuggest(raw: string): SuggestResult {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(s);
  } catch {
    // No JSON — treat the whole text as the reply, leave summary empty.
    return { summary: "", reply: raw.trim() };
  }
  return {
    summary: typeof obj.summary === "string" ? obj.summary : "",
    reply: tidyReply(typeof obj.reply === "string" ? obj.reply : ""),
  };
}

/** Normalize the reply's whitespace so it pastes cleanly: real line breaks, blank line between
 *  paragraphs, no trailing spaces, collapse 3+ blank lines to one. Handles a model that emitted a
 *  literal "\n" sequence instead of an actual newline. */
function tidyReply(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n")        // literal backslash-n -> real newline (belt-and-suspenders)
    .replace(/[ \t]+\n/g, "\n")   // strip trailing spaces on each line
    .replace(/\n{3,}/g, "\n\n")   // at most one blank line between blocks
    .trim();
}

function buildSuggestPrompt(job: JobRow | null, thread: Array<{ sender: string; body: string }>): {
  system: string;
  user: string;
} {
  const system =
    "You are Reflex, an assistant for an Upwork freelancer replying to a client. You will be given " +
    "the job, the freelancer's submitted proposal, and the full message thread. Write the freelancer's " +
    "next reply: professional, warm, specific, and concise — it answers the client's latest questions " +
    "directly and moves the conversation toward the next step (a call, a quote, scope). Never invent " +
    "facts, prices, or commitments not supported by the proposal or thread; if a number is unknown, ask " +
    "for it rather than guessing.\n\n" +
    "FORMAT THE REPLY as a ready-to-send message, well spaced and easy to read:\n" +
    "- Open with a short greeting line (use the client's first name if it's clear from the thread, else \"Hi there\").\n" +
    "- Then a blank line, then 1-3 short paragraphs (1-3 sentences each), each separated by a blank line.\n" +
    "- If listing steps or options, put each on its own line starting with \"- \".\n" +
    "- Close with a brief sign-off line (e.g. \"Best,\" then the next line blank — do NOT invent a name).\n" +
    "- Plain text only: no markdown, no bold, no emojis. Use real line breaks — \\n between lines and \\n\\n between paragraphs.\n\n" +
    'Respond ONLY as minified JSON: {"summary": "...", "reply": "..."} where summary is a 2-3 line recap of ' +
    "where the conversation stands and reply is the message the freelancer can copy and send (with the \\n / \\n\\n line breaks preserved in the JSON string).";

  const jobBlock = job
    ? `JOB TITLE: ${job.title ?? ""}\nJOB DESCRIPTION: ${job.description ?? ""}\nBUDGET: ${job.budget_text ?? ""}\n\nOUR SUBMITTED PROPOSAL:\n${job.cover_letter ?? "(no proposal on file)"}`
    : "JOB: (not matched in Reflex — reply from the conversation alone.)";

  const threadBlock = thread.length
    ? thread.map((m) => `${m.sender === "us" ? "FREELANCER" : "CLIENT"}: ${m.body}`).join("\n")
    : "(no messages synced yet)";

  return { system, user: `${jobBlock}\n\nCONVERSATION (oldest first):\n${threadBlock}` };
}

export async function suggestReply(req: Request, env: Env): Promise<Response> {
  const claims = await authUser(req, env);
  if (!claims) return json({ error: "Unauthorized" }, 401);
  if (!env.ANTHROPIC_API_KEY) return json({ error: "Server misconfigured: ANTHROPIC_API_KEY is not set." }, 500);
  if (!env.DATABASE_URL) return json({ error: "Server misconfigured: DATABASE_URL is not set." }, 500);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body must be JSON, e.g. { "room_id": "..." }.' }, 400);
  }
  const roomId = roomIdFrom(body);
  if (!roomId) return json({ error: "Missing room_id." }, 400);

  try {
    const sql = neon(env.DATABASE_URL);
    // The job (if any) was linked at sync time; the whole thread lives under this room_id.
    const job = await jobFromThread(env.DATABASE_URL, roomId);
    const thread = (await sql`
      select sender::text as sender, body from thread_messages
      where room_id = ${roomId}
      order by sent_at asc nulls last, created_at asc
    `) as Array<{ sender: string; body: string }>;

    if (thread.length === 0) {
      return json({ error: "No synced messages for this conversation yet — click Sync first." }, 409);
    }

    const model = env.ANTHROPIC_MODEL || "claude-haiku-4-5";
    const usdToInr = Number.parseFloat(env.USD_TO_INR || "84") || 84;
    const { system, user } = buildSuggestPrompt(job, thread);

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const resp = await client.messages.create({
      model,
      max_tokens: SUGGEST_MAX_TOKENS,
      system: [{ type: "text", text: system }],
      messages: [{ role: "user", content: user }],
    });
    const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = parseSuggest(text);

    const usage: Usage = {
      input_tokens: resp.usage.input_tokens ?? 0,
      output_tokens: resp.usage.output_tokens ?? 0,
      cache_creation_input_tokens: resp.usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: resp.usage.cache_read_input_tokens ?? 0,
    };
    const { cost_inr } = costInr(model, usage, usdToInr);
    const tokens =
      usage.input_tokens + usage.output_tokens +
      usage.cache_creation_input_tokens + usage.cache_read_input_tokens;

    return json({
      room_id: roomId,
      job_id: job?.id ?? null,
      job_title: job?.title ?? null,
      summary: parsed.summary,
      reply: parsed.reply,
      cost_inr,
      tokens,
      last_synced_at: job?.messages_synced_at ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Suggested reply failed: ${message}` }, 500);
  }
}
