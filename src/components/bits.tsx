"use client";
import { Fragment, useState } from "react";
import { Icon } from "./Icon";
import type { Task } from "./store";
import type { Step } from "@/lib/types";

export const ist = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) => {
  const d = new Date(iso);
  return isNaN(+d) ? iso : d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ...opts });
};
export const ago = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - +new Date(iso)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return ist(iso, { day: "numeric", month: "short" });
};

/** Inline Markdown: **bold**, *italic*, `code` and [links](https://...). */
function inline(text: string, key = 0): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${n++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) {
      const mm = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      out.push(<a key={k} href={mm[2]} target="_blank" rel="noreferrer">{mm[1]}</a>);
    } else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.map((x) => (typeof x === "string" ? x.replace(/\\([*_#|])/g, "$1") : x));
}

/** Jarvis's answers as clean reading text: headings, lists, tables, bold and links. */
export function Rich({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let b = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { blocks.push(h[1].length <= 2 ? <h3 key={b++}>{inline(h[2], b)}</h3> : <h4 key={b++}>{inline(h[2], b)}</h4>); i++; continue; }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { blocks.push(<hr key={b++} />); i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={b++} className="rich-table"><table><thead><tr>{head.map((c, k) => <th key={k}>{inline(c, k)}</th>)}</tr></thead>
          <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, k) => <td key={k}>{inline(c, k)}</td>)}</tr>)}</tbody></table></div>,
      );
      continue;
    }
    if (/^\s*([-*•])\s+/.test(line)) {
      const items: [number, string][] = [];
      while (i < lines.length && /^\s*([-*•])\s+/.test(lines[i])) { const l = lines[i++]; items.push([l.length - l.trimStart().length, l.replace(/^\s*([-*•])\s+/, "")]); }
      const base = Math.min(...items.map(([d]) => d));
      blocks.push(<ul key={b++}>{items.map(([d, t], k) => <li key={k} className={d > base ? "sub" : undefined}>{inline(t, k)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      blocks.push(<ol key={b++}>{items.map((t, k) => <li key={k}>{inline(t, k)}</li>)}</ol>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*[-*•]\s|\s*\d+[.)]\s|\s*\|)/.test(lines[i])) para.push(lines[i++]);
    if (para.length === 0) { para.push(lines[i++]); }
    blocks.push(<p key={b++}>{para.map((p, k) => <Fragment key={k}>{k > 0 && <br />}{inline(p, k)}</Fragment>)}</p>);
  }
  return <div className="rich">{blocks}</div>;
}

const STATUS: Record<Task["status"], [string, string]> = {
  working: ["Working", "run"], waiting: ["Needs your OK", "warn"], done: ["Done", "done"], blocked: ["Blocked", "fail"], failed: ["Failed", "fail"],
};
export function StatusChip({ status }: { status: Task["status"] }) {
  const [label, tone] = STATUS[status];
  return <span className={`chip ${tone}`}>{label}</span>;
}

const APP: Record<string, string> = {
  read_inbox: "Gmail", read_email: "Gmail", send_email: "Gmail", list_events: "Calendar", create_event: "Calendar",
  send_whatsapp: "WhatsApp", search_web: "Google Search", book_table: "Jarvis computer", remember: "Memory", recall_memory: "Memory",
  set_reminder: "Reminders", safety: "Trust layer", use_computer: "Jarvis Cloud Computer", open_website: "Jarvis Cloud Computer",
  open_in_browser: "Your browser", search_email: "Gmail", draft_email: "Gmail", check_availability: "Calendar", update_event: "Calendar",
  cancel_event: "Calendar", save_document: "Google Drive", share_file: "Google Drive", search_drive: "Google Drive", read_drive_file: "Google Drive",
};
export const appOf = (tool: string) => APP[tool] ?? tool;

/** What Jarvis did, step by step, under its task. Open while working; one line once it is over. */
export function TaskProgress({ task }: { task: Task }) {
  const working = task.status === "working";
  const [open, setOpen] = useState<boolean | null>(null);
  const shown = open ?? (working || task.status === "waiting");
  const done = task.steps.filter((s) => s.status === "done").length;
  const secs = Math.max(1, Math.round(task.totalMs / 1000));
  if (!working && task.steps.length === 0) return null;
  return (
    <div className={`progress ${working ? "live" : ""}`}>
      <button className="progress-head" onClick={() => setOpen(!shown)} aria-expanded={shown}>
        {task.status === "waiting" ? <Icon name="alert" size={14} /> : working ? <span className="spinner" aria-hidden /> : task.status === "done" ? <Icon name="check" size={14} /> : <Icon name="x" size={14} />}
        <span className="grow">
          {task.status === "waiting" ? "Waiting for your OK" : working ? (task.steps.length ? "Working on the next step" : "Thinking about how to do this") : `${done} step${done === 1 ? "" : "s"} in ${secs}s · ${task.modelCalls} model calls`}
        </span>
        {task.steps.length > 0 && <Icon name="chevron" size={14} />}
      </button>
      {shown && task.steps.length > 0 && (
        <ol className="progress-steps">
          {task.steps.map((s, i) => <StepRow key={i} s={s} />)}
          {working && <li className="progress-step running"><span className="progress-mark"><span className="spinner" /></span><span className="grow"><span className="progress-title muted">Working</span></span></li>}
        </ol>
      )}
    </div>
  );
}

export function StepRow({ s }: { s: Step }) {
  const cls = s.status === "done" ? "done" : s.status === "waiting" ? "pending" : "failed";
  return (
    <li className={`progress-step ${cls}`}>
      <span className="progress-mark" aria-hidden>
        {s.status === "done" ? <Icon name="check" size={12} /> : s.status === "waiting" ? <Icon name="clock" size={12} /> : <Icon name="x" size={12} />}
      </span>
      <span className="grow">
        <span className="progress-title">{s.label}</span>
        <span className="progress-tool">{appOf(s.tool)} · {s.tier === "read" ? "read only" : s.tier === "reversible" ? "easy to undo" : "needs approval"}</span>
        {s.detail && <span className="progress-found">{s.detail}</span>}
      </span>
    </li>
  );
}

export function Browser({ computer, waiting }: { computer: NonNullable<Task["computer"]>; waiting: boolean }) {
  return (
    <div className="browser">
      <div className="browser-bar"><i /><i /><i /><span className="browser-url">{computer.url}</span></div>
      {computer.image && <img className="browser-shot" src={computer.image} alt={computer.title || "Jarvis computer screen"} />}
      <div className="browser-body">
        {computer.fields.length > 0 && <b>Reserve a table</b>}
        {computer.fields.map((f) => <label key={f.label}>{f.label}<input readOnly value={f.value} /></label>)}
        <div className={`browser-status ${waiting ? "wait" : "ok"}`}>{computer.status}</div>
      </div>
    </div>
  );
}

export interface LiveComputer { url: string; title: string; image: string; goal: string; log: { at: string; label?: string; action: string; note: string }[] }

/** The Jarvis Cloud Computer, live inside the chat while it works. */
export function LiveScreen({ live }: { live: LiveComputer }) {
  const acts = live.log.filter((l) => l.label);
  return (
    <div className="live-screen">
      <div className="live-head"><span className="live-dot" aria-hidden /><b>Jarvis Cloud Computer</b><span className="small muted grow truncate">{live.goal}</span><span className="chip run">Live</span></div>
      {live.image && (
        <div className="browser">
          <div className="browser-bar"><i /><i /><i /><span className="browser-url">{live.url}</span></div>
          <img className="browser-shot" src={live.image} alt={live.title || "Jarvis Cloud Computer, live"} />
        </div>
      )}
      <ol className="progress-steps">
        {acts.slice(-5).map((l, i) => (
          <li key={l.at + i} className="progress-step done"><span className="progress-mark"><Icon name="check" size={12} /></span><span className="grow"><span className="progress-title">{l.label}</span><span className="progress-found">{l.note}</span></span></li>
        ))}
        <li className="progress-step running"><span className="progress-mark"><span className="spinner" /></span><span className="grow"><span className="progress-title muted">{acts.length ? "Looking at the screen for the next step" : "Opening its browser"}</span></span></li>
      </ol>
    </div>
  );
}
