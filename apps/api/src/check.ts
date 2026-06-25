import { neon } from "@neondatabase/serverless";
import type { Env } from "./types";

// Per-card status the extension strip renders. Shapes match what content.js'
// stripInner() already consumes (short verdict codes, good/medium/poor, etc.).
export interface JobStatus {
  connected: true;
  inReflex: boolean;
  verdict?: "rel" | "rev" | "irr" | null;
  quality?: "good" | "medium" | "poor" | null;
  chips?: string;
  ownership?: "mine" | "other" | "available";
  owner?: string | null;
  actioned?: "none" | "generated" | "submitted";
}

const VERDICT_MAP: Record<string, "rel" | "rev" | "irr"> = {
  relevant: "rel",
  review: "rev",
  irrelevant: "irr",
};

function mapQuality(q: string | null): "good" | "medium" | "poor" | null {
  if (!q) return null;
  const s = q.trim().toLowerCase();
  if (s.startsWith("good") || s.startsWith("high")) return "good";
  if (s.startsWith("med")) return "medium";
  if (s.startsWith("poor") || s.startsWith("low")) return "poor";
  return null;
}

interface CheckRow {
  upwork_job_id: string;
  verdict: string | null;
  quality: string | null;
  picked_by_name: string | null;
  proposal_submitted_at: string | null;
  tool: string | null;
  use_case: string | null;
  department: string | null;
  industry: string | null;
}

// Look up many jobs by their Upwork numeric id (== tile data-test-key) in one query.
// Returns a map keyed by jobId; ids not in the DB come back as { inReflex: false }.
// NOTE: ownership "mine" needs the logged-in user (auth, later) — for now a picked job
// reads as "other"; the race-safe owner still lives in job_assignments.
export async function checkJobs(env: Env, jobIds: string[]): Promise<Record<string, JobStatus>> {
  const out: Record<string, JobStatus> = {};
  for (const id of jobIds) out[id] = { connected: true, inReflex: false };
  if (!jobIds.length) return out;

  const sql = neon(env.DATABASE_URL);
  const rows = (await sql`
    select
      j.upwork_job_id,
      j.verdict::text          as verdict,
      j.quality,
      j.picked_by_name,
      j.proposal_submitted_at,
      t.name                   as tool,
      uc.name                  as use_case,
      d.name                   as department,
      ind.name                 as industry
    from jobs j
    left join tools       t   on t.id   = j.tool_id
    left join use_cases   uc  on uc.id  = j.use_case_id
    left join departments d   on d.id   = j.department_id
    left join industries  ind on ind.id = j.industry_id
    where j.upwork_job_id = any(${jobIds})
  `) as CheckRow[];

  for (const r of rows) {
    const chips = [r.tool, r.use_case, r.department].filter(Boolean).join(" · ");
    out[r.upwork_job_id] = {
      connected: true,
      inReflex: true,
      verdict: VERDICT_MAP[(r.verdict ?? "").toLowerCase()] ?? null,
      quality: mapQuality(r.quality),
      chips: chips || undefined,
      owner: r.picked_by_name || null,
      ownership: r.picked_by_name ? "other" : "available",
      actioned: r.proposal_submitted_at ? "submitted" : "none",
    };
  }
  return out;
}
