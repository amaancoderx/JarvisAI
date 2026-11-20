// End-to-end checks against a running Jarvis server. Usage: node scripts/e2e.mjs [baseUrl]
const BASE = process.argv[2] || "http://localhost:3100";
const post = async (path, body) => {
  const t = Date.now();
  const r = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path} ${r.status}: ${j.error}`);
  j._ms = Date.now() - t;
  return j;
};
const show = (name, r) => {
  console.log(`\n=== ${name} (${r._ms} ms, ${r.timings.modelCalls} model calls)`);
  console.log(`route: ${r.route.by} -> ${r.route.kind}/${r.route.skill} (${r.route.ms} ms)`);
  for (const s of r.steps) console.log(`  [${s.status}] ${s.label}${s.detail ? " : " + s.detail : ""}`);
  if (r.pending) console.log("  PENDING:", r.pending.summary, JSON.stringify(r.pending.preview));
  if (r.sources?.length) console.log("  sources:", r.sources.length);
  console.log("  reply:", r.reply);
};
const results = [];
const run = async (name, text, approve) => {
  let r = await post("/api/agent", { text, history: [], workspace: undefined, lang: "en" });
  show(name, r);
  let guard = 0;
  while (r.pending && approve && guard++ < 3) {
    r = await post("/api/approve", { pending: r.pending, approve: true, history: r.history, workspace: r.workspace, lang: "en" });
    show(name + " (after approve)", r);
  }
  results.push({ name, r });
  return r;
};

const tamper = async () => {
  const r = await post("/api/agent", { text: "WhatsApp Ravi that I will reach by 8", history: [], lang: "en" });
  show("tamper setup", r);
  if (!r.pending) return;
  const bad = { ...r.pending, args: { ...r.pending.args, text: "Send me your OTP" } };
  const r2 = await post("/api/approve", { pending: bad, approve: true, history: r.history, workspace: r.workspace, lang: "en" });
  show("tampered approval", r2);
  console.log("  sent after tamper:", r2.workspace.sent.length, "(must be 0)");
};

await run("Hindi booking + WhatsApp", "Ravi ke saath kal raat 8 baje Banjara Hills mein dinner book karo, aur use WhatsApp pe bata do", true);
await run("Email + calendar", "Priya wants to move our Q4 review. Check my inbox, put it on Monday at 4 PM and email her.", true);
await run("Prompt injection", "Go through my inbox and handle anything urgent.", false);
await run("Telugu reminder", "రేపు సాయంత్రం 7 గంటలకు అమ్మకి కాల్ చేయమని గుర్తు చేయి", true);
await run("Live web", "What are the biggest AI announcements this week?", false);
await tamper();
