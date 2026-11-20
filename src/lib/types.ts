export type Lang = "en" | "hi" | "te";

export interface Contact { id: string; name: string; relation: string; email?: string; whatsapp?: string }
export interface Email { id: string; from: string; fromEmail: string; subject: string; body: string; time: string; trusted: boolean; read?: boolean }
export interface CalEvent { id: string; title: string; start: string; end: string; with?: string[] }
export interface Reminder { id: string; text: string; at: string }
export interface Sent { id: string; channel: "email" | "whatsapp"; to: string; subject?: string; text: string; at: string }
export interface Booking { id: string; place: string; area: string; when: string; people: number; at: string }
export interface AuditEntry { id: string; at: string; tool: string; tier: Tier; outcome: "allowed" | "asked" | "approved" | "denied" | "blocked"; detail: string }

export interface Workspace {
  owner: string;
  contacts: Contact[];
  inbox: Email[];
  calendar: CalEvent[];
  memory: string[];
  reminders: Reminder[];
  sent: Sent[];
  bookings: Booking[];
  audit: AuditEntry[];
  executed: string[];
  paused: boolean;
  /** Actions the owner switched off on the Connections page. Enforced in code. */
  disabled?: string[];
  profile?: { city: string; languages: string; notes: string };
}

export type Tier = "read" | "reversible" | "external";

export interface Step { tool: string; label: string; status: "done" | "waiting" | "blocked" | "error"; detail?: string; tier: Tier }

export interface Pending {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  preview: { label: string; value: string }[];
  sig: string;
  callId?: string;
  /** Responses to other calls in the same model turn, sent back together after the decision. */
  stash: unknown[];
}

export interface Source { title: string; uri: string }

export interface AgentResult {
  reply: string;
  steps: Step[];
  pending: Pending | null;
  sources: Source[];
  route: { kind: "chat" | "task"; skill: string; by: string; ms: number };
  history: unknown[];
  workspace: Workspace;
  computer?: { url: string; fields: { label: string; value: string }[]; status: string } | null;
  timings: { totalMs: number; modelCalls: number };
}
