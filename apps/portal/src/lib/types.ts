/**
 * Domain types for the Reflex portal.
 *
 * This is the data seam: the mock data in `./mock-data` is typed against these
 * interfaces, and later gets swapped for real API calls returning the same shapes.
 * Keep these precise — they are the contract every screen reads against.
 */

export interface Person {
  name: string;
  first?: string;
  bg: string;
  fg: string;
}

export interface TaxonomyChipData {
  level: "tool" | "usecase" | "dept" | "industry";
  label: string;
  isNew?: boolean;
}

export interface Job {
  id: string;
  title: string;
  relevance: "relevant" | "review" | "irrelevant";
  quality: "good" | "medium" | "watch" | "poor";
  reason: string;
  chips: TaxonomyChipData[];
  ownership: "mine" | "other" | "available";
  owner?: Person;
  actionState: "not-actioned" | "submitted" | "conversation";
  released?: boolean;
  releasedFrom?: string;
  budget: string;
  connects: number;
  postedAgo: string; // relative time since the job was posted on Upwork
  createdAgo: string; // relative time since the row was created in our DB
  postedAt?: string | null; // raw ISO — for sorting (display uses postedAgo)
  createdAt?: string | null; // raw ISO — for sorting (display uses createdAgo)
  cat: string;
  desc: string;
  url?: string;
  classification: {
    tool: string;
    usecase: string;
    dept: string;
    industry: string;
  };
  client: {
    spend: string;
    hireRate: string;
    location: string;
    payment: string;
  };
}

export interface ActionLink {
  type: "conversation" | "job";
  id: string;
}

export interface ImportantAction {
  id: string;
  tone: "wait" | "info" | "alert";
  kind: "messages" | "assigned" | "proposal" | "released";
  title: string;
  detail: string;
  link: ActionLink;
}

export interface Message {
  from: "client" | "us";
  text: string;
  time: string;
}

export interface Conversation {
  id: string;
  client: Person;
  job: string;
  snippet: string;
  status: "needs-reply" | "waiting" | "quoted";
  time: string;
  summary: string;
  messages: Message[];
}

export interface User extends Person {
  role: "Rep" | "Admin";
  shift: string;
  active: boolean;
  lastActive: string;
}

export interface ScreeningItem {
  q: string;
  a: string;
  cost: string;
}

export interface Proposal {
  cover: string;
  coverCost: string;
  screening: ScreeningItem[];
}

export interface Assets {
  images: { id: string; label: string; tag: string }[];
  looms: { id: string; title: string; url: string; len: string }[];
}

export interface Reporting {
  kpis: { label: string; value: string; sub: string; delta: string }[];
  received: number[];
  taxonomy: {
    level: "tool" | "usecase" | "dept" | "industry";
    label: string;
    items: [string, number][];
  }[];
  perRep: { name: string; proposals: number; connects: number }[];
  table: {
    name: string;
    jobs: number;
    proposals: number;
    connects: number;
    reply: string;
  }[];
}

export interface Kpi {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  deltaTone?: "good";
}

export interface Contacts {
  neha: Person;
  sarthak: Person;
  sachin: Person;
  manish: Person;
}

export interface RootData {
  C: Contacts;
  jobs: Job[];
  importantActions: ImportantAction[];
  conversations: Conversation[];
  users: User[];
  proposal: Proposal;
  assets: Assets;
  reporting: Reporting;
  kpis: Kpi[];
}
