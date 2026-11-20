import { CALENDAR, DRIVE, GMAIL, disconnect, forget, liveFor, userId } from "@/lib/google";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const u = userId(req);
  if (u.fresh) return Response.json({ ok: true });
  const { app } = await req.json().catch(() => ({}));
  const live = await liveFor(u.id, true);
  const id = app === "calendar" ? live.calendar : app === "drive" ? live.drive : live.gmail;
  if (id) await disconnect(id, app === "calendar" ? CALENDAR : app === "drive" ? DRIVE : GMAIL);
  forget(u.id);
  return Response.json({ ok: true });
}
