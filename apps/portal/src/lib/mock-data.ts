/**
 * Reflex portal — coherent demo data.
 *
 * Ported from the prototype `ui_kits/portal-v3/data.js` (a `window.RX_DATA` IIFE)
 * into a typed ES module. This is the data seam: swap these locals for real API
 * calls later, but keep the exported shapes identical to `RootData`.
 */
import type {
  Assets,
  Contacts,
  Conversation,
  ImportantAction,
  Job,
  Kpi,
  Proposal,
  Reporting,
  RootData,
  User,
} from "./types";

const C: Contacts = {
  neha: { name: "Neha Kulkarni", first: "Neha", bg: "#FAEEDA", fg: "#854F0B" },
  sarthak: { name: "Sarthak Rao", first: "Sarthak", bg: "#E6F1FB", fg: "#0C447C" },
  sachin: { name: "Sachin Menon", first: "Sachin", bg: "#E1F5EE", fg: "#0F6E56" },
  manish: { name: "Manish Gupta", first: "Manish", bg: "#EEEDFE", fg: "#3C3489" },
};

const jobs: Job[] = [
  {
    id: "j1",
    title: "Build an n8n workflow to sync Upwork leads into Airtable + Slack alerts",
    relevance: "relevant",
    quality: "good",
    reason: "Strong fit — automation + n8n + CRM sync, exactly our wheelhouse.",
    chips: [
      { level: "tool", label: "n8n" },
      { level: "usecase", label: "Lead gen" },
      { level: "dept", label: "Sales" },
      { level: "industry", label: "SaaS" },
    ],
    ownership: "mine",
    actionState: "not-actioned",
    budget: "$1.5k",
    connects: 12,
    postedAgo: "2h ago",
    createdAgo: "2h ago",
    cat: "AI agents",
    desc: "We get 30–40 Upwork leads a week and track them in a messy spreadsheet. Looking for someone to build an n8n workflow that captures each new lead, writes it to Airtable with the right fields, and posts a Slack alert to our #sales channel. Bonus if you can dedupe by email. We are non-technical so clear handover matters.",
    classification: { tool: "n8n", usecase: "Lead generation", dept: "Sales", industry: "SaaS" },
    client: { spend: "$42k", hireRate: "88%", location: "United States", payment: "Verified" },
  },
  {
    id: "j2",
    title: "Automate weekly sales reporting dashboard from HubSpot + Stripe",
    relevance: "review",
    quality: "medium",
    reason: "Likely fit, but reporting scope is broad — confirm tools before pitching.",
    chips: [
      { level: "tool", label: "Make.com" },
      { level: "usecase", label: "Reporting" },
      { level: "dept", label: "Ops" },
      { level: "industry", label: "Fintech", isNew: true },
    ],
    ownership: "available",
    actionState: "not-actioned",
    budget: "$800",
    connects: 8,
    postedAgo: "5h ago",
    createdAgo: "5h ago",
    cat: "Cloud",
    desc: "Need a weekly automated dashboard pulling from HubSpot and Stripe into a single view the leadership team can read every Monday. Should refresh on its own and flag anything off-trend.",
    classification: { tool: "Make.com", usecase: "Reporting", dept: "Operations", industry: "Fintech" },
    client: { spend: "$8.1k", hireRate: "71%", location: "United Kingdom", payment: "Verified" },
  },
  {
    id: "j3",
    title: "GHL setup: pipelines, calendars, and a voice AI receptionist",
    relevance: "relevant",
    quality: "good",
    reason: "GHL + voice AI — high-value combo we deliver well.",
    chips: [
      { level: "tool", label: "GHL" },
      { level: "usecase", label: "Voice AI" },
      { level: "dept", label: "Sales" },
      { level: "industry", label: "Real estate" },
    ],
    ownership: "available",
    actionState: "not-actioned",
    released: true,
    releasedFrom: "sarthak",
    budget: "$2.4k",
    connects: 16,
    postedAgo: "3h ago",
    createdAgo: "3h ago",
    cat: "GHL",
    desc: "Set up GoHighLevel from scratch for a 4-agent real estate team, including a voice AI receptionist to qualify inbound calls and book viewings straight into the GHL calendar.",
    classification: { tool: "GoHighLevel", usecase: "Voice AI", dept: "Sales", industry: "Real estate" },
    client: { spend: "$120k", hireRate: "94%", location: "Canada", payment: "Verified" },
  },
  {
    id: "j4",
    title: "AI agent to triage customer support tickets in Zendesk",
    relevance: "relevant",
    quality: "good",
    reason: "AI agent + support automation — clean fit.",
    chips: [
      { level: "tool", label: "OpenAI" },
      { level: "usecase", label: "Support triage" },
      { level: "dept", label: "Support" },
      { level: "industry", label: "E-commerce" },
    ],
    ownership: "mine",
    actionState: "submitted",
    budget: "$1.8k",
    connects: 14,
    postedAgo: "6h ago",
    createdAgo: "6h ago",
    cat: "AI agents",
    desc: "Build an AI agent that reads incoming Zendesk tickets, categorizes them, drafts a reply, and routes anything sensitive to a human. Volume is roughly 200 tickets a day.",
    classification: { tool: "OpenAI", usecase: "Support triage", dept: "Support", industry: "E-commerce" },
    client: { spend: "$33k", hireRate: "82%", location: "Australia", payment: "Verified" },
  },
  {
    id: "j5",
    title: "Voice AI cold-calling agent for a solar lead list",
    relevance: "review",
    quality: "medium",
    reason: "Voice AI fits, but cold-calling compliance is unclear — flag for review.",
    chips: [
      { level: "tool", label: "Vapi" },
      { level: "usecase", label: "Outbound" },
      { level: "dept", label: "Sales" },
      { level: "industry", label: "Energy", isNew: true },
    ],
    ownership: "other",
    owner: C.sachin,
    actionState: "conversation",
    budget: "$3.0k",
    connects: 18,
    postedAgo: "8h ago",
    createdAgo: "8h ago",
    cat: "Voice",
    desc: "We have a list of 5,000 solar leads and want a voice AI agent to call, qualify, and book appointments for our closers. Need it live within two weeks.",
    classification: { tool: "Vapi", usecase: "Outbound calling", dept: "Sales", industry: "Energy" },
    client: { spend: "$15k", hireRate: "64%", location: "United States", payment: "Unverified" },
  },
  {
    id: "j6",
    title: "Logo redesign and brand refresh for a coffee roastery",
    relevance: "irrelevant",
    quality: "poor",
    reason: "Design-only, no automation — outside our service line.",
    chips: [
      { level: "tool", label: "Figma" },
      { level: "usecase", label: "Branding" },
      { level: "dept", label: "Marketing" },
      { level: "industry", label: "F&B" },
    ],
    ownership: "available",
    actionState: "not-actioned",
    budget: "$200",
    connects: 4,
    postedAgo: "1d ago",
    createdAgo: "1d ago",
    cat: "Cloud",
    desc: "Looking for a designer to refresh our coffee brand identity and deliver a new logo plus packaging.",
    classification: { tool: "Figma", usecase: "Branding", dept: "Marketing", industry: "F&B" },
    client: { spend: "$1.2k", hireRate: "40%", location: "India", payment: "Unverified" },
  },
  {
    id: "j7",
    title: "Connect Calendly, Zoom, and Notion for an agency onboarding flow",
    relevance: "relevant",
    quality: "good",
    reason: "Multi-tool automation — straightforward fit.",
    chips: [
      { level: "tool", label: "Zapier" },
      { level: "usecase", label: "Onboarding" },
      { level: "dept", label: "Ops" },
      { level: "industry", label: "Agency" },
    ],
    ownership: "other",
    owner: C.neha,
    actionState: "submitted",
    budget: "$650",
    connects: 6,
    postedAgo: "1d ago",
    createdAgo: "1d ago",
    cat: "Cloud",
    desc: "When a client books via Calendly, auto-create the Zoom meeting and a Notion onboarding page, then email the client the details.",
    classification: { tool: "Zapier", usecase: "Onboarding", dept: "Operations", industry: "Agency" },
    client: { spend: "$5.4k", hireRate: "90%", location: "Germany", payment: "Verified" },
  },
];

