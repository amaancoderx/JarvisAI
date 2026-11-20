import { computerReady, openPage } from "@/lib/browser";
import { limited } from "@/lib/limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Opens a page on the Jarvis computer and returns what it saw. */
export async function POST(req: Request) {
  if (limited(req, 20)) return Response.json({ error: "Too many requests." }, { status: 429 });
  if (!computerReady()) return Response.json({ error: "The Jarvis computer is not available on this server." }, { status: 503 });
  const { url } = await req.json().catch(() => ({}));
  if (!url || typeof url !== "string") return Response.json({ error: "Enter a website." }, { status: 400 });
  try {
    const t = Date.now();
    const s = await openPage(url, 15000);
    return Response.json({ url: s.url, title: s.title, image: s.image, ms: Date.now() - t, chars: s.text.length });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 160) }, { status: 502 });
  }
}
