import type { Usage } from "./types";

// Claude Haiku 4.5 — USD per MILLION tokens.
// TODO(verify): confirm against current Anthropic pricing before trusting the ₹ figure
// in production. Structure is what matters: fresh input + cache write + cache read + output,
// each at its own rate. Cache reads are ~10% of input — that's where the shift savings show.
const PER_MTOK = {
  input: 1.0,        // fresh (non-cached) input
  output: 5.0,       // output
  cacheWrite: 1.25,  // 5-min cache write = 1.25x input
  cacheRead: 0.1,    // cache read = 0.1x input
};

// Returns the cost in ₹, rounded to 4 dp (matches proposals.token_cost_inr numeric(10,4)).
// When caching is active, Anthropic reports cached tokens under cache_*; input_tokens is
// only the fresh remainder — so this honestly reflects the cache discount.
export function costInr(usage: Usage, usdToInr: number): number {
  const freshIn = usage.input_tokens || 0;
  const out = usage.output_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;

  const usd =
    (freshIn / 1e6) * PER_MTOK.input +
    (out / 1e6) * PER_MTOK.output +
    (cacheWrite / 1e6) * PER_MTOK.cacheWrite +
    (cacheRead / 1e6) * PER_MTOK.cacheRead;

  return Math.round(usd * usdToInr * 10000) / 10000;
// Per-1M-token USD rates. Source: claude-api skill model table (Haiku 4.5 = $1.00 input /
// $5.00 output) + prompt-caching economics (5-min cache write = 1.25x input, cache read = 0.1x
// input). Keep these in sync if the model or Anthropic pricing changes.
export interface ModelRates {
  input: number; // $ / 1M fresh input tokens
  output: number; // $ / 1M output tokens
  cacheWrite: number; // $ / 1M cache-creation tokens (5-min TTL)
  cacheRead: number; // $ / 1M cache-read tokens
}

const RATES: Record<string, ModelRates> = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
};

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export function ratesFor(model: string): ModelRates {
  return RATES[model] ?? RATES["claude-haiku-4-5"];
}

/** Cost in INR from the token-usage breakdown. Cached tokens visibly cost less than fresh ones. */
export function costInr(
  model: string,
  usage: Usage,
  usdToInr: number,
): { cost_inr: number; usd: number } {
  const r = ratesFor(model);
  const usd =
    (usage.input_tokens * r.input +
      usage.cache_creation_input_tokens * r.cacheWrite +
      usage.cache_read_input_tokens * r.cacheRead +
      usage.output_tokens * r.output) /
    1_000_000;
  return { cost_inr: Math.round(usd * usdToInr * 100) / 100, usd };
}
