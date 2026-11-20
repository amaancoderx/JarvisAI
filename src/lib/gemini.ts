import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import type { Source } from "./types";

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Models tried in order when the first choice is busy, so the demo link never just fails. */
function chain(primary: string): string[] {
  const extra = (process.env.FALLBACK_MODELS || "gemini-flash-lite-latest,gemini-3.5-flash-lite,gemini-3.1-flash-lite").split(",").map((s) => s.trim()).filter(Boolean);
  return [...new Set([primary, ...extra])];
}

/** One model, one call, with a quick retry for busy errors and a fix-up for thought signatures from another model. */
async function attempt(model: string, req: Omit<GenerateContentParameters, "model">): Promise<GenerateContentResponse> {
  let body = { ...req, model, config: { ...req.config, ...speed(model), httpOptions: { timeout: Number(process.env.MODEL_TIMEOUT_MS || 25000) } } } as GenerateContentParameters;
  let last: unknown;
  for (let i = 0; i < 2; i++) {
    try {
      return await ai().models.generateContent(body);
    } catch (e) {
      last = e;
      const status = (e as { status?: number }).status ?? 0;
      const msg = String((e as Error).message || "");
      // A conversation started on another model carries its thought signatures; tell this model to accept them.
      if (status === 400 && /signature/i.test(msg) && i === 0) { body = { ...body, contents: resign(body.contents) as GenerateContentParameters["contents"] }; continue; }
      if (!RETRYABLE.has(status) || i === 1) throw e;
      // Per-minute limits clear quickly; a daily limit will not, so skip the wait for those.
      if (status === 429 && /per day|daily/i.test(msg)) throw e;
      await sleep(status === 429 ? 2500 : 500);
    }
  }
  throw last;
}

/**
 * Hedged generateContent. Starts the first model; if it has not answered within HEDGE_MS, starts the next one
 * in parallel, and so on. The first good answer wins. Keeps the demo fast even when one model is overloaded.
 */
export function generate(primary: string, req: Omit<GenerateContentParameters, "model">): Promise<{ res: GenerateContentResponse; model: string }> {
  const models = chain(primary).slice(0, 3);
  const hedge = Number(process.env.HEDGE_MS || 7000);
  return new Promise((resolve, reject) => {
    let done = false;
    let started = 0;
    let failed = 0;
    let lastErr: unknown;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const launch = () => {
      if (done || started >= models.length) return;
      const model = models[started++];
      attempt(model, req).then(
        (res) => { if (!done) { done = true; timers.forEach(clearTimeout); resolve({ res, model }); } },
        (e) => {
          lastErr = e;
          failed++;
          if (done) return;
          if (failed >= models.length) { done = true; timers.forEach(clearTimeout); reject(lastErr); }
          else launch();
        },
      );
    };
    launch();
    for (let k = 1; k < models.length; k++) timers.push(setTimeout(launch, hedge * k));
  });
}

/** Fast settings: little thinking, because spoken replies must come quickly. */
function speed(model: string): Record<string, unknown> {
  if (model.startsWith("gemma")) return {};
  if (/gemini-(3|flash-latest|pro-latest)/.test(model)) return { thinkingConfig: { thinkingLevel: "low" } };
  return { thinkingConfig: { thinkingBudget: 0 } };
}

function resign(contents: unknown): unknown {
  if (!Array.isArray(contents)) return contents;
  return contents.map((c) => ({
    ...c,
    parts: (c.parts ?? []).map((p: Record<string, unknown>) => (p.functionCall ? { ...p, thoughtSignature: "skip_thought_signature_validator" } : p)),
  }));
}

let client: GoogleGenAI | null = null;
export function ai(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export const MODELS = {
  planner: () => process.env.PLANNER_MODEL || "gemini-3.1-flash-lite",
  router: () => process.env.ROUTER_MODEL || "gemma-4-26b-a4b-it",
  live: () => process.env.LIVE_MODEL || "gemini-3.8-live",
  search: () => process.env.SEARCH_MODEL || process.env.PLANNER_MODEL || "gemini-3.1-flash-lite",
};

const SKILLS = ["gmail", "calendar", "whatsapp", "web-computer", "research", "memory", "reminders"] as const;

/**
 * Router lane: Gemma decides if a message is a plain question or a task, and which skill it needs,
 * before the planner model runs. Falls back to simple rules if Gemma is unavailable.
 */
export async function route(text: string): Promise<{ kind: "chat" | "task"; skill: string; by: string; ms: number }> {
  const t0 = Date.now();
  const prompt = `Classify the user's message for a personal assistant. Reply with exactly one line: KIND SKILL
KIND is "task" if the user wants something done or looked up in their email, calendar, WhatsApp, reminders, memory, bookings or the web, otherwise "chat".
SKILL is one of: ${SKILLS.join(", ")}, none.
The message may be in English, Hindi, Telugu or a mix.

Message: ${text}`;
  try {
    const r = await Promise.race([
      ai().models.generateContent({ model: MODELS.router(), contents: prompt, config: { temperature: 0, maxOutputTokens: 30, thinkingConfig: { thinkingLevel: "minimal" as never } } }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("router timeout")), Number(process.env.ROUTER_TIMEOUT_MS || 2500))),
    ]);
    const out = (r.text || "").trim().toLowerCase();
    const kind = out.startsWith("chat") ? "chat" : "task";
    const skill = SKILLS.find((s) => out.includes(s)) || "none";
    return { kind, skill, by: MODELS.router(), ms: Date.now() - t0 };
  } catch {
    return { kind: "task", skill: guessSkill(text), by: "rules (Gemma busy)", ms: Date.now() - t0 };
  }
}

function guessSkill(t: string): string {
  if (/(book|table|restaurant|dinner|lunch)/i.test(t)) return "web-computer";
  if (/(whatsapp|message|bata do|bhej)/i.test(t)) return "whatsapp";
  if (/(mail|inbox|email)/i.test(t)) return "gmail";
  if (/(calendar|meeting|invite|review|schedule)/i.test(t)) return "calendar";
  if (/(remind|yaad|గుర్తు)/i.test(t)) return "reminders";
  if (/(latest|news|search|what are|who is|price)/i.test(t)) return "research";
  return "none";
}

/** Research skill: Gemini with Google Search grounding, so answers are current and cited. */
export async function searchWeb(query: string): Promise<{ answer: string; sources: Source[] }> {
  const { res: r } = await generate(MODELS.search(), {
    contents: `Answer briefly and factually, with concrete names, prices or dates where useful. Question: ${query}`,
    config: { tools: [{ googleSearch: {} }], temperature: 0.2 },
  });
  const chunks = r.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const c of chunks) {
    const uri = c.web?.uri;
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    sources.push({ title: c.web?.title || uri, uri });
    if (sources.length >= 5) break;
  }
  return { answer: r.text || "", sources };
}
