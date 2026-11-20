import { cookieHeader, liveFor, nangoReady, userId } from "@/lib/google";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = userId(req);
  const fresh = new URL(req.url).searchParams.has("fresh");
  const live = u.fresh ? { gmail: null, calendar: null, email: null } : await liveFor(u.id, fresh).catch(() => ({ gmail: null, calendar: null, email: null }));
  return Response.json(
    { available: nangoReady(), gmail: Boolean(live.gmail), calendar: Boolean(live.calendar), email: live.email },
    { headers: { "Set-Cookie": cookieHeader(u.id), "Cache-Control": "no-store" } },
  );
}
