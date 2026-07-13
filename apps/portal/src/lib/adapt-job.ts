/**
 * Adapter: GET /board snake_case rows → the portal's `Job` shape (the board's contract).
 * Maps field names, builds a display budget from the structured columns (budget_text is
 * usually null), and renders the detail-panel fields (description, Upwork url, client spend/
 * location/payment). Slots with no source — taxonomy chips, client hire-rate — stay honest
 * empties; never invented data.
 */
import type { Job } from "./types";
import type { ApiBoardJob } from "./api";

function fmtNum(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (Number.isNaN(num)) return "";
  return String(num);
}

/** Real budget lives in the structured columns; budget_text is the rare fallback. */
function buildBudget(j: ApiBoardJob): string {
  if (j.contract_type === "FIXED") {
    const amt = fmtNum(j.fixed_amount);
    if (amt) return `$${amt} fixed`;
  }
  if (j.contract_type === "HOURLY") {
    const lo = fmtNum(j.hourly_min);
    const hi = fmtNum(j.hourly_max);
    if (lo || hi) return `$${lo || "?"}-${hi || "?"}/hr`;
  }
  return j.budget_text || "—";
}

/** Exact date + time, e.g. "25 Jun 2026, 6:56 PM". Reps want the real timestamp, not "2w ago". */
function exactDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const ACTION_STATE: Record<string, Job["actionState"]> = {
  Submitted: "submitted",
  "In Contact": "conversation",
};

const QUALITIES = new Set<Job["quality"]>(["good", "medium", "watch", "poor"]);
const VERDICTS = new Set<Job["relevance"]>(["relevant", "review", "irrelevant"]);

export function adaptJob(j: ApiBoardJob): Job {
  const quality = (QUALITIES.has(j.quality as Job["quality"]) ? j.quality : "medium") as Job["quality"];
  const relevance = (VERDICTS.has(j.verdict as Job["relevance"]) ? j.verdict : "review") as Job["relevance"];
  // The Connects column only shows in the Submitted view, so prefer connect_spent (what was
  // actually spent on the submitted proposal); fall back to the job's bid cost otherwise.
  const rawConnects = j.connect_spent != null && j.connect_spent !== "" ? j.connect_spent : j.connects;
  const connects =
    rawConnects == null ? 0 : typeof rawConnects === "number" ? rawConnects : parseInt(String(rawConnects), 10) || 0;
  const locParts = [j.client_city, j.client_country].filter(Boolean) as string[];
  const location = locParts.length ? locParts.join(", ") : j.client_country_code || "—";
  const payment =
    j.client_payment_verified == null ? "—" : j.client_payment_verified ? "Verified" : "Unverified";

  // Ownership is computed server-side relative to the requester:
  //   is_mine → "mine"; is_available (no live owner) → "available"; else another rep owns it.
  const ownership: Job["ownership"] = j.is_mine ? "mine" : j.is_available ? "available" : "other";
  // The live owner's name straight from the DB (job_assignments → users.full_name), for the
  // Assignee column. Present whenever the job is owned (mine or another rep), null when available.
  const owner = j.owner_name
    ? { name: j.owner_name, first: j.owner_name.split(" ")[0], bg: "var(--surface-2)", fg: "var(--text-secondary)" }
    : undefined;

  return {
    id: j.upwork_job_id,
    title: j.title,
    relevance,
    quality,
    reason: j.reason || "",
    chips: [], // taxonomy FKs are null in the migrated data / not returned by /board
    ownership,
    owner,
    actionState: (j.proposal_status && ACTION_STATE[j.proposal_status]) || "not-actioned",
    budget: buildBudget(j),
    connects,
    postedAgo: exactDateTime(j.posted_at),
    createdAgo: exactDateTime(j.created_at),
    postedAt: j.posted_at,
    createdAt: j.created_at,
    cat: "",
    desc: j.description || "",
    url: j.url || undefined,
    classification: { tool: "", usecase: "", dept: "", industry: "" },
    client: {
      spend: j.client_spend || "—",
      hireRate: "—", // no hire-rate column exists (total_hired is a count, not a rate) — honest empty
      location,
      payment,
    },
  };
}
