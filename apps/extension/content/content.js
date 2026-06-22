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
        <div class="rfx-user">logged in as Neha · <b>Active</b></div>
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
    <div class="rfx-footer"><span class="rfx-sync-dot"></span> synced 2 min ago</div>
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
    return `
      <div class="rfx-context-note">${SYSTEM_NAME}'s read on the job you're viewing.</div>
      <div class="rfx-card">
        <div class="rfx-between">
          <div class="rfx-title" style="margin:0">${j.title}</div>
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
    return `
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
        <textarea class="rfx-edit rfx-mt" style="min-height:90px">${MOCK_QUESTION.a}</textarea>
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

    // generic insert buttons -> demo confirmation
    body.querySelectorAll("[data-insert]").forEach(b =>
      b.addEventListener("click", () => flash(b, "Inserted ✓")));

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
      b.addEventListener("click", () => flash(b, "Inserted into Upwork ✓")));
  }

  function flash(btn, msg) {
    const old = btn.innerHTML;
    btn.innerHTML = msg;
    btn.disabled = true;
    setTimeout(() => { btn.innerHTML = old; btn.disabled = false; }, 1300);
    // TODO(claude-code): replace with real DOM fill into the Upwork field, e.g.
    //   document.querySelector("textarea[aria-label='Cover letter']").value = text;
    //   and dispatch an 'input' event so Upwork's React picks it up.
  }

  /* ---------- best-effort live badge injection on Upwork job tiles ----------
     Upwork's DOM changes over time, so this tries a few selectors and fails
     silently. The panel's "Listing" surface always shows the badge component
     regardless, so the demo never depends on this succeeding.
     TODO(claude-code): finalize the selector against the real page (screenshots),
     batch the visible job IDs to the backend, and render true status per job. */
  function injectTileBadges() {
    const selectors = [
      "[data-test='JobTile']",
      "article[data-test='job-tile']",
      "section[data-ev-label='search_results_impression']",
      "div[data-test='job-tile-list'] > *"
    ];
    let tiles = [];
    for (const s of selectors) {
      tiles = document.querySelectorAll(s);
      if (tiles.length) break;
    }
    tiles.forEach((tile, i) => {
      if (tile.querySelector(".rfx-tile-badge, .rfx-tile-add")) return;
      const states = [
        `<span class="rfx-tile-badge rel">In ${SYSTEM_NAME} ✓</span>`,
        `<span class="rfx-tile-badge inf">Assigned · Sarthak</span>`,
        `<button class="rfx-tile-add">Add to ${SYSTEM_NAME}</button>`
      ];
      const el = document.createElement("span");
      el.innerHTML = states[i % states.length]; // MOCK: rotate states for the demo
      const node = el.firstElementChild;
      if (node && node.classList.contains("rfx-tile-add")) {
        node.addEventListener("click", (e) => {
          e.preventDefault(); e.stopPropagation();
          node.outerHTML = `<span class="rfx-tile-badge rel">In ${SYSTEM_NAME} ✓</span>`;
        });
      }
      tile.appendChild(node);
    });
  }
  // run now and on Upwork's dynamic updates
  injectTileBadges();
  const mo = new MutationObserver(() => injectTileBadges());
  mo.observe(document.body, { childList: true, subtree: true });

})();