const importantActions: ImportantAction[] = [
  { id: "ia1", tone: "wait", kind: "messages", title: "3 messages awaiting reply", detail: "David Chen, Tom Becker +1", link: { type: "conversation", id: "c1" } },
  { id: "ia2", tone: "info", kind: "assigned", title: "2 new jobs assigned to you", detail: "n8n lead sync · Zendesk triage", link: { type: "job", id: "j1" } },
  { id: "ia3", tone: "info", kind: "proposal", title: "1 proposal not yet submitted", detail: "GHL setup + voice receptionist", link: { type: "job", id: "j3" } },
  { id: "ia4", tone: "alert", kind: "released", title: "1 job released back to Available", detail: "GHL setup — was assigned to Sarthak", link: { type: "job", id: "j3" } },
];

const conversations: Conversation[] = [
  {
    id: "c1",
    client: { name: "David Chen", bg: "#E6F1FB", fg: "#0C447C" },
    job: "Build an n8n workflow to sync Upwork leads…",
    snippet: "That makes sense. Could you share a rough timeline and what you'd need from us to start?",
    status: "needs-reply",
    time: "12 min ago",
    summary: "David is sold on the approach and ready to move forward. He's asked for a timeline and a list of what you need from his side to begin. Budget ($1.5k) is agreed. Next step: send a clear start plan and required access.",
    messages: [
      { from: "client", text: "Hi! Saw your proposal — the Airtable + Slack idea is exactly what we pictured.", time: "Mon 9:02" },
      { from: "us", text: "Thanks David! Happy to walk you through it. The core flow captures each lead, writes the right fields to Airtable, and posts to your #sales channel with dedupe by email.", time: "Mon 9:40" },
      { from: "client", text: "Love it. We're non-technical so the handover doc matters a lot to us.", time: "Mon 10:15" },
      { from: "us", text: "Absolutely — you'll get a short Loom plus a one-page runbook so anyone on your team can manage it.", time: "Mon 10:22" },
      { from: "client", text: "That makes sense. Could you share a rough timeline and what you'd need from us to start?", time: "Mon 11:48" },
    ],
  },
  {
    id: "c2",
    client: { name: "Aisha Patel", bg: "#E1F5EE", fg: "#0F6E56" },
    job: "GHL setup: pipelines, calendars, voice AI…",
    snippet: "Perfect, we'll review internally and get back to you by Thursday.",
    status: "waiting",
    time: "2h ago",
    summary: "Aisha's team is reviewing the GHL + voice AI proposal internally and will respond by Thursday. No action needed from us until then. This thread was picked up after release — original owner was Sarthak.",
    messages: [
      { from: "us", text: "Hi Aisha — proposal sent. The voice AI receptionist will qualify inbound calls and book viewings straight into your GHL calendar.", time: "Tue 14:10" },
      { from: "client", text: "Looks thorough, thank you. Perfect, we'll review internally and get back to you by Thursday.", time: "Tue 16:30" },
    ],
  },
  {
    id: "c3",
    client: { name: "Tom Becker", bg: "#FAEEDA", fg: "#854F0B" },
    job: "AI agent to triage Zendesk tickets",
    snippet: "Quoted $1,800 for the full build incl. handover.",
    status: "quoted",
    time: "5h ago",
    summary: "Tom received the $1,800 quote for the full Zendesk triage agent including handover. Awaiting his confirmation to proceed.",
    messages: [
      { from: "client", text: "Can you give me a final number for the whole thing?", time: "Wed 08:00" },
      { from: "us", text: "Quoted $1,800 for the full build incl. handover.", time: "Wed 09:12" },
    ],
  },
];

