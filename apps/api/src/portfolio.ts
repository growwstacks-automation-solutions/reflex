// Portfolio index injected into the prompt's CACHED block. It is now sourced from the
// `portfolios` table (Neon) at generation time — the hardcoded list below is the FALLBACK,
// used only until the DB load succeeds (or if the table is empty/unreachable), so generation
// never breaks. The public export `PORTFOLIO_INDEX` is unchanged in shape — a newline-joined
// string in the exact format `N. Title — Tools — page P, position Q` — so every consumer
// (prompt.ts, etc.) keeps working with no change; only the *source* moved to the DB.
//
// `export let` (not const) so loadPortfolioIndex() can repopulate it. ESM exports are LIVE
// BINDINGS, so importers always read the current value — no consumer code needs to change.
import { neon } from "@neondatabase/serverless";

const DEFAULT_PORTFOLIO_INDEX = [
  "1. AI Gift Recommendation Engine — Claude + FastAPI + Prompt Engineering — page 1, position 1",
  "2. Medical-Legal Document Automation with the Anthropic API — Claude + n8n + Airtable — page 1, position 2",
  "3. CRM + PM Platform That Self-Supervises via Claude SDK — Claude + Supabase + React — page 1, position 3",
  "4. Work Witness — Full SaaS Built AI-Native with Claude Code — Claude Code + Full-Stack Development + AI Implementation — page 1, position 4",
  "5. Automated Executive Reporting with Claude Cowork and Monday.com — Claude Cowork + Monday.com MCP + Business Reporting — page 1, position 5",
  "6. RAG (Claude): Three-Agent Public-Sector Bidding Engine — Claude + RAG + Supabase pgvector + Python — page 1, position 6",
  "7. Claude Code: AI Recruitment Operating System Built End-to-End — Claude Code + React + FastAPI + Supabase — page 1, position 7",
  "8. 24/7 AI-Powered Real Estate Lead Qualification & Management System — VAPI.ai + Make.com + Twilio — page 1, position 8",
  "9. AI Voice Automated Professional Appointment Reminder System — n8n + Google Calendar + VAPI — page 1, position 9",
  "10. AI-Powered Chat-to-Calendar Appointment Booking Automation — ChatGPT + Google Calendar + Scheduling — page 1, position 10",
  "11. AI Executive Assistant for Email & Calendar Management — Relevance AI + Make.com + Slack + Gmail — page 2, position 1",
  "12. Smart & Dynamic AI WhatsApp Chatbot - Sales + Customer Support — ChatGPT + WhatsApp Business API + Make.com — page 2, position 2",
  "13. AI-Powered Customer Communication & Data Management System — OpenAI + Gmail + Google Sheets + Google Docs — page 2, position 3",
  "14. Quickbooks - Financial Dashboard & Reporting - Looker Studio, Power BI — QuickBooks Online + Looker Studio + Power BI — page 2, position 4",
  "15. AI-Powered Passport Data Extraction Document Processing Solution — Google Cloud Vision OCR + ChatGPT + Make.com — page 2, position 5",
  "16. Personalized COLD E-Mail Automation = Target + Prospect + Custom Mail — LinkedIn Sales Navigator + ChatGPT + Make.com — page 2, position 6",
  "17. Google Maps Lead Generator Via Apify Web Scraping Automation — Apify + n8n + Google Sheets — page 2, position 7",
  "18. Automated Newsletter Production Pipeline — Multi-agent AI + n8n + Google Docs — page 2, position 8",
  "19. Multi-Platform Social Media Automation with Google Sheets Management — Make.com + Instagram + Facebook + LinkedIn — page 2, position 9",
  "20. Intelligent Email Trading Signal Processor with Alpaca Integration — Gmail + Alpaca API + Make.com — page 2, position 10",
  "21. AI-Powered HR Recruitment Automation with Voice Assistant Integration — n8n + VAPI + ChatGPT + Google Sheets — page 3, position 1",
  "22. AI-Powered Trading Blog Content Generator with SEO Optimization — n8n + ChatGPT + SEO — page 3, position 2",
  "23. AI-Powered RSS Feed-to-Email Campaign Generator — RSS + OpenAI + Notion + Gmail — page 3, position 3",
  "24. AI-Powered SEO Content Generator with Google Sheets Integration — n8n + ChatGPT + Google Sheets — page 3, position 4",
  "25. AI-Powered Video Creation Automation via Telegram Integration — Telegram + n8n + AI image/audio generation — page 3, position 5",
  "26. AI-Powered Product Research Automation with Amazon Data Integration — Make.com + Amazon data scraping + OpenAI — page 3, position 6",
  "27. AI-Powered Email Management System for Outlook and Slack Integration — Make.com + Outlook + Slack + OpenAI — page 3, position 7",
  "28. End-to-End Receipt Processing Automation with Make.com Integration — Make.com + QuickBooks + Xero + FreshBooks — page 3, position 8",
  "29. Real-Time Project Management Sync Google Sheets & ClickUp Workflow — Google Sheets + ClickUp + Make.com — page 3, position 9",
  "30. n8n + RSS Feed Associated LinkedIn Job Search Strategy Automation — n8n + RSS + OpenAI + LinkedIn — page 3, position 10",
  "31. Automated Customer Sentiment Tracking via Gmail & monday.com — Gmail + ChatGPT + Monday.com + NLP — page 4, position 1",
  "32. AI-Powered Telegram Trading Bot Technical Chart Analysis Automation — Telegram + ChatGPT + market data analysis — page 4, position 2",
  "33. AI-Powered WhatsApp Chat Management & Analyzation with PDF.co — Unipile + ChatGPT + PDF.co + Make.com — page 4, position 3",
  "34. n8n + Google Drive Automated Content Management System — n8n + Google Drive API + AI agents — page 4, position 4",
  "35. Restaurant Orders Automated Through AI Voice Assistant Ordering — VAPI + Twilio + Make.com — page 4, position 5",
  "36. AI Voice-Powered Multi-Platform Content Marketing Automation — Telegram + OpenAI + image generation — page 4, position 6",
  "37. Telegram-to-Outlook Automation Email & Calendar Management System — n8n + Microsoft Outlook + Telegram — page 4, position 7",
  "38. Google Credentials Integration via n8n Workflow Automation — n8n + Google Drive + Gmail + Sheets OAuth2 — page 4, position 8",
  "39. AI-Powered Cold Email Data Generator — n8n + dual OpenAI models + Google Sheets — page 4, position 9",
  "40. Advanced n8n Recruitment Process Automation — n8n + Gmail + Google Sheets + OpenAI — page 4, position 10",
  "41. Telegram & Google Calendar Integrated Automation System — Telegram + Google Calendar + n8n — page 5, position 1",
  "42. RSS Feed Automation for Content Writing and Email Notifications — n8n + RSS + Notion + Gmail — page 5, position 2",
  "43. n8n SEO-Optimized Content Creation and Management System — n8n + SEO + Google Drive — page 5, position 3",
  "44. AI-Powered Email Classification & Management with n8n — n8n + Microsoft Outlook + Airtable + ChatGPT — page 5, position 4",
  "45. ManyChat + ChatGPT + Slack + Make.com Integration | Automated Chatbot — ManyChat + ChatGPT + Slack + Make.com — page 5, position 5",
  "46. Generate Questions and Answers from your Notes | Make.com Automation — Make.com + Google Drive — page 5, position 6",
  "47. Automated Social Media: Content Creation and Scheduling with Make.com — Make.com + Social Media Management + API Integration + Content Creation — page 5, position 7",
  "48. ManyChat Automation: PayPal / Venmo Payout via Chat — ManyChat + PayPal + Venmo — page 5, position 8",
  "49. Elevate Your SMS Campaigns: Twilio SMS Automation on Make.com — Twilio + Make.com + Google Apps Script — page 5, position 9",
  "50. Attendance Management Automation: System for Precision on Make.com — E-time office + Make.com + WhatsApp — page 5, position 10",
  "51. Google Reviews Reply Automation: Make.com Automation — Make.com + ChatGPT + WhatsApp — page 6, position 1",
  "52. Instagram Data Scraping Automation with Make.com — Make.com + Google Sheets + Instagram scraping — page 6, position 2",
  "53. Speech-to-Speech Telegram AI Bot: ChatGPT + Eleven Labs | Python Bot — Telegram + ChatGPT + Whisper + Eleven Labs + Python — page 6, position 3",
  "54. Seamless Integration of Survey Monkey and Make.com | Survey Automation — SurveyMonkey + Make.com + Google Sheets — page 6, position 4",
  "55. Quickbooks - Automated InterCompany Invoice Creation — QuickBooks Online + Make.com — page 6, position 5",
  "56. Automated Migration from Google Drive to Frame.io | Python | S3 Bucket — Python + Google Drive + Frame.io + S3 — page 6, position 6",
  "57. Job Scraping Automation using APIFY + Airtable + Make.com | API | AI — Apify + Airtable + Make.com — page 6, position 7",
  "58. Automated Messages with Google Sheet, AppScript, & Twilio on Make.com — Google Apps Script + Twilio + Make.com — page 6, position 8",
  "59. E-Commerce Order Fulfillment Automation: A Case Study — Make.com + CRM Automation + Ecommerce — page 6, position 9",
  "60. Task Management Automation using Google Apps Script and Make.com — Google Apps Script + Make.com + WhatsApp API — page 6, position 10",
  "61. Quickbooks - InterCompany Product Sync Automation — QuickBooks Online + multi-channel sync (Amazon/Shopify/Walmart) — page 7, position 1",
  "62. ManyChat Workflow Expert - Make.com, ChatGPT and Klaviyo Integration — ManyChat + Klaviyo + ChatGPT + Make.com — page 7, position 2",
  "63. Image-To-Text Automation | OCR Automation | Make.com Automation | API — Google Cloud Vision + Make.com + Google Sheets — page 7, position 3",
  "64. Google Apps Script - Auto-populate your Formulas in New Rows on Sheets — Google Apps Script + Google Sheets — page 7, position 4",
  "65. Custom App Creation for Abaninja and Zapfloor: Make.com Automation — Make.com + custom app integration — page 7, position 5",
  "66. Automated SEO-Friendly Articles | Make.com Automation | WordPress + AI — ChatGPT + Make.com + WordPress + Google Sheets — page 7, position 6",
  "67. Automating Email Communication: ChatGPT Email Automation on Make.com — Gmail + ChatGPT + Make.com — page 7, position 7",
  "68. Quickbooks - Chart of Account Setup (Advanced Level) — QuickBooks Online + Financial Reporting + Accounting — page 7, position 8",
  "69. Order Management Make.com Automation: SOS & Pacejet Integration — SOS OMS + Pacejet + Make.com — page 7, position 9",
  "70. Quickbooks Automaton on Make.com | QBO Make.com Automation — QuickBooks Online + Make.com + API Integration — page 7, position 10",
  "71. Weekly KPI & Performance Tracking Automation — Make.com + Google Sheets dashboards — page 8, position 1",
  "72. Automating Sample Testing Funnel: From Lead Capturing to Feedback — GetResponse + SlickText + SignNow + Make.com — page 8, position 2",
  "73. Personalized Nutrition Plan Automation - plans your client's Nutrition — Make.com + Zapier + Jotform + Google Docs — page 8, position 3",
  "74. Website Screenshot Management with Seamless Automation - URLBOX.IO — URLBOX.IO + Google Sheets — page 8, position 4",
].join("\n");

