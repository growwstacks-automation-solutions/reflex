# Reflex — AI generation + portfolio recommendation spec

*The proposal-generation layer that lives in the Cloudflare Worker (the AI plane). Covers model choice, prompt caching for cost control, per-generation rupee cost, and the portfolio recommendation engine — which rides on the same model call. Hand to Claude Code when building the Worker. The schema fields this writes to already exist (`proposals.token_cost_inr`, `proposals.tokens`).*

---

## Model

- **Claude Haiku 4.5** for proposal writing, screening answers, suggested replies, and portfolio recommendation.
- Rationale: cheap, fast, strong enough for demo-first proposals the rep edits before sending. The quality/cost tradeoff favors Haiku here; A/B one batch against a larger model later if persuasion quality matters, but default to Haiku.
- Same model serves all generation tasks so the cached context (below) is reused across them.

---

## Prompt caching — the cost lever for multiple proposals at once

The win condition: when a rep fires several proposals in one shift, the shared, unchanging part of the prompt is charged once at full price and reused cheaply after.

**Structure every generation prompt in two parts, cached part first:**

1. **Cached block (stable, marked for caching):**
   - The Reflex proposal-writing system prompt / instructions / voice + style guide.
   - Company context (who Growwstacks is, positioning, the "how we write" rules).
   - The **portfolio index** (all items: title, skills, one-line description) — see the recommendation section; this is large and stable, so caching it is a big saving.
   - Anything else identical across jobs.

2. **Dynamic block (changes per job, placed AFTER the cached block):**
   - This job's title + description + screening questions.
   - The top 2–3 retrieved past-winning proposals (from pgvector).
   - The specific instruction for this generation.

Because cache reads cost a fraction of fresh input tokens, the big shared preamble + portfolio index is paid at full rate on the first proposal of a burst, then at the cache rate on the rest. This is exactly the "multiple proposals simultaneously" scenario — the cache pays off when generations happen close together (the cache has a short TTL, which matches a shift's rhythm).

**Rules for Claude Code:**
- Keep the cached block byte-stable — any change busts the cache. Don't interpolate per-job data into it.
- Put all per-job content after the cache breakpoint.
- The cached block must clear the minimum-size threshold to be cacheable (the portfolio index alone likely does).

---

## Per-generation cost in ₹ (shown in the UI)

Every API response returns token usage broken down into: fresh input, output, **cache-creation** tokens, and **cache-read** tokens. The Worker computes cost from that breakdown:

```
cost_inr = (fresh_input   × input_rate)
         + (cache_write   × cache_write_rate)   // first call of a burst
         + (cache_read    × cache_read_rate)    // cheap, subsequent calls
         + (output        × output_rate)
         → converted to INR
```

- Store on `proposals.token_cost_inr` and `proposals.tokens`.
- Show per generated block (cover letter, each screening answer) exactly as the UI already specifies — `₹ 0.42 · ~620 tokens`.
- Because the breakdown distinguishes cached vs fresh, a cached generation **visibly costs less** — satisfying and honest for the reps to see, and it makes the caching benefit tangible.
- Use a configurable INR-per-USD rate constant (rates and FX change; don't hard-code deep in logic).

---

## Portfolio recommendation — rides on the SAME model call

The rep attaches up to **4** "profile highlights" (Upwork's cap) from ~74 portfolio items. Upwork's popup has no search and paginates ~2/page over ~10 pages — pure tedium. Reflex removes the *finding*, not the clicking.

**How it works:**
- The portfolio index (all items + skills + descriptions + **which Upwork page each is on**) lives in the cached block. So when the proposal is generated, the model already has every portfolio item in context at near-zero marginal cost.
- The generation returns, alongside the cover letter and screening answers, a **ranked shortlist of the 4 best-fit portfolio items for this job** — matched on the job's needs vs each item's skills/description, with a one-line "why this fits."
- Reflex shows the rep those 4 with: **title, thumbnail, and location** (e.g. "→ Portfolio tab, page 4, 2nd item").
- The rep opens Upwork's highlights popup, jumps to the named page, and clicks **Select highlight** themselves — 4 human-paced clicks, guided. No autonomous clicking.

**Why this design (non-negotiable safety boundary):**
- Reflex does **NOT** auto-paginate the popup or auto-click "Select highlight." Autonomously driving that popup in a burst is the highest account-suspension risk in the whole product — machine-paced clicks through a logged-in session are exactly what Upwork's anti-automation watches for, and the accounts are the reps' livelihood.
- Since the rep only ever picks 4 and was going to click anyway, guiding (search + AI pick + "it's on page 4") removes ~80% of the pain — the hunting — while keeping every click human. Full automation would save 4 clicks at the cost of the account. Not worth it.
- If full auto-select is ever revisited, it's a deliberate, clearly-flagged decision Manish makes with eyes open — not a default, and only with human-like randomized pacing (which lowers but doesn't remove the risk).

**Output shape from the generation (so the UI can render it):**
```json
{
  "cover_letter": "...",
  "screening_answers": [{ "question": "...", "answer": "..." }],
  "portfolio_recommendations": [
    { "title": "AI Gift Recommendation Engine — Claude-Powered Matching API",
      "page": 1, "position": 1, "why": "Claude + recommendation API, mirrors their ask" },
    { "title": "Advanced n8n Recruitment Process Automation",
      "page": 4, "position": 2, "why": "n8n pipeline + Gmail/Sheets, same stack" }
  ],
  "token_cost_inr": 0.42,
  "tokens": 620
}
```

---

## Index source — deferred (decided later, doesn't block this spec)

The recommendation logic above is independent of where the index data comes from. When ready, the index (74 items → title, skills, description, page, position) can be sourced from:
- the ImageKit/portfolio database the team already maintains, and/or
- a one-time, human-paced walk of the Upwork popup to record page/position numbers (capturing the popup selectors then — same DevTools method as the other anchors).

Until the index exists, build the generation + cost + caching, and stub `portfolio_recommendations` so the pipeline and UI are ready to light up when the index is wired.

---

## Build order

1. Worker proposal generation on Haiku, dynamic block only (no cache yet) → returns cover letter + screening answers + ₹ cost.
2. Add the cached block (system prompt + company context); verify cache-read tokens appear on the 2nd call of a burst and the ₹ cost drops.
3. Add the portfolio index to the cached block + the `portfolio_recommendations` output (stubbed index first).
4. Wire the real index source (deferred decision) → recommendations go live.
