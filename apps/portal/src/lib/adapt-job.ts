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

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const min = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
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
  const connects =
    j.connects == null ? 0 : typeof j.connects === "number" ? j.connects : parseInt(String(j.connects), 10) || 0;
  const locParts = [j.client_city, j.client_country].filter(Boolean) as string[];
  const location = locParts.length ? locParts.join(", ") : j.client_country_code || "—";
  const payment =
    j.client_payment_verified == null ? "—" : j.client_payment_verified ? "Verified" : "Unverified";

  return {
    id: j.upwork_job_id,
    title: j.title,
    relevance,
    quality,
    reason: j.reason || "",
    chips: [], // taxonomy FKs are null in the migrated data / not returned by /board
    ownership: "mine", // every row on /board is one this rep was assigned
    actionState: (j.proposal_status && ACTION_STATE[j.proposal_status]) || "not-actioned",
    budget: buildBudget(j),
    connects,
    postedAgo: relativeTime(j.posted_at),
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
