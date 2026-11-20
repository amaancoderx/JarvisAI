"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { JarvisMark } from "./JarvisMark";
import { useJarvis } from "./store";

export type View =
  | "talk" | "today" | "tasks" | "task" | "routines" | "memory" | "inbox"
  | "connections" | "computers" | "device" | "about" | "audit" | "latency" | "settings" | "how";

type Item = readonly [View, string, IconName];
const NAV: readonly Item[] = [["today", "Today", "today"], ["tasks", "Tasks", "tasks"], ["routines", "Routines", "repeat"], ["memory", "Memory", "memory"], ["inbox", "Inbox", "file"]];
const SETUP: readonly Item[] = [["connections", "Connections", "connections"], ["computers", "Computers", "panel"], ["device", "Voice", "device"], ["about", "About you", "user"]];
const RECORDS: readonly Item[] = [["audit", "Audit log", "audit"], ["latency", "Latency", "latency"], ["settings", "Settings", "settings"]];
const BUILD: readonly Item[] = [["how", "How Jarvis works", "bulb"]];
const COLLAPSED = "jarvis.side.collapsed";
const RECENT = 5;

/** Hash routing: #/today, #/task/<id>. Shareable, and the page never reloads. */
export function useRoute(): [View, string | null, (v: View, id?: string) => void] {
  const read = (): [View, string | null] => {
    const parts = (typeof window === "undefined" ? "" : window.location.hash).replace(/^#\/?/, "").split("/");
    const v = (parts[0] || "talk") as View;
    return [v, parts[1] ? decodeURIComponent(parts[1]) : null];
  };
  const [r, setR] = useState<[View, string | null]>(read);
  useEffect(() => {
    const on = () => setR(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = (v: View, id?: string) => { window.location.hash = `/${v}${id ? `/${encodeURIComponent(id)}` : ""}`; };
  return [r[0], r[1], go];
}

export function Shell({ view, go, children }: { view: View; go: (v: View, id?: string) => void; children: ReactNode }) {
  const j = useJarvis();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [all, setAll] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { try { setCollapsed(localStorage.getItem(COLLAPSED) === "1"); } catch { /* open */ } }, []);
  useEffect(() => { setDrawer(false); setMenu(false); }, [view, j.chatId]);
  useEffect(() => {
    if (!menu) return;
    const down = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    window.addEventListener("mousedown", down);
    return () => window.removeEventListener("mousedown", down);
  }, [menu]);
  const fold = () => setCollapsed((c) => { try { localStorage.setItem(COLLAPSED, c ? "0" : "1"); } catch { /* not kept */ } return !c; });

  const waiting = j.pending ? 1 : 0;
  const active = (v: View) => view === v || (v === "tasks" && view === "task");
  const link = ([v, label, icon]: Item) => (
    <a key={v} href={`#/${v}`} className={`side-link ${active(v) ? "active" : ""}`} title={collapsed ? label : undefined}>
      <Icon name={icon} />
      <span className="side-text">{label}</span>
      {v === "today" && waiting > 0 && <span className="side-count">{waiting}</span>}
    </a>
  );
  const group = (label: string, items: readonly Item[]) => (
    <>
      <div className="side-label side-group">{label}</div>
      <nav className="side-nav">{items.map(link)}</nav>
    </>
  );
  const chats = j.chats.filter((c) => c.msgs.length > 0);
  const startChat = () => { j.newChat(); go("talk"); };

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""} ${drawer ? "drawer-open" : ""}`}>
      <header className="mobile-bar">
        <button className="icon-btn" aria-label="Open menu" onClick={() => setDrawer(true)}><Icon name="menu" size={20} /></button>
        <a href="#/talk" className="mobile-brand"><JarvisMark size={24} /><span>Jarvis</span></a>
        <button className="icon-btn" aria-label="New chat" onClick={startChat}><Icon name="plus" size={20} /></button>
      </header>
      <div className="side-scrim" onClick={() => setDrawer(false)} aria-hidden />
      <aside className="side" aria-label="Navigation">
        <div className="side-top">
          <a href="#/talk" className="side-brand" title="Jarvis">
            <JarvisMark size={26} />
            <span className="side-text">Jarvis<small>Google AI edition · Bas Bolo</small></span>
          </a>
          <button className="icon-btn side-fold" onClick={fold} aria-label={collapsed ? "Open sidebar" : "Close sidebar"} title={collapsed ? "Open sidebar" : "Close sidebar"}><Icon name="panel" size={18} /></button>
          <button className="icon-btn side-close" onClick={() => setDrawer(false)} aria-label="Close menu"><Icon name="x" size={18} /></button>
        </div>
        <div className="side-body">
          <nav className="side-nav">
            <button className="side-link side-new" onClick={startChat} title={collapsed ? "New chat" : undefined}>
              <span className="side-new-icon"><Icon name="plus" size={14} /></span>
              <span className="side-text">New chat</span>
            </button>
            {NAV.map(link)}
          </nav>
          <div className="side-recents">
            <div className="side-label">Recents</div>
            {chats.length === 0 && <div className="side-recent faint">Your chats will show here</div>}
            {(all ? chats : chats.slice(0, RECENT)).map((c) => (
              <div key={c.id} className={`side-recent side-chat ${view === "talk" && j.chatId === c.id ? "active" : ""}`} title={c.title}>
                <a href="#/talk" className="truncate grow" onClick={() => j.openChat(c.id)}>{c.title}</a>
                <button className="side-chat-x" aria-label={`Delete chat ${c.title}`} title="Delete chat" onClick={() => { if (window.confirm(`Delete the chat "${c.title}"?`)) j.deleteChat(c.id); }}><Icon name="x" size={14} /></button>
              </div>
            ))}
            {chats.length > RECENT && <button className="side-recent side-more" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${chats.length} chats`}</button>}
          </div>
          {group("Connect", SETUP)}
          {group("Records", RECORDS)}
          {group("Buildathon", BUILD)}
        </div>
        <div className="side-foot" ref={menuRef}>
          {menu && (
            <div className="side-menu" role="menu">
              <div className="side-menu-who truncate">Demo workspace · sample data, nothing leaves it</div>
              <a href="#/about" role="menuitem" className="side-menu-item"><Icon name="user" size={16} />About you</a>
              <a href="#/settings" role="menuitem" className="side-menu-item"><Icon name="settings" size={16} />Settings</a>
              <div className="side-menu-sep" />
              <button role="menuitem" className="side-menu-item" onClick={() => { if (window.confirm("Reset the demo workspace and chats?")) { j.reset(); go("talk"); } }}><Icon name="repeat" size={16} />Reset demo</button>
            </div>
          )}
          <button className={`side-account ${menu ? "on" : ""}`} onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} title={collapsed ? j.ws.owner : undefined}>
            <span className="avatar">{j.ws.owner.slice(0, 1).toUpperCase()}</span>
            <span className="side-text grow truncate">{j.ws.owner} <span className="faint">· demo</span></span>
            <span className="side-text side-account-more"><Icon name="dots" size={16} /></span>
          </button>
        </div>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
