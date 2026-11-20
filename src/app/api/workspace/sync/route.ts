import { calList, gmailList, liveFor, userId } from "@/lib/google";

export const runtime = "nodejs";

/** Real inbox and calendar for the signed-in Google account, so every page shows the owner's own data. */
export async function GET(req: Request) {
  const u = userId(req);
  if (u.fresh) return Response.json({ inbox: null, calendar: null });
  const live = await liveFor(u.id).catch(() => null);
  const [inbox, calendar] = await Promise.all([
    live?.gmail ? gmailList(live.gmail, 12).catch(() => null) : null,
    live?.calendar ? calList(live.calendar).catch(() => null) : null,
  ]);
  return Response.json({ inbox, calendar, email: live?.email ?? null }, { headers: { "Cache-Control": "no-store" } });
}
