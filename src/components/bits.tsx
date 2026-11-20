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

/** Plain reply text with **bold**, line breaks and links. */
export function Rich({ text }: { text: string }) {
  return (
    <div className="rich">
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>
          {para.split("\n").map((line, k) => (
            <Fragment key={k}>
              {k > 0 && <br />}
              {line.split(/(\*\*[^*]+\*\*)/).map((part, n) => (part.startsWith("**") && part.endsWith("**") ? <strong key={n}>{part.slice(2, -2)}</strong> : <Fragment key={n}>{part}</Fragment>))}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
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
  set_reminder: "Reminders", safety: "Trust layer",
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
      <div className="browser-body">
        <b>Reserve a table</b>
        {computer.fields.map((f) => <label key={f.label}>{f.label}<input readOnly value={f.value} /></label>)}
        <div className={`browser-status ${waiting ? "wait" : "ok"}`}>{computer.status}</div>
      </div>
    </div>
  );
}
