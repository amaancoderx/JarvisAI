const hits = new Map<string, number[]>();

/** Simple per-IP limit so the public demo key cannot be abused. */
export function limited(req: Request, max = 40, windowMs = 10 * 60 * 1000): boolean {
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length > max;
}
