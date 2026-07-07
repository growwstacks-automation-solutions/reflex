// POST /jobs/client-name — extract the CLIENT's first name from their public Upwork reviews
// (the feedback past freelancers left about this client), so the proposal can greet them by
// name ("Hey Nathan") instead of the generic "Hey there". Server-side Claude call — the key
// never reaches the browser; the extension's Generate button drives it BEFORE /generate and
// passes the result through as the existing client_name_hint. Fully separate from proposal
// generation: a dedicated prompt + a small, cheap Haiku call.
//
// The name only ever leaks when a reviewer happens to name the client, so this is best-effort:
// no clear name -> null -> the proposal falls back to "Hey there" (unchanged behavior).
import Anthropic from "@anthropic-ai/sdk";
import template from "./reflex-client-name-prompt.template.txt";
import { costInr, type Usage } from "./pricing";

// A first name + JSON wrapper is tiny; keep the ceiling low so the call stays cheap/fast.
const MAX_TOKENS = 32;

// Drop the developer-comment lines (`# ...`) and tidy blank runs — same idea as prompt.ts.
function systemPrompt(): string {
  return template
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface ClientNameResult {
  client_name: string | null;
  cost_inr: number;
  tokens: number;
  usage: Usage;
  model: string;
}

// Robust parse: strip fences, slice the outer object, then validate the name is a plausible
// single first name. Anything odd -> null (the greeting safely falls back to "Hey there").
function parseName(raw: string): string | null {
  const stripped = raw.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
  let obj: Record<string, unknown> | null = null;
  try {
    obj = JSON.parse(stripped);
  } catch {
    const a = stripped.indexOf("{");
    const b = stripped.lastIndexOf("}");
    if (a !== -1 && b !== -1 && b > a) {
      try {
        obj = JSON.parse(stripped.slice(a, b + 1));
      } catch {
        obj = null;
      }
    }
  }
  if (!obj || typeof obj !== "object" || obj.client_name == null) return null;

  const name = String(obj.client_name).trim();
  // One plausible first name only (letters/’/'/-/., 2–20 chars). Rejects sentences, "null", etc.
  if (!/^[A-Za-z][A-Za-z'’.-]{1,19}$/.test(name)) return null;
  if (/^(null|none|there|client|n\/?a|unknown|freelancer)$/i.test(name)) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export async function extractClientName(
  apiKey: string,
  model: string,
  reviews: string[],
  usdToInr: number,
): Promise<ClientNameResult> {
  const client = new Anthropic({ apiKey });
  const user = reviews.map((r, i) => `Review ${i + 1}: ${r}`).join("\n");

  const resp = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    system: [{ type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });

  const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const usage: Usage = {
    input_tokens: resp.usage.input_tokens ?? 0,
    output_tokens: resp.usage.output_tokens ?? 0,
    cache_creation_input_tokens: resp.usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: resp.usage.cache_read_input_tokens ?? 0,
  };
  const { cost_inr } = costInr(model, usage, usdToInr);
  const tokens =
    usage.input_tokens +
    usage.output_tokens +
    usage.cache_creation_input_tokens +
    usage.cache_read_input_tokens;

  return { client_name: parseName(text), cost_inr, tokens, usage, model };
}
