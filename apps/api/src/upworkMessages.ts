// Upwork Messages client — the ONLY place that talks to Upwork's official Messages API.
// Isolated so the exact token/endpoint/response shape lives in one file and can be re-pointed
// without touching the sync/suggest handlers (same spirit as docs/UPWORK-ANCHORS.md for the DOM).
//
// SAFETY: this runs server-side in the Worker against the sanctioned API — never through a
// logged-in browser (docs/ARCHITECTURE.md, the two safety lines). No scraping.

export interface UpworkMessage {
  message_id: string;      // Upwork story id — the idempotency key for thread_messages
  sender: "client" | "us"; // msg_sender enum
  body: string;
  sent_at: string | null;  // ISO 8601, or null if the source has no timestamp
}

export interface RoomInfo {
  topic: string;        // room.topic — the conversation/job title (always available)
  postingId: string;    // room.vendorProposal.marketplaceJobPosting.id — matches jobs.upwork_job_id
  postingTitle: string; // marketplaceJobPosting.content.title (fallback title)
}

/**
 * Call UPWORK_TOKEN_URL and return a bearer access token.
 * Confirmed response shape: `[ { "accessToken": "oauth2v2_..." } ]` (a one-element array).
 * We tolerate the bare object / common field aliases too, so a small change upstream doesn't break us.
 */
export async function fetchUpworkToken(tokenUrl: string): Promise<string> {
  if (!tokenUrl) throw new Error("UPWORK_TOKEN_URL is not set.");
  // The token webhook is POST-only (an empty JSON body is fine). Returns { accessToken } (or an
  // array wrapping it — we tolerate both below).
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(`token endpoint returned ${res.status}`);
  const data = (await res.json().catch(() => null)) as unknown;

  // Confirmed: an array wrapping one object. Fall back to a bare object shape defensively.
  const obj = Array.isArray(data) ? data[0] : data;
  const token =
    obj && typeof obj === "object"
      ? (obj as Record<string, unknown>).accessToken ??
        (obj as Record<string, unknown>).access_token ??
        (obj as Record<string, unknown>).token
      : undefined;
  if (typeof token !== "string" || !token) {
    throw new Error("token endpoint did not return an accessToken.");
  }
  return token;
}

// ---------------------------------------------------------------------------
// Room stories (the messages of one conversation) — Upwork GraphQL API.
//   POST https://api.upwork.com/graphql   (NOT www.upwork.com — that host bot-challenges API calls)
//   query roomStories($filter: RoomStoryFilter){ roomStories(filter:{ roomId_eq }){ edges{ node{
//     ... on RoomStory { id message createdDateTime user { id name } } } } } }
// Field names + filter key (`roomId_eq`) verified live against a real room. `message` is null on
// attachment-only stories (we skip those). The API returns newest-first; we sort ascending below.
// ---------------------------------------------------------------------------

const GRAPHQL_ENDPOINT = "https://api.upwork.com/graphql";

const ROOM_STORIES_QUERY = `query roomStories($filter: RoomStoryFilter) {
  roomStories(filter: $filter) {
    totalCount
    edges {
      node {
        ... on RoomStory {
          id
          message
          createdDateTime
          user { id name }
        }
      }
    }
  }
}`;

/** ISO string from an epoch (ms or s) or an existing date string; null if unparseable. */
function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number") {
    const ms = v > 1e12 ? v : v * 1000; // seconds vs milliseconds
    return new Date(ms).toISOString();
  }
  const s = String(v);
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * Map one RoomStory node to our shape. `viewerId` (our Upwork user id, from UPWORK_VIEWER_ID)
 * decides client-vs-us: a story authored by us is "us", everything else is "client". Without a
 * viewer id we default to "client" (still fine — the suggested reply reads the whole thread).
 */
function mapStory(s: Record<string, unknown>, viewerId: string): UpworkMessage | null {
  const id = s.id;
  if (id == null) return null;
  const user = (s.user && typeof s.user === "object" ? s.user : {}) as Record<string, unknown>;
  const author = user.id;
  const sentAt = toIso(s.createdDateTime);
  const isUs = !!viewerId && author != null && String(author) === String(viewerId);
  return {
    message_id: String(id),
    sender: isUs ? "us" : "client",
    body: s.message == null ? "" : String(s.message),
    sent_at: sentAt,
  };
}

// room -> job link. `chat_url` is empty across the whole jobs table, so we don't use it. Instead we
// read the room's own vendorProposal.marketplaceJobPosting.id, which equals jobs.upwork_job_id, and
// room.topic as a display title. Both verified in scope against a live room.
const ROOM_INFO_QUERY = `query room($id: ID!) {
  room(id: $id) {
    id
    topic
    vendorProposal {
      marketplaceJobPosting {
        id
        content { title }
      }
    }
  }
}`;

/**
 * Fetch the room's topic + the job-posting id it was applied to. Degrades gracefully: if the token
 * lacks scope for the proposal/posting, `topic` alone still labels the thread (GraphQL returns the
 * partial `room` alongside any field-level errors).
 */
export async function fetchRoomInfo(token: string, roomId: string): Promise<RoomInfo> {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ query: ROOM_INFO_QUERY, variables: { id: roomId } }),
  });
  const data = (await res.json().catch(() => null)) as {
    data?: { room?: Record<string, unknown> };
  } | null;
  const room = (data?.data?.room ?? {}) as Record<string, unknown>;
  const vp = (room.vendorProposal ?? {}) as Record<string, unknown>;
  const posting = (vp.marketplaceJobPosting ?? {}) as Record<string, unknown>;
  const content = (posting.content ?? {}) as Record<string, unknown>;
  return {
    topic: typeof room.topic === "string" ? room.topic : "",
    postingId: posting.id != null ? String(posting.id) : "",
    postingTitle: typeof content.title === "string" ? content.title : "",
  };
}

/**
 * Fetch + normalize all messages in a room. Returns them oldest-first (best-effort — depends on
 * the API's order; we sort by sent_at when present).
 */
export async function fetchRoomMessages(
  token: string,
  roomId: string,
  viewerId = "",
): Promise<UpworkMessage[]> {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ query: ROOM_STORIES_QUERY, variables: { filter: { roomId_eq: roomId } } }),
  });
  if (!res.ok) throw new Error(`messages endpoint returned ${res.status}`);
  const data = (await res.json().catch(() => null)) as {
    data?: { roomStories?: { edges?: Array<{ node?: Record<string, unknown> }> } };
    errors?: unknown;
  } | null;
  if (data?.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(data.errors).slice(0, 200)}`);
  }

  const edges = data?.data?.roomStories?.edges ?? [];
  const messages = edges
    .map((e) => e?.node)
    .filter((n): n is Record<string, unknown> => !!n)
    .map((n) => mapStory(n, viewerId))
    .filter((m): m is UpworkMessage => !!m && !!m.body);

  messages.sort((a, b) => {
    if (!a.sent_at || !b.sent_at) return 0;
    return a.sent_at < b.sent_at ? -1 : a.sent_at > b.sent_at ? 1 : 0;
  });
  return messages;
}