const users: User[] = [
  { ...C.sachin, role: "Rep", shift: "02:00 – 10:00", active: true, lastActive: "4 min ago" },
  { ...C.sarthak, role: "Rep", shift: "10:00 – 18:00", active: true, lastActive: "now" },
  { ...C.neha, role: "Rep", shift: "18:00 – 02:00", active: true, lastActive: "1h ago" },
  { ...C.manish, role: "Admin", shift: "—", active: true, lastActive: "now" },
  { name: "Ritu Shah", first: "Ritu", bg: "#FCEBEB", fg: "#A32D2D", role: "Rep", shift: "—", active: false, lastActive: "14 days ago" },
];

const proposal: Proposal = {
  cover: "Hi there,\n\nYou're tracking 30–40 leads a week in a spreadsheet and it's getting messy — I can fix that with a clean n8n workflow.\n\nHere's the flow: every new Upwork lead is captured, written to Airtable with the right fields, deduped by email, and posted to your #sales Slack channel so nobody misses one. Because you're non-technical, I'll hand it over with a short Loom and a one-page runbook so anyone on the team can manage it.\n\nI've shipped 40+ automations like this in the past year. Happy to start this week.\n\n— Neha",
  coverCost: "₹0.41",
  screening: [
    { q: "How many similar automations have you built?", a: "We've shipped 40+ n8n and Make.com workflows in the last year, including several Upwork-lead-to-CRM syncs almost identical to this one.", cost: "₹0.18" },
    { q: "What is your estimated timeline?", a: "A working first version in 3–4 days, with a day for your review and a short handover Loom — about a week end to end.", cost: "₹0.14" },
    { q: "Are you comfortable with a non-technical handover?", a: "Completely — every build ships with a plain-language runbook and a walkthrough Loom, so your team can run and tweak it without us.", cost: "₹0.12" },
  ],
};

