// Research checks against a running Jarvis. Usage: node scripts/research.mjs [baseUrl]
const BASE = process.argv[2] || "http://localhost:3100";
const Q = [
  ["Comparison", "Compare the top 3 electric scooters in India under 1.5 lakh rupees: price, real-world range and charging time."],
  ["Current events", "What did the RBI decide at its most recent monetary policy meeting, and what does it mean for home loan EMIs?"],
  ["Read a website", "Read https://ai.google.dev/gemini-api/docs/models and summarise which Gemini models are available and what each is best for."],
  ["Multi-part travel", "Plan a 2-day trip to Hampi from Hyderabad for this weekend: how to get there, where to stay under 3000 a night, and what to see."],
  ["Hindi research", "Hyderabad mein is hafte ke sabse bade tech events kaun se hain?"],
];
for (const [name, text] of Q) {
  const t = Date.now();
  let r, j;
  for (let k = 0; k < 2; k++) {
    r = await fetch(BASE + "/api/agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, history: [], lang: "en" }) });
    j = await r.json();
    if (r.ok) break;
  }
  const ms = Date.now() - t;
  if (!r.ok) { console.log(`\n=== ${name}: FAILED ${r.status} ${j.reason || j.error}`); continue; }
  const searches = j.steps.filter((s) => s.tool === "search_web" || s.tool === "open_website");
  console.log(`\n=== ${name} (${(ms / 1000).toFixed(1)} s, ${j.timings.modelCalls} model calls, ${searches.length} lookups, ${j.sources.length} sources)`);
  for (const s of j.steps) console.log(`  [${s.status}] ${s.label}${s.detail ? " : " + s.detail.slice(0, 90) : ""}`);
  console.log("  ---\n" + j.reply.split("\n").slice(0, 14).map((l) => "  " + l).join("\n") + (j.reply.split("\n").length > 14 ? "\n  ..." : ""));
}
