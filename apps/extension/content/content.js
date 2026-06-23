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

  // MOCK: saved assets (in production these come from the rep's R2 library).
  const MOCK_ASSETS = [
    { label: "GHL pipeline", bg: "#3C3489" },
    { label: "Nurture flow", bg: "#0F6E56" },
    { label: "Dashboard",    bg: "#0C447C" },
    { label: "Call booking", bg: "#854F0B" },
    { label: "Results",      bg: "#A32D2D" },
    { label: "Before/after", bg: "#993C1D" }
  ];

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
  let surface = "messages"; // open on the hero surface first
  let selectedAssets = new Set([0, 1]);
  let draftIndex = 0;
  let activeTone = "base";

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
        <div class="rfx-user">not connected · sign in to sync</div>
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
    <div class="rfx-footer"><span class="rfx-sync-dot"></span> not connected — UI preview</div>
  `;
  document.body.appendChild(root);

  root.querySelector(".rfx-x").addEventListener("click", closePanel);
  root.querySelectorAll(".rfx-tab").forEach(tab => {
    tab.addEventListener("click", () => { surface = tab.dataset.s; render(); });
  });

  function openPanel() { root.classList.add("rfx-open"); launcher.classList.add("rfx-hidden"); render(); }
  function closePanel() { root.classList.remove("rfx-open"); launcher.classList.remove("rfx-hidden"); }

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

  function chipsHTML(chips) {
    return `<div class="rfx-chips">` + chips.map(c =>
      `<span class="rfx-chip ${c.k}">${c.t}</span>`).join("") + `</div>`;
  }

  /* ---- Surface 1: listing preview ---- */
  function renderListing() {
    const rows = [
      { title: "Build a GHL automation for lead nurture", state: "rel", badge: `<span class="rfx-tile-badge rel">In ${SYSTEM_NAME} ✓</span>` },
      { title: "AI voice agent for inbound appointment booking", state: "rev", badge: `<span class="rfx-tile-badge inf">Assigned · Sarthak</span>` },
      { title: "n8n workflow to sync HubSpot and Slack", state: "new", badge: `<button class="rfx-tile-add" data-add="1">Add to ${SYSTEM_NAME}</button>` }
    ];
    return `
      <div class="rfx-context-note">This is how badges appear next to each job on Upwork search results. On a live Upwork results page, ${SYSTEM_NAME} injects these onto the real rows automatically.</div>
      ${rows.map(r => `
        <div class="rfx-card">
          <div class="rfx-title">${r.title}</div>
          ${r.badge}
          <div class="rfx-meta rfx-mt">$1k–3k · posted 24m ago</div>
        </div>`).join("")}
    `;
  }

  /* ---- Surface 2: job detail ---- */
  function renderJob() {
    const j = MOCK_JOB;
    const real = readJobDetail();                 // Anchor 2 — read the live job-detail region
    const title = real && real.title ? real.title : j.title;
    const note = real && real.title
      ? `<div class="rfx-context-note" style="color:var(--rfx-green-t)">● Read from this Upwork page — verdict &amp; chips below are still mock (no backend yet).</div>`
      : `<div class="rfx-context-note">${SYSTEM_NAME}'s read on the job you're viewing.</div>`;
    return `
      ${note}
      <div class="rfx-card">
        <div class="rfx-between">
          <div class="rfx-title" style="margin:0">${esc(title)}</div>
        </div>
        <div class="rfx-mt"><span class="rfx-badge ${j.verdict}">${j.verdictLabel}</span></div>
        <div class="rfx-meta rfx-mt">${j.reason}</div>
        <div class="rfx-divider"></div>
        ${chipsHTML(j.chips)}
        <div class="rfx-meta rfx-mt">${j.budget} · ${j.connects} connects · posted ${j.posted}</div>
        <div class="rfx-meta">Assigned to you · <b style="color:var(--rfx-amber-t)">not yet actioned</b></div>
        <button class="rfx-btn primary full rfx-mt" data-go="proposal"><span class="rfx-spark">✦</span> Generate proposal</button>
      </div>
    `;
  }

  /* ---- Surface 3: proposal fill ---- */
  function renderProposal() {
    const real = readJobDetail();                 // Anchor 2 — reflect the job on this page
    const jobHead = real && real.title
      ? `<div class="rfx-card" style="margin-bottom:10px"><div class="rfx-meta" style="color:var(--rfx-green-t);margin-bottom:4px">● This job — read from the page</div><div class="rfx-title" style="margin:0;font-size:13.5px">${esc(real.title)}</div></div>`
      : "";
    return `
      ${jobHead}
      <div class="rfx-context-note">Fill the proposal — then review and click <b>Submit</b> on Upwork yourself. ${SYSTEM_NAME} never submits for you.</div>

      <div class="rfx-section-label">Cover letter</div>
      <textarea class="rfx-edit" id="rfx-cover">${MOCK_DRAFTS[draftIndex]}</textarea>
      <div class="rfx-between rfx-mt">
        <span class="rfx-cost">₹ 0.41 · ~620 tokens</span>
        <button class="rfx-btn ghost sm" data-regen-cover>↻ Regenerate</button>
      </div>
      <button class="rfx-btn primary full rfx-mt" data-insert="cover">Insert into cover letter box</button>

      <div class="rfx-divider"></div>
      <div class="rfx-section-label">Attach work samples</div>
      <div class="rfx-assets" id="rfx-assets">
        ${MOCK_ASSETS.map((a,i) => `
          <div class="rfx-asset ${selectedAssets.has(i)?'sel':''}" data-asset="${i}" style="background:${a.bg}">
            <span class="rfx-check">✓</span>${a.label}
          </div>`).join("")}
      </div>
      <div class="rfx-meta" id="rfx-asset-count">${selectedAssets.size} selected</div>
      <button class="rfx-btn ghost full sm rfx-mt" data-loom>＋ Insert a Loom video link</button>

      <div class="rfx-divider"></div>
      <div class="rfx-section-label">Screening question</div>
      <div class="rfx-card" style="margin:0">
        <div class="rfx-meta" style="color:var(--rfx-text-2)">${MOCK_QUESTION.q}</div>
        <textarea class="rfx-edit rfx-mt" id="rfx-screen" style="min-height:90px">${MOCK_QUESTION.a}</textarea>
        <div class="rfx-between rfx-mt">
          <span class="rfx-cost">₹ 0.18 · ~280 tokens</span>
          <button class="rfx-btn ghost sm" data-insert="q">Insert answer</button>
        </div>
      </div>
    `;
  }

  /* ---- Surface 4: messages (hero) ---- */
  function renderMessages() {
    const replied = activeTone !== "base" || window.__rfxReplied;
    const replyText = MOCK_REPLIES[activeTone] || MOCK_REPLIES.base;
    return `
      <div class="rfx-context-note">Reading a client thread? Get a reply in one click — ${SYSTEM_NAME} already knows the job, your proposal, and the whole conversation.</div>

      ${MOCK_THREAD.map(m => `
        <div class="rfx-msg ${m.side}">
          <div class="rfx-who">${m.who}</div>
          <div class="rfx-bubble">${m.text}</div>
        </div>`).join("")}

      <div class="rfx-row rfx-mt" style="gap:8px">
        <button class="rfx-btn primary" data-suggest><span class="rfx-spark">✦</span> Suggested reply</button>
        <button class="rfx-btn ghost" data-summary>Summarize</button>
      </div>

      <div id="rfx-reply-zone" class="rfx-mt"></div>
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
        <button class="rfx-btn primary full rfx-mt" data-insert="reply">Insert into reply box</button>
      </div>
    `;
  }

  /* ---------- wire interactions ---------- */
  function wire(body) {
    // jump between surfaces
    body.querySelectorAll("[data-go]").forEach(b =>
      b.addEventListener("click", () => { surface = b.dataset.go; render(); }));

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

    // proposal: asset select
    body.querySelectorAll("[data-asset]").forEach(el =>
      el.addEventListener("click", () => {
        const i = +el.dataset.asset;
        if (selectedAssets.has(i)) selectedAssets.delete(i); else selectedAssets.add(i);
        el.classList.toggle("sel");
        const c = body.querySelector("#rfx-asset-count");
        if (c) c.textContent = `${selectedAssets.size} selected`;
      }));

    // insert buttons -> REAL fill into the matching Upwork field (anchors)
    body.querySelectorAll("[data-insert]").forEach(b =>
      b.addEventListener("click", () => handleInsert(b, body)));

    body.querySelectorAll("[data-loom]").forEach(b =>
      b.addEventListener("click", () => flash(b, "Loom link inserted ✓")));

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

  /* Route an "Insert" button to the real Upwork field for its surface. */
  function handleInsert(btn, scope) {
    const kind = btn.dataset.insert;
    if (kind === "cover") {
      const ta = scope.querySelector("#rfx-cover");
      const ok = fillCoverLetter(ta ? ta.value : "");
      return flash(btn, ok ? "Inserted into Upwork ✓" : "Cover letter box not found on this page");
    }
    if (kind === "q") {
      const ta = scope.querySelector("#rfx-screen");
      const ans = ta ? ta.value : "";
      const { total, filled } = fillScreeningAnswers(() => ans);
      return flash(btn, total === 0
        ? "No screening questions on this page"
        : `Filled ${filled}/${total} answer${total > 1 ? "s" : ""} ✓`);
    }
    if (kind === "reply") {
      const ta = scope.querySelector("#rfx-reply");
      const ok = fillMessageComposer(ta ? ta.value : "");
      return flash(btn, ok ? "Inserted into Upwork ✓" : "Message box not found on this page");
    }
    return flash(btn, "Inserted ✓");
  }

  /* Best-effort: load the Reflex webfonts on the host page (falls back to a
     clean system stack if Upwork's CSP blocks the request — never "sluggish"). */
  function injectFonts() {
    if (document.getElementById("rfx-fonts")) return;
    const link = document.createElement("link");
    link.id = "rfx-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";
    (document.head || document.documentElement).appendChild(link);
  }

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

  const DUMMY = {
    profileMode: "freelancer", // "freelancer" (first radio) | "agency" (second) — one-line switch
    hourlyRate: "30",
    rateIncrease: "Never",
    cover:
      "[SAMPLE — Reflex not connected] Hi there — I build GoHighLevel and n8n automations for exactly this: lead capture, nurture sequences, and pipeline automation wired together so nothing slips. I've shipped 40+ similar builds and can show a live example on a quick call. — Neha (GrowwStacks)",
    answer: (q) =>
      `[SAMPLE — Reflex not connected] ${q ? "Re: " + q.slice(0, 60) + " — " : ""}Yes, we've delivered this many times and can walk you through a live build. (The AI-written answer replaces this once the backend is connected.)`,
    images: [
      { name: "ghl-pipeline.png", url: "https://ik.imagekit.io/reflexdemo/ghl-pipeline.png" },
      { name: "n8n-flow.png", url: "https://ik.imagekit.io/reflexdemo/n8n-flow.png" },
    ],
    portfolio: [
      { title: "AI Gift Recommendation Engine", where: "Portfolio tab, page 1, 1st item" },
      { title: "Advanced n8n Recruitment Automation", where: "Portfolio tab, page 4, 2nd item" },
      { title: "GHL Voice Receptionist Setup", where: "Portfolio tab, page 2, 3rd item" },
    ],
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
     lighter, taxonomy + owner quiet, terracotta Generate the one warm accent. */
  function stripInner(data) {
    const mark = `<span class="rfx-tag-mark"></span>`;

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
      const data = getJobData(jobId);
      const strip = document.createElement("div");
      strip.className = "rfx-tag" + (data.connected && data.verdict === "irr" ? " rfx-dim" : "");
      strip.dataset.rfxJobId = jobId;
      strip.innerHTML = stripInner(data);
      wireStrip(strip, jobId);
      tile.prepend(strip);
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

  function rfxScan() {
    injectTileTag();
    injectProposalMega();
  }

  // Debounced, idempotent re-injection so the strip survives Upwork's SPA swaps —
  // pagination, infinite scroll, and query changes all replace the JobTile rows,
  // and a trailing debounce re-runs the pass after the DOM settles (the page-2 bug).
  let rfxScanTimer = null;
  function scheduleScan() {
    if (rfxScanTimer) clearTimeout(rfxScanTimer);
    rfxScanTimer = setTimeout(() => { rfxScanTimer = null; rfxScan(); }, 200);
  }

  injectFonts();
  rfxScan();
  const rfxObserver = new MutationObserver(scheduleScan);
  rfxObserver.observe(document.body, { childList: true, subtree: true });

})();
