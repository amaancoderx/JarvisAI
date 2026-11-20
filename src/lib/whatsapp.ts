/**
 * WhatsApp through Twilio, the same carrier the production Jarvis uses. In Twilio's sandbox a message only
 * reaches numbers that joined the sandbox; with an approved business number the same code sends to anyone.
 */
export function whatsappReady(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
}

export function whatsappFrom(): string {
  const f = process.env.TWILIO_WHATSAPP_FROM || "";
  return f.replace(/^whatsapp:/, "");
}

/** Normalises an Indian or international number to E.164, or null if it is not a real number. */
export function e164(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(d)) return d;
  if (/^[6-9]\d{9}$/.test(d)) return `+91${d}`;
  if (/^91[6-9]\d{9}$/.test(d)) return `+${d}`;
  return null;
}

export async function sendWhatsapp(to: string, text: string): Promise<string> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`;
  const from = process.env.TWILIO_WHATSAPP_FROM!.startsWith("whatsapp:") ? process.env.TWILIO_WHATSAPP_FROM! : `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: from, To: `whatsapp:${to}`, Body: text }).toString(),
  });
  const j = (await res.json().catch(() => ({}))) as { sid?: string; status?: string; message?: string; error_message?: string };
  if (!res.ok || j.status === "failed" || j.status === "undelivered") throw new Error(j.message || j.error_message || `WhatsApp refused the message (${res.status})`);
  return j.sid ?? "sent";
}
