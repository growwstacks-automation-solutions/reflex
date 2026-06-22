# Reflex — extension demo (load & walkthrough)

This is a **working UI demo** of the Reflex extension. It runs entirely on **mock data — there is no backend yet.** The point is to load it into Chrome and *feel* the whole thing on a real Upwork page: the launcher, the panel, every surface, and the suggested-reply flow.

To rename it from "Reflex" later: open `content/content.js` and change the line `const SYSTEM_NAME = "Reflex";` (and tell Claude Code to update the popup + icons to match).

---

## How to load it (2 minutes)

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this `reflex-extension` folder
5. Reflex appears in your extensions. Pin it if you like (puzzle-piece icon → pin).

That's it. It updates whenever you reload it from `chrome://extensions` (the ↻ icon on the card).

---

## How to use it

### The toolbar icon (login states)
Click the Reflex icon in the toolbar. You'll see the **sign-in** screen. Click **Sign in** to see the **Active** state. At the bottom there's a **"Preview state"** row — use it to flip between **Login / Active / Deactivated** so you can see the lock-out screen a departing employee would get.

### On Upwork (the main experience)
1. Go to any page on **upwork.com** (a job search page is best).
2. Look at the **bottom-right corner** — there's a round terracotta **R** button. That's the launcher. The little amber dot means a job on this page isn't in Reflex yet.
3. Click it. The **panel slides in from the right.**
4. At the top of the panel are four tabs — **Listing · Job · Proposal · Messages.** Click through them:

   - **Listing** — how the status badges look next to jobs (`In Reflex ✓` / `Assigned · Sarthak` / `Add to Reflex`). Click **Add to Reflex** to see it flip. *On a live search-results page, these also try to inject onto the real job rows automatically.*
   - **Job** — Reflex's read on a job: the relevance verdict, the reason, the four colored classification chips, and a **Generate proposal** button (click it — it takes you to the Proposal tab).
   - **Proposal** — the fill flow. Edit the cover letter, hit **Regenerate** to cycle drafts, pick work-sample images, insert a Loom link, and see the AI answer to a screening question. Note the **₹ token cost** under each AI action, and the reminder that **you** click Submit on Upwork.
   - **Messages** — the important one. A mock client message is shown. Click **Suggested reply** → watch it "generate" → a reply card appears. Try the **Warmer / Shorter / More specific** tone toggles (the reply rewrites). Hit **Insert into reply box**. Also try **Summarize** to see the catch-up summary for a job picked up from someone else.

5. Close the panel with the **×** in the top-right of the panel; the launcher comes back.

---

## What's real vs mocked

- **Real:** the entire look, layout, navigation, interactions, states, and the design system. This is the actual UI.
- **Mocked:** all content (jobs, drafts, replies, token costs) and the "generating" delays. Nothing talks to a server. The badges on live Upwork rows use placeholder states that rotate for the demo.

When you're happy with the feel, hand the separate **Claude Code build guide** to Claude Code — it explains exactly how to swap every mock for real backend calls, real auth, and real Upwork field-filling.
