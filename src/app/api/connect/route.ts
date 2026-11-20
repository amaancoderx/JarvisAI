import { CALENDAR, DRIVE, GMAIL, connectUrl, cookieHeader, nangoReady, userId } from "@/lib/google";
import { limited } from "@/lib/limit";

export const runtime = "nodejs";

/** Starts Google OAuth for Gmail or Calendar through Nango. Returns the URL to open in a popup. */
export async function POST(req: Request) {
  if (limited(req, 20)) return Response.json({ error: "Too many requests." }, { status: 429 });
  if (!nangoReady()) return Response.json({ error: "Google connect is not configured on this server." }, { status: 503 });
  const { app } = await req.json().catch(() => ({}));
  const integration = app === "calendar" ? CALENDAR : app === "drive" ? DRIVE : GMAIL;
  const u = userId(req);
  try {
    const url = await connectUrl(u.id, integration);
    return Response.json({ url }, { headers: { "Set-Cookie": cookieHeader(u.id) } });
  } catch (e) {
    console.error("connect", e);
    return Response.json({ error: "Could not start Google sign-in." }, { status: 502 });
  }
}
