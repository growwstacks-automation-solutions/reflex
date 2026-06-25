// Reflex — background service worker (MV3)
// Holds the API base + the signed-in rep's JWT (chrome.storage.local), and proxies API
// calls so the popup / content script never touch credentials or cross-origin fetch directly.

// Local dev: the Worker from `cd apps/api && npm run dev` (wrangler) serves here.
// TODO(backend): swap for the deployed Worker URL in production.
const API_BASE = "http://localhost:8787";

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
    case "ADD_JOB":
      addJob(msg.payload || {})
        .then((data) => sendResponse(data))
        .catch((e) => sendResponse({ error: errMsg(e) }));
      return true;
    // TODO(backend): SUGGEST_REPLY.
    default:
      return false;
  }
});

function errMsg(e) {
  return String(e && e.message ? e.message : e);
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
