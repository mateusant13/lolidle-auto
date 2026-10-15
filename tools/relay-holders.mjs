// relay-holders.mjs — inventory of stuck CDP sessions on the omp browser-relay.
// Shows which tabs have chrome.debugger attached (active banner) and how many
// downstream CDP clients (puppeteer/registry of live TUIs) hold them.
//
// PRIVACY (owner incident 2026-09-03 x2, NON-NEGOTIABLE): never prints titles,
// URLs, or target ids of non-allowlisted tabs. Only the allowlisted shopify
// target may be shown; every other tab is counted, never listed.
//
// DISCONNECT HYGIENE: leaves no state behind — Target.setDiscoverTargets
// {discover:false} + ws.close() in a finally block.
//
// Usage: bun I:/!manager/tools/relay-holders.mjs
// Exit 0 always (read-only, does not change state).
const PORT = 9224;
const ALLOW_RE = /^https:\/\/(www\.)?shopify\.com\/br\/comecar\/?([?#].*)?$/;

let ws = null;
let id = 0;
try {
  const pending = new Map();
  const events = [];
  ws = new WebSocket(`ws://127.0.0.1:${PORT}/cdp`);
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg.result);
    } else if (msg.method) events.push(msg);
  });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("relay /cdp timeout")), 5000);
    ws.addEventListener("open", () => { clearTimeout(t); res(); }, { once: true });
    ws.addEventListener("error", () => { clearTimeout(t); rej(new Error("relay offline")); }, { once: true });
  });

  ws.send(JSON.stringify({ id: ++id, method: "Target.setDiscoverTargets", params: { discover: true } }));
  await new Promise((r) => setTimeout(r, 800));

  const tabs = new Map(); // targetId -> info
  for (const ev of events) {
    if (!ev.method.startsWith("Target.target")) continue;
    const ti = ev.params.targetInfo ?? {};
    if (ti.type === "tab") tabs.set(ti.targetId, ti);
  }

  console.log(`Tabs known to the relay: ${tabs.size}`);
  let attachedCount = 0;
  let sanctionedCount = 0;
  for (const [tid, ti] of tabs) {
    if (ti.attached) attachedCount++;
    const url = String(ti.url ?? "");
    if (ALLOW_RE.test(url)) {
      sanctionedCount++;
      console.log(`  ${ti.attached ? "ATTACHED " : "free     "} ${url.slice(0, 72)} [${tid}]`);
    } else {
      // Foreign tab: count it, never display it (no URL, no title, no id).
      console.log(`  ${ti.attached ? "ATTACHED " : "free     "} [non-target tab — URL/id hidden for privacy]`);
    }
  }
  console.log(`\nSanctioned shopify target tabs: ${sanctionedCount}`);
  console.log(`ATTACHED (active debugging banner): ${attachedCount}`);
  console.log("Real holders = live omp processes (TUIs/agents) that opened a browser and");
  console.log("did not close it. Physical detach only happens when ALL release (releaseTab/dispose");
  console.log("or the creator session closes). Each creator: `browser.close(name=…)` when done.");
} catch (e) {
  console.log(`relay offline (${e.message}) — no attach state readable from here (nothing touched)`);
} finally {
  try {
    if (ws) ws.send(JSON.stringify({ id: ++id, method: "Target.setDiscoverTargets", params: { discover: false } }));
  } catch { /* read-only tool: never throw on cleanup */ }
  try { if (ws) ws.close(); } catch { /* read-only tool: never throw on cleanup */ }
}
process.exitCode = 0;
