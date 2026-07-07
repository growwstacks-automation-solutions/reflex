/* ============================================================
   Reflex — content script (UI demo scaffold)
   Injects the launcher + panel onto Upwork pages and renders all
   four surfaces with MOCK data. No network calls. Every place that
   needs real wiring is marked TODO(claude-code).

   To rename the product: change SYSTEM_NAME below (and the letter in
   manifest/icons + content.css .rfx-mark if you want the mark to match).
   ============================================================ */
(function () {
  "use strict";
  if (window.__rfxLoaded) return;
  window.__rfxLoaded = true;

  const SYSTEM_NAME = "Reflex"; // <-- single place to rename the product

  /* ─────────────────────────────────────────────────────────────────────────
     SAFETY CONTRACT (protects the reps' Upwork accounts). Audited, must hold:
       • Reactive only — reads the DOM already on the rep's screen. Never scrapes.
       • The ONLY automatic network request is to the Reflex API (localhost / your
         Worker) — NEVER to upwork.com. The extension makes ZERO automated requests
         to Upwork's servers, so Upwork cannot observe any of this activity.
       • Every Upwork-facing action (open a tab, fill a field, actuate a control)
         runs ONLY on an explicit human click. No auto-submit, no auto-refresh,
         no timer-based polling of Upwork.
       • KILL-SWITCH: set REFLEX_ENABLED = false to disable ALL injection instantly.
     ───────────────────────────────────────────────────────────────────────── */
  const REFLEX_ENABLED = true;
  if (!REFLEX_ENABLED) return; // hard off — nothing is injected, no calls are made

  /* ---------- MOCK DATA (replace with API responses) ---------- */
  // MOCK: a job as it would arrive classified from the backend.
  const MOCK_JOB = {
    title: "Build a GoHighLevel automation for lead nurture",
    verdict: "rel", // rel | rev | irr
    verdictLabel: "Relevant",
    reason: "Strong match: GHL + automation, our core service. Clear budget, client hiring now.",
    chips: [
      { k: "tool", t: "GoHighLevel" },
      { k: "use",  t: "Lead nurture" },
      { k: "dept", t: "Marketing" },
      { k: "ind",  t: "Real estate" }
    ],
    budget: "$1.5k–3k",
    connects: 4,
    posted: "18m ago",
    owner: "You",
    actioned: false
  };

  // MOCK: proposal draft variants the "Regenerate" button cycles through.
  const MOCK_DRAFTS = [
    "Hi there — I build GoHighLevel automations for exactly this: lead capture, nurture sequences, pipeline stages, and calendar booking, all wired together so no lead slips. I've set this up for real-estate teams before and can show you a working example on a quick call. I can have your full nurture flow live in 7–10 days. Shall we talk this week?",
    "Hello! Lead nurture in GHL is my core work — I'll connect your forms, build the email/SMS sequences, set the pipeline automations, and tie in calendar booking so follow-up is automatic. Happy to walk you through a live build I've done for a similar client. Realistic timeline is about a week. When works for a short call?"
  ];

  // Work-sample tile colours, cycled across the real image_links for this job.
  const ASSET_PALETTE = ["#3C3489", "#0F6E56", "#0C447C", "#854F0B", "#A32D2D", "#993C1D"];

  // Filename used inside the downloaded zip, derived from the asset URL.
  function assetFilename(url, i) {
    try {
      const last = new URL(url).pathname.split("/").filter(Boolean).pop();
      if (last && /\.[a-z0-9]{2,5}$/i.test(last)) return decodeURIComponent(last);
    } catch (e) { /* not a full URL — fall through */ }
    return `work-sample-${i + 1}.png`;
  }
  // Short, human tile label from a filename ("ghl_pipeline.png" -> "ghl pipeline").
  function assetLabel(name) {
    return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || name;
  }
  // A Google Drive share link (…/file/d/ID/view or …?id=ID) isn't a direct image — turn it
  // into the viewable thumbnail endpoint so an <img> can render it. Other URLs pass through.
  function imageSrcFor(url) {
    const u = String(url || "");
    const m = u.match(/\/file\/d\/([-\w]{10,})/) || u.match(/[?&]id=([-\w]{10,})/);
    if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`;
    return u;
  }
  // image_links (raw screenshot URLs) -> tiles the proposal tab renders + zips.
  function buildAssets(imageLinks) {
    return (Array.isArray(imageLinks) ? imageLinks : []).filter(Boolean).map((raw, i) => {
      const url = String(raw);
      const name = assetFilename(url, i);
      return { url, src: imageSrcFor(url), name, label: assetLabel(name), bg: ASSET_PALETTE[i % ASSET_PALETTE.length] };
    });
  }
  // looms come as "Title — https://loom…" strings; split the title from the URL.
  function parseLoom(s) {
    const raw = String(s || "").trim();
    const m = raw.match(/https?:\/\/\S+/);
    const url = m ? m[0] : "";
    const title = (url ? raw.replace(url, "").replace(/[\s—–-]+$/, "").trim() : raw) || "Loom walkthrough";
    return { title, url, raw };
  }

  // MOCK: a screening question on the job.
  const MOCK_QUESTION = {
    q: "Have you built lead-nurture automations in GoHighLevel before? Briefly describe one.",
    a: "Yes — most recently for a real-estate team: web-form capture into GHL, a 6-step email + SMS nurture sequence, pipeline automations that move leads on reply, and calendar booking. It lifted their booked-call rate noticeably. Happy to show it live."
  };

  // MOCK: the message thread (the hero surface).
  const MOCK_THREAD = [
    { who: "Client · Daniel", side: "them", text: "Hi, thanks for the proposal! Two things — can you give me a fixed price for the full GHL setup, and are you free for a quick call this week?" }
  ];
  // MOCK: suggested replies keyed by tone.
  const MOCK_REPLIES = {
    base:     "Happy to help, Daniel. For the full GoHighLevel setup — pipelines, nurture sequences, and calendar booking — I'd put it at a fixed $1,800, delivered in 7–10 days. I'm free for a quick call Wed or Thu; send a slot that suits you and I'll confirm. Looking forward to it.",
    Warmer:   "Thanks so much, Daniel — really glad the proposal landed! For the full GHL setup (pipelines, nurture sequences, and calendar booking) I'd keep it simple at a fixed $1,800, done in 7–10 days. I'd love to hop on a quick call — Wed or Thu both work for me. Just send a time that's easy for you and I'll lock it in.",
    Shorter:  "Thanks Daniel! Full GHL setup: fixed $1,800, 7–10 days. Free Wed or Thu for a call — send a slot and I'll confirm.",
    "More specific": "Happy to, Daniel. Full GHL setup = lead-capture forms, a 6-step email/SMS nurture sequence, pipeline automations, and calendar booking — fixed $1,800, delivered in 7–10 days with one revision round. I'm free Wed 3–5pm or Thu 11am–1pm IST for a call; pick one and I'll send a calendar invite."
  };
  const MOCK_SUMMARY = "Client reviewed the proposal and is interested — no objections raised. They've asked for (1) a fixed price for the full GHL setup and (2) a call this week. Next step: send the fixed quote and propose two call times.";

  /* ---------- state ---------- */
  let surface = "listing"; // open on the live job-listing replica
  let selectedAssets = new Set();
  let rfxAssets = [];      // work samples for the current proposal (from /generate image_links)
  let rfxLooms = [];       // loom rows for the current proposal (from /generate looms)
  let draftIndex = 0;
  let activeTone = "base";
  let rfxLastOpenId = ""; // last Upwork job id seen open — drives auto-switch to the Job tab
  let rfxGenState = "idle"; // proposal generation: "idle" | "generating" | "ready" | "error"
  let rfxGenStage = "";     // live status line shown while generating (which step we're on)
  let rfxGenJobId = "";     // the job the current proposal draft is for
  let rfxGenResult = null;  // the /generate response (cover letter, answers, portfolio recs, cost)
  let rfxGenError = "";     // last generation error message
  let rfxGenSubmitted = false; // true when the shown proposal was already submitted on Upwork (locks Regenerate)
  let rfxDraftCheckedFor = ""; // job id we've already tried to restore a saved draft for (dedupes the fetch)
  let rfxJobFacts = {};       // jobId -> { title, description, budget, type, posted } from the DB (card fallback on the apply page)
  let rfxAuth = null;       // { token, user } from the background (signed-in rep), or null
  let rfxAddData = null;    // captured job under review in the "Add to Reflex" card
  let rfxAddOpen = false;   // true while the Add review card is showing (suppresses mirror re-render)
  let rfxAddClass = null;   // last /jobs/classify result for the card { token_cost_inr, cache_status, tokens }
  let rfxAddSaved = false;  // true once the open Add card has been persisted (dedupes save-on-leave)
  let rfxAwaitOpenForAdd = null; // jobId the rep wants to add from the listing — waiting for them to open it
  let rfxAwaitOpenForGen = null; // jobId the rep wants to generate for from the listing — waiting for them to open it
  let rfxSubmitState = {};    // proposalId -> "saving" | "saved" (success-page confirm card state)
  let rfxSuccessShownFor = ""; // proposalId we've already rendered the success card for (render-once guard)

  /* ---------- build launcher ---------- */
  const launcher = document.createElement("button");
  launcher.id = "rfx-launcher";
  launcher.innerHTML = `R<span class="rfx-dot" title="1 job on this page not in ${SYSTEM_NAME}"></span>`;
  launcher.addEventListener("click", openPanel);
  document.body.appendChild(launcher);

  /* ---------- build panel shell ---------- */
  const root = document.createElement("div");
  root.id = "rfx-root";
  root.innerHTML = `
    <div class="rfx-header">
      <div class="rfx-mark">R</div>
      <div class="rfx-id">
        <div class="rfx-name">${SYSTEM_NAME}</div>
        <div class="rfx-user">Sign in to sync your jobs</div>
      </div>
      <button class="rfx-move" title="Move panel to the other side">⇄</button>
      <button class="rfx-x" title="Close">×</button>
    </div>
    <div class="rfx-switch">
      <button class="rfx-tab" data-s="listing">Listing</button>
      <button class="rfx-tab" data-s="job">Job</button>
      <button class="rfx-tab" data-s="messages">Messages</button>
    </div>
    <div class="rfx-body" id="rfx-body"></div>
    <div class="rfx-footer"><span class="rfx-sync-dot"></span> Listing is live from Reflex · sign in to sync your assignments</div>
  `;
  document.body.appendChild(root);

  // Closing the panel / switching tabs leaves the Add card — if it was classified but not yet
  // saved, offer to save it first (see confirmLeaveAddCard).
  root.querySelector(".rfx-x").addEventListener("click", () => confirmLeaveAddCard(closePanel));

  // ---------- panel side (bottom-right default, toggle to bottom-left) ----------
  // Both the launcher and the panel share one side. The choice persists per browser
  // profile in chrome.storage.local so it survives reloads. Pure UI — no Upwork touch.
  let rfxSide = "right";
  function applySide(side) {
    rfxSide = side === "left" ? "left" : "right";
    const left = rfxSide === "left";
    launcher.classList.toggle("rfx-left", left);
    root.classList.toggle("rfx-left", left);
    const moveBtn = root.querySelector(".rfx-move");
    if (moveBtn) moveBtn.title = `Move panel to the ${left ? "right" : "left"}`;
  }
  try {
    chrome.storage.local.get("rfx_side", (r) => applySide(r && r.rfx_side));
  } catch (e) { /* storage unavailable — stay on the default right side */ }
  root.querySelector(".rfx-move").addEventListener("click", () => {
    const next = rfxSide === "left" ? "right" : "left";
    applySide(next);
    try { chrome.storage.local.set({ rfx_side: next }); } catch (e) { /* ignore */ }
  });
  root.querySelectorAll(".rfx-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const s = tab.dataset.s;
      confirmLeaveAddCard(() => { surface = s; render(); });
    });
  });

  // Hard close (tab/window closed or navigated away): best-effort save of a classified-but-
  // unsaved Add card so the classification we paid for isn't lost. pagehide fires on real
  // unload (not on mere tab switches), so reps aren't auto-saved just for glancing away.
  window.addEventListener("pagehide", flushAddOnLeave);

  function openPanel() {
    root.classList.add("rfx-open"); launcher.classList.add("rfx-hidden");
    // Gate everything behind sign-in: until the rep is signed in, the panel shows the
    // sign-in prompt instead of any surface. Auth lives in the toolbar popup; we read it
    // from the background (chrome.storage.local) here.
    refreshAuth(() => {
      if (rfxAuth && rfxAuth.token) {
        if (isApplyPage()) {
          surface = "job";                      // apply page -> Job tab (Proposal tab merged in)
          rfxLastOpenId = openJobNumericId();
          captureApplyContext();                // remember job + connects for the post-submit link
        } else if (shouldShowSubmitConfirm()) {
          surface = "job";                      // post-submit success page -> the confirm card
          rfxSuccessShownFor = proposalSuccessId();
        } else {
          const openId = openJobNumericId();
          if (openId) { surface = "job"; rfxLastOpenId = openId; } // a job is open -> show it
        }
        render(); startMirror();
      } else {
        render();                                // signed out -> sign-in gate (no mirror)
      }
    });
  }
  function closePanel() { root.classList.remove("rfx-open"); launcher.classList.remove("rfx-hidden"); stopMirror(); }

  /* ---------- render ---------- */
  function render() {
    rfxAddOpen = false;          // any full render leaves the Add review card
    rfxAwaitOpenForAdd = null;   // ...and clears the "open the job first" prompt
    rfxAwaitOpenForGen = null;   // ...for both the Add and Generate "open the job first" prompts
    updateAuthChrome(); // header user line + footer (signed-in name lives at the bottom)
    root.querySelectorAll(".rfx-tab").forEach(t =>
      t.classList.toggle("rfx-active", t.dataset.s === surface));
    const body = root.querySelector("#rfx-body");
    // Not signed in -> show the sign-in gate instead of any surface.
    if (!rfxAuth || !rfxAuth.token) {
      body.innerHTML = renderAuthGate();
      wire(body);
      return;
    }
    if (surface === "listing")  body.innerHTML = renderListing();
    if (surface === "job")      body.innerHTML = renderJob();
    if (surface === "proposal") body.innerHTML = renderProposal();
    if (surface === "messages") body.innerHTML = renderMessages();
    wire(body);
  }

  /* The signed-in rep's name shows at the bottom of the panel (and the header line).
     Signed out -> the original prompts. */
  function updateAuthChrome() {
    const userEl = root.querySelector(".rfx-user");
    const footEl = root.querySelector(".rfx-footer");
    const signedIn = !!(rfxAuth && rfxAuth.token);
    const nm = signedIn
      ? ((rfxAuth.user && (rfxAuth.user.full_name || rfxAuth.user.email)) || "Signed in")
      : "";
    if (userEl) userEl.textContent = signedIn ? nm : "Sign in to sync your jobs";
    if (footEl) footEl.innerHTML = signedIn
      ? `<span class="rfx-sync-dot"></span> Signed in as ${esc(nm)}`
      : `<span class="rfx-sync-dot"></span> Listing is live from ${SYSTEM_NAME} · sign in to sync your assignments`;
  }

  /* Sign-in gate: shown in the body until the rep signs in via the toolbar popup. */
  function renderAuthGate() {
    return `
      <div class="rfx-context-note">Sign in to ${SYSTEM_NAME} to use this panel — your jobs, proposals, and assignments live behind your account.</div>
      <div class="rfx-authgate">
        <div class="rfx-authgate-ic">🔒</div>
        <div class="rfx-authgate-t">
          <b>Sign in required</b>
          <span>Click the <b>${SYSTEM_NAME}</b> icon in your browser toolbar and sign in, then come back here.</span>
        </div>
        <button class="rfx-btn primary full rfx-mt" data-auth-refresh>I've signed in — refresh</button>
      </div>`;
  }

  /* Read the signed-in rep from the background (chrome.storage.local). */
  function refreshAuth(cb) {
    try {
      chrome.runtime.sendMessage({ type: "GET_AUTH" }, (resp) => {
        rfxAuth = (!chrome.runtime.lastError && resp && resp.token) ? resp : null;
        if (cb) cb();
      });
    } catch (e) { rfxAuth = null; if (cb) cb(); }
  }

  /* Update the live "which stage" line shown while a proposal is generating. Updates the
     element in place (no full re-render) so it stays smooth; rfxGenStage keeps the value so a
     re-render (e.g. the mirror) shows the same stage. No-op once generation isn't showing. */
  function setGenStage(text) {
    rfxGenStage = text;
    const el = root.querySelector("[data-rfx-gen-stage]");
    if (el) el.textContent = text;
  }

  /* Generate a proposal: switch to the Proposal tab, show a waiting state, then call
     the Worker's /generate (Claude) via the background worker and reveal the draft. */
  async function startGeneration(jobId, opts) {
    const stay = !!(opts && opts.stay); // Job tab: render the proposal inline, stay on this tab
    rfxGenJobId = jobId || openJobNumericId();
    rfxGenState = "generating";
    rfxGenStage = "Analyzing the job…";   // first live status line (advanced through the steps below)
    rfxGenResult = null;
    rfxAssets = [];
    rfxLooms = [];
    selectedAssets = new Set();
    rfxGenError = "";
    rfxGenSubmitted = false;       // a fresh generate produces a draft, not a submitted proposal
    rfxDraftCheckedFor = rfxGenJobId; // we're (re)generating this job — don't also restore over it
    if (!stay) surface = "proposal";
    render();
    if (stay) scrollToJobProposal();
    const open = readOpenJob();                       // page-captured context the DB row lacks
    // Personalization: a client's name is hidden on Upwork, but a past freelancer sometimes names
    // them in their public review. Read those review snippets (reactive, read-only) and let the
    // Worker's dedicated extractor pull a first name — so the greeting can be "Hey <Name>" instead
    // of "Hey there". Best-effort + non-fatal: no reviews / no clear name / any error -> null ->
    // the existing "Hey there" fallback. Never blocks generation.
    let clientNameHint = null;
    try {
      const reviews = readClientReviewSnippets();
      if (reviews.length) {
        setGenStage("Extracting client name from client reviews…");
        const nameResp = await apiExtractClientName(reviews);
        if (nameResp && nameResp.client_name) clientNameHint = nameResp.client_name;
      }
    } catch (e) { /* non-fatal — fall back to the generic greeting */ }
    const payload = {
      job_id: rfxGenJobId || "STUB-0001",             // stub mode ignores the id; real mode uses it
      screening_questions: readScreeningQuestionTexts(), // read from the apply page (else none)
      client_name_hint: clientNameHint,               // backend key (renamed in the merge)
      client_context: open && open.client && open.client.length ? open.client.join(" · ") : undefined,
    };
    // The Worker matches work samples/Loom first inside /generate, then Claude writes — reflect
    // that real ordering: show "matching" now, then flip to "writing" if it's still running.
    setGenStage("Matching your work samples & Loom…");
    const writingTimer = setTimeout(() => setGenStage("Writing your proposal…"), 1200);
    const resp = await apiGenerate(payload);
    clearTimeout(writingTimer);
    if (resp && resp.result && !resp.error) {
      rfxGenResult = resp.result;
      // Real work samples + Loom for this job, straight from the /generate response
      // (jobs.image_links / jobs.looms, filled by the asset matcher). All selected by default.
      rfxAssets = buildAssets(resp.result.image_links);
      rfxLooms = (Array.isArray(resp.result.looms) ? resp.result.looms : []).map(parseLoom);
      selectedAssets = new Set(rfxAssets.map((_, i) => i));
      rfxGenState = "ready";
    } else {
      rfxGenError = (resp && resp.error) || "Generation failed";
      rfxGenState = "error";
    }
    render();
    if (stay) scrollToJobProposal();
  }

  // Ask the background worker to POST /generate. Resolves to { result } or { error }.
  function apiGenerate(payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "GENERATE_PROPOSAL", payload }, (resp) => {
          if (chrome.runtime.lastError || !resp) {
            resolve({ error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || "No response from background" });
            return;
          }
          resolve(resp);
        });
      } catch (e) { resolve({ error: String(e) }); }
    });
  }

  /* Read the client's PUBLIC review snippets from the "Client's recent history" section on the
     job-details page — the feedback PAST FREELANCERS left about this client, which is where a
     client's name occasionally leaks (e.g. "great working with Nathan"). We take only the
     freelancer→client reviews (the block WITHOUT "To freelancer:") and skip the client→freelancer
     reviews (those name the freelancer, not the client). Read-only, reactive. Returns [] when the
     section isn't on the page (apply page, or a brand-new client with no history) → "Hey there".
     Anchored on stable data-cy attrs, so it works on both the full job page and the slide-over. */
  function readClientReviewSnippets() {
    const items = document.querySelectorAll("[data-cy='jobs'] [data-cy='job']");
    const out = [];
    items.forEach((item) => {
      item.querySelectorAll(".main .text-body-sm").forEach((block) => {
        // "To freelancer: <name>" block = the client's review OF the freelancer — skip it.
        if (/to\s+freelancer/i.test(block.textContent || "")) return;
        const trunc = block.querySelector(".air3-truncation [id^='air3-truncation-']");
        const t = trunc ? (trunc.textContent || "").replace(/\s+/g, " ").trim() : "";
        if (t && !/no feedback given/i.test(t)) out.push(t.slice(0, 300));
      });
    });
    return out.slice(0, 8);
  }

  // Ask the background worker to POST /jobs/client-name. Resolves to { client_name } (string|null)
  // or null on any error — the caller treats a missing name as "Hey there" (never blocks generate).
  function apiExtractClientName(reviews) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "EXTRACT_CLIENT_NAME", payload: { reviews } }, (resp) => {
          if (chrome.runtime.lastError || !resp) { resolve(null); return; }
          resolve(resp);
        });
      } catch (e) { resolve(null); }
    });
  }

  // Ask the background worker to POST /jobs/proposal — the stored draft for one job.
  // Resolves to { drafted, submitted, cover_letter, screening_answers, looms, image_links } or { error }.
  function apiProposalDraft(jobId) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "PROPOSAL_DRAFT", payload: { job_id: jobId } }, (resp) => {
          if (chrome.runtime.lastError || !resp) {
            resolve({ error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || "No response from background" });
            return;
          }
          resolve(resp);
        });
      } catch (e) { resolve({ error: String(e) }); }
    });
  }

  // If this job already has a saved proposal draft, RESTORE it into the panel instead of
  // re-generating (saves the model call/cost). Best-effort: any failure leaves the normal
  // "Generate" CTA in place. Deduped per job via rfxDraftCheckedFor; skips when a proposal is
  // already showing/in-flight for this job.
  async function maybeRestoreDraft(jobId) {
    if (!jobId) return;
    if (rfxDraftCheckedFor === jobId) return;                    // already fetched this job this session
    rfxDraftCheckedFor = jobId;
    const resp = await apiProposalDraft(jobId);
    if (!resp || resp.error) { rfxDraftCheckedFor = ""; return; } // allow a retry on transient error
    // Capture the job's DB display facts (title/budget/posted/description) — the Job-tab card
    // uses them on the apply page, where the page DOM doesn't expose the real job details.
    if (resp.job && (resp.job.title || resp.job.budget || resp.job.posted || resp.job.description)) {
      rfxJobFacts[jobId] = resp.job;
      if (surface === "job") render();
    }
    // Restore the draft, unless a fresh / in-flight proposal for this job is already on screen.
    if (rfxGenJobId === jobId && (rfxGenState === "generating" || rfxGenState === "ready")) return;
    if (!resp.drafted || !resp.cover_letter) return;
    rfxGenJobId = jobId;
    rfxGenResult = {
      cover_letter: resp.cover_letter,
      screening_answers: Array.isArray(resp.screening_answers) ? resp.screening_answers : [],
      portfolio_recommendations: Array.isArray(resp.portfolio_recommendations) ? resp.portfolio_recommendations : [],
      client_name_used: null,
    };
    rfxAssets = buildAssets(Array.isArray(resp.image_links) ? resp.image_links : []);
    rfxLooms = (Array.isArray(resp.looms) ? resp.looms : []).map(parseLoom);
    selectedAssets = new Set(rfxAssets.map((_, i) => i));
    rfxGenState = "ready";
    rfxGenSubmitted = !!resp.submitted;
    if (surface === "job") render();
  }

  // Screening question texts on the current page (apply page). Empty elsewhere.
  function readScreeningQuestionTexts() {
    try { return readScreeningQuestions().map((q) => q.question).filter(Boolean); }
    catch (e) { return []; }
  }

  /* ---- Add to Reflex (inline review card) ----
     Clicking "+ Add to Reflex" opens a review card IN the panel showing what we captured
     from the page; Confirm POSTs it to the Worker (/jobs/add), which inserts it and claims
     it for the signed-in rep. Read-only capture — we never write to Upwork. */

  // Build the Add payload. Rich when the job under the cursor is the one open on Upwork
  // (readOpenJob); otherwise (a listing card for a job that isn't open) just id + title.
  // Best-effort skill chips from the "Skills and Expertise" area (skips the "+N more" pill;
  // skills hidden behind it aren't in the DOM until expanded). Tries the common selectors.
  function readSkillTokens(region) {
    const out = [];
    region.querySelectorAll(
      "[data-test='Skill'] a, [data-test='Skill'], [data-test='token'], .air3-token, .up-skill-badge, .skill-name"
    ).forEach((el) => {
      const t = (el.textContent || "").trim().replace(/\s+/g, " ");
      if (t && !/^\+\s*\d+\s*more$/i.test(t) && t.length <= 40) out.push(t);
    });
    return Array.from(new Set(out)).slice(0, 25);
  }

  // Best-effort client country/city from the "About the client" block (selectors vary).
  function readClientLocation(region) {
    const el = region.querySelector(
      "[data-qa='client-location'], [data-test='client-location'], [data-test='LocationLabel']"
    );
    if (!el) return { country: "", city: "" };
    const parts = (el.textContent || "").split(/\n|·/).map((s) => s.trim()).filter(Boolean);
    return { country: parts[0] || "", city: parts[1] || "" };
  }

  // Locate the "About the client" sidebar. Upwork gives it a stable container test-id
  // (data-test="about-client-container AboutClientUserShared AboutClientUser"); fall back to the
  // "About the client" heading (an <h5>) if the markup ever changes. Returns the element, or null.
  function findClientSection() {
    const direct = document.querySelector(
      "[data-test~='about-client-container'], .cfe-ui-job-about-client, [data-test*='AboutClientUser'], [data-qa='client-location']"
    );
    if (direct) return direct.closest("[data-test~='about-client-container'], .cfe-ui-job-about-client") || direct;
    const h = Array.from(document.querySelectorAll("h2, h3, h4, h5, strong, div, span, p"))
      .find((el) => { const t = (el.textContent || "").trim(); return /^about the client$/i.test(t) && t.length < 30; });
    if (!h) return null;
    let el = h;
    for (let i = 0; i < 7 && el.parentElement; i++) {
      el = el.parentElement;
      const t = el.textContent || "";
      if (/(payment method verified|jobs posted|total spent|member since|hire rate)/i.test(t) && !/proposal settings/i.test(t)) return el;
    }
    return null;
  }

  // ISO-2 code for the common client countries (best-effort; blank if unknown -> rep can edit).
  const COUNTRY_CODES = {
    "united states": "US", "united kingdom": "GB", "united arab emirates": "AE", "canada": "CA",
    "australia": "AU", "india": "IN", "germany": "DE", "france": "FR", "netherlands": "NL",
    "spain": "ES", "italy": "IT", "ireland": "IE", "switzerland": "CH", "sweden": "SE",
    "norway": "NO", "denmark": "DK", "belgium": "BE", "austria": "AT", "poland": "PL",
    "portugal": "PT", "singapore": "SG", "new zealand": "NZ", "israel": "IL", "saudi arabia": "SA",
    "qatar": "QA", "kuwait": "KW", "south africa": "ZA", "brazil": "BR", "mexico": "MX",
    "japan": "JP", "china": "CN", "hong kong": "HK", "south korea": "KR", "croatia": "HR",
    "greece": "GR", "turkey": "TR", "ukraine": "UA", "romania": "RO", "philippines": "PH",
    "pakistan": "PK", "bangladesh": "BD", "nigeria": "NG", "egypt": "EG", "finland": "FI",
    "czech republic": "CZ", "hungary": "HU", "indonesia": "ID", "malaysia": "MY", "thailand": "TH",
  };
  function countryCode(name) {
    return COUNTRY_CODES[String(name || "").trim().toLowerCase()] || "";
  }

  // Parse the client facts the Add form keeps: country, city, timezone, spend, payment-verified,
  // hires. Upwork's per-field selectors drift, so we read the sidebar's TEXT LINES instead — the
  // client location renders as "<Country>\n<City>  <local time>", reliable across layouts.
  function readClientInfo(section) {
    const out = { country: "", city: "", timezone: "", spend: "", payment_verified: null, total_hired: "" };
    if (!section) return out;
    const T = (el) => (el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "");
    const sectionTxt = T(section);
    out.payment_verified = /payment method verified/i.test(sectionTxt) ? true : null;

    // Location: <li data-qa="client-location"> has <strong>Country</strong> and a <div> with the
    // city span + a [data-test="LocalTime"] span. Use the structure — no text guessing.
    const locEl = section.querySelector("[data-qa='client-location']");
    if (locEl) {
      out.country = T(locEl.querySelector("strong")) || out.country;
      const timeEl = locEl.querySelector("[data-test='LocalTime']");
      const localTime = T(timeEl);
      const cityEl = Array.from(locEl.querySelectorAll("span")).find(
        (s) => s !== timeEl && T(s) && !/\b\d{1,2}:\d{2}\b/.test(T(s))
      );
      out.city = T(cityEl) || T(locEl.querySelector("div")).replace(/\s*\d{1,2}:\d{2}\s*(?:am|pm)?\s*$/i, "").trim();
      // Approximate the client's UTC offset from their shown local time vs current UTC.
      const tm = localTime.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
      if (tm) {
        let h = Number(tm[1]) % 12; if (/pm/i.test(tm[3])) h += 12;
        const now = new Date();
        let diff = (h * 60 + Number(tm[2])) - (now.getUTCHours() * 60 + now.getUTCMinutes());
        if (diff > 720) diff -= 1440; if (diff <= -720) diff += 1440;
        const off = Math.round(diff / 30) * 30;
        const ah = Math.floor(Math.abs(off) / 60); const am = Math.abs(off) % 60;
        out.timezone = `UTC${off >= 0 ? "+" : "-"}${ah}${am ? ":" + String(am).padStart(2, "0") : ""}`;
      }
    }

    // Spend / hires: prefer the structured cells, fall back to the section text.
    const spendTxt = T(section.querySelector("[data-qa='client-spend']")) || sectionTxt;
    const sm = spendTxt.match(/(\$[\d.,]+\s*[kmb]?\+?)\s*(?:total\s*)?spent/i);
    if (sm) out.spend = sm[1].replace(/\s+/g, "").trim();
    const hiresTxt = T(section.querySelector("[data-qa='client-hires']")) || sectionTxt;
    const hm = hiresTxt.match(/(\d+)\s+hires?\b/i);
    if (hm) out.total_hired = Number(hm[1]);
    return out;
  }

  // ISO YYYY-MM-DD for a Date.
  function isoDate(d) { return d.toISOString().slice(0, 10); }
  // Upwork's project-length buckets -> an approximate engagement in weeks (the column is numeric).
  function durationToWeeks(s) {
    const t = String(s || "").toLowerCase();
    if (!t) return "";
    if (/less than 1 month/.test(t)) return 4;
    if (/1 to 3 months/.test(t)) return 12;
    if (/3 to 6 months/.test(t)) return 24;
    if (/more than 6 months|6\+\s*months/.test(t)) return 26;
    const r = t.match(/(\d+)\s*to\s*(\d+)\s*months?/);
    if (r) return Math.round(((Number(r[1]) + Number(r[2])) / 2) * 4.345);
    const one = t.match(/(\d+)\s*months?/);
    if (one) return Math.round(Number(one[1]) * 4.345);
    return "";
  }
  // "Posted Jun 30, 2026" or relative "Posted 3 days ago"/"2 weeks ago"/"yesterday" -> YYYY-MM-DD.
  function postedToISO(s) {
    const t = String(s || "").trim();
    if (!t) return "";
    const abs = t.match(/([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/);
    if (abs) { const d = new Date(abs[1]); if (!isNaN(d.getTime())) return isoDate(d); }
    const now = new Date();
    if (/yesterday/i.test(t)) { now.setDate(now.getDate() - 1); return isoDate(now); }
    const rel = t.match(/(\d+)\s*(minute|hour|day|week|month)s?\s*ago/i);
    if (rel) {
      const n = Number(rel[1]); const u = rel[2].toLowerCase();
      if (u === "day") now.setDate(now.getDate() - n);
      else if (u === "week") now.setDate(now.getDate() - n * 7);
      else if (u === "month") now.setMonth(now.getMonth() - n);
      // minutes / hours -> still today
      return isoDate(now);
    }
    return "";
  }

  function collectAddData(jobId, fallbackTitle) {
    const open = readOpenJob();
    if (!(open && open.id === jobId)) {
      return { upwork_job_id: jobId, title: (fallbackTitle || "").trim() || "(untitled job)" };
    }
    // Scope to the job-detail region; fall back to the page body on a detail page.
    const region = findDetailRegion() || document.body;
    const text = (region.textContent || "").replace(/\s+/g, " ");
    const pick = (re) => { const m = text.match(re); return m ? (m[1] != null ? m[1] : m[0]).trim() : ""; };

    // Type + budget come from the SAME page parse the Job card shows (parseTileBudget), so the
    // saved record matches what the rep sees — not the old loose "/fixed-price/" + first-$ guess.
    const contract_type = open.type || "";
    const budget_text = open.budget || pick(/\$[\d.,]+(?:\.\d{2})?(?:\s*-\s*\$?[\d.,]+)?(?:\s*\/\s*hr)?/i);

    // Experience / workload / duration: prefer the parsed meta grid (open.meta — the same chips the
    // card shows), fall back to scanning the region text. This is the Upwork "Experience Level /
    // Duration / hrs-per-week" block, which used to come through empty.
    const metaStr = (open.meta || []).join(" · ");
    const grab = (re) => { const m = (metaStr.match(re) || text.match(re)); return m ? (m[1] != null ? m[1] : m[0]).trim() : ""; };
    const expRaw = grab(/\b(entry level|intermediate|expert)\b/i).toLowerCase();
    const experience_level = expRaw === "entry level" ? "Entry level"
      : expRaw === "intermediate" ? "Intermediate" : expRaw === "expert" ? "Expert" : "";
    // Hourly workload commitment ("Less than 30 hrs/week", "More than 30 hrs/week").
    const hourly_budget_type = grab(/(?:less than|more than|up to)\s*\d+\s*hrs?\/week/i);
    // Project duration bucket -> engagement weeks (approx).
    const engagement_weeks = durationToWeeks(grab(/(less than 1 month|1 to 3 months|3 to 6 months|more than 6 months|6\+\s*months|\d+\s*to\s*\d+\s*months?)/i));
    // Posted date -> YYYY-MM-DD (page shows it relative or absolute).
    const posted_at = postedToISO(open.posted) || postedToISO(pick(/Posted\b[^·|]{0,30}?(?:ago|\d{4})/i));

    // Client facts come ONLY from the "About the client" sidebar — never scanned from elsewhere on
    // the page (that's how the job's "Worldwide" header or a stray "$…spent" leaked in before). If
    // the section isn't present, the client fields stay blank (editable) rather than guessed.
    const cinfo = readClientInfo(findClientSection());
    const client_spend = cinfo.spend;
    const client_payment_verified = cinfo.payment_verified;
    const loc = { country: cinfo.country, city: cinfo.city };

    // Structured budget: pull the $ number(s) out of budget_text and route by contract type.
    const moneyNums = (budget_text.match(/[\d.,]+/g) || [])
      .map((x) => Number(x.replace(/,/g, "")))
      .filter((n) => Number.isFinite(n));
    const fixed_currency = /\$/.test(budget_text) ? "USD" : "";
    let fixed_amount = "", fixed_amount_max = "", hourly_min = "", hourly_max = "";
    if (contract_type === "Hourly") {
      if (moneyNums[0] != null) hourly_min = moneyNums[0];
      if (moneyNums[1] != null) hourly_max = moneyNums[1];
    } else if (contract_type === "Fixed-price") {
      if (moneyNums[0] != null) fixed_amount = moneyNums[0];
      if (moneyNums[1] != null) fixed_amount_max = moneyNums[1];
    }
    const total_hired = cinfo.total_hired; // from the "About the client" section only

    return {
      upwork_job_id: jobId,
      title: open.title || fallbackTitle || "(untitled job)",
      description: open.description || "",
      url: location.href,                              // the open job's real Upwork URL
      skills: readSkillTokens(region),
      budget_text,
      contract_type,
      experience_level,
      client_country: loc.country,
      client_city: loc.city,
      client_spend,
      client_payment_verified,
      // Structured budget / terms (auto where parseable; editable otherwise)
      fixed_amount, fixed_amount_max, fixed_currency,
      hourly_min, hourly_max, hourly_budget_type,
      engagement_weeks, posted_at,
      // Client detail (timezone approximated from the client's local time; rest editable)
      client_country_code: countryCode(loc.country), client_timezone: cinfo.timezone || "",
      client_billing_type: "", last_client_activity: "",
      // Activity / competition (mostly editable; total_hired best-effort)
      has_bids: null, bid_min_rate: "", bid_avg_rate: "", bid_max_rate: "",
      invites_sent: "", total_invited_to_interview: "", total_hired,
      total_offered: "", total_unanswered_invites: "",
      // Attachments (apply-page only — editable)
      attachments_count: "", attachments_filenames: "",
    };
  }

  // Ask the background to POST /jobs/add. Resolves to { ok, status } or { error }.
  function apiAddJob(payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "ADD_JOB", payload }, (resp) => {
          if (chrome.runtime.lastError || !resp) {
            resolve({ error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || "No response from background" });
            return;
          }
          resolve(resp);
        });
      } catch (e) { resolve({ error: String(e) }); }
    });
  }

  // Defaults for the editable AI fields (hardcoded until a classifier exists). Values match
  // the DB: verdict is the job_verdict enum, quality is text. Kept in sync with addJob.ts.
  const ADD_AI_DEFAULTS = {
    verdict: "review",  // relevant | review | irrelevant
    quality: "medium",  // good | medium | poor
    reason: "Added manually from the extension — pending classification.",
  };

  // The editable Add form — every non-system field as an input, prefilled from the page
  // capture. AI fields use the hardcoded defaults (editable). Owner + Upwork id are
  // system/identity, shown read-only.
  function renderAddForm(d) {
    const val = (x) => esc(x == null ? "" : x);
    const text = (k, label, v, ph) =>
      `<label class="rfx-add-frow"><span class="rfx-add-k">${esc(label)}</span>` +
      `<input class="rfx-add-input" data-f="${k}" value="${val(v)}" placeholder="${esc(ph || "")}"></label>`;
    const numf = (k, label, v) =>
      `<label class="rfx-add-frow"><span class="rfx-add-k">${esc(label)}</span>` +
      `<input class="rfx-add-input" type="number" min="0" step="any" data-f="${k}" value="${val(v)}"></label>`;
    const area = (k, label, v) =>
      `<label class="rfx-add-frow col"><span class="rfx-add-k">${esc(label)}</span>` +
      `<textarea class="rfx-edit" data-f="${k}">${val(v)}</textarea></label>`;
    const sel = (k, label, v, opts) =>
      `<label class="rfx-add-frow"><span class="rfx-add-k">${esc(label)}</span>` +
      `<select class="rfx-add-select" data-f="${k}">` +
      opts.map((o) => `<option value="${esc(o.v)}"${o.v === (v == null ? "" : String(v)) ? " selected" : ""}>${esc(o.t)}</option>`).join("") +
      `</select></label>`;

    const ai = ADD_AI_DEFAULTS;
    const ownerName = (rfxAuth && rfxAuth.user && (rfxAuth.user.full_name || rfxAuth.user.email)) || "you";
    const skillsStr = Array.isArray(d.skills) ? d.skills.join(", ") : (d.skills || "");
    const pay = d.client_payment_verified === true ? "true" : d.client_payment_verified === false ? "false" : "";
    const hb = d.has_bids === true ? "true" : d.has_bids === false ? "false" : "";

    return `
      <div class="rfx-context-note">${SYSTEM_NAME} auto-checks relevance. Review the captured fields below, then confirm — the job is added to your board and claimed by you.</div>

      <div class="rfx-prop-sec rfx-add-ai">
        <div class="rfx-add-aihead">
          <div class="rfx-section-label">AI classification</div>
          <button class="rfx-btn primary sm" data-classify><span class="rfx-spark">✦</span> Re-check</button>
        </div>
        <div class="rfx-add-aicost hidden" data-aicost></div>
        <div class="rfx-ai-wrap">
          <div class="rfx-ai-fields${rfxAddClass ? " rfx-ai-locked" : " rfx-blur"}" data-ai-fields>
            <div class="rfx-ai-2col">
              ${sel("verdict", "Relevance", d.verdict || ai.verdict, [{ v: "relevant", t: "Relevant" }, { v: "review", t: "Needs review" }, { v: "irrelevant", t: "Not a fit" }])}
              ${sel("quality", "Quality", d.quality || ai.quality, [{ v: "good", t: "Good" }, { v: "medium", t: "Medium" }, { v: "poor", t: "Poor" }])}
            </div>
            ${area("reason", "Reason", d.reason || ai.reason)}
          </div>
          <div class="rfx-ai-veil">Checking relevance…</div>
        </div>
      </div>

      <div class="rfx-prop-sec">
        <div class="rfx-section-label">Job — captured from Upwork (editable)</div>
        ${text("title", "Title", d.title)}
        ${text("budget_text", "Budget", d.budget_text)}
        ${sel("contract_type", "Type", d.contract_type, [{ v: "", t: "—" }, { v: "Fixed-price", t: "Fixed-price" }, { v: "Hourly", t: "Hourly" }])}
        ${sel("experience_level", "Experience", d.experience_level, [{ v: "", t: "—" }, { v: "Entry level", t: "Entry level" }, { v: "Intermediate", t: "Intermediate" }, { v: "Expert", t: "Expert" }])}
        ${numf("connects", "Connects", d.connects)}
        ${text("skills", "Skills", skillsStr, "comma, separated")}
        ${text("url", "URL", d.url)}
        ${area("description", "Description", d.description)}
      </div>

      <div class="rfx-prop-sec">
        <div class="rfx-section-label">Budget &amp; terms (editable)</div>
        ${numf("fixed_amount", "Fixed amount", d.fixed_amount)}
        ${numf("fixed_amount_max", "Fixed amount (max)", d.fixed_amount_max)}
        ${text("fixed_currency", "Currency", d.fixed_currency, "USD")}
        ${numf("hourly_min", "Hourly min", d.hourly_min)}
        ${numf("hourly_max", "Hourly max", d.hourly_max)}
        ${text("hourly_budget_type", "Hourly budget type", d.hourly_budget_type)}
        ${numf("engagement_weeks", "Engagement (weeks)", d.engagement_weeks)}
        ${text("posted_at", "Posted at", d.posted_at, "YYYY-MM-DD")}
      </div>

      <div class="rfx-prop-sec">
        <div class="rfx-section-label">Client (editable)</div>
        ${text("client_country", "Country", d.client_country)}
        ${text("client_country_code", "Country code", d.client_country_code, "US")}
        ${text("client_city", "City", d.client_city)}
        ${text("client_timezone", "Timezone", d.client_timezone)}
        ${text("client_spend", "Spend", d.client_spend)}
        ${text("client_billing_type", "Billing type", d.client_billing_type)}
        ${sel("client_payment_verified", "Payment", pay, [{ v: "", t: "Unknown" }, { v: "true", t: "Verified" }, { v: "false", t: "Not verified" }])}
        ${text("last_client_activity", "Last client activity", d.last_client_activity, "YYYY-MM-DD")}
      </div>

      <div class="rfx-prop-sec">
        <div class="rfx-section-label">Activity &amp; competition (editable)</div>
        ${sel("has_bids", "Has bids", hb, [{ v: "", t: "Unknown" }, { v: "true", t: "Yes" }, { v: "false", t: "No" }])}
        ${numf("bid_min_rate", "Bid min rate", d.bid_min_rate)}
        ${numf("bid_avg_rate", "Bid avg rate", d.bid_avg_rate)}
        ${numf("bid_max_rate", "Bid max rate", d.bid_max_rate)}
        ${numf("invites_sent", "Invites sent", d.invites_sent)}
        ${numf("total_invited_to_interview", "Invited to interview", d.total_invited_to_interview)}
        ${numf("total_hired", "Total hired", d.total_hired)}
        ${numf("total_offered", "Total offered", d.total_offered)}
        ${numf("total_unanswered_invites", "Unanswered invites", d.total_unanswered_invites)}
      </div>

      <div class="rfx-prop-sec">
        <div class="rfx-section-label">Attachments (editable)</div>
        ${numf("attachments_count", "Attachments count", d.attachments_count)}
        ${text("attachments_filenames", "Attachment filenames", d.attachments_filenames, "comma, separated")}
      </div>

      <div class="rfx-prop-sec">
        <div class="rfx-section-label">Set automatically</div>
        <div class="rfx-add-row"><span class="rfx-add-k">Owner</span><span class="rfx-add-v">${esc(ownerName)} (you)</span></div>
        <div class="rfx-add-row"><span class="rfx-add-k">Upwork ID</span><span class="rfx-add-v">${d.upwork_job_id ? esc(d.upwork_job_id) : `<span class="rfx-add-empty">—</span>`}</span></div>
      </div>

      <div class="rfx-add-err hidden" data-add-err></div>
      <div class="rfx-between rfx-mt">
        <button class="rfx-btn ghost" data-add-cancel>Cancel</button>
        <button class="rfx-btn primary" data-add-confirm>Confirm add</button>
      </div>`;
  }

  // Read the editable form back into an Add payload.
  function readAddForm(body) {
    const get = (k) => { const el = body.querySelector(`[data-f="${k}"]`); return el ? el.value : ""; };
    const numV = (k) => { const v = get(k); return v === "" ? null : Number(v); };
    const intV = (k) => { const v = get(k); return v === "" ? null : Math.trunc(Number(v)); };
    const pay = get("client_payment_verified");
    const hb = get("has_bids");
    const connects = get("connects");
    return {
      upwork_job_id: (rfxAddData && rfxAddData.upwork_job_id) || "",
      title: get("title").trim(),
      description: get("description"),
      url: get("url"),
      skills: get("skills").split(",").map((x) => x.trim()).filter(Boolean),
      budget_text: get("budget_text"),
      contract_type: get("contract_type"),
      experience_level: get("experience_level"),
      connects: connects === "" ? null : Number(connects),
      client_country: get("client_country"),
      client_city: get("client_city"),
      client_spend: get("client_spend"),
      client_payment_verified: pay === "true" ? true : pay === "false" ? false : null,
      // Structured budget / terms
      fixed_amount: numV("fixed_amount"),
      fixed_amount_max: numV("fixed_amount_max"),
      fixed_currency: get("fixed_currency"),
      hourly_min: numV("hourly_min"),
      hourly_max: numV("hourly_max"),
      hourly_budget_type: get("hourly_budget_type"),
      engagement_weeks: intV("engagement_weeks"),
      posted_at: get("posted_at"),
      // Client detail
      client_country_code: get("client_country_code"),
      client_timezone: get("client_timezone"),
      client_billing_type: get("client_billing_type"),
      last_client_activity: get("last_client_activity"),
      // Activity / competition
      has_bids: hb === "true" ? true : hb === "false" ? false : null,
      bid_min_rate: numV("bid_min_rate"),
      bid_avg_rate: numV("bid_avg_rate"),
      bid_max_rate: numV("bid_max_rate"),
      invites_sent: intV("invites_sent"),
      total_invited_to_interview: intV("total_invited_to_interview"),
      total_hired: intV("total_hired"),
      total_offered: intV("total_offered"),
      total_unanswered_invites: intV("total_unanswered_invites"),
      // Attachments
      attachments_count: intV("attachments_count"),
      attachments_filenames: get("attachments_filenames"),
      // AI fields
      verdict: get("verdict") || "review",
      quality: get("quality") || "medium",
      reason: get("reason"),
      // Classification cost telemetry (set by Check relevance; null if never run)
      token_cost_inr: rfxAddClass ? rfxAddClass.token_cost_inr : null,
      cache_status: rfxAddClass ? rfxAddClass.cache_status : null,
    };
  }

  // Listing Add: we don't have the job's details yet. Ask the rep to open it on Upwork;
  // the mirror then auto-switches to the Job tab (where Add captures the full record).
  function renderOpenJobPrompt(title) {
    return `
      <div class="rfx-context-note">To add a job, ${SYSTEM_NAME} needs its full details — open it on Upwork first.</div>
      <div class="rfx-authgate">
        <div class="rfx-authgate-ic">📄</div>
        <div class="rfx-authgate-t">
          <b>Open the job first</b>
          <span>Click <b>${esc(title || "this job")}</b> on Upwork to open its details. ${SYSTEM_NAME} will switch to the <b>Job</b> tab automatically, where you can add it with all its fields.</span>
        </div>
        <button class="rfx-btn ghost full rfx-mt" data-openprompt-cancel>Back to listing</button>
      </div>`;
  }

  function promptOpenJobToAdd(jobId, title) {
    rfxAwaitOpenForAdd = jobId;
    const body = root.querySelector("#rfx-body");
    body.innerHTML = renderOpenJobPrompt(title);
    const cancel = body.querySelector("[data-openprompt-cancel]");
    if (cancel) cancel.addEventListener("click", () => { rfxAwaitOpenForAdd = null; render(); });
  }

  // Listing Generate: like Add, we need the open job's context (screening questions, client
  // facts) to generate a good proposal. Ask the rep to open it on Upwork first; the mirror then
  // auto-switches to the Job tab and kicks off generation there (inline below the card).
  function renderGenJobPrompt(title) {
    return `
      <div class="rfx-context-note">To generate a proposal, ${SYSTEM_NAME} needs the open job — open it on Upwork first.</div>
      <div class="rfx-authgate">
        <div class="rfx-authgate-ic">✦</div>
        <div class="rfx-authgate-t">
          <b>Open the job first</b>
          <span>Click <b>${esc(title || "this job")}</b> on Upwork to open it. ${SYSTEM_NAME} will switch to the <b>Job</b> tab and generate the proposal there automatically.</span>
        </div>
        <button class="rfx-btn ghost full rfx-mt" data-openprompt-cancel>Back to listing</button>
      </div>`;
  }

  function promptOpenJobToGenerate(jobId, title) {
    rfxAwaitOpenForGen = jobId;
    const body = root.querySelector("#rfx-body");
    body.innerHTML = renderGenJobPrompt(title);
    const cancel = body.querySelector("[data-openprompt-cancel]");
    if (cancel) cancel.addEventListener("click", () => { rfxAwaitOpenForGen = null; render(); });
  }

  function openAddReview(jobId, fallbackTitle) {
    if (!jobId) return;
    rfxAddData = collectAddData(jobId, fallbackTitle);
    rfxAddClass = null; // fresh card — no classification yet
    rfxAddSaved = false; // fresh card — not yet persisted
    rfxAddOpen = true; // hold off the mirror so Upwork DOM churn won't wipe this card
    const body = root.querySelector("#rfx-body");
    body.innerHTML = renderAddForm(rfxAddData);
    const cancel = body.querySelector("[data-add-cancel]");
    if (cancel) cancel.addEventListener("click", () => confirmLeaveAddCard(() => render()));
    const confirm = body.querySelector("[data-add-confirm]");
    if (confirm) confirm.addEventListener("click", () => submitAdd(confirm));
    const classifyBtn = body.querySelector("[data-classify]");
    if (classifyBtn) {
      classifyBtn.addEventListener("click", () => runClassify(classifyBtn, body));
      runClassify(classifyBtn, body); // auto-run on open — the rep no longer clicks "Check relevance"
    }
  }

  // Job-tab "Add to Reflex": the same Add review process, but the job card slides to the
  // BOTTOM and the form sits on top. On a successful add we re-render the Job tab — the
  // job is now in the DB, so the card shows only Generate (enabled). (Cancel returns to it.)
  function openJobAddReview(jobId, fallbackTitle) {
    if (!jobId) return;
    rfxAddData = collectAddData(jobId, fallbackTitle);
    rfxAddClass = null; // fresh card — no classification yet
    rfxAddSaved = false; // fresh card — not yet persisted
    rfxAddOpen = true; // hold off the mirror so Upwork DOM churn won't wipe this card
    const body = root.querySelector("#rfx-body");
    // Card pinned to the TOP as the header; the Add process (form) follows below it.
    // The card is collapsed (title only) with a toggle to expand the full job details back.
    body.innerHTML =
      jobMinCardHTML(rfxAddData, fallbackTitle) +
      `<div id="rfx-jobadd-form">${renderAddForm(rfxAddData)}</div>`;
    // Scroll up to the top of the process (the rep may have been scrolled deep in the job).
    // rAF so the swap has laid out before we scroll, else the assignment is clobbered.
    requestAnimationFrame(() => { if (body.scrollTo) body.scrollTo({ top: 0, behavior: "smooth" }); else body.scrollTop = 0; });
    wireJobMinCard(body);
    const cancel = body.querySelector("[data-add-cancel]");
    if (cancel) cancel.addEventListener("click", () => confirmLeaveAddCard(() => render()));
    const confirm = body.querySelector("[data-add-confirm]");
    if (confirm) confirm.addEventListener("click", () => submitAdd(confirm));
    const classifyBtn = body.querySelector("[data-classify]");
    if (classifyBtn) {
      classifyBtn.addEventListener("click", () => runClassify(classifyBtn, body));
      runClassify(classifyBtn, body); // auto-run on open — the rep no longer clicks "Check relevance"
    }
  }

  // The collapsed "Adding this job" header card. Title is always shown; the chevron expands
  // the captured details (type · budget, experience, client, description) back into view.
  function jobMinCardHTML(d, fallbackTitle) {
    d = d || {};
    const title = d.title || fallbackTitle || "(this job)";
    const metaLine = [d.contract_type, d.budget_text].filter(Boolean).join(" · ");
    const tags = [d.experience_level, d.client_country, d.client_spend].filter(Boolean)
      .map((x) => `<span class="rfx-jt-posted">${esc(x)}</span>`).join("");
    const details =
      (metaLine ? `<div class="rfx-jt-meta"><span class="rfx-jt-budget">${esc(metaLine)}</span>${tags}</div>`
        : (tags ? `<div class="rfx-jt-meta">${tags}</div>` : "")) +
      (d.description ? `<div class="rfx-jobdesc">${esc(d.description)}</div>` : "");
    return `<div class="rfx-job-card rfx-job-card-min" data-collapsed="1">
      <div class="rfx-jc-min-head">
        <div class="rfx-jc-min-id">
          <div class="rfx-jc-min-cap">Adding this job to ${SYSTEM_NAME}</div>
          <div class="rfx-job-title">${esc(title)}</div>
        </div>
        <button class="rfx-jc-min-toggle" data-jobcard-toggle aria-expanded="false" title="Show job details">▾</button>
      </div>
      <div class="rfx-jc-min-body"${details ? "" : " data-empty"} hidden>${details || `<div class="rfx-add-note">No extra detail captured for this job.</div>`}</div>
    </div>`;
  }

  function wireJobMinCard(scope) {
    const toggle = scope.querySelector("[data-jobcard-toggle]");
    if (!toggle) return;
    toggle.addEventListener("click", () => {
      const card = toggle.closest(".rfx-job-card-min");
      const det = card && card.querySelector(".rfx-jc-min-body");
      const collapsed = card.getAttribute("data-collapsed") === "1";
      card.setAttribute("data-collapsed", collapsed ? "0" : "1");
      if (det) det.hidden = !collapsed; // collapsed -> now expanded -> show
      toggle.setAttribute("aria-expanded", collapsed ? "true" : "false");
      toggle.title = collapsed ? "Hide job details" : "Show job details";
    });
  }

  // Scroll the panel to the inline proposal (the Job tab's Generate flow renders it below).
  function scrollToJobProposal() {
    const body = root.querySelector("#rfx-body");
    const el = body && body.querySelector("#rfx-job-proposal");
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Ask the background to POST /jobs/classify. Resolves to { result } or { error }.
  function apiClassify(payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "CLASSIFY_JOB", payload }, (resp) => {
          if (chrome.runtime.lastError || !resp) {
            resolve({ error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || "No response from background" });
            return;
          }
          resolve(resp);
        });
      } catch (e) { resolve({ error: String(e) }); }
    });
  }

  // "Check relevance": classify the job as currently edited, fill the AI fields in place,
  // and show the token/cost badge. The classification cost is stored (rfxAddClass) so the
  // confirm step persists token_cost_inr + cache_status to the DB.
  async function runClassify(btn, body) {
    const cur = readAddForm(body); // classify what the rep currently sees (edits included)
    const payload = {
      title: cur.title,
      description: cur.description,
      skills: cur.skills,
      client_country: cur.client_country,
      budget_text: cur.budget_text,
      contract_type: cur.contract_type,
      experience_level: cur.experience_level,
      client_spend: cur.client_spend,
    };
    const cost = body.querySelector("[data-aicost]");
    const prev = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="rfx-spin"></span> Classifying…`;
    if (cost) { cost.classList.remove("hidden"); cost.textContent = "Classifying with Claude…"; }

    const resp = await apiClassify(payload);
    btn.disabled = false;
    btn.innerHTML = prev;

    if (!resp || resp.error || !resp.result) {
      if (cost) cost.textContent = "Couldn't classify: " + ((resp && resp.error) || "no result");
      return;
    }
    const r = resp.result;
    // Fill the editable AI fields in place (keep the rep's other edits intact).
    const setVal = (k, v) => { const el = body.querySelector(`[data-f="${k}"]`); if (el && v != null) el.value = v; };
    setVal("verdict", r.verdict);
    setVal("quality", r.quality);
    setVal("reason", r.reason);
    // Reveal the now-filled AI fields and LOCK them — the model's verdict isn't hand-editable.
    // (disabled selects / readonly textarea still report .value, so the Add payload keeps them.)
    const fields = body.querySelector("[data-ai-fields]");
    if (fields) {
      fields.classList.remove("rfx-blur");
      fields.classList.add("rfx-ai-locked");
      fields.querySelectorAll("select").forEach((el) => { el.disabled = true; });
      fields.querySelectorAll("textarea, input").forEach((el) => { el.readOnly = true; });
    }
    // Remember the cost so Confirm add persists it to jobs.token_cost_inr / cache_status.
    rfxAddClass = { token_cost_inr: r.cost_inr, cache_status: r.cache_status, tokens: r.tokens };
    if (cost) {
      const inr = typeof r.cost_inr === "number" ? r.cost_inr.toFixed(2) : r.cost_inr;
      cost.textContent = `✦ ${r.tokens} tokens · ₹${inr} · cache ${r.cache_status} · model said ${r.relevance_raw}/${r.quality_raw}`;
    }
  }

  async function submitAdd(btn) {
    const body = root.querySelector("#rfx-body");
    const payload = readAddForm(body);
    const err = body.querySelector("[data-add-err]");
    const showErr = (m) => { if (err) { err.textContent = m; err.classList.remove("hidden"); } };
    if (err) err.classList.add("hidden");
    if (!payload.upwork_job_id) return showErr("Missing job id — reopen this from the job.");
    if (!payload.title) return showErr("Title is required.");
    btn.disabled = true;
    btn.textContent = "Adding…";
    const resp = await apiAddJob(payload);
    if (resp && resp.status && !resp.error) {
      rfxJobCache[payload.upwork_job_id] = resp.status; // strip will now show "In Reflex ✓"
      rfxAddSaved = true; // persisted — the save-on-leave guard won't fire for this card
      render();
      // Job now in the DB: card is back at the top with Generate enabled — show it.
      const b = root.querySelector("#rfx-body");
      if (b) requestAnimationFrame(() => { if (b.scrollTo) b.scrollTo({ top: 0, behavior: "smooth" }); else b.scrollTop = 0; });
    } else {
      btn.disabled = false;
      btn.textContent = "Confirm add";
      showErr((resp && resp.error) || "Couldn't add this job.");
    }
  }

  // --- Save the classified Add card on leave -------------------------------
  // A card is "dirty" once Check relevance ran (rfxAddClass) but it hasn't been saved yet.
  function addCardDirty() { return rfxAddOpen && !!rfxAddClass && !rfxAddSaved; }

  // Persist the open Add card right now (used by the leave prompt). Resolves true on success.
  async function saveAddCardNow() {
    const body = root.querySelector("#rfx-body");
    if (!body) return false;
    const payload = readAddForm(body);
    if (!payload.upwork_job_id || !payload.title) return false;
    const resp = await apiAddJob(payload);
    if (resp && resp.status && !resp.error) {
      rfxJobCache[payload.upwork_job_id] = resp.status;
      rfxAddSaved = true;
      return true;
    }
    return false;
  }

  // Guarded leave: if the open Add card was classified-but-unsaved, ask before leaving;
  // otherwise just proceed. `proceed` performs the actual navigation (render/close/switch).
  function confirmLeaveAddCard(proceed) {
    if (!addCardDirty()) { proceed(); return; }
    showLeaveModal(proceed);
  }

  function showLeaveModal(proceed) {
    if (root.querySelector(".rfx-leave-modal")) return; // don't stack
    const m = document.createElement("div");
    m.className = "rfx-leave-modal";
    m.innerHTML = `
      <div class="rfx-leave-box">
        <div class="rfx-leave-title">Save this job to ${SYSTEM_NAME}?</div>
        <div class="rfx-leave-msg">You ran <b>Check relevance</b> on this job. Save it to your board so the classification isn't lost?</div>
        <div class="rfx-leave-err hidden" data-leave-err></div>
        <div class="rfx-leave-acts">
          <button class="rfx-btn ghost sm" data-leave="stay">Keep editing</button>
          <button class="rfx-btn primary sm" data-leave="save">Save to ${SYSTEM_NAME}</button>
        </div>
      </div>`;
    root.appendChild(m);
    const close = () => m.remove();
    m.querySelector('[data-leave="stay"]').addEventListener("click", close);
    m.querySelector('[data-leave="save"]').addEventListener("click", async (e) => {
      const sb = e.currentTarget;
      sb.disabled = true; sb.textContent = "Saving…";
      const ok = await saveAddCardNow();
      if (ok) { close(); proceed(); return; }
      sb.disabled = false; sb.textContent = `Save to ${SYSTEM_NAME}`;
      const err = m.querySelector("[data-leave-err]");
      if (err) { err.textContent = "Couldn't save — try again."; err.classList.remove("hidden"); }
    });
  }

  // Hard close (pagehide): can't prompt, so best-effort save via the background. Fire-and-
  // forget — the service worker completes the POST independently of the unloading page.
  function flushAddOnLeave() {
    if (!addCardDirty()) return;
    const body = root.querySelector("#rfx-body");
    if (!body) return;
    const payload = readAddForm(body);
    if (!payload.upwork_job_id || !payload.title) return;
    rfxAddSaved = true; // optimistic dedupe
    try { chrome.runtime.sendMessage({ type: "ADD_JOB", payload }); } catch (e) { /* best effort */ }
  }

  function chipsHTML(chips) {
    return `<div class="rfx-chips">` + chips.map(c =>
      `<span class="rfx-chip ${c.k}">${c.t}</span>`).join("") + `</div>`;
  }

  /* ---- Surface 1: LIVE listing replica ----
     Mirrors the Upwork results page INSIDE our sidebar. We READ the visible job
     tiles (read-only — never write to Upwork), render one card per job, and pull
     each job's Reflex status from the DB via the Worker (CHECK_JOBS). A debounced
     observer (startMirror) keeps this in sync as the rep scrolls / paginates /
     searches. Nothing here injects into, fills, or clicks Upwork's page. */

  // Read the jobs currently on the Upwork results page. Best-effort selectors with
  // text-pattern fallbacks (Upwork's tile testids drift) — read-only, never writes.
  // Budget / contract type — exactly what the Upwork tile/detail text shows. Hourly appears in
  // two forms: "Hourly: $50.00 - $95.00" (no /hr suffix) and "$30/hr"; fixed shows
  // "Est. budget: $500.00". The [KMB] suffix is attached to the number (no \s* gap) so it can't
  // grab the leading letter of the next word (the old "$1,200.00 B" bug from "…BUILD").
  function parseTileBudget(text) {
    const t = String(text || "");
    // Decide the type from the tile's BUDGET facts, not a loose word match — the description
    // and skills routinely contain "hourly" or "fixed price", and either one would otherwise
    // flip the label. Priority: a budget estimate ⇒ fixed (only fixed tiles show "Est. budget");
    // an hourly rate or the "Hourly:/Hourly -" meta tag ⇒ hourly; bare "fixed price" only last.
    const estBudget = t.match(/Est(?:imated)?\.?\s*budget\s*:?\s*(\$[\d.,]+[KMB]?)/i); // fixed-only fact
    // Hourly rate in any of its layouts: listing "Hourly: $x - $y", the job-details layout where
    // the amount comes BEFORE the label ("$x - $y Hourly"), or finally "$x/hr". The label-bound
    // forms are tried FIRST, and the bare "$x/hr" excludes the client's "$x/hr avg rate paid" — so
    // the "About the client" average hourly rate is never mistaken for the job's rate.
    const hourlyRate = t.match(/hourly\s*:?\s*(\$[\d.,]+(?:\s*-\s*\$?[\d.,]+)?)/i)
                    || t.match(/(\$[\d.,]+(?:\s*-\s*\$?[\d.,]+)?)\s*hourly\b/i)
                    || t.match(/(\$[\d.,]+(?:\s*-\s*\$?[\d.,]+)?)\s*\/\s*hr\b(?!\s*(?:avg|rate|paid))/i);
    // "Hourly" meta tag — anchored to what follows it on the tile line (an experience level,
    // "Est…", or a "$" rate). Upwork renders the "·"/"-" separators with CSS, so textContent has
    // none — we can't require one. Anchoring to the next meta token still rejects a stray "hourly"
    // sitting in the description (it'd be followed by ordinary prose, not a level/Est/$).
    // Also catches the job-details / apply layout where "Hourly" is a sub-label: "Hourly range"
    // next to the rate, or the contract label sitting right after the weekly hours
    // ("Less than 30 hrs/week  Hourly") — the only reliable no-rate hourly signal on those pages.
    const hourlyTag = /\bhourly[\s:·•\-–]*(?:entry|intermediate|expert|est\b|range\b|\$)/i.test(t)
                   || /hrs?\/week\s*hourly\b/i.test(t);
    let type = "";
    let budget = "";
    if (estBudget) {
      type = "Fixed-price";
      budget = estBudget[1].trim();
    } else if (hourlyRate || hourlyTag) {
      type = "Hourly";
      if (hourlyRate) budget = hourlyRate[1].replace(/\s+/g, " ").trim();
    } else if (/\bfixed[- ]price\b/i.test(t)) {
      type = "Fixed-price"; // fixed job with no visible budget
    }
    // Fixed-price amount without "Est. budget" — the job-details page shows "$700.00 Fixed-price"
    // (amount beside the tag, not under an "Est. budget" label). Fill it in when we know it's fixed.
    if (type === "Fixed-price" && !budget) {
      const m = t.match(/(\$[\d.,]+[KMB]?)\s*Fixed[- ]price/i)        // "$700.00 Fixed-price"
             || t.match(/Fixed[- ]price\s*:?\s*(\$[\d.,]+[KMB]?)/i);  // "Fixed-price: $700.00"
      if (m) budget = m[1].trim();
    }
    return { type, budget };
  }

  // Job tiles across Upwork surfaces. Search results (/nx/search/jobs) use
  // [data-test='JobTile']; the find-work feed (/nx/find-work/best-matches, /most-recent)
  // renders each job WITHOUT that attribute, so fall back through the cards that carry a
  // job uid, the job-tile-list children, then the job-title links climbed to their nearest
  // card. Read-only — same reactive contract as the rest of the mirror.
  function findJobTiles() {
    const direct = Array.from(document.querySelectorAll(ANCHORS.jobTile));
    if (direct.length) return direct;
    // Feed cards usually carry data-ev-job-uid on the card element itself.
    const byUid = Array.from(document.querySelectorAll("[data-ev-job-uid]")).filter((el) =>
      el.querySelector("a[href*='~0'], [data-test='job-tile-title-link'], h2 a, h3 a, h2, h3"));
    if (byUid.length) return byUid;
    // Upwork's find-work feed renders the cards as direct children of a job-tile-list.
    const listed = Array.from(document.querySelectorAll(
      "[data-test='job-tile-list'] > section, [data-test='job-tile-list'] > article, [data-test='job-tile-list'] > div"
    )).filter((el) => el.querySelector("a, h2, h3"));
    if (listed.length) return listed;
    // Last resort: climb from each job-title link to its nearest card container, de-duped.
    const seen = new Set();
    const out = [];
    document.querySelectorAll(
      "[data-test='job-tile-title-link'], a[href*='/nx/job-details/'], a[href*='/jobs/~'], a[href*='/search/jobs/details/~']"
    ).forEach((a) => {
      const tile = a.closest("article, li, section");
      if (tile && !seen.has(tile)) { seen.add(tile); out.push(tile); }
    });
    return out;
  }

  // Numeric Upwork job id for one tile: the search-tile attributes first (parity with
  // the old path), else the numeric id embedded in a ~0… link cipher — the same
  // extraction openJobNumericId() uses, so feed ids match jobs.upwork_job_id.
  function tileJobId(tile) {
    let id = (tile.getAttribute && (tile.getAttribute("data-test-key") || tile.getAttribute("data-ev-job-uid"))) || "";
    if (!id) {
      const a = tile.querySelector("a[href*='~0']");
      const m = a && (a.getAttribute("href") || "").match(/~0\d(\d{6,})/);
      if (m) id = m[1];
    }
    return id;
  }

  function readVisibleTiles() {
    return findJobTiles().map((tile) => {
      const jobId = tileJobId(tile);
      const titleEl = tile.querySelector(
        "[data-test='job-tile-title-link'], [data-test='job-title-link'], a[href*='/jobs/'], h2 a, h3 a, h2, h3"
      );
      const title = titleEl ? titleEl.textContent.trim().replace(/\s+/g, " ") : "(untitled job)";
      const text = (tile.textContent || "").replace(/\s+/g, " ");

      // Posted date — "Posted … ago". Selector first, then a text-pattern fallback.
      const postedEl = tile.querySelector(
        "[data-test='job-pubilshed-date'], [data-test='posted-on'], small[data-test='job-pubilshed-date'] span"
      );
      let posted = postedEl ? postedEl.textContent.trim().replace(/\s+/g, " ") : "";
      if (!posted) { const m = text.match(/Posted\s+[^·|]+?\bago\b/i); posted = m ? m[0].trim() : ""; }

      // One-line description snippet.
      const descEl = tile.querySelector(
        "[data-test='UpCLineClamp JobDescription'], [data-test='job-description-text'], [data-test='job-description'], [data-test='UpCJobsListItemDescription']"
      );
      const description = descEl ? descEl.textContent.trim().replace(/\s+/g, " ") : "";

      // Budget / contract type — same facts the real Upwork tile shows.
      const { type, budget } = parseTileBudget(text);

      return { jobId, title, posted, description, type, budget };
    });
  }

  // The strip inside each sidebar card — same signals as the old tile strip, laid
  // out for the narrow panel (pills wrap, chips truncate, action on its own row).
  function listCardInner(data, jobTab, jobId) {
    if (data.checking) {
      return `<div class="rfx-jc-line"><span class="rfx-spin dark"></span><span class="rfx-jc-note">${SYSTEM_NAME} · checking…</span></div>`;
    }
    if (!data.connected) {
      return `<div class="rfx-jc-line"><span class="rfx-jc-note">${SYSTEM_NAME} · not synced</span></div>`;
    }
    if (!data.inReflex) {
      // On the apply page the page hides the client block + full job details, so Adding here would
      // save a poor record (and the wrong title). Instead of Add, send the rep to the real job
      // posting — Add works properly there.
      if (jobTab && isApplyPage()) {
        const url = jobPostingUrl();
        return `<div class="rfx-jc-line"><span class="rfx-jc-note">Open the job posting to add it to ${SYSTEM_NAME}</span></div>` +
          `<div class="rfx-jc-acts">` +
          (url
            ? `<a class="rfx-btn primary full" href="${esc(url)}" target="_blank" rel="noopener">View job posting →</a>`
            : `<span class="rfx-jc-note">Job posting link not found on this page.</span>`) +
          `</div>`;
      }
      // Job tab: both actions, but Generate is locked until the job is added.
      if (jobTab) {
        return `<div class="rfx-jc-line"><span class="rfx-jc-note">Not in ${SYSTEM_NAME} yet</span></div>` +
          `<div class="rfx-jc-acts">` +
          `<button class="rfx-tag-add" data-card-add>＋ Add to ${SYSTEM_NAME}</button>` +
          `<button class="rfx-tag-gen" data-card-gen disabled title="Add to ${SYSTEM_NAME} first"><span class="rfx-spark">✦</span> Generate</button>` +
          `</div>`;
      }
      return `<div class="rfx-jc-line"><span class="rfx-jc-note">Not in ${SYSTEM_NAME} yet</span><span class="rfx-jc-spacer"></span><button class="rfx-tag-add" data-card-add>＋ Add to ${SYSTEM_NAME}</button></div>`;
    }
    const rel = `<span class="rfx-tag-relevance ${data.verdict}"><span class="rfx-tag-ic">${VERDICT_ICON[data.verdict] || ""}</span>${esc(VERDICT_LABEL[data.verdict] || "—")}</span>`;
    const quality = `<span class="rfx-tag-quality ${data.quality}">${esc(QUALITY_LABEL[data.quality] || "—")}</span>`;
    const chips = data.chips ? `<div class="rfx-jc-chips">${esc(data.chips)}</div>` : "";
    const own = data.ownership === "mine"
      ? `<span class="rfx-tag-own mine">In ${SYSTEM_NAME} ✓</span>`
      : data.ownership === "other"
        ? `<span class="rfx-tag-own other">Assigned · ${esc(data.owner || "")}</span>`
        : `<span class="rfx-tag-own skip">Available</span>`;
    // Live generation state for THIS job (beats the DB check, which lags a fresh generate).
    const liveGenerating = jobId && rfxGenJobId === jobId && rfxGenState === "generating";
    const liveReady = jobId && rfxGenJobId === jobId && rfxGenState === "ready";
    const isGenerated = data.actioned === "generated" || liveReady;
    let action;
    if (data.verdict === "irr") {
      action = `<span class="rfx-tag-skip">Not pursued</span>`;
    } else if (data.actioned === "submitted") {
      // Already submitted on Upwork — locked (no regenerate).
      action = `<span class="rfx-tag-own mine">Proposal submitted ✓</span>`;
    } else if (liveGenerating) {
      action = `<button class="rfx-tag-gen" disabled><span class="rfx-spin"></span> Generating…</button>`;
    } else if (isGenerated) {
      // On the Job tab the proposal is shown inline below with its own Regenerate, so the card
      // button is just a disabled "generated" marker. On the listing it stays clickable to act.
      action = jobTab
        ? `<button class="rfx-tag-gen" disabled title="Use Regenerate in the cover letter below"><span class="rfx-spark">✦</span> Proposal generated</button>`
        : `<button class="rfx-tag-gen quiet" data-card-regen>↻ Proposal ready</button>`;
    } else {
      action = `<button class="rfx-tag-gen" data-card-gen><span class="rfx-spark">✦</span> Generate</button>`;
    }
    return `<div class="rfx-jc-pills">${rel}${quality}</div>${chips}<div class="rfx-jc-foot">${own}<span class="rfx-jc-spacer"></span>${action}</div>`;
  }

  function listCardHTML(job) {
    const data = (job.jobId && rfxJobCache[job.jobId]) ||
      (job.jobId ? { connected: true, checking: true } : { connected: false });
    const dim = data.connected && data.verdict === "irr" ? " rfx-dim" : "";
    // Budget · type, then posted date — the same facts the real Upwork tile shows.
    const budgetText = [job.type, job.budget].filter(Boolean).join(" · ");
    const metaBits = [];
    if (budgetText) metaBits.push(`<span class="rfx-jt-budget">${esc(budgetText)}</span>`);
    if (job.posted) metaBits.push(`<span class="rfx-jt-posted">${esc(job.posted)}</span>`);
    const metaRow = metaBits.length ? `<div class="rfx-jt-meta">${metaBits.join("")}</div>` : "";
    const desc = job.description ? `<div class="rfx-jt-desc">${esc(job.description)}</div>` : "";
    return `
      <div class="rfx-job-card${dim}" data-rfx-card="${esc(job.jobId)}">
        <div class="rfx-jt-titlerow">
          <div class="rfx-job-title">${esc(job.title)}</div>
          <button class="rfx-jt-copy" data-copy-title="${esc(job.title)}" title="Copy job title" aria-label="Copy job title">⧉</button>
        </div>
        ${metaRow}
        ${desc}
        <div class="rfx-job-strip">${listCardInner(data, false, job.jobId)}</div>
      </div>`;
  }

  function renderListing() {
    const jobs = readVisibleTiles();
    if (!jobs.length) {
      return `<div class="rfx-context-note">No Upwork jobs detected on this page. Open an Upwork job search and the list will appear here — it stays in sync as you scroll or change the search.</div>`;
    }
    scheduleListFetch(jobs.map((j) => j.jobId).filter(Boolean));
    return `
      <div class="rfx-context-note">${jobs.length} job${jobs.length > 1 ? "s" : ""} on this Upwork page · status from ${SYSTEM_NAME}. Stays in sync as the page changes.</div>
      ${jobs.map(listCardHTML).join("")}
    `;
  }

  // Wire one live job card (Add / Generate). Distinct data-card-* attrs so this
  // never collides with other surfaces' [data-add]. Generate opens the Upwork
  // detail page in a new tab on YOUR click (navigation only — no auto-submit).
  function wireListCard(card, jobId) {
    const jobTab = surface === "job";
    const add = card.querySelector("[data-card-add]");
    if (add) add.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const titleEl = card.querySelector(".rfx-job-title");
      const title = titleEl ? titleEl.textContent : "";
      // We can only add with full details from the OPEN job. If this card is the job that's
      // open on Upwork (Job tab), review now; otherwise (a listing card) ask the rep to open
      // it first — opening it auto-switches to the Job tab.
      const open = readOpenJob();
      if (jobTab && open && open.id === jobId) openJobAddReview(jobId, title); // merged flow
      else if (open && open.id === jobId) openAddReview(jobId, title);
      else promptOpenJobToAdd(jobId, title);
    });
    // Skip the locked (disabled) Generate; a real one is wired once the job is added.
    const gen = card.querySelector("[data-card-gen]:not([disabled]), [data-card-regen]");
    if (gen) gen.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const titleEl = card.querySelector(".rfx-job-title");
      const title = titleEl ? titleEl.textContent : "";
      // Generation needs the OPEN job's context (screening questions, client facts). If this card
      // is the job open on Upwork, generate now inline on the Job tab. Otherwise (a listing card
      // for a job that isn't open) ask the rep to open it first — like Add; the mirror then
      // switches to the Job tab and kicks off generation there.
      const open = readOpenJob();
      if (open && open.id === jobId) { surface = "job"; startGeneration(jobId, { stay: true }); }
      else promptOpenJobToGenerate(jobId, title);
    });
  }

  /* ---- Live status: batch the visible job ids into ONE CHECK_JOBS call, then
     fill each card's strip. Debounced + in-flight guarded + cached (one lookup
     per job). These calls go to OUR Worker only, never to Upwork. ---- */
  let rfxListTimer = null;
  let rfxListFetching = false;
  function scheduleListFetch(ids) {
    if (rfxListTimer) clearTimeout(rfxListTimer);
    rfxListTimer = setTimeout(() => runListFetch(ids), 300);
  }
  async function runListFetch(ids) {
    rfxListTimer = null;
    const need = ids.filter((id) => id && !(id in rfxJobCache));
    if (!need.length) { updateListCards(); return; }
    if (rfxListFetching) { scheduleListFetch(ids); return; }
    rfxListFetching = true;
    try {
      const statuses = await apiCheckJobs(need);
      need.forEach((id) => {
        rfxJobCache[id] = statuses
          ? (statuses[id] || { connected: true, inReflex: false })
          : { connected: false }; // backend unreachable -> honest "not synced"
      });
      updateListCards();
    } finally {
      rfxListFetching = false;
    }
  }
  function updateListCards() {
    const body = root.querySelector("#rfx-body");
    if (!body || surface !== "listing") return;
    body.querySelectorAll("[data-rfx-card]").forEach((card) => {
      const id = card.getAttribute("data-rfx-card");
      const data = (id && rfxJobCache[id]) ||
        (id ? { connected: true, checking: true } : { connected: false });
      const strip = card.querySelector(".rfx-job-strip");
      if (strip) { strip.innerHTML = listCardInner(data, false, id); wireListCard(card, id); }
      card.classList.toggle("rfx-dim", !!(data.connected && data.verdict === "irr"));
    });
  }

  /* ---- Surface 2: the OPEN job (detail) ----
     Reads whatever job is open on Upwork (the [data-ev-sublocation='jobdetails']
     region) — READ-ONLY — and shows it here with its Reflex strip pulled from the
     DB (CHECK_JOBS), exactly like a Listing card but for the single open job. */
  function renderJob() {
    // Upwork's post-submit success page — show the "save this submission to Reflex" confirm card
    // instead of the normal open-job card (this page has no job open, only a proposal id).
    if (shouldShowSubmitConfirm()) return renderSubmitConfirm();
    const open = readOpenJob();
    if (!open) {
      return `<div class="rfx-context-note">Open a job on Upwork — click any job to view it — and its ${SYSTEM_NAME} details will appear here, with its strip from the database.</div>`;
    }
    scheduleJobFetch(open.id);
    maybeRestoreDraft(open.id); // restore a saved draft (no model call) if one exists for this job
    const data = (open.id && rfxJobCache[open.id]) ||
      (open.id ? { connected: true, checking: true } : { connected: false });
    const dim = data.connected && data.verdict === "irr" ? " rfx-dim" : "";
    // On the apply page the page DOM doesn't expose the real job details (title is "Submit a
    // Proposal", no budget/posted/description) — fall back to the DB facts fetched via
    // /jobs/proposal. On the job-details page the page read is good, so prefer it.
    const facts = rfxJobFacts[open.id] || {};
    const onApply = isApplyPage();
    // The DB's budget_text sometimes holds a bare type word ("Hourly"/"Fixed") rather than an
    // amount — only trust it as a budget when it actually contains a number, so we never render
    // "Hourly · Hourly". The page parse (open.budget) is always a "$…" amount or "".
    const factsBudget = /\d/.test(String(facts.budget || "")) ? facts.budget : "";
    const title = onApply ? (facts.title || open.title || "(this job)") : (open.title || facts.title || "(this job)");
    // Type/budget: always prefer the PAGE parse. The apply page hides them from the H1/title but
    // still shows them in its "Job details" sidebar ("$10 - $25 · Hourly range", "$4,500 ·
    // Fixed-price"), which readOpenJob reads — so we no longer fall back to the DB's bare word here.
    const dType = open.type || facts.type || "";
    const dBudget = open.budget || factsBudget;
    const dPosted = onApply ? fmtPosted(facts.posted) : (open.posted || fmtPosted(facts.posted));
    const dDesc = onApply ? (facts.description || "") : (open.description || facts.description || "");
    // Compact facts up top (type · price, posted date) — same as a Listing tile.
    const budgetText = [dType, dBudget].filter(Boolean).join(" · ");
    const metaBits = [];
    if (budgetText) metaBits.push(`<span class="rfx-jt-budget">${esc(budgetText)}</span>`);
    if (dPosted) metaBits.push(`<span class="rfx-jt-posted">${esc(dPosted)}</span>`);
    const metaRow = metaBits.length ? `<div class="rfx-jt-meta">${metaBits.join("")}</div>` : "";
    const meta = open.meta.map((v) => `<span class="rfx-detail-stat">${esc(v)}</span>`).join("");
    const stats = open.client.map((v) => `<span class="rfx-detail-stat client">${esc(v)}</span>`).join("");
    // Once Generate runs for THIS job, the proposal renders inline below the card
    // (the Job + Proposal flow is one scroll). Idle -> nothing here; the card's button is the CTA.
    const showProp = rfxGenState !== "idle" && rfxGenJobId && rfxGenJobId === open.id;
    const propSection = showProp
      ? `<div id="rfx-job-proposal" class="rfx-job-proposal">
          <div class="rfx-prop-divider"><span class="rfx-spark">✦</span> Proposal</div>
          ${renderProposal(true)}
        </div>`
      : "";
    // On the apply page, show that Reflex has armed submission tracking (with the connects it
    // captured) so the rep knows it'll be recorded after they submit. Text is kept live by the
    // observer (updateApplyHint) as the bidding box loads/changes.
    let applyHint = "";
    if (onApply) {
      captureApplyContext(); // ensure the pending record (connects) is fresh before we read it
      const p = readSubmitPending();
      const c = p && p.connects != null ? p.connects : null;
      applyHint = `<div class="rfx-apply-hint" data-rfx-apply-hint>✓ ${SYSTEM_NAME} will record this proposal after you submit${c != null ? ` · ${esc(c)} connects` : ""}.</div>`;
    }
    return `
      <div class="rfx-context-note">This job — read from the Upwork page. Status from ${SYSTEM_NAME}.</div>
      <div class="rfx-job-card${dim}" data-rfx-jobtab="${esc(open.id)}">
        <div class="rfx-job-title" style="-webkit-line-clamp:3">${esc(title)}</div>
        ${metaRow}
        ${applyHint}
        <div class="rfx-job-strip">${listCardInner(data, true, open.id)}</div>
        ${meta ? `<div class="rfx-jc-stats">${meta}</div>` : ""}
        ${stats ? `<div class="rfx-jc-stats">${stats}</div>` : ""}
        ${dDesc ? `<div class="rfx-jobdesc">${esc(dDesc)}</div>` : ""}
        ${open.cipher && !isApplyPage() ? `<a class="rfx-btn primary full rfx-mt rfx-apply-link" href="${esc(applyUrlFor(open.cipher))}" target="_blank" rel="noopener">Apply on Upwork →</a>` : ""}
      </div>
      ${propSection}
    `;
  }

  /* ---- Success page: confirm + record a submitted proposal ----
     After the rep submits on Upwork, the SAME tab lands on …/nx/proposals/<proposalId>?success.
     We read the proposal id from the URL and the remembered job + connects from this tab's
     sessionStorage (set on /apply), then show a card. Nothing is written until the rep clicks
     "Confirm & Save" — keeping this reactive. Deduped by proposal id so a reload can't re-record. */
  function renderSubmitConfirm() {
    const pid = proposalSuccessId();
    const link = `https://www.upwork.com/nx/proposals/${pid}`;
    const pending = readSubmitPending();
    const saved = rfxSubmitState[pid] === "saved" || sessionStorage.getItem("rfx_saved_" + pid) === "1";
    const saving = rfxSubmitState[pid] === "saving";
    const repName = (rfxAuth && rfxAuth.user && (rfxAuth.user.full_name || rfxAuth.user.email)) || "you";
    const jobTitle = (pending && pending.title) || "";
    const connects = pending && pending.connects != null ? pending.connects : null;

    const facts =
      (jobTitle ? `<div class="rfx-jt-meta"><span class="rfx-jt-budget">${esc(jobTitle)}</span></div>` : "") +
      `<div class="rfx-sub-rows">` +
        `<div class="rfx-sub-row"><span>Submitted by</span><b>${esc(repName)}</b></div>` +
        (connects != null ? `<div class="rfx-sub-row"><span>Connects spent</span><b>${esc(connects)}</b></div>` : "") +
        `<div class="rfx-sub-row"><span>Proposal</span><a href="${esc(link)}" target="_blank" rel="noopener">#${esc(pid)} ↗</a></div>` +
      `</div>`;

    if (saved) {
      return `<div class="rfx-context-note">Proposal recorded in ${SYSTEM_NAME}.</div>
        <div class="rfx-job-card">
          <div class="rfx-job-title">Proposal submitted ✓</div>
          ${facts}
          <div class="rfx-jc-line rfx-mt"><span class="rfx-tag-own mine">Saved to ${SYSTEM_NAME} ✓</span></div>
        </div>`;
    }
    if (!pending || !pending.job_id) {
      // Success opened without a remembered job (fresh page / different tab) — can't link it.
      return `<div class="rfx-context-note">You submitted this proposal on Upwork.</div>
        <div class="rfx-job-card">
          <div class="rfx-job-title">Proposal submitted ✓</div>
          ${facts}
          <div class="rfx-add-note">Couldn't match this to a ${SYSTEM_NAME} job automatically — open the job from its posting first, then submit, to record it.</div>
        </div>`;
    }
    return `<div class="rfx-context-note">You submitted this on Upwork — save it to ${SYSTEM_NAME}?</div>
      <div class="rfx-job-card">
        <div class="rfx-job-title">Proposal submitted — save to ${SYSTEM_NAME}?</div>
        ${facts}
        <div class="rfx-jc-acts rfx-mt">
          <button class="rfx-btn primary full" data-submit-confirm ${saving ? "disabled" : ""}>${saving ? '<span class="rfx-spin"></span> Saving…' : "Confirm &amp; Save"}</button>
        </div>
        <div class="rfx-add-err hidden" data-submit-err></div>
      </div>`;
  }

  async function confirmSubmitProposal(body) {
    const pid = proposalSuccessId();
    const pending = readSubmitPending();
    if (!pid || !pending || !pending.job_id) return;
    const err = body.querySelector("[data-submit-err]");
    if (err) err.classList.add("hidden");
    rfxSubmitState[pid] = "saving";
    render(); // reflect the "Saving…" state
    const resp = await apiSubmitProposal({
      upwork_job_id: pending.job_id,
      proposal_id: pid,
      proposal_link: `https://www.upwork.com/nx/proposals/${pid}`,
      connects_spent: pending.connects,
    });
    if (resp && resp.ok && !resp.error) {
      rfxSubmitState[pid] = "saved";
      try { sessionStorage.setItem("rfx_saved_" + pid, "1"); sessionStorage.removeItem("rfx_pending_submit"); } catch (e) { /* ignore */ }
      // Drop any cached status for this job so the next check reflects "submitted".
      if (rfxJobCache[pending.job_id]) delete rfxJobCache[pending.job_id];
      render();
    } else {
      delete rfxSubmitState[pid];
      render();
      const e2 = root.querySelector("[data-submit-err]");
      if (e2) { e2.textContent = (resp && resp.error) || "Couldn't save — try again."; e2.classList.remove("hidden"); }
    }
  }

  // Numeric Upwork job id from the detail URL ciphertext (~0<version><numeric>).
  // Strip "~0" + the single version digit -> the numeric id that matches
  // jobs.upwork_job_id (verified: ~022069… -> 2069…). Best-effort; re-check on live.
  function openJobNumericId() {
    const m = (location.pathname + location.search).match(/~0\d(\d{6,})/);
    return m ? m[1] : "";
  }

  // The full ciphertext id (~0…) from the URL — needed to build the apply URL.
  function openJobCipherId() {
    const m = (location.pathname + location.search).match(/~0[0-9a-z]+/i);
    return m ? m[0] : "";
  }

  // The Upwork apply page for a job (opens in a new tab, like Upwork's Apply button).
  function applyUrlFor(cipher) {
    return cipher ? `https://www.upwork.com/nx/proposals/job/${cipher}/apply/` : "";
  }

  // The canonical job-posting URL. On the apply page we can't Add well (the page hides the client
  // block + full details), so we send the rep to the real job posting to add it there. Prefer the
  // page's own "View job posting" link; fall back to building it from the URL ciphertext.
  function jobPostingUrl() {
    const a = Array.from(document.querySelectorAll("a[href]"))
      .find((el) => /view job posting/i.test((el.textContent || "").trim()));
    if (a && a.href) return a.href;
    const cipher = openJobCipherId();
    return cipher ? `https://www.upwork.com/nx/search/jobs/details/${cipher}` : "";
  }

  // Format a DB posted_at timestamp (ISO) as "Posted Jun 29, 2026". Empty for null/invalid.
  function fmtPosted(v) {
    if (!v) return "";
    try {
      const d = new Date(v);
      if (isNaN(d.getTime())) return "";
      return "Posted " + d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    } catch (e) { return ""; }
  }

  // Are we ON an apply page? (used to auto-switch to the Proposal tab)
  function isApplyPage() {
    const p = location.pathname;
    return /\/apply(\/|$)/.test(p) || /\/proposals\/job\/~/.test(p);
  }

  // The Upwork proposal-success / details page: …/nx/proposals/<proposalId>[?success]. The number
  // is the PROPOSAL id — NOT the job id (the job cipher is gone from the URL by now). Note the
  // apply page is /nx/proposals/job/~… (non-numeric after "proposals"), so it won't match here.
  function proposalSuccessId() {
    const m = location.pathname.match(/\/nx\/proposals\/(\d{6,})(?:\/|$)/);
    return m ? m[1] : "";
  }
  function isProposalSuccessPage() { return !!proposalSuccessId(); }
  // Only take over the Job tab with the "save this submission" card when it's actually a submit
  // context: a fresh `?success`, a remembered pending apply (this tab), or an already-saved id.
  // A plain proposal-details visit (from "My proposals") without any of these is left alone.
  function shouldShowSubmitConfirm() {
    const pid = proposalSuccessId();
    if (!pid) return false;
    return /success/i.test(location.search)
      || !!readSubmitPending()
      || sessionStorage.getItem("rfx_saved_" + pid) === "1";
  }

  // While on /apply, remember (in THIS tab's sessionStorage) the job + connects so that after the
  // rep submits — same tab, a new URL that no longer carries the job id — we can still link the new
  // proposal id back to this job. sessionStorage is per-tab, so concurrent applies in other tabs
  // never mix. Cheap to re-run on each observer tick, keeping connects current (e.g. after a boost).
  function captureApplyContext() {
    if (!isApplyPage()) return;
    const jobId = openJobNumericId();
    if (!jobId) return;
    const t = (document.body && document.body.innerText) || "";
    const grab = (re) => { const m = t.match(re); return m ? Number(m[1]) : null; };
    const connects = grab(/Total:\s*(\d+)\s*Connects/i)
      ?? grab(/Required for proposal:\s*(\d+)\s*Connects/i)
      ?? grab(/This proposal requires\s*(\d+)\s*Connects/i);
    const rec = { job_id: jobId, cipher: openJobCipherId(), connects, title: readApplyJobTitle() || "", ts: Date.now() };
    try { sessionStorage.setItem("rfx_pending_submit", JSON.stringify(rec)); } catch (e) { /* storage blocked — ignore */ }
  }
  function readSubmitPending() {
    try { return JSON.parse(sessionStorage.getItem("rfx_pending_submit") || "null"); }
    catch (e) { return null; }
  }
  // Refresh just the apply-page hint line (connects) in place — the observer calls this as the
  // bidding box loads, without a full re-render (which would wipe the rep's inline edits).
  function updateApplyHint() {
    const el = root.querySelector("[data-rfx-apply-hint]");
    if (!el) return;
    const p = readSubmitPending();
    const c = p && p.connects != null ? p.connects : null;
    el.textContent = `✓ ${SYSTEM_NAME} will record this proposal after you submit${c != null ? ` · ${c} connects` : ""}.`;
  }
  // Ask the background to POST /jobs/submitted. Resolves to { ok } or { error }.
  function apiSubmitProposal(payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "SUBMIT_PROPOSAL", payload }, (resp) => {
          if (chrome.runtime.lastError || !resp) {
            resolve({ error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || "No response from background" });
            return;
          }
          resolve(resp);
        });
      } catch (e) { resolve({ error: String(e && e.message ? e.message : e) }); }
    });
  }

  // Read the currently-open job on Upwork (read-only). Returns null when no job
  // detail region is present. Title/description are best-effort; client stats are
  // pulled by text pattern from the region (the spend / rating / hire-rate Upwork
  // shows on the page but omits from its API).
  // Find the job-detail container. Known anchors first; then a content heuristic:
  // the slider/modal view has no stable testid, so locate the "Summary" label and
  // walk up to the ancestor that ALSO holds the job meta — that's the detail panel.
  function findDetailRegion() {
    const sels = [
      "[data-ev-sublocation='jobdetails']",
      "[data-test='JobDetails']",
      "[data-test='job-details-content']",
      ".job-details-content",
      ".air3-slider-content",
      ".air3-slider-body",
    ];
    for (const s of sels) { const el = document.querySelector(s); if (el) return el; }
    const marker = Array.from(document.querySelectorAll("h2, h3, h4, div, span, strong"))
      .find((el) => el.children.length === 0 && /^summary$/i.test((el.textContent || "").trim()));
    if (marker) {
      let el = marker;
      for (let i = 0; i < 7 && el.parentElement; i++) {
        el = el.parentElement;
        const t = el.textContent || "";
        if (el.querySelector("h1, h2, h3, h4") && /hrs?\/week|experience level|project type|ongoing project|fixed-price|\/hr/i.test(t)) {
          return el;
        }
      }
    }
    return null;
  }

  // The apply page (/apply) has no detail region, but it DOES render a "Job details" card whose
  // sidebar shows the budget ("$10 - $25 · Hourly range", "$4,500 · Fixed-price", or just
  // "Hourly"). Locate that card so we can read the budget from the page instead of the DB.
  // Returns the section element, or null (caller falls back to the whole document).
  function findApplyDetails() {
    const h = Array.from(document.querySelectorAll("h2, h3, h4, strong, div, span"))
      .find((el) => { const t = (el.textContent || "").trim(); return /^job details$/i.test(t) && t.length < 30; });
    if (!h) return null;
    let el = h;
    for (let i = 0; i < 7 && el.parentElement; i++) {
      el = el.parentElement;
      const t = el.textContent || "";
      // The Job-details card holds the budget meta but NOT the sibling "Proposal settings"/"Terms"
      // sections — that guard bounds the card without a char limit (long descriptions blew past it).
      if (/experience level|project length|hrs?\/week|fixed-price|\bhourly\b/i.test(t)
          && !/proposal settings|do you want to submit/i.test(t)) return el;
    }
    return null;
  }

  // The real job title on the apply page (the page H1 is "Submit a proposal"). It sits right under
  // the "Job details" heading — find that heading page-wide, then take the first title-like thing
  // after it: a heading if the title is a real <h*>, else the next text line.
  function readApplyJobTitle() {
    const isLabel = (t) => !t || t.length < 4
      || /^(job details|summary|terms|skills and expertise|preferred qualifications|activity on this job|about the client|proposal settings)$/i.test(t)
      || /^posted\b/i.test(t);
    // 1) The first non-label heading after the "Job details" heading (document order).
    const heads = Array.from(document.querySelectorAll("h1, h2, h3, h4"))
      .map((h) => (h.textContent || "").trim().replace(/\s+/g, " "));
    const hi = heads.findIndex((t) => /^job details$/i.test(t));
    if (hi >= 0) { const t = heads.slice(hi + 1).find((x) => !isLabel(x)); if (t) return t; }
    // 2) Fall back to the page text: the line right after "Job details" (title isn't always an <h*>).
    const lines = (document.body ? (document.body.innerText || document.body.textContent || "") : "")
      .split(/\n+/).map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
    const li = lines.findIndex((l) => /^job details$/i.test(l));
    if (li >= 0) { const t = lines.slice(li + 1, li + 6).find((x) => !isLabel(x)); if (t) return t; }
    return "";
  }

  // The job "type" meta — the same facts Upwork shows as its icon grid.
  function readJobMeta(text) {
    const m = (re) => { const x = text.match(re); return x ? x[0].replace(/\s+/g, " ").trim() : ""; };
    const out = [
      /fixed[- ]price/i.test(text) ? "Fixed-price" : (/\bhourly\b/i.test(text) ? "Hourly" : ""),
      m(/\$[\d.,]+(?:\s*-\s*\$?[\d.,]+)?\s*\/?\s*hr/i) || m(/\$[\d.,]+\s*-\s*\$?[\d.,]+/),
      m(/(?:less than|more than)\s*\d+\s*hrs?\/week/i),
      m(/(?:less than 1 month|1 to 3 months|3 to 6 months|more than 6 months|\d+\s*-\s*\d+\s*months?)/i),
      m(/\b(?:entry level|intermediate|expert)\b/i),
      m(/(?:ongoing project|one-time project|complex project)/i),
      /contract-to-hire/i.test(text) ? "Contract-to-hire" : "",
      /\bremote\b/i.test(text) ? "Remote" : "",
    ].filter(Boolean);
    return out.filter((v, i) => out.indexOf(v) === i); // de-dupe
  }

  // The open job is identified by the URL id (reliable). Title / description /
  // meta / client are best-effort reads from the scoped detail region.
  function readOpenJob() {
    const id = openJobNumericId();
    const region = findDetailRegion();
    if (!id && !region) return null; // no job open
    const scope = region || document;
    const titleEl = scope.querySelector("h1, h2, h3, h4, [data-test='job-title'], [data-test='JobTitle']");
    let title = titleEl ? titleEl.textContent.trim().replace(/\s+/g, " ") : "";
    // On the apply page the page H1 is "Submit a proposal" — the real title sits right under the
    // "Job details" heading. Read it page-wide (not scoped to a card, whose columns live in
    // separate DOM branches) so a long description or deep nesting can't break it.
    if (isApplyPage()) {
      const t = readApplyJobTitle();
      if (t) title = t;
    }
    if (!title || /^submit a proposal$/i.test(title)) title = (document.title || "").replace(/\s*[-|–]\s*Upwork.*$/i, "").trim();
    if (!title || /^submit a proposal$/i.test(title)) title = "(this job)";
    const text = region ? (region.textContent || "").replace(/\s+/g, " ") : "";
    // description: explicit selector, else the text right after "Summary"
    const descEl = scope.querySelector("[data-test='Description'], [data-test='job-description-text'], [data-test='JobDescription']");
    let description = descEl ? descEl.textContent.trim().replace(/\s+/g, " ") : "";
    if (!description && text) {
      const i = text.search(/\bsummary\b/i);
      if (i >= 0) description = text.slice(i + 7).trim();
    }
    description = description.slice(0, 320);
    const meta = region ? readJobMeta(text) : [];
    const pick = (re) => { const x = text.match(re); return x ? x[0].trim() : ""; };
    const rating = pick(/\b[0-5]\.\d{1,2}\b/);
    const client = [
      pick(/\$[\d.,]+\s*[KMB]?\+?\s*(?:total spent|spent)/i),
      rating ? rating + " rating" : "",
      pick(/\b\d{1,3}%\s*hire rate/i),
      /payment (?:method )?verified/i.test(text) ? "✓ Payment verified" : "",
    ].filter(Boolean);
    // Compact card facts (same as a Listing tile): type · price, and the posted date.
    // On the apply page there's no detail region (text is ""), but the page still shows the budget
    // in its "Job details" card — parse type/budget from that (scoped, else the whole page) so the
    // apply card stops falling back to the DB's bare "Hourly"/"Fixed" word. Client/meta/posted
    // below still read `text` only, so the apply card gains no extra chips.
    const budgetSrc = text
      || (isApplyPage() ? ((findApplyDetails() || document.body || {}).textContent || "").replace(/\s+/g, " ") : "");
    const { type, budget } = parseTileBudget(budgetSrc);
    const pm = text.match(/Posted\s+[^·|]+?\bago\b/i);
    const posted = pm ? pm[0].trim() : "";
    return { id, title, description, meta, client, type, budget, posted, cipher: openJobCipherId() };
  }

  /* Job-tab status: one CHECK_JOBS lookup for the open job, cached + debounced.
     Calls OUR Worker only, never Upwork. */
  let rfxJobTabTimer = null;
  function scheduleJobFetch(id) {
    if (!id || (id in rfxJobCache)) { updateJobTab(); return; }
    if (rfxJobTabTimer) clearTimeout(rfxJobTabTimer);
    rfxJobTabTimer = setTimeout(async () => {
      rfxJobTabTimer = null;
      const statuses = await apiCheckJobs([id]);
      rfxJobCache[id] = statuses ? (statuses[id] || { connected: true, inReflex: false }) : { connected: false };
      updateJobTab();
    }, 250);
  }
  function updateJobTab() {
    const body = root.querySelector("#rfx-body");
    if (!body || surface !== "job") return;
    const card = body.querySelector("[data-rfx-jobtab]");
    if (!card) return;
    const id = card.getAttribute("data-rfx-jobtab");
    const data = (id && rfxJobCache[id]) ||
      (id ? { connected: true, checking: true } : { connected: false });
    const strip = card.querySelector(".rfx-job-strip");
    if (strip) { strip.innerHTML = listCardInner(data, true, id); wireListCard(card, id); }
    card.classList.toggle("rfx-dim", !!(data.connected && data.verdict === "irr"));
  }

  /* ---- Surface 3: proposal (the Upwork APPLY page) ----
     Generated pieces the rep copies / downloads into Upwork's apply form. Reflex
     never writes to the page: cover letter + answer = Copy, work samples = Download
     selected as a zip, Loom = Copy link. */
  function renderProposal(embedded) {
    const open = readOpenJob();                    // the job this proposal is for
    // Embedded in the Job tab the card already names the job — skip the duplicate header.
    const jobHead = (!embedded && open)
      ? `<div class="rfx-prop-job"><div class="rfx-prop-job-cap">Proposal for</div><div class="rfx-prop-job-title">${esc(open.title)}</div></div>`
      : "";

    // Generating — show a waiting state while Claude writes. The bold line is a LIVE status
    // that startGeneration advances through the stages (client name → work samples/Loom →
    // writing) via setGenStage(), so the rep sees which step is running.
    if (rfxGenState === "generating") {
      return `
        ${jobHead}
        <div class="rfx-gen-wait">
          <span class="rfx-spin dark big"></span>
          <div class="rfx-gen-wait-t">
            <b data-rfx-gen-stage>${esc(rfxGenStage || "Writing your proposal…")}</b>
            <span>${SYSTEM_NAME} takes a few seconds — you'll review everything before it goes to Upwork.</span>
          </div>
        </div>`;
    }

    // Error — generation failed (Worker down, key, etc.).
    if (rfxGenState === "error") {
      return `
        ${jobHead}
        <div class="rfx-gen-err">Couldn't generate: ${esc(rfxGenError)}</div>
        <button class="rfx-btn primary full rfx-mt" data-gen-proposal><span class="rfx-spark">✦</span> Try again</button>`;
    }

    // Idle — nothing generated yet; offer the one action.
    if (rfxGenState !== "ready") {
      return `
        ${jobHead}
        <div class="rfx-context-note">Generate a tailored proposal for this job — cover letter, screening answers, the right work samples, and your Loom. You copy each piece into Upwork yourself.</div>
        <button class="rfx-btn primary full" data-gen-proposal><span class="rfx-spark">✦</span> Generate proposal</button>`;
    }

    // Ready — the draft. ONLY real Claude output is shown (no mock fallback), so
    // sections with nothing generated are hidden rather than faked.
    const g = rfxGenResult || {};
    const coverText = g.cover_letter || "";
    const answers = (g.screening_answers && g.screening_answers.length) ? g.screening_answers : [];
    const recs = Array.isArray(g.portfolio_recommendations) ? g.portfolio_recommendations : [];
    const cost = typeof g.cost_inr === "number"
      ? `₹ ${g.cost_inr.toFixed(2)}${g.usage ? ` · ${g.usage.output_tokens || 0} tokens` : ""}`
      : "";

    const screeningSecs = answers.map((a, i) => `
      <div class="rfx-prop-sec">
        <div class="rfx-section-label">Screening question${answers.length > 1 ? ` ${i + 1}` : ""}</div>
        <div class="rfx-qtext">${esc(a.question || "")}</div>
        <textarea class="rfx-edit rfx-mt" id="rfx-screen-${i}" style="min-height:90px">${esc(a.answer || "")}</textarea>
        <div class="rfx-between rfx-mt">
          <span class="rfx-cost"></span>
          <button class="rfx-btn ghost sm" data-copy="#rfx-screen-${i}">Copy answer</button>
        </div>
      </div>`).join("");

    const recsSec = recs.length ? `
      <div class="rfx-prop-sec">
        <div class="rfx-section-label">Suggested Proposal points to select</div>
        <div class="rfx-hint">${SYSTEM_NAME} recommends these from your portfolio for this job:</div>
        ${recs.map((r) => {
          // Title = portfolio location (e.g. "Portfolio p5, item 1"); subheading = the sample name.
          const where = (r.page != null) ? `Portfolio p${r.page}, item ${r.position}` : (r.where || "");
          const title = where || (r.title || "");
          const sub = where ? (r.title || "") : "";
          return `<div class="rfx-rec"><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</div>`;
        }).join("")}
      </div>` : "";

    // Work samples — real screenshot URLs (jobs.image_links). Hidden when the job has none.
    const assetsSec = rfxAssets.length ? `
      <div class="rfx-prop-sec">
        <div class="rfx-section-label">Attachments</div>
        <div class="rfx-hint">Pick the samples relevant to this job, then download them as one zip to upload to Upwork.</div>
        <div class="rfx-assets" id="rfx-assets">
          ${rfxAssets.map((a, i) => `
            <div class="rfx-asset ${selectedAssets.has(i) ? "sel" : ""}" data-asset="${i}" style="background:${a.bg}" title="${esc(a.url)}">
              ${a.src ? `<img class="rfx-asset-img" data-asset-img src="${esc(a.src)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}
              <span class="rfx-check">✓</span>
              <span class="rfx-asset-cap">${esc(a.label)}</span>
            </div>`).join("")}
        </div>
        <div class="rfx-between rfx-mt">
          <span class="rfx-meta" id="rfx-asset-count">${selectedAssets.size} selected</span>
          <button class="rfx-btn primary sm" data-zip ${selectedAssets.size ? "" : "disabled"}><span class="rfx-dl">⬇</span> Download selected (ZIP)</button>
        </div>
      </div>` : "";

    // Loom walkthroughs — real links (jobs.looms). Title shown, the URL is what Copy copies.
    // Hidden for now (flip SHOW_LOOM to re-enable); the section is kept built, just not rendered.
    const SHOW_LOOM = false;
    const loomSec = rfxLooms.length ? `
      <div class="rfx-prop-sec">
        <div class="rfx-section-label">Loom video${rfxLooms.length > 1 ? "s" : ""}</div>
        ${rfxLooms.map((l) => `
          <div class="rfx-loom-row">
            <span class="rfx-loom-link" title="${esc(l.url || l.title)}">${esc(l.title)}</span>
            <button class="rfx-btn ghost sm" data-loom="${esc(l.url || l.raw)}">Copy link</button>
          </div>`).join("")}
      </div>` : "";

    return `
      ${jobHead}
      <div class="rfx-context-note">Copy each piece into Upwork's apply form yourself — ${SYSTEM_NAME} never fills or submits the page.${cost ? ` <span class="rfx-cost">${cost}</span>` : ""}</div>

      <div class="rfx-prop-sec">
        <div class="rfx-section-label">Cover letter</div>
        <textarea class="rfx-edit" id="rfx-cover">${esc(coverText)}</textarea>
        <div class="rfx-between rfx-mt">
          <span class="rfx-cost"></span>
          ${rfxGenSubmitted
            ? `<span class="rfx-tag-own mine" title="This proposal was already submitted on Upwork — regenerate is locked.">Submitted ✓</span>`
            : `<button class="rfx-btn ghost sm" data-gen-proposal>↻ Regenerate</button>`}
        </div>
        <button class="rfx-btn primary full rfx-mt" data-copy="#rfx-cover">Copy cover letter</button>
      </div>

      ${screeningSecs}
      ${recsSec}
      ${assetsSec}
      ${SHOW_LOOM ? loomSec : ""}
    `;
  }

  /* ---- Download selected work samples as ONE zip (no dependencies) ----
     Fetches each selected asset (when it has a real url) and bundles them with a
     minimal store-method ZIP writer. Until R2 urls are wired, a placeholder text
     file stands in per asset so the flow is testable end-to-end. */
  function crc32(bytes) {
    let table = crc32._t;
    if (!table) {
      table = crc32._t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
      }
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function buildZip(files) {
    const enc = new TextEncoder();
    const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF];
    const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];
    const parts = [];
    const central = [];
    let offset = 0;
    files.forEach((f) => {
      const nameBytes = enc.encode(f.name);
      const crc = crc32(f.data);
      const size = f.data.length;
      const local = new Uint8Array([].concat(
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0)
      ));
      parts.push(local, nameBytes, f.data);
      central.push(new Uint8Array([].concat(
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(size), u32(size), u16(nameBytes.length),
        u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)
      )), nameBytes);
      offset += local.length + nameBytes.length + size;
    });
    let centralSize = 0;
    central.forEach((c) => (centralSize += c.length));
    const eocd = new Uint8Array([].concat(
      u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
      u32(centralSize), u32(offset), u16(0)
    ));
    return new Blob([...parts, ...central, eocd], { type: "application/zip" });
  }

  // Ask the background to fetch an image cross-origin. Resolves to { ok, base64, contentType } or { error }.
  function apiFetchAsset(url) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "FETCH_ASSET", url }, (resp) => {
          if (chrome.runtime.lastError || !resp) {
            resolve({ error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || "No response" });
            return;
          }
          resolve(resp);
        });
      } catch (e) { resolve({ error: String(e) }); }
    });
  }
  // base64 (from the background fetch) -> bytes for the ZIP.
  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // File extension from a content-type, so the zipped image lands as .jpg/.png/etc.
  function extFromType(ct) {
    const t = String(ct || "").toLowerCase();
    if (t.includes("jpeg") || t.includes("jpg")) return "jpg";
    if (t.includes("png")) return "png";
    if (t.includes("webp")) return "webp";
    if (t.includes("gif")) return "gif";
    if (t.includes("svg")) return "svg";
    return "";
  }
  async function downloadSelectedZip(btn) {
    const idxs = [...selectedAssets];
    if (!idxs.length) return flash(btn, "Select at least one sample");
    const prev = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="rfx-spin"></span> Zipping…`;
    const enc = new TextEncoder();
    const files = [];
    for (const i of idxs) {
      const a = rfxAssets[i];
      if (!a) continue;
      let data = null, name = a.name || `${a.label}.bin`;
      // Fetch the real image via the BACKGROUND (host_permissions bypass the page's CORS,
      // which would otherwise block drive.google.com). Prefer the viewable thumbnail URL.
      const fetchUrl = a.src || a.url;
      if (fetchUrl) {
        const resp = await apiFetchAsset(fetchUrl);
        if (resp && resp.ok && resp.base64) {
          data = b64ToBytes(resp.base64);
          const ext = extFromType(resp.contentType);
          if (ext) name = `${(a.label || `work-sample-${i + 1}`).replace(/[^\w.-]+/g, "-")}.${ext}`;
        }
      }
      if (!data) { // couldn't fetch the real bytes — placeholder so the zip still downloads
        data = enc.encode(`Reflex work sample — ${a.label}\n\nCouldn't fetch ${fetchUrl || "this asset"}.\nIf this persists, the image host may need to be added to the extension's host_permissions.`);
        name = name.replace(/\.[^.]+$/, "") + ".txt";
      }
      files.push({ name, data });
    }
    const url = URL.createObjectURL(buildZip(files));
    const link = document.createElement("a");
    link.href = url;
    link.download = "reflex-work-samples.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    btn.disabled = false;
    btn.innerHTML = prev;
    flash(btn, `Downloaded ${files.length} file${files.length > 1 ? "s" : ""} ✓`);
  }

  /* ---- Surface 4: messages (hero) ---- */
  function renderMessages() {
    const replied = activeTone !== "base" || window.__rfxReplied;
    const replyText = MOCK_REPLIES[activeTone] || MOCK_REPLIES.base;
    return `
      <div class="rfx-context-note">Reading a client thread? Get a reply in one click — ${SYSTEM_NAME} already knows the job, your proposal, and the whole conversation.</div>

      <div class="rfx-card rfx-thread">
        <div class="rfx-thread-head">Conversation</div>
        ${MOCK_THREAD.map(m => `
          <div class="rfx-msg ${m.side}">
            <div class="rfx-who">${m.who}</div>
            <div class="rfx-bubble">${m.text}</div>
          </div>`).join("")}
        <div class="rfx-thread-actions">
          <button class="rfx-btn primary" data-suggest><span class="rfx-spark">✦</span> Suggested reply</button>
          <button class="rfx-btn ghost" data-summary>Summarize</button>
        </div>
      </div>

      <div id="rfx-reply-zone"></div>
    `;
  }

  function replyCardHTML() {
    const replyText = MOCK_REPLIES[activeTone] || MOCK_REPLIES.base;
    const tones = ["Warmer", "Shorter", "More specific"];
    return `
      <div class="rfx-card">
        <div class="rfx-section-label">Suggested reply</div>
        <textarea class="rfx-edit" id="rfx-reply">${replyText}</textarea>
        <div class="rfx-tones">
          ${tones.map(t => `<button class="rfx-tone ${activeTone===t?'rfx-active':''}" data-tone="${t}">${t}</button>`).join("")}
        </div>
        <div class="rfx-between">
          <span class="rfx-cost">₹ 0.22 · ~340 tokens</span>
          <button class="rfx-btn ghost sm" data-regen-reply>↻ Regenerate</button>
        </div>
        <button class="rfx-btn primary full rfx-mt" data-insert="reply">Copy reply</button>
      </div>
    `;
  }

  /* ---------- wire interactions ---------- */
  function wire(body) {
    // sign-in gate: re-check auth after the rep signs in via the popup
    const ar = body.querySelector("[data-auth-refresh]");
    if (ar) ar.addEventListener("click", () => refreshAuth(() => {
      if (rfxAuth && rfxAuth.token) startMirror();
      render();
    }));

    // jump between surfaces
    body.querySelectorAll("[data-go]").forEach(b =>
      b.addEventListener("click", () => { surface = b.dataset.go; render(); }));

    // listing: wire each live job card (Add / Generate)
    body.querySelectorAll("[data-rfx-card]").forEach((card) =>
      wireListCard(card, card.getAttribute("data-rfx-card")));

    // job tab: wire the open job's card (Add / Generate)
    const jc = body.querySelector("[data-rfx-jobtab]");
    if (jc) wireListCard(jc, jc.getAttribute("data-rfx-jobtab"));

    // success page: "Confirm & Save" records the submitted proposal against its job
    const sc = body.querySelector("[data-submit-confirm]");
    if (sc) sc.addEventListener("click", () => confirmSubmitProposal(body));

    // job tab: "Apply on Upwork" is a plain <a href> (the apply URL built from the open job's
    // URL). The rep clicks the link themselves — no scripted navigation/automation here.

    // listing add
    body.querySelectorAll("[data-add]").forEach(b =>
      b.addEventListener("click", () => {
        b.outerHTML = `<span class="rfx-tile-badge rel">In ${SYSTEM_NAME} ✓</span>`;
        // TODO(claude-code): send { type:"ADD_JOB", jobData } to background, persist to backend.
      }));

    // proposal: regenerate cover
    const rc = body.querySelector("[data-regen-cover]");
    if (rc) rc.addEventListener("click", () => {
      draftIndex = (draftIndex + 1) % MOCK_DRAFTS.length;
      body.querySelector("#rfx-cover").value = MOCK_DRAFTS[draftIndex];
      // TODO(claude-code): call backend GENERATE_PROPOSAL and stream the new draft.
    });

    // proposal: asset select -> updates the count + enables the zip button
    body.querySelectorAll("[data-asset]").forEach(el =>
      el.addEventListener("click", () => {
        const i = +el.dataset.asset;
        if (selectedAssets.has(i)) selectedAssets.delete(i); else selectedAssets.add(i);
        el.classList.toggle("sel");
        const c = body.querySelector("#rfx-asset-count");
        if (c) c.textContent = `${selectedAssets.size} selected`;
        const zip = body.querySelector("[data-zip]");
        if (zip) zip.disabled = selectedAssets.size === 0;
      }));

    // proposal: if a work-sample image can't load (CSP / not public), hide it so the
    // colored tile + caption show instead of a broken-image icon. (Inline onerror is
    // blocked by Upwork's page CSP, so wire it here.)
    body.querySelectorAll("[data-asset-img]").forEach((img) =>
      img.addEventListener("error", () => { img.style.display = "none"; }));

    // proposal: the idle "Generate proposal" CTA + Regenerate / Try again.
    // On the Job tab the proposal lives inline below the card, so stay on this tab.
    body.querySelectorAll("[data-gen-proposal]").forEach((gp) =>
      gp.addEventListener("click", () => startGeneration(undefined, { stay: surface === "job" })));

    // proposal: download the selected work samples as one zip
    const zip = body.querySelector("[data-zip]");
    if (zip) zip.addEventListener("click", () => downloadSelectedZip(zip));

    // copy buttons -> clipboard (Reflex never writes into Upwork's fields)
    body.querySelectorAll("[data-insert]").forEach(b =>
      b.addEventListener("click", () => handleInsert(b, body)));

    // generic copy: copies the value of the element named in data-copy
    body.querySelectorAll("[data-copy]").forEach(b =>
      b.addEventListener("click", () => {
        const el = body.querySelector(b.getAttribute("data-copy"));
        copyText(b, el ? el.value : "");
      }));

    // proposal: copy the Loom link (the real URL lives on each row's data-loom)
    body.querySelectorAll("[data-loom]").forEach(b =>
      b.addEventListener("click", () => copyText(b, b.dataset.loom || "")));

    // listing: copy a job title straight from its card (the literal title is on data-copy-title).
    // Tiny icon button → use a toast for the confirmation (not a button-label flash).
    body.querySelectorAll("[data-copy-title]").forEach(b =>
      b.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const title = b.getAttribute("data-copy-title") || "";
        if (!title) return;
        writeClipboard(title);
        b.classList.add("ok"); setTimeout(() => b.classList.remove("ok"), 1200);
        toast("Title copied ✓");
      }));

    // messages: suggested reply (with generating state)
    const sg = body.querySelector("[data-suggest]");
    if (sg) sg.addEventListener("click", () => {
      const zone = body.querySelector("#rfx-reply-zone");
      sg.disabled = true;
      sg.innerHTML = `<span class="rfx-spin"></span> Generating…`;
      // TODO(claude-code): send { type:"SUGGEST_REPLY", jobId, thread } to background.
      setTimeout(() => {
        window.__rfxReplied = true;
        activeTone = "base";
        zone.innerHTML = replyCardHTML();
        wireReply(zone);
        sg.disabled = false;
        sg.innerHTML = `<span class="rfx-spark">✦</span> Suggested reply`;
      }, 850);
    });

    // messages: summarize
    const sm = body.querySelector("[data-summary]");
    if (sm) sm.addEventListener("click", () => {
      const zone = body.querySelector("#rfx-reply-zone");
      zone.innerHTML = `<div class="rfx-card"><div class="rfx-section-label">Conversation summary</div><div class="rfx-meta" style="color:var(--rfx-text-2)">${MOCK_SUMMARY}</div></div>`;
    });

    // if a reply was already shown for this session, restore it
    if (surface === "messages" && window.__rfxReplied) {
      const zone = body.querySelector("#rfx-reply-zone");
      if (zone && !zone.innerHTML.trim()) { zone.innerHTML = replyCardHTML(); wireReply(zone); }
    }
  }

  function wireReply(zone) {
    zone.querySelectorAll("[data-tone]").forEach(t =>
      t.addEventListener("click", () => {
        activeTone = t.dataset.tone;
        zone.innerHTML = replyCardHTML();
        wireReply(zone);
        // TODO(claude-code): re-call backend with the tone instruction.
      }));
    const rr = zone.querySelector("[data-regen-reply]");
    if (rr) rr.addEventListener("click", () => { zone.innerHTML = replyCardHTML(); wireReply(zone); });
    zone.querySelectorAll("[data-insert]").forEach(b =>
      b.addEventListener("click", () => handleInsert(b, zone)));
  }

  function flash(btn, msg) {
    const old = btn.innerHTML;
    btn.innerHTML = msg;
    btn.disabled = true;
    setTimeout(() => { btn.innerHTML = old; btn.disabled = false; }, 1300);
  }

  /* ============================================================
     REAL UPWORK DOM INTEGRATION  (anchors — see docs/UPWORK-ANCHORS.md)
     Reads the page and FILLS fields on a user click only. Nothing here
     submits, auto-refreshes, or harvests on a timer — reactive-only; the
     rep reviews and clicks Submit on Upwork. Only the DOM read/write is
     real; the *content* (drafts, replies, statuses) stays mock until the
     backend exists.
     ============================================================ */
  const ANCHORS = {
    jobTile:       "[data-test='JobTile']",
    jobDetail:     "[data-ev-sublocation='jobdetails']",
    coverLetter:   "textarea[aria-labelledby='cover_letter_label']",
    questionsArea: ".questions-area",
    composer:      ".composer [contenteditable='true']"
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* Anchor 3 / 3b — fill a <textarea> so Upwork's framework registers it.
     A plain `.value =` is ignored; use the native setter + an input event. */
  function fillTextarea(el, text) {
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return el.value === text;
  }

  /* Anchor 4 — fill the Tiptap/ProseMirror editor. Setting .value/.textContent
     won't work (the editor owns its state); insert via a paste the editor
     recognizes, fall back to execCommand, then verify it actually persisted. */
  function fillContentEditable(el, text) {
    if (!el) return false;
    el.focus();
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    } catch (e) { /* ClipboardEvent/DataTransfer unsupported — fall through */ }
    if (!(el.textContent || "").includes(text)) {
      el.focus();
      try { document.execCommand("insertText", false, text); } catch (e) {}
    }
    return (el.textContent || "").includes(text); // persisted, not just visual
  }

  /* Anchor 3 — cover letter */
  function fillCoverLetter(text) {
    return fillTextarea(document.querySelector(ANCHORS.coverLetter), text);
  }

  /* Anchor 3b — screening questions (DYNAMIC count). Read each <label> (the
     question) and fill its <textarea>. answerFor(question, i) supplies the
     text — mock now, per-question from the backend later. */
  function readScreeningQuestions() {
    const area = document.querySelector(ANCHORS.questionsArea);
    if (!area) return [];
    return Array.from(area.querySelectorAll("textarea")).map((el, i) => {
      let question = "";
      if (el.id) {
        const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lab) question = lab.textContent.trim();
      }
      if (!question) {
        const near = el.closest("div, fieldset, li, section");
        const lab = near && near.querySelector("label");
        if (lab) question = lab.textContent.trim();
      }
      return { index: i, question, el };
    });
  }
  function fillScreeningAnswers(answerFor) {
    const qs = readScreeningQuestions();
    let filled = 0;
    qs.forEach((q) => {
      const text = answerFor(q.question, q.index);
      if (text != null && fillTextarea(q.el, text)) filled++;
    });
    if (qs.length) {
      console.log(`[${SYSTEM_NAME}] screening: read ${qs.length}, filled ${filled}`, qs.map((q) => q.question));
    }
    return { total: qs.length, filled };
  }

  /* Anchor 4 — message composer */
  function fillMessageComposer(text) {
    return fillContentEditable(document.querySelector(ANCHORS.composer), text);
  }

  /* Anchor 2 — read the live job-detail region (covers slide-over + full page).
     The region selector is verified; the title/description sub-selectors are
     best-effort and may need re-pointing on the live site. */
  function readJobDetail() {
    const region = document.querySelector(ANCHORS.jobDetail);
    if (!region) return null;
    const titleEl = region.querySelector("h1, h2, h3, [data-test='job-title']");
    const descEl = region.querySelector("[data-test='Description'], [data-test='job-description-text']");
    return {
      title: titleEl ? titleEl.textContent.trim() : "",
      description: descEl ? descEl.textContent.trim() : "",
      region
    };
  }

  /* COPY (never write to Upwork). The rep pastes into Upwork themselves — the
     extension never touches Upwork's fields, on a click or otherwise. */
  function copyText(btn, text) {
    if (!text) return flash(btn, "Nothing to copy");
    const done = () => flash(btn, "Copied — paste into Upwork ✓");
    try {
      const p = navigator.clipboard && navigator.clipboard.writeText(text);
      if (p && p.then) p.then(done, () => { legacyCopy(text); done(); });
      else { legacyCopy(text); done(); }
    } catch (e) { legacyCopy(text); done(); }
  }
  // Copy to clipboard WITHOUT flashing a button (used by tiny icon buttons that can't hold a
  // confirmation label) — pair it with toast().
  function writeClipboard(text) {
    try {
      const p = navigator.clipboard && navigator.clipboard.writeText(text);
      if (p && p.then) p.catch(() => legacyCopy(text));
      else legacyCopy(text);
    } catch (e) { legacyCopy(text); }
  }
  // Small transient confirmation popup anchored to the panel (not to a button).
  let rfxToastTimer = null;
  function toast(msg) {
    let el = root.querySelector(".rfx-toast");
    if (!el) { el = document.createElement("div"); el.className = "rfx-toast"; root.appendChild(el); }
    el.textContent = msg;
    el.classList.add("show");
    if (rfxToastTimer) clearTimeout(rfxToastTimer);
    rfxToastTimer = setTimeout(() => { el.classList.remove("show"); }, 1400);
  }
  function handleInsert(btn, scope) {
    const sel = { cover: "#rfx-cover", q: "#rfx-screen", reply: "#rfx-reply" }[btn.dataset.insert];
    const ta = sel ? scope.querySelector(sel) : null;
    copyText(btn, ta ? ta.value : "");
  }
  function legacyCopy(text) {
    const t = document.createElement("textarea");
    t.value = text;
    t.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(t);
    t.focus(); t.select();
    try { document.execCommand("copy"); } catch (e) {}
    t.remove();
  }

  /* Webfont loading removed for safety: it was the only automatic request to a
     third party (Google Fonts) on Upwork pages. The CSS already declares a system
     fallback stack, so the strip just uses the system font — no external request. */

  /* ---- Data seam: the single source the injected UI reads from. ----
     The backend/API doesn't exist yet, so this honestly reports "not connected"
     and never invents a verdict, owner, or quality. When the API lands this is the
     ONE function to change — call CHECK_JOBS keyed by jobId — and the whole
     injected UI lights up. Connected shape (future):
       { connected: true, inReflex, ownership: "mine"|"other"|"available", owner,
         verdict: "rel"|"rev"|"irr", quality: "good"|"medium"|"poor",
         actioned: "none"|"generated"|"submitted" } */
  /* ============================================================
     DUMMY MODE — REFLEX_DUMMY makes the full flow testable before the
     backend exists. Every action that would call the API uses local dummy
     values instead. Flip to false (and wire the TODO(backend) calls) when the
     API is live — that's the only switch.
     RULES: generated PROSE is marked "[SAMPLE …]" so no rep submits placeholder
     text to a client; form values (rate, profile) are fine to fill since the rep
     reviews before submitting.
     ============================================================ */
  const REFLEX_DUMMY = true;

  // Card strips pull LIVE status from the API via CHECK_JOBS. This is independent of
  // REFLEX_DUMMY (which only governs the demo prose/prefill + the detail strip). Set
  // false to fall back to the dummy per-card states.
  const REFLEX_LIVE = true;
  const rfxJobCache = {}; // jobId -> status from CHECK_JOBS (or {connected:false} if unreachable)

  const DUMMY = {
    profileMode: "freelancer", // "freelancer" (first radio) | "agency" (second) — one-line switch
    hourlyRate: "30",
    rateIncrease: "Never",
    cover:
      "[SAMPLE — Reflex not connected] Hi there — I build GoHighLevel and n8n automations for exactly this: lead capture, nurture sequences, and pipeline automation wired together so nothing slips. I've shipped 40+ similar builds and can show a live example on a quick call. — Neha (GrowwStacks)",
    answer: (q) =>
      `[SAMPLE — Reflex not connected] ${q ? "Re: " + q.slice(0, 60) + " — " : ""}Yes, we've delivered this many times and can walk you through a live build. (The AI-written answer replaces this once the backend is connected.)`,
    // TODO(backend): placeholder URLs — replace with real R2/ImageKit asset URLs (and add a
    // host_permission for that host) before image attach can actually fetch + drop files.
    images: [
      { name: "ghl-pipeline.png", url: "https://ik.imagekit.io/reflexdemo/ghl-pipeline.png" },
      { name: "n8n-flow.png", url: "https://ik.imagekit.io/reflexdemo/n8n-flow.png" },
    ],
    portfolio: [
      { title: "AI Gift Recommendation Engine", where: "Portfolio tab, page 1, 1st item" },
      { title: "Advanced n8n Recruitment Automation", where: "Portfolio tab, page 4, 2nd item" },
      { title: "GHL Voice Receptionist Setup", where: "Portfolio tab, page 2, 3rd item" },
    ],
    // dummy client snapshot the detail-page capture shows until CHECK_JOBS/ADD_JOB is live
    client: { spend: "$80K+ spent", rating: "5.0", hireRate: "95% hire rate", location: "United States", paymentVerified: true },
    // dummy stand-in for the AI client-name suggestion (real mode: from on-page reviews)
    nameHint: "Jacob",
    // per-card indicators (varied, deterministic by job id) — dummy stand-in for CHECK_JOBS
    card: (idx) => {
      const v = [
        { connected: true, inReflex: true, ownership: "mine", verdict: "rel", quality: "good", chips: "n8n · Lead gen · Sales", actioned: "none" },
        { connected: true, inReflex: true, ownership: "other", owner: "Sarthak", verdict: "rev", quality: "medium", chips: "Make.com · Reporting · Ops", actioned: "none" },
        { connected: true, inReflex: false },
        { connected: true, inReflex: true, ownership: "available", verdict: "rel", quality: "good", chips: "GHL · Voice AI · Sales", actioned: "none" },
        { connected: true, inReflex: true, ownership: "mine", verdict: "irr", quality: "poor", chips: "Figma · Branding", actioned: "none" },
      ];
      return v[idx % v.length];
    },
  };

  function rfxHashIdx(s, mod) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h) % mod;
  }

  /* Per-card data the strip reads. Dummy mode returns varied connected states (stable
     per job id); real mode returns {connected:false} until CHECK_JOBS exists. */
  function getJobData(jobId) {
    if (REFLEX_DUMMY) return DUMMY.card(rfxHashIdx(jobId || "x", 5));
    return { connected: false }; // TODO(backend): CHECK_JOBS({ jobId }) -> real status
  }

  /* Fill an <input> so Upwork's framework registers it (native setter + events). */
  function fillInput(el, value) {
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return el.value === value;
  }

  /* Open the job's Upwork DETAIL page (what clicking a job title does — NOT the apply form). */
  function openDetailPage(jobId) {
    const id = (jobId || "").replace(/^~/, "");
    const url = id ? `https://www.upwork.com/nx/search/jobs/details/~${id}` : "https://www.upwork.com/nx/find-work/";
    window.open(url, "_blank", "noopener");
  }

  const VERDICT_LABEL = { rel: "Relevant", rev: "Needs review", irr: "Not a fit" };
  const VERDICT_ICON = { rel: "✓", rev: "!", irr: "✕" };
  const QUALITY_LABEL = { good: "Good fit", medium: "Medium fit", poor: "Poor fit" };

  /* Inner HTML of the top-of-card strip for whatever state the data is in.
     Hierarchy by weight + color: relevance pill loudest, quality paired but
     lighter, taxonomy + owner quiet, the indigo Generate the one bright accent. */
  function stripInner(data) {
    const mark = `<span class="rfx-tag-mark"></span>`;

    if (data.checking) {
      return mark +
        `<span class="rfx-spin dark"></span>` +
        `<span class="rfx-tag-note">${SYSTEM_NAME} · checking…</span>`;
    }
    if (!data.connected) {
      // Honest now-state: no backend, so no invented values.
      return mark +
        `<span class="rfx-tag-relevance muted">—</span>` +
        `<span class="rfx-tag-quality muted">—</span>` +
        `<span class="rfx-tag-note">${SYSTEM_NAME} · not synced</span>` +
        `<span class="rfx-tag-spacer"></span>` +
        `<button class="rfx-tag-gen" disabled title="Connect ${SYSTEM_NAME} to enable"><span class="rfx-spark">✦</span> Generate proposal</button>`;
    }
    if (!data.inReflex) {
      return mark +
        `<span class="rfx-tag-note">Not in ${SYSTEM_NAME} yet</span>` +
        `<span class="rfx-tag-spacer"></span>` +
        `<button class="rfx-tag-add" data-add>＋ Add to ${SYSTEM_NAME}</button>`;
    }
    const relevance =
      `<span class="rfx-tag-relevance ${data.verdict}"><span class="rfx-tag-ic">${VERDICT_ICON[data.verdict] || ""}</span>${esc(VERDICT_LABEL[data.verdict] || "—")}</span>`;
    const quality = `<span class="rfx-tag-quality ${data.quality}">${esc(QUALITY_LABEL[data.quality] || "—")}</span>`;
    const chips = data.chips ? `<span class="rfx-tag-chips">${esc(data.chips)}</span>` : "";
    const own = data.ownership === "mine"
      ? `<span class="rfx-tag-own mine">In ${SYSTEM_NAME} ✓</span>`
      : data.ownership === "other"
        ? `<span class="rfx-tag-own other">Assigned · ${esc(data.owner || "")}</span>`
        : `<span class="rfx-tag-own skip">Available</span>`;
    const action = data.verdict === "irr"
      ? `<span class="rfx-tag-skip">Not pursued</span>`
      : (data.actioned === "generated" || data.actioned === "submitted")
        ? `<button class="rfx-tag-gen quiet" data-regen>↻ Proposal generated</button>`
        : `<button class="rfx-tag-gen" data-gen><span class="rfx-spark">✦</span> Generate proposal</button>`;
    return mark + relevance + quality + chips + `<span class="rfx-tag-spacer"></span>` + own + action;
  }

  /* Anchor 1 — prepend the Reflex strip to the TOP of each job card. Reactive-only,
     idempotent (skips a card that already has a strip), re-run by the debounced
     observer so it survives pagination, infinite scroll, and query changes. */
  function injectTileTag() {
    document.querySelectorAll(ANCHORS.jobTile).forEach((tile) => {
      if (tile.querySelector(":scope > .rfx-tag")) return;
      const jobId = tile.getAttribute("data-test-key") || tile.getAttribute("data-ev-job-uid") || "";
      // Live mode: use cached status if we have it, else a "checking…" placeholder that
      // the batched fetch fills in. Dummy mode: the local per-card states.
      const data = REFLEX_LIVE
        ? (rfxJobCache[jobId] || { connected: true, checking: true })
        : getJobData(jobId);
      const strip = document.createElement("div");
      strip.className = "rfx-tag" + (data.connected && data.verdict === "irr" ? " rfx-dim" : "");
      strip.dataset.rfxJobId = jobId;
      strip.innerHTML = stripInner(data);
      wireStrip(strip, jobId);
      tile.prepend(strip);
    });
    if (REFLEX_LIVE) scheduleFetch();
  }

  /* ---- Live strip data: batch every visible tile's id into ONE CHECK_JOBS call,
     then update each strip. Reactive only — runs after the (debounced) injection pass,
     never on a timer of its own. ---- */
  function apiCheckJobs(jobIds) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "CHECK_JOBS", jobIds }, (resp) => {
          if (chrome.runtime.lastError || !resp || resp.error) { resolve(null); return; }
          resolve(resp.statuses || {});
        });
      } catch (e) { resolve(null); }
    });
  }

  // Throttle: this only reduces load on OUR Worker/Neon (these calls never reach
  // Upwork). Debounce collapses rapid SPA churn; the in-flight guard means at most
  // one batch is ever in flight; the cache means each id is checked exactly once.
  let rfxFetchTimer = null;
  let rfxFetching = false;
  function scheduleFetch() {
    if (rfxFetchTimer) clearTimeout(rfxFetchTimer);
    rfxFetchTimer = setTimeout(runFetch, 400);
  }
  async function runFetch() {
    rfxFetchTimer = null;
    if (rfxFetching) { scheduleFetch(); return; } // one batch at a time
    const need = [];
    document.querySelectorAll(".rfx-tag[data-rfx-job-id]").forEach((s) => {
      const id = s.dataset.rfxJobId;
      if (id && !(id in rfxJobCache)) need.push(id);
    });
    if (!need.length) return;
    rfxFetching = true;
    try {
      const statuses = await apiCheckJobs(need);
      need.forEach((id) => {
        rfxJobCache[id] = statuses
          ? (statuses[id] || { connected: true, inReflex: false })
          : { connected: false }; // backend unreachable -> honest "not synced"
        updateTileStrip(id);
      });
    } finally {
      rfxFetching = false;
    }
  }
  function updateTileStrip(jobId) {
    const data = rfxJobCache[jobId];
    document.querySelectorAll(`.rfx-tag[data-rfx-job-id="${CSS.escape(jobId)}"]`).forEach((strip) => {
      strip.className = "rfx-tag" + (data.connected && data.verdict === "irr" ? " rfx-dim" : "");
      strip.innerHTML = stripInner(data);
      wireStrip(strip, jobId);
    });
  }

  /* Wire the strip's actions. Dummy mode: Add → flip to in-Reflex with indicators;
     Generate → loading → open the apply page (no dead clicks). No auto-submit. */
  function wireStrip(strip, jobId) {
    const add = strip.querySelector("[data-add]");
    if (add) {
      add.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const next = REFLEX_DUMMY
          ? { connected: true, inReflex: true, ownership: "mine", verdict: "rel", quality: "good", chips: "Added · syncing", actioned: "none" }
          : { connected: false };
        strip.className = "rfx-tag";
        strip.innerHTML = stripInner(next);
        wireStrip(strip, jobId);
        // TODO(backend): ADD_JOB({ jobId }).
      });
    }
    const gen = strip.querySelector("[data-gen], [data-regen]");
    if (gen) {
      gen.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const prev = gen.innerHTML;
        gen.disabled = true;
        gen.innerHTML = `<span class="rfx-spin"></span> Generating…`;
        setTimeout(() => {
          gen.innerHTML = `<span class="rfx-spark">✦</span> Opened →`;
          openDetailPage(jobId); // open the job DETAIL page (like clicking the title)
          setTimeout(() => { gen.innerHTML = prev; gen.disabled = false; }, 1500);
        }, 650);
        // TODO(backend): GENERATE_PROPOSAL({ jobId }), then open with the draft.
      });
    }
  }

  /* ---- Part 2/3: proposal page — one "Generate & prefill everything" button. ----
     Dummy mode fills profile + rate + rate-increase + cover + every screening answer
     and attempts an image attach, then shows a summary + portfolio picks. Cover and
     screening use the captured anchors; the settings fields use BEST-EFFORT selectors
     (not in UPWORK-ANCHORS.md) — all marked TODO(verify). Reflex never submits. */

  // Best-effort settings selectors — TODO(verify) on the live apply page, then move to UPWORK-ANCHORS.md.
  const SETTINGS = {
    hourlyRate: "#step-rate, [data-test='currency-input']", // VERIFIED — the bid-rate input
    fileInput: "input[type='file']", // VERIFIED — hidden file input (not the visible button)
  };

  function selectProfileRadio() {
    // VERIFIED: input[type='radio'] (2 on page) — first = "As a freelancer", second = agency.
    const radios = Array.from(document.querySelectorAll("input[type='radio']"));
    const target = DUMMY.profileMode === "agency" ? radios[1] : radios[0];
    if (!target) return false;
    if (!target.checked) target.click();
    return true;
  }
  function setHourlyRate() {
    const el = document.querySelector(SETTINGS.hourlyRate);
    return el ? fillInput(el, DUMMY.hourlyRate) : false;
  }
  function setRateIncrease() {
    // VERIFIED: custom dropdown (not <select>). Open the toggle inside the frequency scope,
    // then click the "Never" option row in the dropdown menu.
    const scope = document.querySelector('[aria-label="How often do you want a rate increase?"]');
    const toggle = scope && scope.querySelector("[data-test='dropdown-toggle']");
    if (!toggle) return false;
    toggle.click();
    const pickNever = () => {
      const menu = document.querySelector(".air3-dropdown-menu-container");
      if (!menu) return false;
      const row = Array.from(menu.querySelectorAll("*")).find(
        (el) => el.children.length === 0 && /^never$/i.test((el.textContent || "").trim())
      );
      if (row) { row.click(); return true; }
      return false;
    };
    if (!pickNever()) setTimeout(pickNever, 150); // menu animates in
    return true;
  }
  async function attachImages() {
    const input = document.querySelector(SETTINGS.fileInput); // TODO(verify)
    const names = DUMMY.images.map((i) => i.name);
    if (!input) return { ok: false, names };
    try {
      const dt = new DataTransfer();
      for (const img of DUMMY.images) {
        const blob = await (await fetch(img.url)).blob();
        dt.items.add(new File([blob], img.name, { type: blob.type || "image/png" }));
      }
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files").set;
      setter.call(input, dt.files);
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return { ok: true, names };
    } catch (e) {
      return { ok: false, names }; // cross-origin/CSP blocked the fetch — fall back to manual
    }
  }
  function markFilled(el) {
    if (!el || !el.parentElement) return;
    if (el.parentElement.querySelector(":scope > .rfx-filled")) return;
    const m = document.createElement("div");
    m.className = "rfx-filled";
    m.innerHTML = `<span class="rfx-tag-mark"></span> ${SYSTEM_NAME}-filled — review before submitting`;
    el.parentElement.insertBefore(m, el);
  }

  async function runPrefill(summaryEl) {
    const done = [];
    if (selectProfileRadio()) done.push("profile (" + DUMMY.profileMode + ")");
    if (setHourlyRate()) done.push("rate $" + DUMMY.hourlyRate);
    if (setRateIncrease()) done.push("rate increase: Never");
    const cover = document.querySelector(ANCHORS.coverLetter);
    if (cover && fillTextarea(cover, DUMMY.cover)) { markFilled(cover); done.push("cover letter"); }
    let nq = 0;
    readScreeningQuestions().forEach((q) => {
      if (fillTextarea(q.el, DUMMY.answer(q.question))) { markFilled(q.el); nq++; }
    });
    if (nq) done.push(nq + " screening answer" + (nq > 1 ? "s" : ""));
    const att = await attachImages();
    done.push(att.ok ? att.names.length + " images" : "images: attach manually");
    renderSummary(summaryEl, done, att);
  }

  function renderSummary(el, done, att) {
    const picks = DUMMY.portfolio.map((p) => `<li><b>${esc(p.title)}</b> — ${esc(p.where)}</li>`).join("");
    el.innerHTML =
      `<div class="rfx-sum-head"><span class="rfx-tag-mark"></span> Reflex prefilled — review &amp; submit</div>` +
      `<div class="rfx-sum-body">${esc(done.join(" · "))}</div>` +
      (att.ok ? "" : `<div class="rfx-sum-note">Couldn't auto-attach — add these in Upwork yourself: ${esc(att.names.join(", "))}</div>`) +
      `<div class="rfx-sum-sub">Portfolio picks for this job — open Upwork's highlights popup yourself and select:</div>` +
      `<ul class="rfx-sum-list">${picks}</ul>` +
      `<div class="rfx-sum-foot">Reflex never submits, opens, or clicks inside Upwork's popups — you review everything and click Submit.</div>`;
  }

  /* Pin one prominent action at the top of the apply page. */
  function injectProposalMega() {
    const cover = document.querySelector(ANCHORS.coverLetter);
    if (!cover) return;                          // mega-button is for the apply page
    if (document.querySelector(".rfx-mega")) return;

    const bar = document.createElement("div");
    bar.className = "rfx-mega";
    bar.innerHTML =
      `<div class="rfx-mega-row">` +
        `<span class="rfx-tag-mark"></span>` +
        `<div class="rfx-mega-txt"><b>Generate &amp; prefill everything</b><span>profile · rate · cover letter · all answers · images — sample data, you review &amp; submit</span></div>` +
        `<button class="rfx-mega-btn"><span class="rfx-spark">✦</span> Generate &amp; prefill</button>` +
      `</div>` +
      `<div class="rfx-mega-sum" hidden></div>`;
    const btn = bar.querySelector(".rfx-mega-btn");
    const sum = bar.querySelector(".rfx-mega-sum");
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.innerHTML = `<span class="rfx-spin"></span> Prefilling…`;
      sum.hidden = false;
      sum.innerHTML = `<div class="rfx-sum-body">Working…</div>`;
      await runPrefill(sum);
      btn.disabled = false;
      btn.innerHTML = `<span class="rfx-spark">✦</span> Re-run prefill`;
    });
    // best-effort placement: top of the apply form. TODO(verify) container.
    const host = cover.closest("form") || document.querySelector("main") || document.body;
    host.insertBefore(bar, host.firstChild);
  }

  /* ============================================================
     Part 3 — JOB DETAIL PAGE (Phase 1)
     On a job detail page (slide-over panel OR full page), inject a Reflex strip into
     the [data-ev-sublocation='jobdetails'] region. It shows Reflex's read on the job,
     captures the job + client snapshot (the spend / rating / hire-rate that Upwork's
     API omits but the page shows), and surfaces an AI client-name suggestion the rep
     confirms. Reactive-only: fires when the rep opens a job, never on a timer. In dummy
     mode the data is simulated; real mode swaps getJobData/capture for backend calls.
     ============================================================ */

  /* The job id from the detail URL (~0… natural key), used to key getJobData. */
  function currentDetailJobId() {
    return (location.pathname.match(/~0[0-9a-z]+/i) || [])[0] || "";
  }

  /* Best-effort read of the client snapshot from the detail region. The sub-selectors
     are TODO(verify) on the live site, so we read by text pattern and, in dummy mode,
     fall back to DUMMY.client so the panel always shows something. Real mode sends this
     to the backend on ADD_JOB for the exists-check + gap-fill. */
  function readClientStats(region) {
    const text = (region.textContent || "").replace(/\s+/g, " ");
    const pick = (re) => { const m = text.match(re); return m ? m[0].trim() : ""; };
    const found = {
      spend: pick(/\$[\d.,]+\s*[KMB]?\+?\s*(?:total spent|spent)/i),
      rating: pick(/\b[0-5]\.\d{1,2}\b/),
      hireRate: pick(/\b\d{1,3}%\s*hire rate/i),
      location: "",
      paymentVerified: /payment (?:method )?verified/i.test(text),
    };
    if (REFLEX_DUMMY && !found.spend && !found.hireRate) return { ...DUMMY.client };
    return found;
  }

  /* Surface a suggested client name. Real mode: pass on-page review text to the AI,
     which returns a name + confidence. Dummy mode: a friendly stand-in. NEVER
     auto-inserted into the greeting — the rep confirms it (a wrong name is worse than
     no name). */
  function suggestClientName(region) {
    const text = (region.textContent || "").replace(/\s+/g, " ");
    const m = text.match(/\b(?:working with|worked with|with)\s+([A-Z][a-z]{2,})\b/);
    const fromReview = m ? m[1] : "";
    if (REFLEX_DUMMY) return fromReview || DUMMY.nameHint;
    return fromReview; // TODO(backend): AI infers from reviews, returns name + confidence
  }

  /* Inner HTML of the detail strip: row 1 = Reflex read + ownership/add, row 2 =
     captured client snapshot, row 3 = confirmable client-name suggestion. */
  function detailStripInner(data, client, nameHint) {
    const mark = `<span class="rfx-tag-mark"></span>`;
    let read;
    if (!data.connected) {
      read = `<span class="rfx-tag-relevance muted">—</span><span class="rfx-tag-note">${SYSTEM_NAME} · not synced</span>`;
    } else if (!data.inReflex) {
      read = `<span class="rfx-tag-note">Not in ${SYSTEM_NAME} yet</span>` +
        `<span class="rfx-tag-spacer"></span>` +
        `<button class="rfx-tag-add" data-detail-add>＋ Add to ${SYSTEM_NAME}</button>`;
    } else {
      const rel = `<span class="rfx-tag-relevance ${data.verdict}"><span class="rfx-tag-ic">${VERDICT_ICON[data.verdict] || ""}</span>${esc(VERDICT_LABEL[data.verdict] || "—")}</span>`;
      const q = `<span class="rfx-tag-quality ${data.quality}">${esc(QUALITY_LABEL[data.quality] || "—")}</span>`;
      const chips = data.chips ? `<span class="rfx-tag-chips">${esc(data.chips)}</span>` : "";
      const own = data.ownership === "mine"
        ? `<span class="rfx-tag-own mine">In ${SYSTEM_NAME} ✓</span>`
        : data.ownership === "other"
          ? `<span class="rfx-tag-own other">Assigned · ${esc(data.owner || "")}</span>`
          : `<span class="rfx-tag-own skip">Available</span>`;
      read = rel + q + chips + `<span class="rfx-tag-spacer"></span>` + own;
    }

    const stats = [
      client.spend,
      client.rating ? client.rating + " rating" : "",
      client.hireRate,
      client.location,
      client.paymentVerified ? "✓ Payment verified" : "",
    ].filter(Boolean).map((v) => `<span class="rfx-detail-stat">${esc(v)}</span>`).join("");
    const clientRow = (data.connected && stats)
      ? `<div class="rfx-detail-client"><span class="rfx-detail-cap">Client captured</span>${stats}</div>`
      : "";

    const nameRow = (data.connected && nameHint)
      ? `<div class="rfx-detail-name">Client may be named <b>${esc(nameHint)}</b> (from reviews) — ` +
        `<button class="rfx-detail-usename" data-use-name="${esc(nameHint)}">use in greeting</button>` +
        `<span class="rfx-detail-named" hidden>✓ greeting set to "${esc(nameHint)}"</span></div>`
      : "";

    return `<div class="rfx-detail-row">${mark}${read}</div>${clientRow}${nameRow}`;
  }

  /* Capture the job + client on detail-open. Reactive (the rep opened this job), debounced
     by the idempotent injection. Dummy: log. Real: ADD_JOB exists-check + gap-fill. */
  function captureOnDetailOpen(jobId, data, client) {
    if (REFLEX_DUMMY) {
      console.log(`[${SYSTEM_NAME}] detail capture (dummy) — job ${jobId || "?"}`, { data, client });
      return;
    }
    // TODO(backend): ADD_JOB({ jobId, job: readJobDetail(), client }) — exists-check + gap-fill.
  }

  function wireDetailStrip(strip, jobId) {
    const add = strip.querySelector("[data-detail-add]");
    if (add) add.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const region = document.querySelector(ANCHORS.jobDetail) || document.body;
      const next = REFLEX_DUMMY
        ? { connected: true, inReflex: true, ownership: "mine", verdict: "rel", quality: "good", chips: "Added · syncing", actioned: "none" }
        : { connected: false };
      strip.className = "rfx-detail";
      strip.innerHTML = detailStripInner(next, readClientStats(region), suggestClientName(region));
      wireDetailStrip(strip, jobId);
      // TODO(backend): ADD_JOB({ jobId }).
    });
    const useName = strip.querySelector("[data-use-name]");
    if (useName) useName.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const named = strip.querySelector(".rfx-detail-named");
      useName.setAttribute("hidden", "");
      if (named) named.removeAttribute("hidden");
      // TODO(backend): persist the confirmed greeting name for this job's generation.
    });
  }

  /* Anchor 2 — prepend the Reflex strip to the job-detail region (panel + full page).
     Idempotent; re-run by the debounced observer so it survives the SPA opening jobs. */
  function injectDetailStrip() {
    const region = document.querySelector(ANCHORS.jobDetail);
    if (!region) return;
    if (region.querySelector(":scope > .rfx-detail")) return;
    const jobId = currentDetailJobId();
    const data = getJobData(jobId);
    const client = readClientStats(region);
    const nameHint = suggestClientName(region);
    captureOnDetailOpen(jobId, data, client);
    const strip = document.createElement("div");
    strip.className = "rfx-detail" + (data.connected && data.verdict === "irr" ? " rfx-dim" : "");
    strip.innerHTML = detailStripInner(data, client, nameHint);
    wireDetailStrip(strip, jobId);
    region.prepend(strip);
  }

  /* ============================================================
     REAL-TIME MIRROR (read-only). While the panel is open, watch Upwork's page
     for listing changes (scroll / pagination / new search / filter) and refresh
     the sidebar's Listing so it always matches what's on the main page. We only
     READ the DOM here — nothing is injected into, filled, or clicked on Upwork.
     Mutations originating inside our own panel are ignored to avoid a render loop.
     Idle when the panel is closed.
     ============================================================ */
  let rfxMirrorObserver = null;
  let rfxMirrorTimer = null;
  function startMirror() {
    if (rfxMirrorObserver) return;
    rfxMirrorObserver = new MutationObserver((muts) => {
      // ignore our own sidebar's DOM changes (would otherwise loop)
      if (!muts.some((m) => !root.contains(m.target))) return;
      if (rfxMirrorTimer) clearTimeout(rfxMirrorTimer);
      // listing mirrors the results page; job tab mirrors the open job — both
      // re-read the page (read-only) when Upwork's DOM changes. Opening a NEW job
      // auto-switches from the Listing to the Job tab.
      rfxMirrorTimer = setTimeout(() => {
        if (rfxAddOpen) return; // reviewing an Add — don't re-render over the review card
        // Waiting for the rep to open a job they tried to add from the listing: when one
        // opens, auto-switch to the Job tab; until then keep the "open the job" prompt up.
        if (rfxAwaitOpenForAdd) {
          const openNow = openJobNumericId();
          if (openNow) { rfxAwaitOpenForAdd = null; rfxLastOpenId = openNow; surface = "job"; render(); }
          return;
        }
        // Same, but the rep clicked Generate from the listing: switch to the Job tab and kick off
        // generation inline once they open the job.
        if (rfxAwaitOpenForGen) {
          const openNow = openJobNumericId();
          if (openNow) { rfxAwaitOpenForGen = null; rfxLastOpenId = openNow; surface = "job"; startGeneration(openNow, { stay: true }); }
          return;
        }
        // Post-submit success page: show the "save to Reflex" confirm card once (per proposal id).
        // Don't re-render on later DOM churn so the card's saving/saved state isn't wiped.
        if (shouldShowSubmitConfirm()) {
          const pid = proposalSuccessId();
          if (surface !== "job" || rfxSuccessShownFor !== pid) {
            surface = "job"; rfxSuccessShownFor = pid; render();
          }
          return;
        }
        // The apply page maps to the Job tab (Proposal tab was merged in). Switch from the
        // listing once; once we're on the Job tab, DON'T re-render on later DOM churn so the
        // rep's inline cover-letter edits / sample picks aren't wiped.
        if (isApplyPage()) {
          captureApplyContext(); // keep the remembered job + connects fresh (cheap) for the submit link
          updateApplyHint();     // refresh the visible "will record · N connects" line in place
          if (surface === "listing") { surface = "job"; rfxLastOpenId = openJobNumericId(); render(); }
          return;
        }
        const openId = openJobNumericId();
        if (openId && openId !== rfxLastOpenId) {
          rfxLastOpenId = openId;
          if (surface === "listing") surface = "job";
        } else if (!openId) {
          rfxLastOpenId = "";
        }
        // Job tab with an inline proposal up for THIS job: don't re-render over it — the rep
        // may be editing the cover letter / picking samples (same guard the apply page gets).
        if (surface === "job" && rfxGenState !== "idle" && rfxGenJobId && rfxGenJobId === openId) return;
        if (surface === "listing" || surface === "job") render();
      }, 250);
    });
    rfxMirrorObserver.observe(document.body, { childList: true, subtree: true });
  }
  function stopMirror() {
    if (rfxMirrorObserver) { rfxMirrorObserver.disconnect(); rfxMirrorObserver = null; }
    if (rfxMirrorTimer) { clearTimeout(rfxMirrorTimer); rfxMirrorTimer = null; }
  }

  // Live auth: when the rep signs in/out in the toolbar popup, chrome.storage.local
  // changes — reflect it in an already-open panel (gate ⇄ surfaces) without a reopen.
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || (!changes.reflex_token && !changes.reflex_user)) return;
      refreshAuth(() => {
        if (!root.classList.contains("rfx-open")) return;
        if (rfxAuth && rfxAuth.token) startMirror(); else stopMirror();
        render();
      });
    });
  } catch (e) { /* storage API unavailable — gate still works via the refresh button */ }

  // The apply page opens in its own browser tab — auto-open the panel straight to
  // the Proposal tab there, so the rep lands on exactly what they need. Same on the
  // post-submit success page, so the "save to Reflex" confirm card is right there.
  if (isApplyPage() || shouldShowSubmitConfirm()) openPanel();

})();
