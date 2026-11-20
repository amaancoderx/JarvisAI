"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { AppIcon } from "./AppIcon";
import { JarvisMark, type MarkState } from "./JarvisMark";
import { Browser, Rich, StatusChip, TaskProgress, ago, ist } from "./bits";
import { useJarvis } from "./store";
import { LiveVoice, type VoiceState } from "./voice";
import type { Lang } from "@/lib/types";
import type { View } from "./Shell";

const SUGGEST: { lang: Lang; kind: string; text: string }[] = [
  { lang: "hi", kind: "Book and tell a friend · हिंदी", text: "Ravi ke saath kal raat 8 baje Banjara Hills mein dinner book karo, aur use WhatsApp pe bata do" },
  { lang: "en", kind: "Email and calendar", text: "Priya wants to move our Q4 review. Check my inbox, put it on Monday at 4 PM and email her." },
  { lang: "en", kind: "Safety: inbox with a phishing email", text: "Go through my inbox and handle anything urgent." },
  { lang: "te", kind: "Reminder · తెలుగు", text: "రేపు సాయంత్రం 7 గంటలకు అమ్మకి కాల్ చేయమని గుర్తు చేయి" },
  { lang: "en", kind: "Live web answer", text: "What are the biggest AI announcements this week?" },
  { lang: "hi", kind: "Supplier follow-up · Hinglish", text: "Suresh Traders ko WhatsApp karo ki invoice 2291 ka payment Friday tak ho jayega" },
];

const LIVE_SUGGEST: { lang: Lang; kind: string; text: string }[] = [
  { lang: "en", kind: "Your inbox", text: "Go through my inbox and tell me what needs my attention." },
  { lang: "en", kind: "Your calendar", text: "What's on my calendar this week?" },
  { lang: "hi", kind: "Plan an evening · हिंदी", text: "Kal shaam 7 baje ke liye Banjara Hills mein ek achha restaurant dhoondo aur calendar mein daal do" },
  { lang: "en", kind: "Reply for you", text: "Draft a reply to my latest email and show it to me before sending." },
  { lang: "te", kind: "Reminder · తెలుగు", text: "రేపు సాయంత్రం 7 గంటలకు అమ్మకి కాల్ చేయమని గుర్తు చేయి" },
  { lang: "en", kind: "Live web answer", text: "What are the biggest AI announcements this week?" },
];

