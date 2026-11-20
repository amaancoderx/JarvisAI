import { cookieHeader, liveFor, nangoReady, userId } from "@/lib/google";
import { whatsappFrom, whatsappReady } from "@/lib/whatsapp";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = userId(req);
  const fresh = new URL(req.url).searchParams.has("fresh");
  const live = u.fresh ? { gmail: null, calendar: null, drive: null, email: null } : await liveFor(u.id, fresh).catch(() => ({ gmail: null, calendar: null, drive: null, email: null }));
  return Response.json(
    { available: nangoReady(), gmail: Boolean(live.gmail), calendar: Boolean(live.calendar), drive: Boolean(live.drive), email: live.email, whatsapp: whatsappReady() ? whatsappFrom() : null },
    { headers: { "Set-Cookie": cookieHeader(u.id), "Cache-Control": "no-store" } },
  );
}
