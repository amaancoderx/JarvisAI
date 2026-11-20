"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { seedWorkspace } from "@/lib/workspace";
import type { AgentResult, Lang, Pending, Source, Step, Workspace } from "@/lib/types";

export type TaskStatus = "working" | "waiting" | "done" | "blocked" | "failed";
export interface Task {
  id: string; chatId: string; request: string; at: string; status: TaskStatus; voice?: boolean;
  steps: Step[]; reply: string; sources: Source[]; route?: AgentResult["route"];
  totalMs: number; modelCalls: number; rounds: { ms: number; calls: number; kind: "request" | "approval" }[];
  computer?: AgentResult["computer"];
}
export interface Msg { id: string; who: "user" | "jarvis"; text: string; taskId?: string; voice?: boolean; error?: boolean }
export interface Chat { id: string; title: string; at: string; msgs: Msg[]; history: unknown[] }
export interface Routine { id: string; name: string; when: string; prompt: string; on: boolean }

const KEY = "jarvis.ai.v2";
const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const ROUTINES: Routine[] = [
  { id: "r1", name: "Morning brief", when: "Every day, 8:00 AM", prompt: "Give me my morning brief: today's calendar, anything urgent in my inbox, and my reminders.", on: true },
  { id: "r2", name: "Supplier follow-up", when: "Fridays, 11:00 AM", prompt: "Check if any supplier invoice is due this week and draft a WhatsApp to them about the payment date.", on: true },
  { id: "r3", name: "Weekly AI news", when: "Mondays, 9:00 AM", prompt: "What were the biggest AI announcements this week?", on: false },
];

interface State {
  ws: Workspace; chats: Chat[]; chatId: string; tasks: Task[]; pending: (Pending & { taskId: string }) | null;
  computer: AgentResult["computer"]; lang: Lang; busy: boolean; routines: Routine[];
  /** The workspace not in use, kept so switching never mixes real and sample data. */
  stash?: Partial<Record<"google" | "sample", Workspace>>;
}

function fresh(): State {
  const id = uid("c");
  return { ws: seedWorkspace(), chats: [{ id, title: "New chat", at: new Date().toISOString(), msgs: [], history: [] }], chatId: id, tasks: [], pending: null, computer: null, lang: "en", busy: false, routines: ROUTINES };
}

export interface LiveState { available: boolean; gmail: boolean; calendar: boolean; drive: boolean; email: string | null; whatsapp: string | null }
export type GApp = "gmail" | "calendar" | "drive";
export type LearnSource = "gmail" | "calendar" | "drive" | "text" | "file" | "chat";

/** A new Google workspace: the owner's own data only, nothing from the samples. */
function googleWs(email: string | null): Workspace {
  const seed = seedWorkspace();
  const name = email ? email.split("@")[0].replace(/[._\d]+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase()) || "You" : "You";
  return { ...seed, owner: name, contacts: [], memory: [], inbox: [], calendar: [], reminders: [], sent: [], bookings: [], audit: [], executed: [], docs: [], profile: { city: "", languages: "English", notes: "" } };
}

export type Space = "google" | "sample" | null;

interface Api extends State {
  live: LiveState;
  /** Which workspace Jarvis works in: the owner's real Google account, or sample data. */
  space: Space;
  setSpace: (s: "google" | "sample") => void;
  connect: (app: GApp) => Promise<void>;
  disconnect: (app: GApp) => Promise<void>;
  sync: () => Promise<void>;
  syncing: boolean;
  learn: (source: LearnSource, extra?: { text?: string; name?: string; mime?: string; data?: string }) => Promise<{ facts: number; people: number; error?: string }>;
  chat: Chat;
  send: (text: string, voice?: boolean) => Promise<AgentResult | null>;
  decide: (approve: boolean) => Promise<AgentResult | null>;
  newChat: () => void;
  openChat: (id: string) => void;
  deleteChat: (id: string) => void;
  setLang: (l: Lang) => void;
  updateWs: (f: (w: Workspace) => Workspace) => void;
  setRoutines: (r: Routine[]) => void;
  reset: () => void;
}

const Ctx = createContext<Api | null>(null);
export const useJarvis = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("JarvisProvider missing");
  return v;
};

async function post(url: string, body: unknown): Promise<{ ok: true; r: AgentResult } | { ok: false; error: string }> {
  const once = () => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  let res = await once();
  // Gemini can be briefly overloaded; one quiet retry hides most of it.
  if (!res || res.status >= 500) { await new Promise((r) => setTimeout(r, 1200)); res = await once(); }
  if (!res) return { ok: false, error: "Network problem. Please try again." };
  const j = await res.json().catch(() => ({ error: "Network problem. Please try again." }));
  return res.ok ? { ok: true, r: j as AgentResult } : { ok: false, error: j.error || "Something went wrong. Please try again." };
}

