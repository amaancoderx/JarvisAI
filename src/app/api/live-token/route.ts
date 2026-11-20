import { keyAi, MODELS } from "@/lib/gemini";
import { limited } from "@/lib/limit";

export const runtime = "nodejs";

/** Short-lived, single-use token so the browser can talk to Gemini Live without seeing our API key. */
export async function POST(req: Request) {
  if (limited(req, 15)) return Response.json({ error: "Too many voice sessions. Please wait a few minutes." }, { status: 429 });
  try {
    const now = Date.now();
    const token = await keyAi().authTokens.create({
      config: {
        uses: 3,
        expireTime: new Date(now + 20 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString(),
        httpOptions: { apiVersion: "v1alpha" },
      },
    });
    return Response.json({ token: token.name, models: [MODELS.live(), process.env.LIVE_FALLBACK_MODEL || "gemini-2.5-flash-native-audio-latest"] });
  } catch (e) {
    console.error("live token error", e);
    return Response.json({ error: "Voice is unavailable right now." }, { status: 503 });
  }
}
