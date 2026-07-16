// Reflex — background service worker (MV3)
// Holds the API base + the signed-in rep's JWT (chrome.storage.local), and proxies API
// calls so the popup / content script never touch credentials or cross-origin fetch directly.

// Local dev: the Worker from `cd apps/api && npm run dev` (wrangler) serves here.
// TODO(backend): swap for the deployed Worker URL in production.
const API_BASE = "http://localhost:8787";
//const API_BASE = "https://reflex-api.manish-98d.workers.dev";

// Same keys the portal uses (localStorage there, chrome.storage.local here).
const TOKEN_KEY = "reflex_token";
const USER_KEY = "reflex_user";

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Reflex] installed — API base:", API_BASE);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return false;

  switch (msg.type) {
    case "LOGIN":
      login(msg.email, msg.password)
        .then((data) => sendResponse(data))
        .catch((e) => sendResponse({ error: errMsg(e) }));
      return true; // keep the channel open for the async response
    case "LOGOUT":
      logout().then(() => sendResponse({ ok: true }));
      return true;
    case "GET_AUTH":
      getAuth().then((auth) => sendResponse(auth));
      return true;
    case "CHECK_JOBS":
      checkJobs(msg.jobIds || [])
        .then((statuses) => sendResponse({ statuses }))
        .catch((e) => sendResponse({ error: errMsg(e) }));
      return true;
    case "GENERATE_PROPOSAL":
      generateProposal(msg.payload || {})
        .then((result) => sendResponse({ result }))
        .catch((e) => sendResponse({ error: errMsg(e) }));
      return true;
    case "EXTRACT_CLIENT_NAME":
      extractClientName(msg.payload || {})
        .then((data) => sendResponse(data))
        .catch((e) => sendResponse({ error: errMsg(e) }));
      return true;
    case "ADD_JOB":
      addJob(msg.payload || {})
        .then((data) => sendResponse(data))
        .catch((e) => sendResponse({ error: errMsg(e) }));
      return true;
    case "CLASSIFY_JOB":
      classifyJob(msg.payload || {})
        .then((result) => sendResponse({ result }))
        .catch((e) => sendResponse({ error: errMsg(e) }));
      return true;
    case "FETCH_ASSET":
      fetchAsset(msg.url)
        .then((data) => sendResponse(data))
        .catch((e) => sendResponse({ error: errMsg(e) }));
      return true;
    case "PROPOSAL_DRAFT":
      proposalDraft(msg.payload || {})
        .then((data) => sendResponse(data))
        .catch((e) => sendResponse({ error: errMsg(e) }));
      return true;
    case "SUBMIT_PROPOSAL":
      submitProposal(msg.payload || {})
        .then((data) => sendResponse(data))
        .catch((e) => sendResponse({ error: errMsg(e) }));
      return true;
    case "SYNC_MESSAGES":
      syncMessages(msg.payload || {})
        .then((data) => sendResponse(data))
        .catch((e) => sendResponse({ error: errMsg(e) }));
      return true;
    case "SUGGEST_REPLY":
      suggestReply(msg.payload || {})
        .then((data) => sendResponse(data))
        .catch((e) => sendResponse({ error: errMsg(e) }));
      return true;
    case "OPEN_TAB":
      // Open a URL in a NEW tab. Done here (not window.open in the content script) because a
      // window.open after an async gap is popup-blocked; chrome.tabs.create is not. Navigation only.
      openTab(msg.url)
        .then((data) => sendResponse(data))
        .catch((e) => sendResponse({ error: errMsg(e) }));
      return true;
    default:
      return false;
  }
});

function errMsg(e) {
  return String(e && e.message ? e.message : e);
}

// Open a URL in a new active tab. chrome.tabs.create doesn't need the "tabs" permission.
async function openTab(url) {
  if (!url) return { error: "No URL" };
  const tab = await chrome.tabs.create({ url, active: true });
  return { ok: true, tabId: tab && tab.id };
}

// --- auth ----------------------------------------------------------------

// POST credentials to the Worker's /auth/login; on success persist { token, user }.
// Returns { ok, user } on success, or { error, status } so the popup can pick the screen
// (status 403 = account disabled → "deactivated").
async function login(email, password) {
  const endpoint = `${API_BASE}/auth/login`;
  // NB: we log the email + status only — never the password or the full token.
  console.log("[Reflex auth] POST", endpoint, "email:", email);
  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch (e) {
    console.error("[Reflex auth] network error — is the Worker running on :8787?", e);
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  console.log("[Reflex auth] response", res.status, res.ok ? "OK" : (data && data.error) || "(no body)");
  if (!res.ok) {
    return { error: data && data.error ? data.error : `Login failed (${res.status})`, status: res.status };
  }
  await chrome.storage.local.set({ [TOKEN_KEY]: data.token, [USER_KEY]: data.user });
  console.log(
    "[Reflex auth] signed in as",
    data.user && data.user.email,
    "· token stored (len",
    data.token ? data.token.length : 0,
    ")"
  );
  return { ok: true, user: data.user };
}

async function logout() {
  await chrome.storage.local.remove([TOKEN_KEY, USER_KEY]);
}

async function getAuth() {
  const out = await chrome.storage.local.get([TOKEN_KEY, USER_KEY]);
  return { token: out[TOKEN_KEY] || null, user: out[USER_KEY] || null };
}

async function getToken() {
  const out = await chrome.storage.local.get(TOKEN_KEY);
  return out[TOKEN_KEY] || null;
}

// Attach the Bearer token when the rep is signed in (endpoints tolerate its absence today,
// but ownership/auth-gated reads will use it).
async function authHeaders(base) {
  const token = await getToken();
  return token ? { ...base, authorization: `Bearer ${token}` } : base;
}

// --- proxied API calls ---------------------------------------------------

// POST the job + screening questions to the Worker; returns the generated proposal.
async function generateProposal(payload) {
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: await authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data && data.error ? data.error : `GENERATE ${res.status}`);
  return data;
}

