import type { Env, GenerateResult, JobData, ScreeningAnswer, Usage } from "./types";
import { buildMessages } from "./prompt";
import { costInr } from "./pricing";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Build the prompt, call Haiku, parse the JSON, attach the ₹ cost. Always calls the
// model (that's the point of the stub test) — `stub` only reflects whether the job
// came from STUB_JOB vs Neon.
export async function generateProposal(
  env: Env,
  job: JobData,
  screeningQuestions: string[],
  clientName: string | null,
  stub: boolean,
): Promise<GenerateResult> {
  const { system, user } = buildMessages(job, screeningQuestions, clientName);

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Generation failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
    usage?: Usage;
  };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  const parsed = parseJson(text);
  const usage: Usage = data.usage ?? { input_tokens: 0, output_tokens: 0 };

  return {
    cover_letter: String(parsed.cover_letter ?? ""),
    screening_answers: normalizeAnswers(parsed.screening_answers, screeningQuestions),
    portfolio_recommendations: Array.isArray(parsed.portfolio_recommendations)
      ? parsed.portfolio_recommendations.slice(0, 4)
      : [],
    client_name_used:
      (typeof parsed.client_name_used === "string" ? parsed.client_name_used : null) ??
      (clientName || null),
    cost_inr: costInr(usage, Number(env.USD_TO_INR) || 84),
    usage,
    stub,
  };
}

// Defensive parse — models occasionally wrap JSON in prose or fences.
function parseJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  const a = cleaned.indexOf("{");
  const b = cleaned.lastIndexOf("}");
  if (a !== -1 && b > a) {
    try {
      return JSON.parse(cleaned.slice(a, b + 1)) as Record<string, unknown>;
    } catch {
      /* fall through */
    }
  }
  throw new Error("Model did not return valid JSON. First 200 chars: " + text.slice(0, 200));
}

function normalizeAnswers(raw: unknown, questions: string[]): ScreeningAnswer[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: unknown, i: number) => {
    if (typeof r === "string") return { question: questions[i] ?? "", answer: r };
    const o = (r ?? {}) as { question?: unknown; answer?: unknown };
    return {
      question: String(o.question ?? questions[i] ?? ""),
      answer: String(o.answer ?? ""),
    };
  });
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
