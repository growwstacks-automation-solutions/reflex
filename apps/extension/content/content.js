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

  // MOCK: saved assets (in production these come from the rep's R2 library, each
  // with a real `url`). `name` is the filename used inside the downloaded zip.
  const MOCK_ASSETS = [
    { label: "GHL pipeline", bg: "#3C3489", name: "ghl-pipeline.png" },
    { label: "Nurture flow", bg: "#0F6E56", name: "nurture-flow.png" },
    { label: "Dashboard",    bg: "#0C447C", name: "dashboard.png" },
    { label: "Call booking", bg: "#854F0B", name: "call-booking.png" },
    { label: "Results",      bg: "#A32D2D", name: "results.png" },
    { label: "Before/after", bg: "#993C1D", name: "before-after.png" }
  ];

  // MOCK: the rep's relevant Loom walkthrough for this job (backend supplies the real one).
  const MOCK_LOOM = "https://www.loom.com/share/reflex-ghl-automation-demo";

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
  let selectedAssets = new Set([0, 1]);
  let draftIndex = 0;
  let activeTone = "base";
  let rfxLastOpenId = ""; // last Upwork job id seen open — drives auto-switch to the Job tab
  let rfxGenState = "idle"; // proposal generation: "idle" | "generating" | "ready" | "error"
  let rfxGenJobId = "";     // the job the current proposal draft is for
  let rfxGenResult = null;  // the /generate response (cover letter, answers, portfolio recs, cost)
  let rfxGenError = "";     // last generation error message

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
      <button class="rfx-x" title="Close">×</button>
    </div>
    <div class="rfx-switch">
      <button class="rfx-tab" data-s="listing">Listing</button>
      <button class="rfx-tab" data-s="job">Job</button>
      <button class="rfx-tab" data-s="proposal">Proposal</button>
      <button class="rfx-tab" data-s="messages">Messages</button>
    </div>
    <div class="rfx-body" id="rfx-body"></div>
    <div class="rfx-footer"><span class="rfx-sync-dot"></span> Listing is live from Reflex · sign in to sync your assignments</div>
  `;
  document.body.appendChild(root);

  root.querySelector(".rfx-x").addEventListener("click", closePanel);
  root.querySelectorAll(".rfx-tab").forEach(tab => {
    tab.addEventListener("click", () => { surface = tab.dataset.s; render(); });
  });

  function openPanel() {
    root.classList.add("rfx-open"); launcher.classList.add("rfx-hidden");
    if (isApplyPage()) {
      surface = "proposal";                 // on the apply page -> Proposal tab
    } else {
      const openId = openJobNumericId();
      if (openId) { surface = "job"; rfxLastOpenId = openId; } // a job is open -> show it
    }
    render(); startMirror();
  }
  function closePanel() { root.classList.remove("rfx-open"); launcher.classList.remove("rfx-hidden"); stopMirror(); }

  /* ---------- render ---------- */
  function render() {
    root.querySelectorAll(".rfx-tab").forEach(t =>
      t.classList.toggle("rfx-active", t.dataset.s === surface));
    const body = root.querySelector("#rfx-body");
    if (surface === "listing")  body.innerHTML = renderListing();
    if (surface === "job")      body.innerHTML = renderJob();
    if (surface === "proposal") body.innerHTML = renderProposal();
    if (surface === "messages") body.innerHTML = renderMessages();
    wire(body);
  }

  /* Generate a proposal: switch to the Proposal tab, show a waiting state, then call
     the Worker's /generate (Claude) via the background worker and reveal the draft. */
  async function startGeneration(jobId) {
    rfxGenJobId = jobId || openJobNumericId();
    rfxGenState = "generating";
    rfxGenResult = null;
    rfxGenError = "";
    surface = "proposal";
    render();
    const open = readOpenJob();                       // page-captured context the DB row lacks
    const payload = {
      job_id: rfxGenJobId || "STUB-0001",             // stub mode ignores the id; real mode uses it
      screening_questions: readScreeningQuestionTexts(), // read from the apply page (else none)
      client_name_hint: null,                         // backend key (renamed in the merge)
      client_context: open && open.client && open.client.length ? open.client.join(" · ") : undefined,
    };
    const resp = await apiGenerate(payload);
    if (resp && resp.result && !resp.error) {
      rfxGenResult = resp.result;
      rfxGenState = "ready";
    } else {
      rfxGenError = (resp && resp.error) || "Generation failed";
      rfxGenState = "error";
    }
    render();
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

  // Screening question texts on the current page (apply page). Empty elsewhere.
  function readScreeningQuestionTexts() {
    try { return readScreeningQuestions().map((q) => q.question).filter(Boolean); }
    catch (e) { return []; }
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

  // Read the jobs currently on the Upwork results page. Best-effort title selectors.
  function readVisibleTiles() {
    return Array.from(document.querySelectorAll(ANCHORS.jobTile)).map((tile) => {
      const jobId = tile.getAttribute("data-test-key") || tile.getAttribute("data-ev-job-uid") || "";
      const titleEl = tile.querySelector(
        "[data-test='job-tile-title-link'], [data-test='job-title-link'], a[href*='/jobs/'], h2 a, h3 a, h2, h3"
      );
      const title = titleEl ? titleEl.textContent.trim().replace(/\s+/g, " ") : "(untitled job)";
      return { jobId, title };
    });
  }

  // The strip inside each sidebar card — same signals as the old tile strip, laid
  // out for the narrow panel (pills wrap, chips truncate, action on its own row).
  function listCardInner(data) {
    if (data.checking) {
      return `<div class="rfx-jc-line"><span class="rfx-spin dark"></span><span class="rfx-jc-note">${SYSTEM_NAME} · checking…</span></div>`;
    }
    if (!data.connected) {
      return `<div class="rfx-jc-line"><span class="rfx-jc-note">${SYSTEM_NAME} · not synced</span></div>`;
    }
    if (!data.inReflex) {
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
    const action = data.verdict === "irr"
      ? `<span class="rfx-tag-skip">Not pursued</span>`
      : (data.actioned === "generated" || data.actioned === "submitted")
        ? `<button class="rfx-tag-gen quiet" data-card-regen>↻ Proposal generated</button>`
        : `<button class="rfx-tag-gen" data-card-gen><span class="rfx-spark">✦</span> Generate</button>`;
    return `<div class="rfx-jc-pills">${rel}${quality}</div>${chips}<div class="rfx-jc-foot">${own}<span class="rfx-jc-spacer"></span>${action}</div>`;
  }

  function listCardHTML(job) {
    const data = (job.jobId && rfxJobCache[job.jobId]) ||
      (job.jobId ? { connected: true, checking: true } : { connected: false });
    const dim = data.connected && data.verdict === "irr" ? " rfx-dim" : "";
    return `
      <div class="rfx-job-card${dim}" data-rfx-card="${esc(job.jobId)}">
        <div class="rfx-job-title">${esc(job.title)}</div>
        <div class="rfx-job-strip">${listCardInner(data)}</div>
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
    const strip = card.querySelector(".rfx-job-strip");
    const add = card.querySelector("[data-card-add]");
    if (add) add.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const next = REFLEX_DUMMY
        ? { connected: true, inReflex: true, ownership: "mine", verdict: "rel", quality: "good", chips: "Added · syncing", actioned: "none" }
        : { connected: false };
      if (jobId) rfxJobCache[jobId] = next;
      strip.innerHTML = listCardInner(next);
      card.classList.toggle("rfx-dim", !!(next.connected && next.verdict === "irr"));
      wireListCard(card, jobId);
      // TODO(backend): ADD_JOB({ jobId }).
    });
    const gen = card.querySelector("[data-card-gen], [data-card-regen]");
    if (gen) gen.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      startGeneration(jobId); // switch to Proposal tab + waiting state + draft
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
      if (strip) { strip.innerHTML = listCardInner(data); wireListCard(card, id); }
      card.classList.toggle("rfx-dim", !!(data.connected && data.verdict === "irr"));
    });
  }

  /* ---- Surface 2: the OPEN job (detail) ----
     Reads whatever job is open on Upwork (the [data-ev-sublocation='jobdetails']
     region) — READ-ONLY — and shows it here with its Reflex strip pulled from the
     DB (CHECK_JOBS), exactly like a Listing card but for the single open job. */
  function renderJob() {
    const open = readOpenJob();
    if (!open) {
      return `<div class="rfx-context-note">Open a job on Upwork — click any job to view it — and its ${SYSTEM_NAME} details will appear here, with its strip from the database.</div>`;
    }
    scheduleJobFetch(open.id);
    const data = (open.id && rfxJobCache[open.id]) ||
      (open.id ? { connected: true, checking: true } : { connected: false });
    const dim = data.connected && data.verdict === "irr" ? " rfx-dim" : "";
    const meta = open.meta.map((v) => `<span class="rfx-detail-stat">${esc(v)}</span>`).join("");
    const stats = open.client.map((v) => `<span class="rfx-detail-stat client">${esc(v)}</span>`).join("");
    return `
      <div class="rfx-context-note">This job — read from the Upwork page. Status from ${SYSTEM_NAME}.</div>
      <div class="rfx-job-card${dim}" data-rfx-jobtab="${esc(open.id)}">
        <div class="rfx-job-title" style="-webkit-line-clamp:3">${esc(open.title)}</div>
        <div class="rfx-job-strip">${listCardInner(data)}</div>
        ${meta ? `<div class="rfx-jc-stats">${meta}</div>` : ""}
        ${stats ? `<div class="rfx-jc-stats">${stats}</div>` : ""}
        ${open.description ? `<div class="rfx-jobdesc">${esc(open.description)}</div>` : ""}
        ${open.cipher ? `<button class="rfx-btn primary full rfx-mt" data-apply="${esc(applyUrlFor(open.cipher))}">Apply on Upwork →</button>` : ""}
      </div>
    `;
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

  // Are we ON an apply page? (used to auto-switch to the Proposal tab)
  function isApplyPage() {
    const p = location.pathname;
    return /\/apply(\/|$)/.test(p) || /\/proposals\/job\/~/.test(p);
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
    if (!title) title = (document.title || "").replace(/\s*[-|–]\s*Upwork.*$/i, "").trim();
    if (!title) title = "(this job)";
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
    return { id, title, description, meta, client, cipher: openJobCipherId() };
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
    if (strip) { strip.innerHTML = listCardInner(data); wireListCard(card, id); }
    card.classList.toggle("rfx-dim", !!(data.connected && data.verdict === "irr"));
  }

  /* ---- Surface 3: proposal (the Upwork APPLY page) ----
     Generated pieces the rep copies / downloads into Upwork's apply form. Reflex
     never writes to the page: cover letter + answer = Copy, work samples = Download
     selected as a zip, Loom = Copy link. */
  function renderProposal() {
    const open = readOpenJob();                    // the job this proposal is for
    const jobHead = open
      ? `<div class="rfx-prop-job"><div class="rfx-prop-job-cap">Proposal for</div><div class="rfx-prop-job-title">${esc(open.title)}</div></div>`
      : "";

    // Generating — show a waiting state while Claude writes (UI-only for now).
    if (rfxGenState === "generating") {
      return `
        ${jobHead}
        <div class="rfx-gen-wait">
          <span class="rfx-spin dark big"></span>
          <div class="rfx-gen-wait-t">
            <b>Writing your proposal…</b>
            <span>${SYSTEM_NAME} is drafting the cover letter and answers, and picking the right work samples + Loom for this job.</span>
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
        <div class="rfx-section-label">Suggested work samples</div>
        <div class="rfx-hint">${SYSTEM_NAME} recommends these from your portfolio for this job:</div>
        ${recs.map((r) => {
          const why = r.why || r.reason || "";
          const where = (r.page != null) ? `Portfolio p${r.page}, item ${r.position}` : (r.where || "");
          return `<div class="rfx-rec"><b>${esc(r.title || "")}</b>${why ? `<span>${esc(why)}</span>` : ""}${where ? `<em>${esc(where)}</em>` : ""}</div>`;
        }).join("")}
      </div>` : "";

    return `
      ${jobHead}
      <div class="rfx-context-note">Copy each piece into Upwork's apply form yourself — ${SYSTEM_NAME} never fills or submits the page.${cost ? ` <span class="rfx-cost">${cost}</span>` : ""}</div>

      <div class="rfx-prop-sec">
        <div class="rfx-section-label">Cover letter</div>
        <textarea class="rfx-edit" id="rfx-cover">${esc(coverText)}</textarea>
        <div class="rfx-between rfx-mt">
          <span class="rfx-cost"></span>
          <button class="rfx-btn ghost sm" data-gen-proposal>↻ Regenerate</button>
        </div>
        <button class="rfx-btn primary full rfx-mt" data-copy="#rfx-cover">Copy cover letter</button>
      </div>

      ${screeningSecs}
      ${recsSec}

      <div class="rfx-prop-sec">
        <div class="rfx-section-label">Work samples</div>
        <div class="rfx-hint">Pick the samples relevant to this job, then download them as one zip to upload to Upwork.</div>
        <div class="rfx-assets" id="rfx-assets">
          ${MOCK_ASSETS.map((a, i) => `
            <div class="rfx-asset ${selectedAssets.has(i) ? "sel" : ""}" data-asset="${i}" style="background:${a.bg}">
              <span class="rfx-check">✓</span>${esc(a.label)}
            </div>`).join("")}
        </div>
        <div class="rfx-between rfx-mt">
          <span class="rfx-meta" id="rfx-asset-count">${selectedAssets.size} selected</span>
          <button class="rfx-btn primary sm" data-zip ${selectedAssets.size ? "" : "disabled"}><span class="rfx-dl">⬇</span> Download selected (ZIP)</button>
        </div>
      </div>

      <div class="rfx-prop-sec">
        <div class="rfx-section-label">Loom video</div>
        <div class="rfx-loom-row">
          <span class="rfx-loom-link">${esc(MOCK_LOOM)}</span>
          <button class="rfx-btn ghost sm" data-loom>Copy link</button>
        </div>
      </div>
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
  async function downloadSelectedZip(btn) {
    const idxs = [...selectedAssets];
    if (!idxs.length) return flash(btn, "Select at least one sample");
    const prev = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="rfx-spin"></span> Zipping…`;
    const enc = new TextEncoder();
    const files = [];
    for (const i of idxs) {
      const a = MOCK_ASSETS[i];
      let data = null, name = a.name || `${a.label}.bin`;
      if (a.url) {
        try { const r = await fetch(a.url); if (r.ok) data = new Uint8Array(await r.arrayBuffer()); } catch (e) { /* fall back */ }
      }
      if (!data) { // no real url yet — placeholder so the zip still downloads
        data = enc.encode(`Reflex work sample — ${a.label}\n\nThis is a placeholder. The real file from your R2 library replaces this once assets are wired.`);
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
    // jump between surfaces
    body.querySelectorAll("[data-go]").forEach(b =>
      b.addEventListener("click", () => { surface = b.dataset.go; render(); }));

    // listing: wire each live job card (Add / Generate)
    body.querySelectorAll("[data-rfx-card]").forEach((card) =>
      wireListCard(card, card.getAttribute("data-rfx-card")));

    // job tab: wire the open job's card (Add / Generate)
    const jc = body.querySelector("[data-rfx-jobtab]");
    if (jc) wireListCard(jc, jc.getAttribute("data-rfx-jobtab"));

    // job tab: Apply -> open Upwork's apply page in a new tab (Proposal tab auto-opens there)
    const ap = body.querySelector("[data-apply]");
    if (ap) ap.addEventListener("click", () => window.open(ap.getAttribute("data-apply"), "_blank", "noopener"));

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

    // proposal: the idle "Generate proposal" CTA
    const gp = body.querySelector("[data-gen-proposal]");
    if (gp) gp.addEventListener("click", () => startGeneration());

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

    // proposal: copy the Loom link
    body.querySelectorAll("[data-loom]").forEach(b =>
      b.addEventListener("click", () => copyText(b, MOCK_LOOM)));

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
        // on the apply page, switch to Proposal once (don't re-render it after, so
        // the rep's edits/selections aren't wiped by Upwork's DOM churn).
        if (isApplyPage()) {
          if (surface === "listing" || surface === "job") { surface = "proposal"; render(); }
          return;
        }
        const openId = openJobNumericId();
        if (openId && openId !== rfxLastOpenId) {
          rfxLastOpenId = openId;
          if (surface === "listing") surface = "job";
        } else if (!openId) {
          rfxLastOpenId = "";
        }
        if (surface === "listing" || surface === "job") render();
      }, 250);
    });
    rfxMirrorObserver.observe(document.body, { childList: true, subtree: true });
  }
  function stopMirror() {
    if (rfxMirrorObserver) { rfxMirrorObserver.disconnect(); rfxMirrorObserver = null; }
    if (rfxMirrorTimer) { clearTimeout(rfxMirrorTimer); rfxMirrorTimer = null; }
  }

  // The apply page opens in its own browser tab — auto-open the panel straight to
  // the Proposal tab there, so the rep lands on exactly what they need.
  if (isApplyPage()) openPanel();

})();