// POST the client's public review snippets to the Worker; returns { client_name } (the client's
// first name if a reviewer named them, else null) so the proposal can greet them by name. Fully
// separate from /generate — the content script calls this first, then passes client_name_hint on.
async function extractClientName(payload) {
  const res = await fetch(`${API_BASE}/jobs/client-name`, {
    method: "POST",
    headers: await authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data && data.error ? data.error : `CLIENT_NAME ${res.status}`);
  return data;
}

// POST a captured job to the Worker; it inserts + claims it for the signed-in rep.
// Returns { ok, jobId, existed, status } or throws on error.
async function addJob(payload) {
  const res = await fetch(`${API_BASE}/jobs/add`, {
    method: "POST",
    headers: await authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data && data.error ? data.error : `ADD_JOB ${res.status}`);
  return data;
}

// POST a captured job to the Worker's classifier (Claude). No DB write — returns
// { verdict, quality, reason, cost_inr, tokens, cache_status, ... } for the Add card.
async function classifyJob(payload) {
  const res = await fetch(`${API_BASE}/jobs/classify`, {
    method: "POST",
    headers: await authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data && data.error ? data.error : `CLASSIFY ${res.status}`);
  return data;
}

// Fetch a work-sample image cross-origin and return it base64-encoded. The content script
// can't fetch these directly (the page's CORS blocks drive.google.com), but the background
// can — host_permissions cover the image hosts. Used to bundle real images into the ZIP.
async function fetchAsset(url) {
  if (!url) return { error: "No URL" };
  let res;
  try {
    res = await fetch(url, { credentials: "omit" });
  } catch (e) {
    return { error: `Fetch failed (host not permitted?): ${errMsg(e)}` };
  }
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const contentType = res.headers.get("content-type") || "";
  const buf = new Uint8Array(await res.arrayBuffer());
  // arrayBuffer -> base64, chunked so a big image doesn't blow the call stack.
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, buf.subarray(i, i + CHUNK));
  }
  return { ok: true, base64: btoa(binary), contentType, bytes: buf.length };
}

// POST a job id to the Worker; returns the stored proposal draft for that job (or
// { drafted:false } if none) so the extension can RESTORE it instead of re-generating.
async function proposalDraft(payload) {
  const res = await fetch(`${API_BASE}/jobs/proposal`, {
    method: "POST",
    headers: await authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data && data.error ? data.error : `PROPOSAL_DRAFT ${res.status}`);
  return data;
}

// Record a submitted proposal (job id + proposal id/link + connects spent) after the rep confirms
// on the Upwork success page. Auth-gated on the API; idempotent server-side.
async function submitProposal(payload) {
  const res = await fetch(`${API_BASE}/jobs/submitted`, {
    method: "POST",
    headers: await authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data && data.error ? data.error : `SUBMIT_PROPOSAL ${res.status}`);
  return data;
}

// POST { room_id } to the Worker; it fetches the room's messages from Upwork's official API
// (server-side) and upserts them into thread_messages. Returns { synced, fetched, job_title,
// last_synced_at, linked }. Auth-gated.
async function syncMessages(payload) {
  const res = await fetch(`${API_BASE}/messages/sync`, {
    method: "POST",
    headers: await authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data && data.error ? data.error : `SYNC_MESSAGES ${res.status}`);
  return data;
}

// POST { room_id } to the Worker; it feeds the job + proposal + synced thread to Claude and
// returns { job_title, summary, reply, cost_inr, tokens, last_synced_at } for the rep to copy.
async function suggestReply(payload) {
  const res = await fetch(`${API_BASE}/messages/suggest`, {
    method: "POST",
    headers: await authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data && data.error ? data.error : `SUGGEST_REPLY ${res.status}`);
  return data;
}

// POST the visible job ids to the Worker; returns { [jobId]: status }.
async function checkJobs(jobIds) {
  if (!Array.isArray(jobIds) || !jobIds.length) return {};
  const res = await fetch(`${API_BASE}/jobs/check`, {
    method: "POST",
    headers: await authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ jobIds }),
  });
  if (!res.ok) throw new Error(`CHECK_JOBS ${res.status}`);
  const data = await res.json();
  return data.statuses || {};
}
