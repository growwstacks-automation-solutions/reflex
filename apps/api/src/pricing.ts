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
