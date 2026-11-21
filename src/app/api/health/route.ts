import { apiKeys } from "@/lib/gemini";
import { MODELS } from "@/lib/gemini";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    key: Boolean(process.env.GEMINI_API_KEY), keys: apiKeys().length,
    models: { planner: MODELS.planner(), router: MODELS.router(), live: MODELS.live() },
    region: process.env.K_SERVICE ? "Google Cloud Run" : process.env.VERCEL ? "Vercel" : "local",
  });
}
