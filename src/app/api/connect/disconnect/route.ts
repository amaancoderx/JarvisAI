import { CALENDAR, GMAIL, disconnect, forget, liveFor, userId } from "@/lib/google";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const u = userId(req);
  if (u.fresh) return Response.json({ ok: true });
  const { app } = await req.json().catch(() => ({}));
  const live = await liveFor(u.id, true);
  const id = app === "calendar" ? live.calendar : live.gmail;
  if (id) await disconnect(id, app === "calendar" ? CALENDAR : GMAIL);
  forget(u.id);
  return Response.json({ ok: true });
}
