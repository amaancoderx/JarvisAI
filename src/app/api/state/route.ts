import { firestore } from "@/lib/db";
import { cookieHeader, userId } from "@/lib/google";
import { limited } from "@/lib/limit";

export const runtime = "nodejs";

/** The owner's Jarvis state (workspaces, memory, chats), kept in Firestore so it follows them across devices and reloads. */
export async function GET(req: Request) {
  const u = userId(req);
  const db = firestore();
  if (!db || u.fresh) return Response.json({ state: null }, { headers: { "Set-Cookie": cookieHeader(u.id) } });
  try {
    const snap = await db.collection("jarvis_state").doc(u.id).get();
    const d = snap.data();
    return Response.json({ state: d?.json ? JSON.parse(d.json) : null, updatedAt: d?.updatedAt ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("state get", e);
    return Response.json({ state: null });
  }
}

export async function PUT(req: Request) {
  if (limited(req, 240)) return Response.json({ ok: false }, { status: 429 });
  const u = userId(req);
  const db = firestore();
  if (!db) return Response.json({ ok: false, reason: "no database" });
  const text = await req.text();
  if (text.length > 900_000) return Response.json({ ok: false, reason: "too large" }, { status: 413 });
  try {
    JSON.parse(text);
    const updatedAt = new Date().toISOString();
    await db.collection("jarvis_state").doc(u.id).set({ json: text, updatedAt });
    return Response.json({ ok: true, updatedAt }, { headers: { "Set-Cookie": cookieHeader(u.id) } });
  } catch (e) {
    console.error("state put", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
