import { runAgent } from "@/lib/agent";
import { limited } from "@/lib/limit";
import { liveFor, userId } from "@/lib/google";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (limited(req)) return Response.json({ error: "Too many requests. Please wait a few minutes." }, { status: 429 });
  try {
    const body = await req.json();
    if (!body.pending || !body.workspace) return Response.json({ error: "Nothing to approve." }, { status: 400 });
    const u = userId(req);
    const live = u.fresh || body.live === false ? undefined : await liveFor(u.id).catch(() => undefined);
    const result = await runAgent({
      live,
      voice: body.voice === true,
      history: Array.isArray(body.history) ? body.history : [],
      workspace: body.workspace,
      lang: ["en", "hi", "te"].includes(body.lang) ? body.lang : "en",
      decision: { pending: body.pending, approve: body.approve === true },
    });
    return Response.json(result);
  } catch (e) {
    console.error("approve error", e);
    return Response.json({ error: "Jarvis hit a problem. Please try again.", reason: String((e as Error).message || "").replace(/key=[^&s]+/g, "key=***").slice(0, 300) }, { status: 500 });
  }
}
