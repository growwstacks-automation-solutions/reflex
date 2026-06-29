import { neon } from "@neondatabase/serverless";

// ============================================================
// Match Resources — single-job port of the n8n "Match Resources" node.
//
// Source tables (exact Neon column names):
//   loom_videos    : id, title, new_link
//   knowledge_base : id, project_id, use_case, description,
//                    major_apps, secondary_apps, screenshot_urls
//
// Destination (migrations/0004_job_work_samples.sql):
//   jobs.looms       text[]  -- "Title — new_link"
//   jobs.image_links text[]  -- flat screenshot URLs (max 4)
//
// Unlike the n8n version this scores ONE job (the one being processed),
// reads the two source tables directly (no _source split), and ends by
// upserting the matched arrays onto that job's row. The scoring logic
// (tokenize / scoreText / stopwords / platformBoosts) is kept identical
// so matches line up with what the n8n workflow produces.
// ============================================================

export interface MatchResult {
  matched: boolean; // false when the job row could not be found
  skipped: boolean; // true when the job was already matched (assets left untouched)
  looms: string[];
  image_links: string[];
  debug: {
    kb_rows: number;
    loom_rows: number;
    kb_matches: number;
    loom_matches: number;
  };
}

// -------------------------------------------------------
// HELPERS (verbatim from the n8n node)
// -------------------------------------------------------
const stopwords = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "for", "to", "of", "in", "on", "at",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does",
  "did", "will", "would", "should", "could", "can", "may", "might", "must", "this",
  "that", "these", "those", "i", "you", "we", "they", "it", "my", "your", "our", "their",
  "with", "from", "by", "as", "about", "need", "want", "looking", "help", "build",
  "use", "using", "make", "project", "work", "team", "expert", "via", "etc",
]);

const platformBoosts = new Set([
  "n8n", "make", "zapier", "airtable", "notion", "slack", "webhook", "webhooks",
  "gpt", "openai", "claude", "anthropic", "gemini", "llm", "ai",
  "zoho", "hubspot", "pipedrive", "salesforce", "gohighlevel", "ghl", "attio",
  "wordpress", "woocommerce", "shopify", "wix", "bigcommerce",
  "twilio", "whatsapp", "whapi", "vapi", "retell", "elevenlabs", "bolna",
  "supabase", "postgres", "postgresql", "firebase", "mongodb", "mysql",
  "google", "sheets", "gmail", "calendar", "drive", "docs",
  "facebook", "instagram", "linkedin", "tiktok", "youtube",
  "react", "nextjs", "vue", "angular", "fastapi", "node", "python",
  "stripe", "paypal", "quickbooks", "xero", "razorpay",
  "apify", "apollo", "clay", "puppeteer", "playwright",
  "monday", "clickup", "asana", "trello", "jira",
  "mailchimp", "sendgrid", "klaviyo", "activecampaign",
]);

function tokenize(text: unknown): string[] {
  return (text ?? "").toString().toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));
}

function scoreText(text: unknown, leadKeywords: Set<string>): number {
  if (!text) return 0;
  let score = 0;
  for (const token of tokenize(text)) {
    if (leadKeywords.has(token)) score += platformBoosts.has(token) ? 3 : 1;
  }
  return score;
}

/** Postgres array OR "{a,b}" literal OR plain string → string[]. */
function toArrayText(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string" && v.startsWith("{")) {
    return v.replace(/^\{|\}$/g, "").split(",")
      .map((s) => s.replace(/^"|"$/g, "").trim())
      .filter(Boolean);
  }
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  return [];
}

/** major_apps / secondary_apps may be array or string — flatten to one space-joined string. */
function appsToText(v: unknown): string {
  return Array.isArray(v) ? v.join(" ") : (v == null ? "" : String(v));
}

