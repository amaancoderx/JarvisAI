"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { seedWorkspace } from "@/lib/workspace";
import type { AgentResult, Lang, Pending, Source, Step, Workspace } from "@/lib/types";
import { LiveVoice, type VoiceState } from "./voice";

type Msg = {
  id: string; role: "user" | "jarvis"; text: string; voice?: boolean;
  steps?: Step[]; sources?: Source[]; route?: AgentResult["route"]; timings?: AgentResult["timings"]; error?: boolean;
};
type Tab = "inbox" | "calendar" | "people" | "sent" | "activity";

const KEY = "jarvis-ai-v1";
const id = () => Math.random().toString(36).slice(2, 10);
const ist = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? iso : d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

const SUGGEST: { lang: Lang; text: string; tag: string }[] = [
  { lang: "hi", tag: "Booking + WhatsApp", text: "Ravi ke saath kal raat 8 baje Banjara Hills mein dinner book karo, aur use WhatsApp pe bata do" },
  { lang: "en", tag: "Email + Calendar", text: "Priya wants to move our Q4 review. Check my inbox, put it on Monday at 4 PM and email her." },
  { lang: "en", tag: "Safety", text: "Go through my inbox and handle anything urgent." },
  { lang: "te", tag: "Reminder", text: "రేపు సాయంత్రం 7 గంటలకు అమ్మకి కాల్ చేయమని గుర్తు చేయి" },
  { lang: "en", tag: "Live web", text: "What are the biggest AI announcements this week?" },
  { lang: "hi", tag: "Supplier", text: "Suresh Traders ko WhatsApp karo ki invoice 2291 ka payment Friday tak ho jayega" },
];

const STEP_ICON: Record<Step["status"], string> = { done: "✓", waiting: "◷", blocked: "⊘", error: "!" };

