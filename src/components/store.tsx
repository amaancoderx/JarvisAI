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
}

function fresh(): State {
  const id = uid("c");
  return { ws: seedWorkspace(), chats: [{ id, title: "New chat", at: new Date().toISOString(), msgs: [], history: [] }], chatId: id, tasks: [], pending: null, computer: null, lang: "en", busy: false, routines: ROUTINES };
}

interface Api extends State {
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
  const ref = useRef(s);
  ref.current = s;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved?.ws && saved?.chats?.length) setS({ ...fresh(), ...saved, busy: false });
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
    const out = await post("/api/agent", { text: t, history: chat.history, workspace: st.ws, lang: st.lang });
    if (out.ok) apply(taskId, chat.id, out.r, "request");
    else setS((x) => ({ ...x, tasks: x.tasks.map((k) => (k.id === taskId ? { ...k, status: "failed", reply: out.error } : k)), chats: patchChat(x, chat.id, (c) => ({ ...c, msgs: [...c.msgs, { id: uid("m"), who: "jarvis", text: out.error, error: true }] })) }));
    setS((x) => ({ ...x, busy: false }));
    return out.ok ? out.r : null;
  }, [apply]);

  const decide = useCallback(async (approve: boolean) => {
    const st = ref.current;
    const p = st.pending;
    if (!p) return null;
    const task = st.tasks.find((t) => t.id === p.taskId);
    const chat = st.chats.find((c) => c.id === (task?.chatId ?? st.chatId)) ?? st.chats[0];
    setS((x) => ({ ...x, busy: true, pending: null, tasks: x.tasks.map((t) => (t.id === p.taskId ? { ...t, status: "working" } : t)) }));
    const { taskId: _t, ...pending } = p;
    const out = await post("/api/approve", { pending, approve, history: chat.history, workspace: st.ws, lang: st.lang });
    if (out.ok) apply(p.taskId, chat.id, out.r, "approval");
    else setS((x) => ({ ...x, pending: p, tasks: x.tasks.map((t) => (t.id === p.taskId ? { ...t, status: "waiting" } : t)), chats: patchChat(x, chat.id, (c) => ({ ...c, msgs: [...c.msgs, { id: uid("m"), who: "jarvis", text: out.error, error: true }] })) }));
    setS((x) => ({ ...x, busy: false }));
    return out.ok ? out.r : null;
  }, [apply]);

  const api = useMemo<Api>(() => ({
    ...s,
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
  }), [s, send, decide]);

  if (!loaded) return null;
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
