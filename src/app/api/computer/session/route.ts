import { computerReady } from "@/lib/browser";
import { getSession, runGoal, startSession, stopSession, view } from "@/lib/computer";
import { cookieHeader, userId } from "@/lib/google";
import { limited } from "@/lib/limit";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Live view of the owner's Jarvis Cloud Computer. */
export async function GET(req: Request) {
  const u = userId(req);
  const s = u.fresh ? undefined : getSession(u.id);
  return Response.json({ ready: computerReady(), session: s ? view(s) : null }, { headers: { "Cache-Control": "no-store", "Set-Cookie": cookieHeader(u.id) } });
}

/** start | run {goal} | stop */
export async function POST(req: Request) {
  if (limited(req, 60)) return Response.json({ error: "Too many requests." }, { status: 429 });
  if (!computerReady()) return Response.json({ error: "The Jarvis computer is not available on this server." }, { status: 503 });
  const u = userId(req);
  const body = await req.json().catch(() => ({}));
  const headers = { "Set-Cookie": cookieHeader(u.id) };
  try {
    if (body.action === "stop") { await stopSession(u.id); return Response.json({ session: null }, { headers }); }
    if (body.action === "run") {
      const goal = String(body.goal || "").slice(0, 500).trim();
      if (!goal) return Response.json({ error: "Tell the computer what to do." }, { status: 400 });
      await startSession(u.id);
      // Runs in the background on this instance; the page follows it live through GET.
      void runGoal(u.id, goal);
      await new Promise((r) => setTimeout(r, 300));
      return Response.json({ session: view(getSession(u.id)!) }, { headers });
    }
    const s = await startSession(u.id);
    return Response.json({ session: view(s) }, { headers });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 160) }, { status: 502 });
  }
}