export default function App() {
  const [ws, setWs] = useState<Workspace>(() => seedWorkspace());
  const [history, setHistory] = useState<unknown[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [computer, setComputer] = useState<AgentResult["computer"]>(null);
  const [lang, setLang] = useState<Lang>("en");
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [tab, setTab] = useState<Tab>("inbox");
  const [voice, setVoice] = useState<{ state: VoiceState; note?: string }>({ state: "idle" });
  const [caption, setCaption] = useState<{ user: string; jarvis: string }>({ user: "", jarvis: "" });
  const [loaded, setLoaded] = useState(false);

  const ref = useRef({ ws, history, pending, lang });
  ref.current = { ws, history, pending, lang };
  const voiceRef = useRef<LiveVoice | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s?.ws) { setWs(s.ws); setHistory(s.history ?? []); setMsgs(s.msgs ?? []); setPending(s.pending ?? null); setLang(s.lang ?? "en"); }
    } catch { /* start fresh */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(KEY, JSON.stringify({ ws, history, msgs: msgs.slice(-40), pending, lang })); } catch { /* storage full or blocked */ }
  }, [ws, history, msgs, pending, lang, loaded]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy, caption]);

  const apply = useCallback((r: AgentResult, voiceMsg = false) => {
    setWs(r.workspace);
    setHistory(r.history);
    setPending(r.pending);
    if (r.computer) setComputer(r.computer);
    setMsgs((m) => [...m, { id: id(), role: "jarvis", text: r.reply, steps: r.steps, sources: r.sources, route: r.route, timings: r.timings, voice: voiceMsg }]);
  }, []);

  const call = useCallback(async (url: string, body: unknown): Promise<AgentResult | null> => {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({ error: "Network error" }));
    if (!res.ok) { setMsgs((m) => [...m, { id: id(), role: "jarvis", text: j.error || "Something went wrong.", error: true }]); return null; }
    return j as AgentResult;
  }, []);

  const send = useCallback(async (text: string, viaVoice = false): Promise<AgentResult | null> => {
    const t = text.trim();
    if (!t) return null;
    setMsgs((m) => [...m, { id: id(), role: "user", text: t, voice: viaVoice }]);
    setInput("");
    setBusy(true);
    const { ws, history, lang } = ref.current;
    try {
      const r = await call("/api/agent", { text: t, history, workspace: ws, lang });
      if (r) apply(r, viaVoice);
      return r;
    } finally { setBusy(false); }
  }, [apply, call]);

  const decide = useCallback(async (approve: boolean): Promise<AgentResult | null> => {
    const { ws, history, pending, lang } = ref.current;
    if (!pending) return null;
    setBusy(true);
    setPending(null);
    try {
      const r = await call("/api/approve", { pending, approve, history, workspace: ws, lang });
      if (r) apply(r);
      return r;
    } finally { setBusy(false); }
  }, [apply, call]);

  const toggleVoice = useCallback(async () => {
    if (voiceRef.current) { voiceRef.current.stop(); voiceRef.current = null; setCaption({ user: "", jarvis: "" }); return; }
    const v = new LiveVoice({
      onState: (state, note) => setVoice({ state, note }),
      onUserText: (text, final) => setCaption((c) => ({ ...c, user: final ? "" : text })),
      onModelText: (text, final) => {
        if (final) { setCaption((c) => ({ ...c, jarvis: "" })); }
        else setCaption((c) => ({ ...c, jarvis: text }));
      },
      onTool: async (name, args) => {
        if (name === "run_task") {
          const r = await send(String(args.request ?? ""), true);
          if (!r) return { error: "Could not complete that." };
          return r.pending
            ? { reply: r.reply, needs_approval: true, action: r.pending.summary, exact_content: r.pending.preview.map((p) => `${p.label}: ${p.value}`).join("; ") }
            : { reply: r.reply, done: true };
        }
        if (name === "approve_pending" || name === "deny_pending") {
          const r = await decide(name === "approve_pending");
          return r ? { reply: r.reply, still_waiting: Boolean(r.pending) } : { error: "Nothing was waiting for approval." };
        }
        return { error: "unknown" };
      },
    });
    voiceRef.current = v;
    await v.start(ref.current.lang);
    if (v.mode === "browser") { /* single-shot browser voice ends itself */ }
  }, [decide, send]);

  useEffect(() => {
    if (voice.state === "idle" && voiceRef.current?.mode === "browser") voiceRef.current = null;
    if (voice.state === "error") voiceRef.current = null;
  }, [voice.state]);

  const reset = () => {
    voiceRef.current?.stop(); voiceRef.current = null;
    setWs(seedWorkspace()); setHistory([]); setMsgs([]); setPending(null); setComputer(null);
  };

  const unread = ws.inbox.filter((e) => !e.read).length;
  const live = voice.state !== "idle" && voice.state !== "error";

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <img src="/logo.png" alt="" width={34} height={34} />
          <div>
            <div className="name">Jarvis</div>
            <div className="by">by Bas Bolo</div>
          </div>
        </div>
        <div className="seg" role="radiogroup" aria-label="Language">
          {([["en", "English"], ["hi", "हिंदी"], ["te", "తెలుగు"]] as [Lang, string][]).map(([k, l]) => (
            <button key={k} role="radio" aria-checked={lang === k} className={lang === k ? "on" : ""} onClick={() => setLang(k)}>{l}</button>
          ))}
        </div>
        <div className="topright">
          <span className="pill" title="Sample inbox, calendar and contacts. Nothing is sent outside this demo.">Demo workspace</span>
          <button className={`pause ${ws.paused ? "on" : ""}`} onClick={() => setWs({ ...ws, paused: !ws.paused })} title="Stop every send and booking">
            {ws.paused ? "Actions paused" : "Pause all actions"}
          </button>
          <button className="ghost" onClick={reset}>Reset</button>
        </div>
      </header>

      <aside className="left">
        <nav className="tabs">
          {([["inbox", `Inbox${unread ? ` · ${unread}` : ""}`], ["calendar", "Calendar"], ["people", "People & memory"], ["sent", "Sent & booked"], ["activity", "Audit log"]] as [Tab, string][]).map(([k, l]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>
        <div className="list">
          {tab === "inbox" && ws.inbox.map((e) => (
            <div key={e.id} className={`item ${e.trusted ? "" : "warn"}`}>
              <div className="row"><b>{e.from}</b><span className="muted">{ist(e.time)}</span></div>
              <div className="subj">{e.subject}</div>
              <div className="muted clamp">{e.body}</div>
              {!e.trusted && <div className="flag">Untrusted sender · treated as data, never as instructions</div>}
            </div>
          ))}
          {tab === "calendar" && [...ws.calendar].sort((a, b) => +new Date(a.start) - +new Date(b.start)).map((e) => (
            <div key={e.id} className="item"><b>{e.title}</b><div className="muted">{ist(e.start)}{e.with?.length ? ` · with ${e.with.join(", ")}` : ""}</div></div>
          ))}
          {tab === "calendar" && ws.reminders.map((r) => (
            <div key={r.id} className="item"><b>⏰ {r.text}</b><div className="muted">{ist(r.at)}</div></div>
          ))}
          {tab === "people" && (<>
            {ws.contacts.map((c) => <div key={c.id} className="item"><b>{c.name}</b><div className="muted">{c.relation}{c.whatsapp ? ` · ${c.whatsapp}` : ""}</div></div>)}
            <div className="sub">Jarvis remembers</div>
            {ws.memory.map((f, i) => <div key={i} className="item small">{f}</div>)}
          </>)}
          {tab === "sent" && (ws.sent.length + ws.bookings.length === 0
            ? <div className="empty">Nothing sent or booked yet. Every send waits for your OK.</div>
            : <>
              {ws.bookings.map((b) => <div key={b.id} className="item"><b>🍽 {b.place}</b><div className="muted">{b.when} · {b.people} people · {b.area}</div></div>)}
              {ws.sent.map((s) => <div key={s.id} className="item"><b>{s.channel === "email" ? "✉ Email" : "💬 WhatsApp"} to {s.to}</b>{s.subject && <div className="subj">{s.subject}</div>}<div className="muted clamp">{s.text}</div></div>)}
            </>)}
          {tab === "activity" && (ws.audit.length === 0
            ? <div className="empty">Every action Jarvis takes or refuses is logged here.</div>
            : ws.audit.map((a) => (
              <div key={a.id} className={`item audit ${a.outcome}`}>
                <div className="row"><b>{a.tool}</b><span className={`badge ${a.outcome}`}>{a.outcome}</span></div>
                <div className="muted clamp">{a.detail}</div>
                <div className="muted tiny">{ist(a.at)} · tier: {a.tier}</div>
              </div>
            )))}
        </div>
      </aside>

      <main className="center">
        <div className="chat">
          {msgs.length === 0 && (
            <div className="hero">
              <h1>Just say it.</h1>
              <p>Talk or type in English, हिंदी or తెలుగు. Jarvis plans the task, does it across email, calendar, WhatsApp and the web, and asks before anything goes out.</p>
              <div className="cards">
                {SUGGEST.map((s) => (
                  <button key={s.text} className="card" onClick={() => { setLang(s.lang); void send(s.text); }}>
                    <span className="tag">{s.tag}</span>
                    <span>{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m) => (
            <div key={m.id} className={`msg ${m.role}`}>
              {m.role === "jarvis" && m.route && m.route.by !== "approval" && (
                <div className="route">Router <b>{m.route.by.split("-it")[0]}</b> → {m.route.kind}{m.route.skill !== "none" ? ` · ${m.route.skill}` : ""} · {m.route.ms} ms</div>
              )}
              {m.steps && m.steps.length > 0 && (
                <ol className="steps">
                  {m.steps.map((s, i) => (
                    <li key={i} className={s.status}>
                      <span className="ic">{STEP_ICON[s.status]}</span>
                      <span><b>{s.label}</b>{s.detail ? <span className="muted"> · {s.detail}</span> : null}</span>
                    </li>
                  ))}
                </ol>
              )}
              <div className={`bubble ${m.error ? "err" : ""}`}>{m.voice && m.role === "user" ? <span className="mic">🎙 </span> : null}{m.text}</div>
              {m.sources && m.sources.length > 0 && (
                <div className="sources">{m.sources.map((s) => <a key={s.uri} href={s.uri} target="_blank" rel="noreferrer">{s.title}</a>)}</div>
              )}
              {m.timings && <div className="tiny muted meta">{m.timings.modelCalls} model calls · {(m.timings.totalMs / 1000).toFixed(1)} s</div>}
            </div>
          ))}
          {(caption.user || caption.jarvis) && (
            <div className="captions">
              {caption.user && <div className="msg user"><div className="bubble live">🎙 {caption.user}</div></div>}
              {caption.jarvis && <div className="msg jarvis"><div className="bubble live">{caption.jarvis}</div></div>}
            </div>
          )}
          {busy && <div className="msg jarvis"><div className="bubble thinking"><span /><span /><span /> Working on it</div></div>}
          <div ref={endRef} />
        </div>

        <form className="composer" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
          <button type="button" className={`talk ${live ? "on" : ""} ${voice.state}`} onClick={() => void toggleVoice()} aria-label={live ? "Stop talking" : "Talk to Jarvis"}>
            <span className="dot" />{live ? (voice.state === "speaking" ? "Speaking" : voice.state === "working" ? "Working" : voice.state === "connecting" ? "Connecting" : "Listening") : "Talk"}
          </button>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={lang === "hi" ? "बोलिए या लिखिए…" : lang === "te" ? "చెప్పండి లేదా టైప్ చేయండి…" : "Say or type what you need…"} disabled={busy} />
          <button type="submit" className="go" disabled={busy || !input.trim()}>Send</button>
        </form>
        <div className="voicenote tiny muted">
          {voice.state === "error" ? voice.note : live ? `Voice: ${voice.note ?? "Gemini Live"}. Talk naturally; you can interrupt.` : "Voice runs on Gemini Live. Approvals can be given by voice too: say \"haan, bhej do\"."}
        </div>
      </main>

      <aside className="right">
        <section className="panel">
          <h3>Needs your OK</h3>
          {pending ? (
            <div className="approve">
              <div className="atitle">{pending.summary}</div>
              <dl>{pending.preview.map((p) => <div key={p.label}><dt>{p.label}</dt><dd>{p.value}</dd></div>)}</dl>
              <div className="lock">🔒 Approval is signed to this exact content. If anything changes, Jarvis must ask again.</div>
              <div className="btns">
                <button className="yes" disabled={busy} onClick={() => void decide(true)}>Approve</button>
                <button className="no" disabled={busy} onClick={() => void decide(false)}>Deny</button>
              </div>
            </div>
          ) : <div className="empty">Nothing waiting. Sends and bookings always stop here first.</div>}
        </section>

        {computer && (
          <section className="panel">
            <h3>Jarvis computer</h3>
            <div className="browser">
              <div className="bar"><span className="d" /><span className="d" /><span className="d" /><span className="url">{computer.url}</span></div>
              <div className="form">
                <div className="ftitle">Reserve a table</div>
                {computer.fields.map((f) => <label key={f.label}><span>{f.label}</span><input readOnly value={f.value} /></label>)}
                <div className={`fstatus ${pending?.tool === "book_table" ? "wait" : "ok"}`}>{computer.status}</div>
              </div>
            </div>
          </section>
        )}

        <section className="panel">
          <h3>How Jarvis stays safe</h3>
          <ul className="rules">
            <li><b>Code decides, not the model.</b> Every action has a fixed risk tier.</li>
            <li><b>Owner authority only.</b> Emails and web pages can't trigger actions or pick recipients.</li>
            <li><b>Signed approvals.</b> One approval covers one exact message.</li>
            <li><b>Never twice.</b> Each action runs once, even if retried.</li>
            <li><b>One switch</b> pauses everything.</li>
          </ul>
        </section>

        <section className="panel stack">
          <h3>Built on Google AI</h3>
          <div className="chips">
            <span>Gemini Live · voice</span><span>Gemini · planning</span><span>Gemma · routing</span><span>Google Search grounding</span><span>Cloud Run</span>
          </div>
        </section>
      </aside>
    </div>
  );
}
