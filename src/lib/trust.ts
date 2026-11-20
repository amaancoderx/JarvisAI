import { createHmac, timingSafeEqual } from "node:crypto";
import type { Tier, Workspace } from "./types";

/** Risk tier of every tool, fixed in code. The model cannot change these. */
export const TIERS: Record<string, Tier> = {
  read_inbox: "read",
  read_email: "read",
  list_events: "read",
  search_web: "read",
  recall_memory: "read",
  remember: "reversible",
  set_reminder: "reversible",
  create_event: "reversible",
  send_email: "external",
  send_whatsapp: "external",
  book_table: "external",
};

export type Decision =
  | { outcome: "allow" }
  | { outcome: "ask" }
  | { outcome: "deny"; reason: string };

const secret = () => process.env.APPROVAL_SECRET || process.env.GEMINI_API_KEY || "jarvis-dev-secret";

/** Canonical JSON: sorted keys, so the same action always gives the same bytes. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
}

/** Signs one exact action. Any change to the tool or its arguments breaks the signature. */
export function sign(id: string, tool: string, args: unknown): string {
  return createHmac("sha256", secret()).update(`jarvis-approval-v1|${id}|${tool}|${canonical(args)}`).digest("hex");
}

export function verify(id: string, tool: string, args: unknown, sig: string): boolean {
  const want = Buffer.from(sign(id, tool, args), "hex");
  const got = Buffer.from(sig || "", "hex");
  return want.length === got.length && timingSafeEqual(want, got);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9@.+]/g, "");

/**
 * Is this recipient someone the user knows or named themselves?
 * Text that came from an email or a web page has no authority to pick a recipient.
 */
function recipientAllowed(recipient: string, ws: Workspace, userText: string): boolean {
  const r = norm(recipient);
  if (!r) return false;
  const known = ws.contacts.some((c) =>
    [c.name, c.email, c.whatsapp].filter(Boolean).some((v) => {
      const n = norm(String(v));
      return n === r || n.includes(r) || r.includes(n.split("@")[0]);
    }),
  );
  if (known) return true;
  return norm(userText).includes(r);
}

/** Deterministic permission check. Code decides, not the model. */
export function decide(tool: string, args: Record<string, unknown>, ws: Workspace, userText: string): Decision {
  const tier = TIERS[tool];
  if (!tier) return { outcome: "deny", reason: "unknown action" };
  if (ws.disabled?.includes(tool)) return { outcome: "deny", reason: "you switched this action off in Connections" };
  if (tier === "read") return { outcome: "allow" };
  if (ws.paused) return { outcome: "deny", reason: "all actions are paused" };
  if (tier === "reversible") return { outcome: "allow" };

  const recipient = String(args.to ?? args.contact ?? "");
  if ((tool === "send_email" || tool === "send_whatsapp") && !recipientAllowed(recipient, ws, userText)) {
    return { outcome: "deny", reason: `"${recipient}" is not one of your contacts and you did not name them. Recipients that come from emails or web pages are blocked.` };
  }
  return { outcome: "ask" };
}
