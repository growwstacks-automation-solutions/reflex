import template from "./reflex-proposal-prompt.template.txt";
import { PORTFOLIO_INDEX } from "./portfolio";
import type { JobInput } from "./job";

const NA = "Not specified";
// Match the section BANNER (`# [DYNAMIC BLOCK]`), not the bare phrase — the header
// comment also mentions "[DYNAMIC BLOCK]", and indexOf would split on that first.
const DYNAMIC_MARKER = "# [DYNAMIC BLOCK]";

/** Drop developer-comment lines (`# ...`) but keep markdown headers (`## ...`), then tidy blanks. */
function stripComments(s: string): string {
  return s
    .split("\n")
    .filter((line) => !/^\s*#(?!#)/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split the template into the cached prefix and the per-job remainder at the [DYNAMIC BLOCK] marker. */
function splitTemplate(): { cached: string; dynamic: string } {
  const marker = template.indexOf(DYNAMIC_MARKER);
  if (marker === -1) return { cached: stripComments(template), dynamic: "" };
  const lineStart = template.lastIndexOf("\n", marker) + 1;
  return {
    cached: stripComments(template.slice(0, lineStart)),
    dynamic: stripComments(template.slice(lineStart)),
  };
}

export interface BuiltPrompt {
  /** Stable across jobs — goes in the cached `system` block. */
  system: string;
  /** Per-job — goes in the `user` message after the cache breakpoint. */
  user: string;
}

export function buildPrompt(job: JobInput): BuiltPrompt {
  const { cached, dynamic } = splitTemplate();

  // Portfolio index is stable data, so interpolating it keeps the cached block byte-stable.
  const system = cached.replace("{{PORTFOLIO_INDEX}}", PORTFOLIO_INDEX);

  const screening =
    job.screening_questions.length > 0
      ? job.screening_questions.map((q, i) => `${i + 1}. ${q}`).join("\n")
      : "(none)";

  const user =
    dynamic
      .replace("{{JOB_TITLE}}", job.title || NA)
      .replace("{{JOB_BUDGET}}", job.budget || NA)
      .replace("{{JOB_TYPE}}", job.type || NA)
      .replace("{{JOB_EXPERIENCE}}", job.experience || NA)
      .replace("{{JOB_DURATION}}", job.duration || NA)
      .replace("{{JOB_SKILLS}}", job.skills || NA)
      .replace("{{JOB_DESCRIPTION}}", job.description || NA)
      .replace("{{CLIENT_CONTEXT}}", job.client_context || NA)
      .replace("{{CLIENT_NAME_HINT}}", job.client_name_hint || "(none)")
      .replace("{{SCREENING_QUESTIONS}}", screening)
      .replace("{{PAST_WINNERS}}", "(none — retrieval not wired yet)") +
    // Re-state the load-bearing constraints in case they were stripped as comments above.
    // (Matches the template's OUTPUT CONTRACT: the cover letter's Loom links are placeholders
    // filled externally, while portfolio_recommendations are picked from the portfolio index.)
    "\n\nReturn ONLY the JSON object — no markdown, no fences. Give exactly one screening_answers " +
    "entry per screening question above (empty array if there were none). Return up to 4 " +
    "portfolio_recommendations (best-fit items from the portfolio index). Keep the two loom lines " +
    "verbatim as [LOOM_TITLE_1] — [LOOM_LINK_1] and [LOOM_TITLE_2] — [LOOM_LINK_2], with a short lead-in line.";

  return { system, user };
}
