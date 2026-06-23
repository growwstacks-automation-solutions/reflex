// Sample portfolio index for development. Replace with the real 74-item index when wired
// (sourced from the ImageKit/portfolio DB and/or a one-time human-paced walk of the Upwork
// "profile highlights" popup to record page/position) — see docs/reflex-ai-generation-spec.md.
//
// One line per item: `N. Title — skills / one-line — page P, position Q`.
// This is injected into the CACHED block, so it must stay byte-stable across requests for
// prompt caching to pay off. (Until it grows past ~4096 tokens it won't actually cache on
// Haiku 4.5 — that's expected; the cost math still works, there's just no cache discount yet.)
export const PORTFOLIO_INDEX = [
  "1. AI Gift Recommendation Engine — Claude-powered matching API (Node) — page 1, position 1",
  "2. Advanced n8n Recruitment Process Automation — n8n + Gmail + Sheets pipeline — page 4, position 2",
  "3. Real-time Support Chatbot on Claude — streaming + RAG over docs — page 2, position 1",
  "4. Shopify Product Sync Pipeline — scraping + ETL + webhooks — page 3, position 2",
  "5. Slack ↔ Notion Ops Automation — Make + Slack + Notion API — page 5, position 1",
  "6. CRM Auto-fill Chrome Extension — MV3, DOM, content scripts — page 6, position 2",
].join("\n");