const assets: Assets = {
  images: [
    { id: "a1", label: "Airtable lead board", tag: "#E1F5EE" },
    { id: "a2", label: "n8n workflow canvas", tag: "#EEEDFE" },
    { id: "a3", label: "Slack alert sample", tag: "#E6F1FB" },
    { id: "a4", label: "GHL pipeline view", tag: "#FAEEDA" },
    { id: "a5", label: "Voice AI call log", tag: "#FCEBEB" },
    { id: "a6", label: "Zendesk triage demo", tag: "#E1F5EE" },
  ],
  looms: [
    { id: "l1", title: "How our Airtable + Slack sync works", url: "loom.com/share/a1f3…", len: "2:14" },
    { id: "l2", title: "GHL voice receptionist walkthrough", url: "loom.com/share/9c7b…", len: "3:41" },
  ],
};

const reporting: Reporting = {
  kpis: [
    { label: "Jobs received", value: "128", sub: "last 14 days", delta: "+18%" },
    { label: "Proposals submitted", value: "37", sub: "last 14 days", delta: "+9%" },
    { label: "Connects spent", value: "412", sub: "last 14 days", delta: "−4%" },
    { label: "Reply rate", value: "46%", sub: "last 14 days", delta: "+6%" },
  ],
  received: [6, 9, 7, 12, 10, 14, 11, 8, 13, 15, 9, 12, 16, 14],
  taxonomy: [
    { level: "tool", label: "Tool", items: [["n8n", 38], ["GHL", 24], ["Make.com", 19], ["Voice", 12]] },
    { level: "usecase", label: "Use case", items: [["Lead gen", 31], ["Reporting", 22], ["Voice AI", 18], ["Onboarding", 14]] },
    { level: "dept", label: "Department", items: [["Sales", 44], ["Ops", 28], ["Support", 16], ["Marketing", 9]] },
    { level: "industry", label: "Industry", items: [["SaaS", 35], ["Real estate", 21], ["E-com", 17], ["Fintech", 11]] },
  ],
  perRep: [
    { name: "Neha", proposals: 14, connects: 156 },
    { name: "Sarthak", proposals: 13, connects: 142 },
    { name: "Sachin", proposals: 10, connects: 114 },
  ],
  table: [
    { name: "Neha Kulkarni", jobs: 41, proposals: 14, connects: 156, reply: "52%" },
    { name: "Sarthak Rao", jobs: 38, proposals: 13, connects: 142, reply: "44%" },
    { name: "Sachin Menon", jobs: 33, proposals: 10, connects: 114, reply: "41%" },
  ],
};

const kpis: Kpi[] = [
  { label: "New today", value: "14", delta: "+3", deltaTone: "good" },
  { label: "Relevant", value: "9", sub: "worth pursuing" },
  { label: "Submitted this shift", value: "5", sub: "of 8 target" },
  { label: "Connects left", value: "142", sub: "this cycle" },
];

export const RX_DATA: RootData = {
  C,
  jobs,
  importantActions,
  conversations,
  users,
  proposal,
  assets,
  reporting,
  kpis,
};

export { C, jobs, importantActions, conversations, users, proposal, assets, reporting, kpis };