/** The live index consumed by the prompt. Starts as the fallback; loadPortfolioIndex() replaces it. */
export let PORTFOLIO_INDEX = DEFAULT_PORTFOLIO_INDEX;

/** One row of the `portfolios` table (source of truth for the index). */
export interface PortfolioRow {
  portfolio_title: string;
  tools_used: string;
  page_number: number;
  position: number;
}

/**
 * Render DB rows into the existing index string format — one line per item,
 * `N. Title — Tools — page P, position Q`. `N` is the 1-based order (rows arrive
 * sorted by page_number, position), reproducing the original hardcoded numbering exactly.
 */
export function formatPortfolioIndex(rows: PortfolioRow[]): string {
  return rows
    .map(
      (r, i) =>
        `${i + 1}. ${r.portfolio_title} — ${r.tools_used} — page ${Number(r.page_number)}, position ${Number(r.position)}`,
    )
    .join("\n");
}

/**
 * Load every portfolio from Neon (ordered page_number ASC, position ASC) and rebuild the
 * in-memory PORTFOLIO_INDEX. Falls back to the hardcoded default when the table is empty, so
 * the prompt is never blank. Throws on a DB error — callers wrap this and keep the last value.
 */
export async function loadPortfolioIndex(databaseUrl: string): Promise<string> {
  const sql = neon(databaseUrl);
  const rows = (await sql`
    select portfolio_title, tools_used, page_number, position
    from portfolios
    order by page_number, position
  `) as PortfolioRow[];
  PORTFOLIO_INDEX = rows.length > 0 ? formatPortfolioIndex(rows) : DEFAULT_PORTFOLIO_INDEX;
  return PORTFOLIO_INDEX;
}