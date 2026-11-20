"use client";
import { useState } from "react";
import { Icon, type IconName } from "./Icon";
import { JarvisMark } from "./JarvisMark";
import { AppIcon } from "./AppIcon";
import { Browser, Rich, StatusChip, StepRow, ago, appOf, ist } from "./bits";
import { useJarvis, type Task } from "./store";
import type { View } from "./Shell";

type Go = (v: View, id?: string) => void;
const Head = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="page-head"><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
);

/* ---------- Today ---------- */
export function TodayPage({ go }: { go: Go }) {
  const j = useJarvis();
  const now = new Date();
  const todayKey = ist(now.toISOString(), { day: "numeric", month: "short" });
  const events = [...j.ws.calendar].sort((a, b) => +new Date(a.start) - +new Date(b.start)).filter((e) => +new Date(e.end) > +now - 3600e3).slice(0, 6);
  const flagged = j.ws.inbox.filter((e) => !e.trusted);
  const unread = j.ws.inbox.filter((e) => !e.read && e.trusted);
  return (
    <div className="page">
      <Head title="Today" sub={`${ist(now.toISOString(), { weekday: "long", day: "numeric", month: "long" })}. What needs you, what's next, and what Jarvis is keeping an eye on.`} />
      <section className="section">
        <div className="section-head"><h2>Needs you</h2><span className="count">{j.pending ? 1 : 0}</span></div>
        {!j.pending ? <div className="empty">Nothing waiting for your OK.</div> : (
          <div className="card attn stack-sm">
            <div className="row"><Icon name="alert" size={16} /><b className="grow">{j.pending.summary}</b><span className="chip warn">Waiting</span></div>
            <pre className="preview">{j.pending.preview.map((p) => `${p.label}: ${p.value}`).join("\n")}</pre>
            <div className="row"><button className="btn sm accent" onClick={() => void j.decide(true)}>Approve</button><button className="btn sm ghost" onClick={() => void j.decide(false)}>Deny</button></div>
          </div>
        )}
      </section>
      <section className="section">
        <div className="section-head"><h2>Coming up</h2><span className="count">{events.length}</span></div>
        <div className="group">
          {events.map((e) => (
            <div key={e.id} className="group-row">
              <span className="tile accent"><Icon name="clock" size={16} /></span>
              <div className="grow"><div className="title">{e.title}</div><div className="desc">{ist(e.start)}{e.with?.length ? ` · with ${e.with.join(", ")}` : ""}</div></div>
              {ist(e.start, { day: "numeric", month: "short" }) === todayKey && <span className="chip run">Today</span>}
            </div>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="section-head"><h2>Inbox</h2><span className="count">{unread.length} unread</span></div>
        <div className="group">
          {unread.slice(0, 3).map((e) => (
            <a key={e.id} href="#/inbox" className="group-row"><span className="tile">{e.from.slice(0, 1)}</span><div className="grow"><div className="title">{e.subject}</div><div className="desc truncate">{e.from} · {e.body}</div></div></a>
          ))}
          {flagged.map((e) => (
            <a key={e.id} href="#/inbox" className="group-row"><span className="tile fail"><Icon name="alert" size={16} /></span><div className="grow"><div className="title">{e.subject}</div><div className="desc">From an untrusted sender. Jarvis treats it as data and never follows instructions inside it.</div></div><span className="chip fail">Flagged</span></a>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="section-head"><h2>Reminders</h2><span className="count">{j.ws.reminders.length}</span></div>
        {j.ws.reminders.length === 0 ? <div className="empty">No reminders. Try: "remind me to call Amma at 7".</div> : (
          <div className="group">{j.ws.reminders.map((r) => <div key={r.id} className="group-row"><span className="tile"><Icon name="bell" size={16} /></span><div className="grow"><div className="title">{r.text}</div><div className="desc">{ist(r.at)}</div></div></div>)}</div>
        )}
      </section>
      <button className="btn ghost" onClick={() => go("talk")}><Icon name="talk" size={16} />Ask Jarvis</button>
    </div>
  );
}

/* ---------- Tasks ---------- */
export function TasksPage({ go }: { go: Go }) {
  const j = useJarvis();
  return (
    <div className="page">
      <Head title="Tasks" sub="Every request becomes a task: the plan, each step, what was checked and what needed your OK." />
      {j.tasks.length === 0 ? <div className="empty">No tasks yet. Ask Jarvis something to start.</div> : (
        <div className="group">
          {j.tasks.map((t) => (
            <button key={t.id} className="group-row" style={{ width: "100%", textAlign: "left" }} onClick={() => go("task", t.id)}>
              <span className={`tile ${t.status === "done" ? "ok" : t.status === "waiting" ? "warn" : t.status === "working" ? "accent" : "fail"}`}><Icon name={t.status === "done" ? "check" : "tasks"} size={16} /></span>
              <div className="grow"><div className="title truncate">{t.request}</div><div className="desc">{ago(t.at)} · {t.steps.length} steps · {(t.totalMs / 1000).toFixed(1)} s{t.voice ? " · by voice" : ""}</div></div>
              <StatusChip status={t.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TaskPage({ id, go }: { id: string | null; go: Go }) {
  const j = useJarvis();
  const t = j.tasks.find((x) => x.id === id);
  if (!t) return <div className="page"><Head title="Task not found" /><button className="btn ghost" onClick={() => go("tasks")}>All tasks</button></div>;
  return (
    <div className="page">
      <div className="row"><button className="text-btn" onClick={() => go("tasks")}>← All tasks</button></div>
      <div className="page-head"><div className="row"><StatusChip status={t.status} />{t.voice && <span className="chip plain">By voice</span>}<span className="small muted">{ist(t.at)}</span></div><h1>{t.request}</h1></div>
      <div className="grid3">
        <div className="card stat"><b>{(t.totalMs / 1000).toFixed(1)} s</b><span>total time</span></div>
        <div className="card stat"><b>{t.modelCalls}</b><span>model calls</span></div>
        <div className="card stat"><b>{t.steps.length}</b><span>steps</span></div>
      </div>
      {t.route && <div className="card tint small">Routed by <b>{t.route.by}</b> as a <b>{t.route.kind}</b>{t.route.skill !== "none" ? <> for <b>{t.route.skill}</b></> : null} in {t.route.ms} ms, then planned by Gemini with function calling.</div>}
      <section className="section">
        <h2>Steps</h2>
        {t.steps.length === 0 ? <div className="empty">No tools needed.</div> : <ol className="progress-steps" style={{ marginLeft: 7 }}>{t.steps.map((s, i) => <StepRow key={i} s={s} />)}</ol>}
      </section>
      {t.computer && <section className="section"><h2>Jarvis computer</h2><div style={{ maxWidth: 420 }}><Browser computer={t.computer} waiting={t.status === "waiting"} /></div></section>}
      <section className="section"><h2>Answer</h2><div className="card"><Rich text={t.reply || "Working on it"} /></div></section>
      {t.sources.length > 0 && <section className="section"><h2>Sources</h2><div className="group">{t.sources.map((s) => <a key={s.uri} className="group-row" href={s.uri} target="_blank" rel="noreferrer"><Icon name="external" size={16} /><span className="grow truncate">{s.title}</span></a>)}</div></section>}
      <section className="section"><h2>Timing</h2>
        <table className="table"><thead><tr><th>Round</th><th className="num">Time</th><th className="num">Model calls</th></tr></thead>
          <tbody>{t.rounds.map((r, i) => <tr key={i}><td>{r.kind === "request" ? "Your request" : "After your decision"}</td><td className="num">{(r.ms / 1000).toFixed(1)} s</td><td className="num">{r.calls}</td></tr>)}</tbody></table>
      </section>
    </div>
  );
}

/* ---------- Routines ---------- */
export function RoutinesPage({ go }: { go: Go }) {
  const j = useJarvis();
  return (
    <div className="page">
      <Head title="Routines" sub="Things Jarvis does for you on a schedule. Run one now to see it work." />
      <div className="group">
        {j.routines.map((r) => (
          <div key={r.id} className="group-row">
            <span className="tile accent"><Icon name="repeat" size={16} /></span>
            <div className="grow"><div className="title">{r.name}</div><div className="desc">{r.when} · "{r.prompt}"</div></div>
            <button className="btn sm ghost" disabled={j.busy} onClick={() => { go("talk"); void j.send(r.prompt); }}>Run now</button>
            <input type="checkbox" className="switch" checked={r.on} onChange={() => j.setRoutines(j.routines.map((x) => (x.id === r.id ? { ...x, on: !x.on } : x)))} aria-label={`${r.name} on or off`} />
          </div>
        ))}
      </div>
      <p className="small muted">Routines run on schedule from Cloud Scheduler. Press Run now to see one work immediately.</p>
    </div>
  );
}

/* ---------- Memory ---------- */
export function MemoryPage() {
  const j = useJarvis();
  const [fact, setFact] = useState("");
  const [p, setP] = useState({ name: "", email: "" });
  return (
    <div className="page">
      <Head title="Memory" sub="What Jarvis knows about you and your people. It uses this to pick the right place, tone and language. You can edit it any time." />
      <section className="section">
        <div className="section-head"><h2>Facts</h2><span className="count">{j.ws.memory.length}</span></div>
        <div className="group">
          {j.ws.memory.map((f, i) => (
            <div key={i} className="group-row"><Icon name="memory" size={16} /><span className="grow">{f}</span>
              <button className="icon-btn" aria-label="Forget" title="Forget" onClick={() => j.updateWs((w) => ({ ...w, memory: w.memory.filter((_, k) => k !== i) }))}><Icon name="x" size={16} /></button></div>
          ))}
        </div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (fact.trim()) { j.updateWs((w) => ({ ...w, memory: [...w.memory, fact.trim()] })); setFact(""); } }}>
          <input className="input" placeholder="Add something Jarvis should remember" value={fact} onChange={(e) => setFact(e.target.value)} />
          <button className="btn" disabled={!fact.trim()}>Remember</button>
        </form>
      </section>
      <section className="section">
        <div className="section-head"><h2>People</h2><span className="count">{j.ws.contacts.length}</span></div>
        <div className="group">
          {j.ws.contacts.map((c) => <div key={c.id} className="group-row"><span className="avatar">{c.name.slice(0, 1)}</span><div className="grow"><div className="title">{c.name}</div><div className="desc">{c.relation}{c.whatsapp ? ` · ${c.whatsapp}` : ""}{c.email ? ` · ${c.email}` : ""}</div></div></div>)}
        </div>
        <form className="row wrap" onSubmit={(e) => { e.preventDefault(); if (!p.name.trim()) return; j.updateWs((w) => ({ ...w, contacts: [...w.contacts, { id: `c_${Date.now()}`, name: p.name.trim(), relation: "added by you", ...(p.email.trim() ? { email: p.email.trim() } : {}) }] })); setP({ name: "", email: "" }); }}>
          <input className="input" style={{ flex: "1 1 140px" }} placeholder="Name" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          <input className="input" style={{ flex: "1 1 200px" }} placeholder="Email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} />
          <button className="btn" disabled={!p.name.trim()}>Add person</button>
        </form>
        <p className="small muted">Only these people, or someone you name yourself, can receive a message. Recipients found inside emails or web pages are blocked in code.</p>
      </section>
    </div>
  );
}

/* ---------- Inbox ---------- */
export function InboxPage({ go }: { go: Go }) {
  const j = useJarvis();
  return (
    <div className="page">
      <Head title="Inbox" sub={j.space === "google" ? "Your Gmail, as Jarvis last read it. Ask Jarvis to go through it; anything that tries to give Jarvis orders gets quarantined." : "The sample inbox. One email is a phishing attempt that tries to give Jarvis orders; watch it get quarantined."} />
      <div className="stack">
        {j.ws.inbox.map((e) => (
          <div key={e.id} className={`card mail ${e.trusted ? "" : "untrusted"}`}>
            <div className="from"><b>{e.from}</b><span className="small faint">{e.fromEmail}</span><span className="grow" /><span className="small faint">{ist(e.time)}</span></div>
            <div className="subj">{e.subject}</div>
            <div className="small muted">{e.body}</div>
            {!e.trusted && <div className="flag"><Icon name="alert" size={14} />Untrusted sender. Treated as data, never as instructions.</div>}
          </div>
        ))}
      </div>
      <button className="btn accent" disabled={j.busy} onClick={() => { go("talk"); void j.send("Go through my inbox and handle anything urgent."); }}><Icon name="talk" size={16} />Ask Jarvis to handle the inbox</button>
      {j.ws.sent.length > 0 && (
        <section className="section"><div className="section-head"><h2>Sent by Jarvis</h2><span className="count">{j.ws.sent.length}</span></div>
          <div className="group">{j.ws.sent.map((s) => <div key={s.id} className="group-row"><span className="tile ok"><Icon name={s.channel === "email" ? "send" : "talk"} size={16} /></span><div className="grow"><div className="title">{s.channel === "email" ? "Email" : "WhatsApp"} to {s.to}</div><div className="desc">{s.subject ? `${s.subject} · ` : ""}{s.text}</div></div><span className="small faint">{ago(s.at)}</span></div>)}</div>
        </section>
      )}
    </div>
  );
}

/* ---------- Connections ---------- */
const ACTIONS: Record<string, [string, string][]> = {
  gmail: [["read_inbox", "Read and triage email"], ["send_email", "Send email (asks first)"]],
  calendar: [["list_events", "Read calendar"], ["create_event", "Create and move events"]],
  whatsapp: [["send_whatsapp", "Send messages (asks first)"]],
  computer: [["book_table", "Fill forms and book (asks before submit)"]],
  search: [["search_web", "Search the live web"]],
  reminders: [["set_reminder", "Set reminders"], ["remember", "Save to memory"]],
};
function ActionSwitches({ app }: { app: string }) {
  const j = useJarvis();
  const off = new Set(j.ws.disabled ?? []);
  const toggle = (tool: string) => j.updateWs((w) => { const d = new Set(w.disabled ?? []); if (d.has(tool)) d.delete(tool); else d.add(tool); return { ...w, disabled: [...d] }; });
  return (
    <>
      {(ACTIONS[app] ?? []).map(([tool, label]) => (
        <label key={tool} className="group-row" style={{ minHeight: 46, paddingLeft: 64 }}>
          <div className="grow"><span className="title">{label}</span> <span className="mono faint">{tool}</span></div>
          <input type="checkbox" className="switch" checked={!off.has(tool)} onChange={() => toggle(tool)} />
        </label>
      ))}
    </>
  );
}
function AppRow({ app, title, desc, right }: { app: string; title: string; desc: string; right: React.ReactNode }) {
  return (
    <div className="group-row">
      <span className="tile brand"><AppIcon app={app} /></span>
      <div className="grow"><div className="title">{title}</div><div className="desc truncate">{desc}</div></div>
      {right}
    </div>
  );
}
export function ConnectionsPage() {
  const j = useJarvis();
  const [busy, setBusy] = useState<string | null>(null);
  const google = j.space === "google";
  const run = async (app: "gmail" | "calendar", f: () => Promise<void>) => { setBusy(app); try { await f(); } finally { setBusy(null); } };
  const googleApps = [
    { id: "gmail" as const, title: "Gmail", what: "Read, triage and reply to your email.", on: j.live.gmail },
    { id: "calendar" as const, title: "Google Calendar", what: "Check, create and move your events.", on: j.live.calendar },
  ];
  const connected = googleApps.filter((a) => a.on);
  const open = googleApps.filter((a) => !a.on);
  return (
    <div className="page">
      <Head title="Connections" sub="The apps Jarvis can use for you. Every action has its own switch, and switching one off is enforced in code at once." />

      <div className="card tint row" style={{ gap: 12 }}>
        <span className="tile brand"><AppIcon app={google ? "gmail" : "computer"} /></span>
        <div className="grow"><div style={{ fontWeight: 600 }}>{google ? "Working in your Google account" : "Working in a sample workspace"}</div><div className="small muted">{google ? `Jarvis reads and acts on ${j.live.email ?? "your account"}. Every send still waits for your OK.` : "A sample inbox, calendar and people, so you can try sends safely. The AI, search and voice are real."}</div></div>
        <div className="seg">
          <button className={google ? "on" : ""} onClick={() => (j.live.gmail || j.live.calendar ? j.setSpace("google") : void j.connect("gmail"))}>Your Google</button>
          <button className={!google ? "on" : ""} onClick={() => j.setSpace("sample")}>Sample</button>
        </div>
      </div>

      <section className="section">
        <div className="section-head"><h2>Connected</h2><span className="count">{connected.length + 2}</span></div>
        <div className="group">
          <AppRow app="search" title="Google Search" desc="Live, cited answers through Gemini grounding on Vertex AI." right={<span className="chip done">Built in</span>} />
          <ActionSwitches app="search" />
        </div>
        <div className="group">
          <AppRow app="reminders" title="Reminders and memory" desc="Remembers people and reminds you on time." right={<span className="chip done">Built in</span>} />
          <ActionSwitches app="reminders" />
        </div>
        {connected.map((a) => (
          <div key={a.id} className="group">
            <AppRow app={a.id} title={a.title} desc={j.live.email ?? "Your Google account"} right={<><span className="chip done">Connected</span><button className="btn sm ghost" disabled={busy !== null} onClick={() => void run(a.id, () => j.disconnect(a.id))}>Disconnect</button></>} />
            <ActionSwitches app={a.id} />
          </div>
        ))}
      </section>

      {open.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Connect an app</h2></div>
          <p className="section-note">One click opens Google's own sign-in in a small window. Jarvis never sees your password, tokens stay on the server, and nothing is sent in your name without your OK.</p>
          <div className="group">
            {open.map((a) => (
              <AppRow key={a.id} app={a.id} title={a.title} desc={j.live.available ? a.what : "Sign-in is not set up on this server yet."}
                right={<button className="btn sm" disabled={!j.live.available || busy !== null} onClick={() => void run(a.id, () => j.connect(a.id))}>{busy === a.id ? "Waiting for sign-in" : "Connect"}</button>} />
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head"><h2>In preview</h2></div>
        <p className="section-note">Jarvis plans these fully and shows you the exact message or form, then records the result here. Live sending switches on once each provider's access is approved.</p>
        <div className="group">
          <AppRow app="whatsapp" title="WhatsApp" desc="Message your people in their own language." right={<span className="chip plain">Preview</span>} />
          <ActionSwitches app="whatsapp" />
        </div>
        <div className="group">
          <AppRow app="computer" title="Jarvis computer" desc="Finds the place, fills the booking form, stops before submit." right={<span className="chip plain">Preview</span>} />
          <ActionSwitches app="computer" />
        </div>
      </section>
    </div>
  );
}

/* ---------- Computers ---------- */
export function ComputersPage() {
  const j = useJarvis();
  const t = j.tasks.find((x) => x.computer);
  return (
    <div className="page">
      <Head title="Computers" sub="Jarvis has its own computer in the cloud. It opens websites, fills forms and books things the way a person would, and stops before it submits." />
      <div className="computer-grid">
        <div className="card computer-card">
          <div className="row"><span className="tile accent"><Icon name="panel" size={16} /></span><b className="grow">Jarvis computer</b><span className="chip done">Ready</span></div>
          <p className="computer-what">An isolated browser that runs one task at a time.</p>
          <ul className="computer-can"><li>Finds the place with Google Search</li><li>Fills the booking form for you</li><li>Pauses for your OK before submit</li><li>Logs every action it takes</li></ul>
        </div>
        <div className="card computer-card">
          <b>Last screen</b>
          {t?.computer ? <Browser computer={t.computer} waiting={j.pending?.tool === "book_table"} /> : <div className="screen-frame screen-empty small muted">No booking yet. Try "book a table for 4 tonight".</div>}
        </div>
      </div>
      {j.ws.bookings.length > 0 && <section className="section"><h2>Bookings</h2><div className="group">{j.ws.bookings.map((b) => <div key={b.id} className="group-row"><span className="tile ok"><Icon name="check" size={16} /></span><div className="grow"><div className="title">{b.place}</div><div className="desc">{b.when} · {b.people} people · {b.area}</div></div></div>)}</div></section>}
    </div>
  );
}

/* ---------- Voice ---------- */
export function DevicePage({ go }: { go: Go }) {
  const j = useJarvis();
  return (
    <div className="page">
      <Head title="Voice" sub="Jarvis listens and speaks through Gemini Live: real-time, interruptible voice in Indian languages." />
      <div className="card device-card stack">
        <div className="device-now listening"><span className="device-dot" /><div><b>This browser</b><div className="small muted">Gemini Live · gemini-3.8-live, native audio</div></div></div>
        <div className="small muted">Your browser gets a short-lived, single-use token from our server, so our API key never reaches the browser. If Gemini Live is unavailable, Jarvis falls back to the browser's own speech.</div>
        <div className="row"><span className="small">Language</span>
          <div className="seg">{([["en", "English"], ["hi", "हिंदी"], ["te", "తెలుగు"]] as const).map(([k, l]) => <button key={k} className={j.lang === k ? "on" : ""} onClick={() => j.setLang(k)}>{l}</button>)}</div>
        </div>
        <div><button className="btn accent" onClick={() => go("talk")}><Icon name="mic" size={16} />Open chat and press the mic</button></div>
      </div>
      <section className="section"><h2>Things to say</h2>
        <div className="group">
          {["Ravi ke saath kal raat 8 baje dinner book karo", "Move my Q4 review to Monday at 4 and tell Priya", "రేపు ఉదయం 9 కి జిమ్ గుర్తు చేయి", "Haan, bhej do (to approve what is waiting)"].map((s) => <div key={s} className="group-row"><Icon name="mic" size={16} /><span className="grow">{s}</span></div>)}
        </div>
      </section>
    </div>
  );
}

/* ---------- About you ---------- */
export function AboutPage() {
  const j = useJarvis();
  const p = j.ws.profile ?? { city: "", languages: "", notes: "" };
  const set = (k: "owner" | "city" | "languages" | "notes", v: string) => j.updateWs((w) => (k === "owner" ? { ...w, owner: v } : { ...w, profile: { ...(w.profile ?? p), [k]: v } }));
  return (
    <div className="page">
      <Head title="About you" sub="Jarvis uses this in every task, so replies sound like you and fit your day." />
      <div className="card stack profile-form">
        <label className="profile-field">Name<input value={j.ws.owner} onChange={(e) => set("owner", e.target.value)} /></label>
        <label className="profile-field">City<input value={p.city} onChange={(e) => set("city", e.target.value)} /></label>
        <label className="profile-field">Languages you speak<input value={p.languages} onChange={(e) => set("languages", e.target.value)} /></label>
        <label className="profile-field">Anything Jarvis should know<textarea rows={3} value={p.notes} onChange={(e) => set("notes", e.target.value)} /></label>
      </div>
    </div>
  );
}

/* ---------- Audit ---------- */
export function AuditPage() {
  const j = useJarvis();
  const tone: Record<string, string> = { allowed: "done", approved: "done", asked: "warn", denied: "fail", blocked: "fail" };
  return (
    <div className="page wide">
      <Head title="Audit log" sub="Everything Jarvis did or refused, with the risk tier and the reason. Code decides; this is the proof." />
      {j.ws.audit.length === 0 ? <div className="empty">Nothing yet. Every action, approval and block will show here.</div> : (
        <table className="table">
          <thead><tr><th>When</th><th>Action</th><th>Tier</th><th>Outcome</th><th>Detail</th></tr></thead>
          <tbody>{j.ws.audit.map((a) => <tr key={a.id}><td className="small">{ist(a.at, { hour: "numeric", minute: "2-digit", second: "2-digit" })}</td><td>{a.tool === "prompt_injection" ? "Prompt injection" : appOf(a.tool)}</td><td className="small muted">{a.tier}</td><td><span className={`chip ${tone[a.outcome]}`}>{a.outcome}</span></td><td className="small">{a.detail}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

/* ---------- Latency ---------- */
export function LatencyPage({ go }: { go: Go }) {
  const j = useJarvis();
  const done = j.tasks.filter((t) => t.rounds.length);
  const first = done.map((t) => t.rounds[0].ms).sort((a, b) => a - b);
  const approvals = done.flatMap((t) => t.rounds.filter((r) => r.kind === "approval").map((r) => r.ms)).sort((a, b) => a - b);
  const med = (a: number[]) => (a.length ? `${(a[Math.floor(a.length / 2)] / 1000).toFixed(1)} s` : "—");
  return (
    <div className="page wide">
      <Head title="Latency" sub="How long each task took in this browser, measured end to end on the live deployment." />
      <div className="grid3">
        <div className="card stat"><b>{med(first)}</b><span>median, first answer</span></div>
        <div className="card stat"><b>{med(approvals)}</b><span>median, after you approve</span></div>
        <div className="card stat"><b>{done.length}</b><span>tasks measured</span></div>
      </div>
      {done.length === 0 ? <div className="empty">Run a few tasks and their timing shows here.</div> : (
        <table className="table">
          <thead><tr><th>Task</th><th>Router</th><th className="num">First answer</th><th className="num">Total</th><th className="num">Model calls</th></tr></thead>
          <tbody>{done.map((t) => <tr key={t.id} style={{ cursor: "pointer" }} onClick={() => go("task", t.id)}><td className="truncate" style={{ maxWidth: 360 }}>{t.request}</td><td className="small muted">{t.route?.by ?? "-"}</td><td className="num">{(t.rounds[0].ms / 1000).toFixed(1)} s</td><td className="num">{(t.totalMs / 1000).toFixed(1)} s</td><td className="num">{t.modelCalls}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

/* ---------- Settings ---------- */
export function SettingsPage() {
  const j = useJarvis();
  const [theme, setTheme] = useState<string>(() => { try { return localStorage.getItem("jarvis.theme") || "light"; } catch { return "light"; } });
  const pick = (t: string) => { setTheme(t); document.documentElement.dataset.theme = t; try { localStorage.setItem("jarvis.theme", t); } catch { /* not kept */ } };
  return (
    <div className="page">
      <Head title="Settings" />
      <div className="group">
        <label className="group-row"><div className="grow"><div className="title">Pause all actions</div><div className="desc">Stops every send and booking at once. Reading still works.</div></div><input type="checkbox" className="switch" checked={j.ws.paused} onChange={() => j.updateWs((w) => ({ ...w, paused: !w.paused }))} /></label>
        <div className="group-row"><div className="grow"><div className="title">Appearance</div></div><div className="seg">{["light", "dark", "system"].map((t) => <button key={t} className={theme === t ? "on" : ""} onClick={() => pick(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div></div>
        <div className="group-row"><div className="grow"><div className="title">Reset workspace</div><div className="desc">Clears chats and restores the sample inbox, calendar and people, and clears chats.</div></div><button className="btn sm danger" onClick={() => { if (window.confirm("Reset everything?")) j.reset(); }}>Reset</button></div>
      </div>
    </div>
  );
}

/* ---------- How it works ---------- */
export function HowPage({ go }: { go: Go }) {
  return (
    <div className="page wide">
      <div className="page-head">
        <div className="row"><JarvisMark size={36} /><span className="chip google">Startup Buildathon India 2026 · Google DeepMind × Google Cloud</span></div>
        <h1>How Jarvis works</h1>
        <p>Jarvis is a voice-first AI agent for India, built by team Bas Bolo in Hyderabad. You say what you need in English, Hindi or Telugu; Jarvis plans it, does it across email, calendar, WhatsApp and the web, and asks before anything goes out.</p>
      </div>
      <section className="section"><h2>From one sentence to a finished task</h2><div className="figure"><img src="/flow.png" alt="Process flow" /></div></section>
      <section className="section"><h2>Architecture</h2><div className="figure"><img src="/architecture.png" alt="Architecture" /></div></section>
      <section className="section"><h2>Google AI inside</h2>
        <div className="grid2">
          {[
            ["Gemini Live", "Real-time, interruptible voice. The browser connects with a short-lived token minted by our server."],
            ["Gemini API", "The planner: breaks a request into tool calls with function calling, then checks each result."],
            ["Gemma", "Routes every request first: question or task, and which skill, before the bigger model runs."],
            ["Google Search grounding", "Live, cited answers for places, news and prices. It is how Jarvis picks a real restaurant."],
            ["Google AI Studio", "Where we test prompts and tool schemas and manage keys."],
            ["Google Cloud", "Stateless service in a Docker image built for Cloud Run in Mumbai; Cloud SQL, Pub/Sub and Scheduler next."],
          ].map(([t, d]) => <div key={t} className="card"><b>{t}</b><div className="small muted" style={{ marginTop: 4 }}>{d}</div></div>)}
        </div>
      </section>
      <section className="section"><h2>Why you can trust it</h2>
        <div className="group">
          {[
            ["Code decides, not the model", "Every action has a fixed risk tier: read, easy to undo, or external."],
            ["Signed approvals", "An approval is HMAC-signed to the exact recipient and content. Change one word and it must ask again."],
            ["Prompt-injection shield", "Instructions hidden in emails or web pages are quarantined; they can never start an action or pick a recipient."],
            ["Never twice", "Each action runs once, even if retried. Everything lands in the audit log."],
            ["One switch", "Pause stops every send and booking. Any action can be switched off in Connections."],
          ].map(([t, d]) => <div key={t} className="group-row"><span className="tile ok"><Icon name="audit" size={16} /></span><div className="grow"><div className="title">{t}</div><div className="desc">{d}</div></div></div>)}
        </div>
      </section>
      <div className="row wrap">
        <button className="btn accent" onClick={() => go("talk")}><Icon name="talk" size={16} />Try it now</button>
        <a className="btn ghost" href="https://github.com/amaancoderx/JarvisAI" target="_blank" rel="noreferrer"><Icon name="external" size={16} />Code on GitHub</a>
        <a className="btn ghost" href="#/audit">See the audit log</a>
      </div>
    </div>
  );
}

export type { Task };
