// Reflex — background service worker (MV3)
// This is intentionally minimal in the scaffold. The demo runs entirely in the
// content script with mock data. In production, Claude Code will use this worker
// to hold the auth token, refresh it, and proxy API calls so the content script
// never touches credentials directly.

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Reflex] installed — UI demo scaffold (mocked, no backend).");
});

// TODO(claude-code): handle messages from content script, e.g.
//   - { type: "GENERATE_PROPOSAL", jobId }  -> call backend, return draft + token cost
//   - { type: "SUGGEST_REPLY", jobId, thread } -> call backend, return reply + token cost
//   - { type: "ADD_JOB", jobData } -> POST to backend, return saved job
//   - { type: "CHECK_JOBS", jobIds } -> return which ids already exist + owner
// Keep the JWT here in chrome.storage and attach it to every request.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Scaffold: no real handling yet.
  return false;
});