export function JarvisProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(fresh);
  const [loaded, setLoaded] = useState(false);
  const [live, setLive] = useState<LiveState>({ available: false, gmail: false, calendar: false, drive: false, email: null, whatsapp: null });
  const refreshLive = useCallback(async (fresh = false) => {
    try {
      const r = await fetch(`/api/connect/status${fresh ? "?fresh=1" : ""}`, { cache: "no-store" });
      if (r.ok) { const j = (await r.json()) as LiveState; setLive(j); return j; }
    } catch { /* offline */ }
    return null;
  }, []);
  useEffect(() => { void refreshLive(); }, [refreshLive]);
  const [space, setSpaceState] = useState<Space>(() => { try { return (localStorage.getItem("jarvis.space") as Space) || null; } catch { return null; } });
  const spaceRef = useRef(space);
  spaceRef.current = space;
  const keepSpace = (v: Space) => { setSpaceState(v); try { if (v) localStorage.setItem("jarvis.space", v); } catch { /* not kept */ } };
  const ref = useRef(s);
  ref.current = s;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved?.ws && saved?.chats?.length) {
        const sp = localStorage.getItem("jarvis.space");
        // A Google workspace never carries the sample people or mail from before.
        if (sp === "google" && saved.ws.contacts?.some((c: { id: string }) => c.id === "c_ravi")) saved.ws = { ...googleWs(null), memory: [], chats: undefined };
        setS({ ...fresh(), ...saved, busy: false });
      }
    } catch { /* start fresh */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      const { busy: _b, ...keep } = s;
      localStorage.setItem(KEY, JSON.stringify({ ...keep, chats: keep.chats.slice(0, 20), tasks: keep.tasks.slice(0, 60) }));
    } catch { /* storage full or blocked */ }
  }, [s, loaded]);

  const patchChat = (st: State, chatId: string, f: (c: Chat) => Chat): Chat[] => st.chats.map((c) => (c.id === chatId ? f(c) : c));

  const apply = useCallback((taskId: string, chatId: string, r: AgentResult, kind: "request" | "approval") => {
    setS((st) => {
      const tasks = st.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const status: TaskStatus = r.pending ? "waiting" : r.steps.some((x) => x.status === "blocked") && !r.steps.some((x) => x.status === "done" && x.tier === "external") && kind === "approval" ? "blocked" : "done";
        return {
          ...t, status, reply: r.reply,
          steps: [...t.steps.filter((x) => !(x.status === "waiting" && kind === "approval" && r.steps.some((n) => n.tool === x.tool))), ...r.steps],
          sources: [...t.sources, ...r.sources], route: t.route ?? (r.route.by !== "approval" ? r.route : undefined),
          totalMs: t.totalMs + r.timings.totalMs, modelCalls: t.modelCalls + r.timings.modelCalls,
          rounds: [...t.rounds, { ms: r.timings.totalMs, calls: r.timings.modelCalls, kind }],
          computer: r.computer ?? t.computer,
        };
      });
      // One answer per task: after an approval, the task's earlier "check it and approve" line is replaced, not stacked.
      const chats = patchChat(st, chatId, (c) => {
        const msgs = kind === "approval" ? c.msgs.filter((m) => m.taskId !== taskId) : c.msgs;
        return { ...c, history: r.history, msgs: [...msgs, { id: uid("m"), who: "jarvis", text: r.reply, taskId }] };
      });
      return { ...st, ws: r.workspace, tasks, chats, pending: r.pending ? { ...r.pending, taskId } : null, computer: r.computer ?? st.computer };
    });
  }, []);

  const merge = useCallback((label: string, out: { facts?: string[]; people?: { name: string; relation: string; email?: string; phone?: string }[]; summary?: string }, doc?: { name: string; source: string }) => {
    let nf = 0, np = 0;
    setS((x) => {
      const have = new Set(x.ws.memory.map((m) => m.toLowerCase().replace(/[^a-z0-9]/g, "")));
      const facts = (out.facts ?? []).filter((f) => { const k = f.toLowerCase().replace(/[^a-z0-9]/g, ""); if (!k || have.has(k)) return false; have.add(k); return true; });
      nf = facts.length;
      const contacts = [...x.ws.contacts];
      for (const pp of out.people ?? []) {
        if (!pp.name || /noreply|no-reply|notification/i.test(`${pp.name} ${pp.email ?? ""}`)) continue;
        const i = contacts.findIndex((c) => c.name.toLowerCase() === pp.name.toLowerCase() || (pp.email && c.email?.toLowerCase() === pp.email.toLowerCase()));
        if (i >= 0) { contacts[i] = { ...contacts[i], email: contacts[i].email || pp.email || undefined, whatsapp: contacts[i].whatsapp || pp.phone || undefined }; continue; }
        contacts.push({ id: uid("c"), name: pp.name, relation: pp.relation || label.toLowerCase(), ...(pp.email ? { email: pp.email } : {}), ...(pp.phone ? { whatsapp: pp.phone } : {}) });
        np++;
      }
      const docs = doc ? [...(x.ws.docs ?? []), { id: uid("d"), name: doc.name, summary: out.summary || `${facts.length} facts learned`, at: new Date().toISOString(), source: doc.source }] : x.ws.docs;
      return { ...x, ws: { ...x.ws, memory: [...x.ws.memory, ...facts], contacts, docs } };
    });
    return { nf, np };
  }, []);

  const learn = useCallback(async (source: LearnSource, extra: { text?: string; name?: string; mime?: string; data?: string } = {}) => {
    const r = await fetch("/api/memory/learn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source, ...extra, known: ref.current.ws.memory }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : { error: "Network problem." };
    if (!r || !r.ok) return { facts: 0, people: 0, error: j.error || "Could not learn from that." };
    await new Promise((res) => setTimeout(res, 0));
    const before = ref.current.ws.memory.length, beforeP = ref.current.ws.contacts.length;
    merge(j.label || source, j, source === "file" || source === "text" ? { name: extra.name || (source === "text" ? "Note" : "Document"), source } : undefined);
    await new Promise((res) => setTimeout(res, 50));
    return { facts: Math.max(0, ref.current.ws.memory.length - before), people: Math.max(0, ref.current.ws.contacts.length - beforeP) };
  }, [merge]);

  const [syncing, setSyncing] = useState(false);
  const sync = useCallback(async () => {
    if (spaceRef.current !== "google") return;
    setSyncing(true);
    try {
      const r = await fetch("/api/workspace/sync", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { inbox: Workspace["inbox"] | null; calendar: Workspace["calendar"] | null };
      setS((x) => ({ ...x, ws: { ...x.ws, ...(j.inbox ? { inbox: j.inbox.map((m) => ({ ...m, trusted: true })) } : {}), ...(j.calendar ? { calendar: j.calendar } : {}) } }));
    } finally { setSyncing(false); }
  }, []);
  useEffect(() => { if (loaded && space === "google" && (live.gmail || live.calendar)) void sync(); }, [loaded, space, live.gmail, live.calendar, sync]);

  const send = useCallback(async (text: string, voice = false) => {
    const t = text.trim();
    if (!t) return null;
    const st = ref.current;
    const chat = st.chats.find((c) => c.id === st.chatId)!;
    const taskId = uid("t");
    const task: Task = { id: taskId, chatId: chat.id, request: t, at: new Date().toISOString(), status: "working", voice, steps: [], reply: "", sources: [], totalMs: 0, modelCalls: 0, rounds: [] };
    setS((x) => ({
      ...x, busy: true, tasks: [task, ...x.tasks],
      chats: patchChat(x, chat.id, (c) => ({ ...c, title: c.msgs.length ? c.title : t.slice(0, 48), at: new Date().toISOString(), msgs: [...c.msgs, { id: uid("m"), who: "user", text: t, voice }] })),
    }));
    const out = await post("/api/agent", { text: t, history: chat.history, workspace: st.ws, lang: st.lang, live: spaceRef.current === "google", voice });
    if (out.ok) {
      apply(taskId, chat.id, out.r, "request");
      // The memory learns from the conversation in the background, like a brain: lasting facts only.
      if (t.length > 12) void learn("chat", { text: `User: ${t}\nJarvis: ${out.r.reply}` });
    }
    else setS((x) => ({ ...x, tasks: x.tasks.map((k) => (k.id === taskId ? { ...k, status: "failed", reply: out.error } : k)), chats: patchChat(x, chat.id, (c) => ({ ...c, msgs: [...c.msgs, { id: uid("m"), who: "jarvis", text: out.error, error: true }] })) }));
    setS((x) => ({ ...x, busy: false }));
    return out.ok ? out.r : null;
  }, [apply, learn]);

  const decide = useCallback(async (approve: boolean) => {
    const st = ref.current;
    const p = st.pending;
    if (!p) return null;
    const task = st.tasks.find((t) => t.id === p.taskId);
    const chat = st.chats.find((c) => c.id === (task?.chatId ?? st.chatId)) ?? st.chats[0];
    setS((x) => ({ ...x, busy: true, pending: null, tasks: x.tasks.map((t) => (t.id === p.taskId ? { ...t, status: "working" } : t)) }));
    const { taskId: _t, ...pending } = p;
    const out = await post("/api/approve", { pending, approve, history: chat.history, workspace: st.ws, lang: st.lang, live: spaceRef.current === "google" });
    if (out.ok) apply(p.taskId, chat.id, out.r, "approval");
    else setS((x) => ({ ...x, pending: p, tasks: x.tasks.map((t) => (t.id === p.taskId ? { ...t, status: "waiting" } : t)), chats: patchChat(x, chat.id, (c) => ({ ...c, msgs: [...c.msgs, { id: uid("m"), who: "jarvis", text: out.error, error: true }] })) }));
    setS((x) => ({ ...x, busy: false }));
    return out.ok ? out.r : null;
  }, [apply]);

  /** Swaps workspaces: the current one is kept aside, the other comes back exactly as it was. */
  function switchTo(v: "google" | "sample", email: string | null) {
    setS((x) => {
      const from = spaceRef.current ?? "sample";
      const stash = { ...(x.stash ?? {}), [from]: x.ws };
      const next = stash[v] ?? (v === "google" ? googleWs(email) : seedWorkspace());
      return { ...x, stash, ws: next, pending: null, computer: null };
    });
  }

  const connect = useCallback(async (app: GApp) => {
    const r = await fetch("/api/connect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ app }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.url) { window.alert(j.error || "Could not start Google sign-in."); return; }
    const w = window.open(j.url, "jarvis-google", "width=520,height=680");
    for (let i = 0; i < 90; i++) {
      await new Promise((res) => setTimeout(res, 2000));
      const st = await refreshLive(true);
      if (st && st[app]) {
        // The owner's own workspace: real data only.
        if (spaceRef.current !== "google") switchTo("google", st.email);
        keepSpace("google");
        setTimeout(() => void sync(), 300);
        try { w?.close(); } catch { /* closed */ }
        return;
      }
      if (w && w.closed && i > 3) { await refreshLive(true); return; }
    }
  }, [refreshLive, sync]);
  const disconnect = useCallback(async (app: GApp) => {
    await fetch("/api/connect/disconnect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ app }) });
    await refreshLive(true);
    setS((x) => ({ ...x, ws: app === "gmail" ? { ...x.ws, inbox: [] } : app === "calendar" ? { ...x.ws, calendar: [] } : x.ws }));
  }, [refreshLive]);

  const setSpace = useCallback((v: "google" | "sample") => {
    if (spaceRef.current !== v) switchTo(v, live.email);
    keepSpace(v);
    if (v === "google") setTimeout(() => void sync(), 200);
  }, [live.email, sync]);

  const api = useMemo<Api>(() => ({
    ...s, live, connect, disconnect, space, setSpace, sync, syncing, learn,
    chat: s.chats.find((c) => c.id === s.chatId) ?? s.chats[0],
    send, decide,
    newChat: () => setS((x) => {
      const cur = x.chats.find((c) => c.id === x.chatId);
      if (cur && cur.msgs.length === 0) return x;
      const id = uid("c");
      return { ...x, chatId: id, chats: [{ id, title: "New chat", at: new Date().toISOString(), msgs: [], history: [] }, ...x.chats] };
    }),
    openChat: (id) => setS((x) => ({ ...x, chatId: id })),
    deleteChat: (id) => setS((x) => {
      const chats = x.chats.filter((c) => c.id !== id);
      if (chats.length === 0) { const n = uid("c"); return { ...x, chats: [{ id: n, title: "New chat", at: new Date().toISOString(), msgs: [], history: [] }], chatId: n }; }
      return { ...x, chats, chatId: x.chatId === id ? chats[0].id : x.chatId };
    }),
    setLang: (lang) => setS((x) => ({ ...x, lang })),
    updateWs: (f) => setS((x) => ({ ...x, ws: f(x.ws) })),
    setRoutines: (routines) => setS((x) => ({ ...x, routines })),
    reset: () => setS(fresh()),
  }), [s, send, decide, live, connect, disconnect, space, setSpace, sync, syncing, learn]);

  if (!loaded) return null;
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
