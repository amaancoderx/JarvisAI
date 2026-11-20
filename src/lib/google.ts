import { randomUUID } from "node:crypto";

/**
 * Real Google accounts, connected through Nango (the same OAuth setup the production Jarvis uses).
 * Nango keeps the OAuth tokens server-side; this app only ever holds a connection id, and only for the
 * signed-in browser's own end user id.
 */
export const GMAIL = "google-mail";
export const CALENDAR = "google-calendar";
const host = () => process.env.NANGO_HOST || "https://api.nango.dev";
const secret = () => process.env.NANGO_SECRET_KEY || "";
export const nangoReady = () => Boolean(secret());

const COOKIE = "jai_uid";
/** A private, random id per browser, in an httpOnly cookie. It is the Nango end user id. */
export function userId(req: Request): { id: string; fresh: boolean } {
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)jai_uid=([a-f0-9-]{36})/);
  return m ? { id: m[1], fresh: false } : { id: randomUUID(), fresh: true };
}
export const cookieHeader = (id: string) => `${COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;

export interface Live { gmail: string | null; calendar: string | null; email: string | null }
const cache = new Map<string, { at: number; live: Live }>();

/** Which Google apps this end user has connected. Looked up on the server, never trusted from the browser. */
export async function liveFor(uid: string, fresh = false): Promise<Live> {
  const hit = cache.get(uid);
  if (!fresh && hit && Date.now() - hit.at < 60_000) return hit.live;
  const none: Live = { gmail: null, calendar: null, email: null };
  if (!nangoReady()) return none;
  const r = await fetch(`${host()}/connections?endUserId=${encodeURIComponent(uid)}`, { headers: { Authorization: `Bearer ${secret()}` } });
  if (!r.ok) return hit?.live ?? none;
  const j = (await r.json()) as { connections?: { connection_id: string; provider_config_key: string; created: string; end_user?: { id?: string; email?: string } | null }[] };
  const mine = (j.connections ?? []).filter((c) => c.end_user?.id === uid).sort((a, b) => b.created.localeCompare(a.created));
  const live: Live = {
    gmail: mine.find((c) => c.provider_config_key === GMAIL)?.connection_id ?? null,
    calendar: mine.find((c) => c.provider_config_key === CALENDAR)?.connection_id ?? null,
    email: null,
  };
  if (live.gmail) {
    try { live.email = (await proxy<{ emailAddress: string }>(live.gmail, GMAIL, "GET", "/gmail/v1/users/me/profile")).emailAddress; } catch { /* still connected */ }
  }
  cache.set(uid, { at: Date.now(), live });
  return live;
}
export const forget = (uid: string) => cache.delete(uid);

export async function connectUrl(uid: string, integration: string): Promise<string> {
  const r = await fetch(`${host()}/connect/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ end_user: { id: uid }, allowed_integrations: [integration] }),
  });
  if (!r.ok) throw new Error(`connect session ${r.status}`);
  const j = (await r.json()) as { data: { token: string } };
  return `${host()}/oauth/connect/${integration}?connect_session_token=${encodeURIComponent(j.data.token)}`;
}

export async function disconnect(connectionId: string, integration: string) {
  await fetch(`${host()}/connection/${encodeURIComponent(connectionId)}?provider_config_key=${integration}`, { method: "DELETE", headers: { Authorization: `Bearer ${secret()}` } });
}

/** Calls Google through Nango's proxy, which injects the user's OAuth token server-side. */
export async function proxy<T>(connectionId: string, integration: string, method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${host()}/proxy${path}`, {
    method,
    headers: { Authorization: `Bearer ${secret()}`, "Connection-Id": connectionId, "Provider-Config-Key": integration, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Google ${r.status}: ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

/* ---------- Gmail ---------- */
type Header = { name: string; value: string };
interface GMsg { id: string; threadId: string; snippet?: string; internalDate?: string; payload?: { headers?: Header[]; mimeType?: string; body?: { data?: string }; parts?: GMsg["payload"][] } }
const header = (m: GMsg, n: string) => m.payload?.headers?.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";
const b64 = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

export async function gmailList(conn: string, max = 8) {
  const list = await proxy<{ messages?: { id: string }[] }>(conn, GMAIL, "GET", `/gmail/v1/users/me/messages?maxResults=${max}&q=${encodeURIComponent("in:inbox")}`);
  const msgs = await Promise.all((list.messages ?? []).map((m) => proxy<GMsg>(conn, GMAIL, "GET", `/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)));
  return msgs.map((m) => {
    const from = header(m, "From");
    const name = from.replace(/<.*>/, "").replace(/"/g, "").trim() || from;
    const email = (from.match(/<([^>]+)>/)?.[1] ?? from).trim();
    return { id: `g:${m.id}`, from: name, fromEmail: email, subject: header(m, "Subject") || "(no subject)", body: m.snippet ?? "", time: new Date(Number(m.internalDate) || Date.now()).toISOString() };
  });
}

export async function gmailRead(conn: string, id: string) {
  const m = await proxy<GMsg>(conn, GMAIL, "GET", `/gmail/v1/users/me/messages/${id.replace(/^g:/, "")}?format=full`);
  const find = (p: GMsg["payload"]): string => {
    if (!p) return "";
    if (p.mimeType === "text/plain" && p.body?.data) return b64(p.body.data);
    for (const c of p.parts ?? []) { const t = find(c); if (t) return t; }
    if (p.mimeType === "text/html" && p.body?.data) return b64(p.body.data).replace(/<[^>]+>/g, " ");
    return "";
  };
  return { from: header(m, "From"), subject: header(m, "Subject"), body: (find(m.payload) || m.snippet || "").replace(/\s+\n/g, "\n").slice(0, 4000) };
}

export async function gmailSend(conn: string, to: string, subject: string, body: string) {
  const enc = (s: string) => `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`;
  const raw = [`To: ${to}`, `Subject: ${enc(subject)}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(body).toString("base64")].join("\r\n");
  const out = await proxy<{ id: string }>(conn, GMAIL, "POST", "/gmail/v1/users/me/messages/send", { raw: Buffer.from(raw).toString("base64url") });
  return out.id;
}

/* ---------- Calendar ---------- */
interface GEvent { id: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; attendees?: { email: string; displayName?: string }[] }
export async function calList(conn: string) {
  const now = new Date();
  const q = new URLSearchParams({ timeMin: now.toISOString(), timeMax: new Date(+now + 7 * 864e5).toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "15" });
  const r = await proxy<{ items?: GEvent[] }>(conn, CALENDAR, "GET", `/calendar/v3/calendars/primary/events?${q}`);
  return (r.items ?? []).map((e) => ({
    id: `g:${e.id}`, title: e.summary || "(no title)",
    start: e.start?.dateTime ?? `${e.start?.date}T00:00:00+05:30`, end: e.end?.dateTime ?? `${e.end?.date}T00:00:00+05:30`,
    with: (e.attendees ?? []).map((a) => a.displayName || a.email),
  }));
}
export async function calCreate(conn: string, title: string, start: string, end: string) {
  const e = await proxy<GEvent>(conn, CALENDAR, "POST", "/calendar/v3/calendars/primary/events", { summary: title, start: { dateTime: start, timeZone: "Asia/Kolkata" }, end: { dateTime: end, timeZone: "Asia/Kolkata" } });
  return e.id;
}