const greeting = () => {
  const h = Number(new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export function TalkView({ go }: { go: (v: View, id?: string) => void }) {
  const j = useJarvis();
  const [text, setText] = useState("");
  const [voice, setVoice] = useState<{ state: VoiceState; note?: string }>({ state: "idle" });
  const [live, setLive] = useState("");
  const [aside, setAside] = useState(true);
  const connected = j.live.gmail || j.live.calendar;
  const isLive = j.space === "google" && connected;
  const mode = j.space === "sample" ? "sample" : null;
  const useGoogle = () => (connected ? j.setSpace("google") : void j.connect("gmail"));
  const voiceRef = useRef<LiveVoice | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const jr = useRef(j);
  jr.current = j;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [j.chat.msgs.length, j.busy, live]);
  useEffect(() => () => voiceRef.current?.stop(), []);

  const listening = voice.state !== "idle" && voice.state !== "error";
  const mark: MarkState = voice.state === "speaking" ? "speaking" : listening ? "listening" : "idle";
  const say = (t: string) => { if (!t.trim() || j.busy) return; setText(""); void j.send(t); };

  const toggleMic = async () => {
    if (voiceRef.current) { voiceRef.current.stop(); voiceRef.current = null; setLive(""); return; }
    const v = new LiveVoice({
      onState: (state, note) => { setVoice({ state, note }); if (state === "idle" || state === "error") { if (v.mode === "browser" || state === "error") voiceRef.current = null; } },
      onUserText: (t, final) => setLive(final ? "" : t),
      onModelText: () => undefined,
      onTool: async (name, args) => {
        if (name === "run_task") {
          const r = await jr.current.send(String(args.request ?? ""), true);
          if (!r) return { error: "Could not complete that." };
          return r.pending
            ? { reply: r.reply, needs_approval: true, action: r.pending.summary, exact_content: r.pending.preview.map((p) => `${p.label}: ${p.value}`).join("; ") }
            : { reply: r.reply, done: true };
        }
        if (name === "approve_pending" || name === "deny_pending") {
          const r = await jr.current.decide(name === "approve_pending");
          return r ? { reply: r.reply, still_waiting: Boolean(r.pending) } : { error: "Nothing was waiting for approval." };
        }
        return { error: "unknown" };
      },
    });
    voiceRef.current = v;
    await v.start(jr.current.lang);
  };

  const status = voice.state === "error" ? voice.note : listening ? (voice.state === "speaking" ? "Speaking" : voice.state === "working" ? "Working" : voice.state === "connecting" ? "Connecting" : "Listening") : j.busy ? "Working" : "Ready";
  const recent = j.tasks.slice(0, 5);
  const reminders = j.ws.reminders.slice(-4).reverse();
  const pendingTask = j.pending ? j.tasks.find((t) => t.id === j.pending!.taskId) : null;
  const computerTask = j.tasks.find((t) => t.computer);

  return (
    <div className={`talk ${aside ? "" : "no-aside"}`}>
      <div className="talk-main">
        <header className="talk-head">
          <JarvisMark size={28} state={mark} />
          <span className="name">Jarvis</span>
          <span className="small muted">{status}</span>
          <span className="grow" />
          {j.space && (
            <div className="seg space-seg" role="radiogroup" aria-label="Workspace">
              <button role="radio" aria-checked={isLive} className={isLive ? "on" : ""} onClick={useGoogle} title={j.live.email ?? "Connect your Google account"}><AppIcon app="search" size={14} />{isLive && j.live.email ? j.live.email.split("@")[0] : "Your Google"}</button>
              <button role="radio" aria-checked={!isLive} className={!isLive ? "on" : ""} onClick={() => j.setSpace("sample")} title="Sample inbox and calendar; the AI is real">Sample</button>
            </div>
          )}
          {j.ws.paused && <span className="chip warn">Actions paused</span>}
          <div className="seg lang-seg" role="radiogroup" aria-label="Language">
            {([["en", "EN"], ["hi", "हिं"], ["te", "తె"]] as [Lang, string][]).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={j.lang === k} className={j.lang === k ? "on" : ""} onClick={() => j.setLang(k)}>{l}</button>
            ))}
          </div>
          <button className="icon-btn" onClick={() => setAside((v) => !v)} aria-label="Toggle details" title="Details"><Icon name="panel" /></button>
        </header>

        <div className="thread">
          <div className="thread-inner">
            {j.chat.msgs.length === 0 && (
              <div className="welcome">
                <JarvisMark size={64} state={mark} />
                <h1>{greeting()}{isLive ? (j.live.email ? `, ${j.live.email.split("@")[0]}` : "") : mode === "sample" ? `, ${j.ws.owner}` : ""}</h1>
                {!isLive && mode !== "sample" ? (
                  <>
                    <p>Jarvis is a voice-first AI agent. Say what you need in English, हिंदी or తెలుగు, and it gets it done across Gmail, Calendar and the web, asking before anything goes out.</p>
                    <div className="start-grid">
                      <button className="start primary" onClick={useGoogle} disabled={!j.live.available}>
                        <span className="start-icons"><AppIcon app="gmail" size={26} /><AppIcon app="calendar" size={26} /></span>
                        <span className="title">{connected ? "Continue with your Google account" : "Continue with Google"}</span>
                        <span className="desc">Your real Gmail and Calendar. Google sign-in in a small window; every send waits for your OK.</span>
                        <span className="btn sm accent start-cta">{connected ? "Open my workspace" : "Connect Google"}</span>
                      </button>
                      <button className="start" onClick={() => j.setSpace("sample")}>
                        <span className="start-icons"><AppIcon app="gemini" size={26} /><AppIcon app="search" size={26} /></span>
                        <span className="title">Explore with sample data</span>
                        <span className="desc">No sign-in. A ready inbox and calendar, with the same real Gemini, Google Search and voice.</span>
                        <span className="btn sm ghost start-cta">Start exploring</span>
                      </button>
                    </div>
                    <div className="trust-line"><Icon name="audit" size={14} />Tokens stay on our server · approvals are signed to the exact message · switch workspaces any time</div>
                  </>
                ) : (
                  <p>{isLive ? "Your real Gmail and Calendar are connected. " : "You are using a sample inbox; the AI, search and voice are all real. "}Ask by voice or by typing. Jarvis plans it, checks it is allowed, does it, and asks before anything goes out.</p>
                )}
                {(isLive || mode === "sample") && <div className="suggest">
                  {(isLive ? LIVE_SUGGEST : SUGGEST).map((s) => (
                    <button key={s.text} disabled={j.busy} onClick={() => { j.setLang(s.lang); say(s.text); }}>
                      <span className="k">{s.kind}</span>
                      {s.text}
                    </button>
                  ))}
                </div>}
                {mode === "sample" && !isLive && j.live.available && (
                  <button className="text-btn" onClick={useGoogle}>{connected ? "Switch to your Google account" : "Connect your Google account to use your real Gmail"}</button>
                )}
              </div>
            )}
            {j.chat.msgs.map((m) => {
              if (m.who === "user") return <div key={m.id} className="msg user">{m.voice ? "🎙 " : ""}{m.text}</div>;
              const t = m.taskId ? j.tasks.find((x) => x.id === m.taskId) : undefined;
              if (m.error || !t) return <div key={m.id} className={`msg jarvis ${m.error ? "err" : ""}`}><Rich text={m.text} /></div>;
              const last = j.chat.msgs.filter((x) => x.taskId === t.id).at(-1)?.id === m.id;
              return (
                <div key={m.id} className="stack-sm" style={{ display: "contents" }}>
                  {last && t.route && <div className="route-line">Routed by <b>{t.route.by.replace(/-it$/, "")}</b> → {t.route.kind}{t.route.skill !== "none" ? ` · ${t.route.skill}` : ""} · {t.route.ms} ms</div>}
                  {last && (
                    <button className="task-card" onClick={() => go("task", t.id)}>
                      <span className={`tile ${t.status === "done" ? "ok" : t.status === "waiting" ? "warn" : t.status === "working" ? "accent" : "fail"}`}><Icon name={t.status === "done" ? "check" : t.status === "waiting" ? "alert" : "tasks"} /></span>
                      <span className="grow">
                        <span className="truncate" style={{ display: "block", fontWeight: 550 }}>{t.request}</span>
                        <span className="small muted truncate" style={{ display: "block" }}>{t.status === "waiting" ? "Waiting for your OK: approve or deny on the right" : "Open to see every step"}</span>
                      </span>
                      <StatusChip status={t.status} />
                      <Icon name="chevron" size={16} />
                    </button>
                  )}
                  {last && <TaskProgress task={t} />}
                  <div className="msg jarvis"><Rich text={m.text} /></div>
                  {last && t.sources.length > 0 && <div className="sources">{t.sources.slice(0, 5).map((s) => <a key={s.uri} href={s.uri} target="_blank" rel="noreferrer">{s.title}</a>)}</div>}
                  {last && t.status !== "working" && <div className="msg-meta">{(t.totalMs / 1000).toFixed(1)} s · {t.modelCalls} model calls</div>}
                </div>
              );
            })}
            {j.busy && (j.chat.msgs.at(-1)?.who === "user" || j.tasks[0]?.status === "working") && (() => {
              const t = j.tasks.find((x) => x.status === "working" && x.chatId === j.chat.id);
              return t ? <TaskProgress task={t} /> : null;
            })()}
            {live && <div className="msg user live">{live}</div>}
            <div ref={endRef} />
          </div>
        </div>

        <div className="composer">
          <form className={`composer-box ${listening ? "listening" : ""}`} onSubmit={(e) => { e.preventDefault(); say(text); }}>
            {listening ? (
              <div className="composer-live">
                <span className={`wave ${voice.state === "speaking" || live ? "" : "still"}`}><i /><i /><i /><i /></span>
                <span className="truncate">{live || { listening: "Listening on Gemini Live. Just talk, you can interrupt.", speaking: "Speaking. Interrupt any time.", working: "Working on it", connecting: "Connecting to Gemini Live", idle: "", error: "" }[voice.state]}</span>
              </div>
            ) : (
              <input placeholder={j.lang === "hi" ? "Jarvis से कहिए…" : j.lang === "te" ? "Jarvis కి చెప్పండి…" : "Ask Jarvis"} value={text} onChange={(e) => setText(e.target.value)} aria-label="Message" />
            )}
            <button type="button" className={`round mic ${listening ? "on" : ""}`} onClick={() => void toggleMic()} aria-label={listening ? "End conversation" : "Start talking"} title={listening ? "End conversation" : "Talk with Gemini Live"}>
              <Icon name={listening ? "stop" : "mic"} size={19} />
            </button>
            <button type="submit" className="round send" disabled={j.busy || !text.trim() || listening} aria-label="Send"><Icon name="send" size={18} /></button>
          </form>
          <p className="composer-note">{voice.state === "error" ? voice.note : "Jarvis asks before it sends anything in your name. Approve by tap or by voice: \"haan, bhej do\"."}</p>
        </div>
      </div>

      {aside && (
        <aside className="aside">
          <div className="panel">
            <div className="panel-id">
              <JarvisMark size={52} state={mark} />
              <div>
                <div className="name">Jarvis</div>
                <div className="small muted">{j.tasks[0] ? `Active ${ago(j.tasks[0].at)}` : status}</div>
              </div>
            </div>
            <div className="panel-actions">
              <button className={`btn ${listening ? "danger solid" : "ghost"}`} onClick={() => void toggleMic()}><Icon name={listening ? "stop" : "mic"} size={16} />{listening ? "End" : "Talk"}</button>
              <button className={`btn ${j.ws.paused ? "danger" : "ghost"}`} onClick={() => j.updateWs((w) => ({ ...w, paused: !w.paused }))} title="Stops every new send and booking"><Icon name={j.ws.paused ? "play" : "pause"} size={16} />{j.ws.paused ? "Resume" : "Pause"}</button>
            </div>

            <div className="panel-sec">
              <div className="panel-label">Hears you through</div>
              <div className="panel-item"><Icon name="mic" size={16} /><span className="grow">This browser</span><span className="small muted">{listening ? voice.note ?? "Gemini Live" : "Gemini Live"}</span></div>
            </div>

            <div className="panel-sec">
              <div className="panel-label">Needs your OK</div>
              {!j.pending && <div className="panel-none">Nothing waiting</div>}
              {j.pending && (
                <div className="need hot">
                  <div className="small" style={{ fontWeight: 600 }}>{j.pending.summary}</div>
                  <dl>{j.pending.preview.map((p) => <div key={p.label}><dt>{p.label}</dt><dd>{p.value}</dd></div>)}</dl>
                  <div className="lock"><Icon name="audit" size={14} />Signed to this exact content. If anything changes, Jarvis must ask again.</div>
                  <div className="row">
                    <button className="btn sm accent" disabled={j.busy} onClick={() => void j.decide(true)}>Approve</button>
                    <button className="btn sm ghost" disabled={j.busy} onClick={() => void j.decide(false)}>Deny</button>
                    <span className="grow" />
                    {pendingTask && <button className="text-btn" onClick={() => go("task", pendingTask.id)}>Details</button>}
                  </div>
                </div>
              )}
            </div>

            {computerTask?.computer && (
              <div className="panel-sec">
                <div className="panel-label">Jarvis computer<a href="#/computers" className="text-btn">Open</a></div>
                <Browser computer={computerTask.computer} waiting={j.pending?.tool === "book_table"} />
              </div>
            )}

            <div className="panel-sec">
              <div className="panel-label">Recent activity<a href="#/tasks" className="text-btn">All</a></div>
              {recent.length === 0 && <div className="panel-none">No tasks yet</div>}
              {recent.map((t) => (
                <button key={t.id} className="panel-item" onClick={() => go("task", t.id)} title={t.status}>
                  <Icon name={t.status === "done" ? "check" : t.status === "working" || t.status === "waiting" ? "circle" : "x"} size={16} />
                  <span className="grow truncate">{t.request}</span>
                </button>
              ))}
            </div>

            <div className="panel-sec">
              <div className="panel-label">Reminders</div>
              {reminders.length === 0 && <div className="panel-none">None set</div>}
              {reminders.map((r) => (
                <div key={r.id} className="panel-item"><Icon name="clock" size={16} /><span className="grow truncate">{r.text}</span><span className="small muted">{ist(r.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span></div>
              ))}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
