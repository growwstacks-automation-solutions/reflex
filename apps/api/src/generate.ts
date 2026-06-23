import Anthropic from "@anthropic-ai/sdk";
import { buildPrompt } from "./prompt";
import type { JobInput } from "./job";
import type { Usage } from "./pricing";

export interface ScreeningAnswer {
  question: string;
  answer: string;
}

export interface PortfolioPick {
  title: string;
  page: number;
  position: number;
  why: string;
}

export interface ProposalResult {
  cover_letter: string;
  screening_answers: ScreeningAnswer[];
  portfolio_recommendations: PortfolioPick[];
  client_name_used: string | null;
}

/** Defensive parse: strip ``` fences, slice to the outer { ... }, then JSON.parse. */
function parseJson(raw: string): ProposalResult {
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
    throw new Error(`model did not return valid JSON: ${raw.slice(0, 200)}`);
  }
  return {
    cover_letter: typeof obj.cover_letter === "string" ? obj.cover_letter : "",
    screening_answers: Array.isArray(obj.screening_answers)
      ? (obj.screening_answers as ScreeningAnswer[])
      : [],
    portfolio_recommendations: Array.isArray(obj.portfolio_recommendations)
      ? (obj.portfolio_recommendations as PortfolioPick[])
      : [],
    client_name_used:
      typeof obj.client_name_used === "string" ? obj.client_name_used : null,
  };
}

export async function generate(
  apiKey: string,
  model: string,
  maxTokens: number,
  job: JobInput,
): Promise<{ proposal: ProposalResult; usage: Usage }> {
  const client = new Anthropic({ apiKey });
  const { system, user } = buildPrompt(job);

  const resp = await client.messages.create({
    model,
    max_tokens: maxTokens,
    // Cached prefix first (stable instructions + portfolio index), per-job content after.
    // Guard: never send cache_control on an empty block (the API 400s on that).
    system: system.trim()
      ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }]
      : undefined,
    messages: [{ role: "user", content: user }],
  });

  const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const usage: Usage = {
    input_tokens: resp.usage.input_tokens ?? 0,
    output_tokens: resp.usage.output_tokens ?? 0,
    cache_creation_input_tokens: resp.usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: resp.usage.cache_read_input_tokens ?? 0,
  };

  return { proposal: parseJson(text), usage };
}
