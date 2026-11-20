import { runAgent } from "@/lib/agent";
import { limited } from "@/lib/limit";
import { liveFor, userId } from "@/lib/google";
import { seedWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (limited(req)) return Response.json({ error: "Too many requests. Please wait a few minutes." }, { status: 429 });
  try {
    const body = await req.json();
    const text = String(body.text ?? "").slice(0, 2000).trim();
    if (!text) return Response.json({ error: "Say or type something first." }, { status: 400 });
    const u = userId(req);
    const live = u.fresh || body.live === false ? undefined : await liveFor(u.id).catch(() => undefined);
    const result = await runAgent({
      live,
      voice: body.voice === true,
      uid: u.id,
      tab: body.tab && typeof body.tab === "object" ? body.tab : undefined,
      text,
      history: Array.isArray(body.history) ? body.history : [],
      workspace: body.workspace ?? seedWorkspace(),
      lang: ["en", "hi", "te"].includes(body.lang) ? body.lang : "en",
    });
    return Response.json(result);
  } catch (e) {
    console.error("agent error", e);
    return Response.json({ error: "Jarvis hit a problem. Please try again.", reason: String((e as Error).message || "").replace(/key=[^&s]+/g, "key=***").slice(0, 300) }, { status: 500 });
  }
}
