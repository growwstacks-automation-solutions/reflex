// Reflex — background service worker (MV3)
// Holds the API base + (later) the JWT, and proxies API calls so the content
// script never touches credentials or cross-origin fetch directly.

// Local dev: the Worker from `cd apps/api && npm run dev` (wrangler) serves here.
// TODO(backend): swap for the deployed Worker URL in production.
const API_BASE = "http://localhost:8787";

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Reflex] installed — API base:", API_BASE);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "CHECK_JOBS") {
    checkJobs(msg.jobIds || [])
      .then((statuses) => sendResponse({ statuses }))
      .catch((e) => sendResponse({ error: String(e && e.message ? e.message : e) }));
    return true; // keep the message channel open for the async response
  }
  if (msg && msg.type === "GENERATE_PROPOSAL") {
    generateProposal(msg.payload || {})
      .then((result) => sendResponse({ result }))
      .catch((e) => sendResponse({ error: String(e && e.message ? e.message : e) }));
    return true;
  }
  // TODO(backend): ADD_JOB, SUGGEST_REPLY (attach the JWT here).
  return false;
});

// POST the job + screening questions to the Worker; returns the generated proposal.
async function generateProposal(payload) {
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data && data.error ? data.error : `GENERATE ${res.status}`);
  return data;
}

// POST the visible job ids to the Worker; returns { [jobId]: status }.
async function checkJobs(jobIds) {
  if (!Array.isArray(jobIds) || !jobIds.length) return {};
  const res = await fetch(`${API_BASE}/jobs/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobIds }),
  });
  if (!res.ok) throw new Error(`CHECK_JOBS ${res.status}`);
  const data = await res.json();
  return data.statuses || {};
}