/**
 * Match work samples for ONE job and upsert them onto jobs.looms / jobs.image_links.
 *
 * Reads the job's own keyword fields (title/description/skills/reason) from the
 * jobs table, scores the loom_videos + knowledge_base reference tables against
 * them, keeps the top 2 of each, and writes the formatted arrays back to the
 * job row. Returns what it wrote (matched=false if the job row is missing).
 *
 * `jobId` is jobs.id (uuid) OR upwork_job_id — either resolves the row.
 */
export async function matchAssets(databaseUrl: string, jobId: string): Promise<MatchResult> {
  const sql = neon(databaseUrl);

  const empty: MatchResult = {
    matched: false,
    skipped: false,
    looms: [],
    image_links: [],
    debug: { kb_rows: 0, loom_rows: 0, kb_matches: 0, loom_matches: 0 },
  };

  // -- resolve the job we're matching against --
  const jobRows = (await sql`
    select title, description, skills, reason, looms, image_links
    from jobs
    where id::text = ${jobId} or upwork_job_id = ${jobId}
    limit 1
  `) as Array<Record<string, unknown>>;
  if (jobRows.length === 0) return empty;
  const lead = jobRows[0];

  // -- already matched? matchAssets always writes BOTH columns, so both being
  //    non-null means this job has been processed. Skip the rescan + reuse the
  //    stored assets (saves two table scans + an upsert on every Generate). --
  if (lead.looms != null && lead.image_links != null) {
    return {
      matched: true,
      skipped: true,
      looms: toArrayText(lead.looms),
      image_links: toArrayText(lead.image_links),
      debug: { kb_rows: 0, loom_rows: 0, kb_matches: 0, loom_matches: 0 },
    };
  }

  // -- read both source tables (small reference tables) --
  const [loomRows, kbRows] = await Promise.all([
    sql`select id, title, new_link from loom_videos` as Promise<Array<Record<string, unknown>>>,
    sql`select id, project_id, use_case, description, major_apps, secondary_apps, screenshot_urls
        from knowledge_base` as Promise<Array<Record<string, unknown>>>,
  ]);

  // -- build lead keywords from THIS job --
  const skillsText = appsToText(lead.skills);
  const leadKeywords = new Set(
    tokenize([lead.title ?? "", lead.description ?? "", lead.reason ?? "", skillsText].join(" ")),
  );

  // -- score KB --
  const scoredKB = kbRows
    .map((kb) => {
      const searchText = [
        kb.use_case ?? "",
        kb.description ?? "",
        appsToText(kb.major_apps),
        appsToText(kb.secondary_apps),
      ].join(" ");
      return { record: kb, score: scoreText(searchText, leadKeywords) };
    })
    .sort((a, b) => b.score - a.score);

  // -- score looms (column is 'title') --
  const scoredLooms = loomRows
    .map((loom) => ({ record: loom, score: scoreText(loom.title ?? "", leadKeywords) }))
    .sort((a, b) => b.score - a.score);

  // -- top 2 each (score > 0) --
  const topKB = scoredKB.filter((x) => x.score > 0).slice(0, 2).map((x) => x.record);
  const topLooms = scoredLooms.filter((x) => x.score > 0).slice(0, 2).map((x) => x.record);

  // -- looms column: "Title — new_link" --
  const looms = topLooms
    .map((loom) => {
      const title = (loom.title as string) ?? "";
      const link = (loom.new_link as string) ?? "";
      return link ? `${title} — ${link}` : title;
    })
    .filter(Boolean);

  // -- image_links column: flat screenshot URLs from the top KB rows, max 4 --
  const image_links = topKB.flatMap((kb) => toArrayText(kb.screenshot_urls)).slice(0, 10);

  // -- upsert onto the job row (matches by uuid or upwork id) --
  await sql`
    update jobs
       set looms = ${looms}::text[],
           image_links = ${image_links}::text[]
     where id::text = ${jobId} or upwork_job_id = ${jobId}
  `;

  return {
    matched: true,
    skipped: false,
    looms,
    image_links,
    debug: {
      kb_rows: kbRows.length,
      loom_rows: loomRows.length,
      kb_matches: topKB.length,
      loom_matches: topLooms.length,
    },
  };
}
