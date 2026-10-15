// ext-reload-cdp.mjs — drive ONE known relay target by id over the local CDP
// relay (durable replacement for state/tmp/extauto-cdp.mjs).
// Privacy: target id is an input; never enumerates/prints other targets.
//
// Typical use for an unpacked-extension update (see playbooks/extension-auto-install.md):
//   --target <flow page target id> \
//   --context-origin chrome-extension://<id> \
//   --expr "window.open(chrome.runtime.getURL('reload-bootstrap.html'))"
//
// Usage:
//   bun tools/ext-reload-cdp.mjs --target <id> --expr '<js>' [--await]
//   bun tools/ext-reload-cdp.mjs --target <id> --expr '<js>' --context-origin chrome-extension://<id>
//   bun tools/ext-reload-cdp.mjs --target <id> --navigate <url> [--wait-href <substr>]
//   bun tools/ext-reload-cdp.mjs --target <id> --call <Method> [--params '<json>']
//
// Env: EXT_RELOAD_CDP (default ws://127.0.0.1:9224/cdp).
const CDP = process.env.EXT_RELOAD_CDP || "ws://127.0.0.1:9224/cdp";
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const targetId = arg("--target");
if (!targetId) { console.error("usage: --target <id> ..."); process.exit(2); }

let ws = null, msgId = 0, sessionId = null, exitCode = 0;
const pending = new Map();

function send(method, params, sid) {
  const id = ++msgId;
  ws.send(JSON.stringify(sid ? { id, method, params, sessionId: sid } : { id, method, params }));
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { pending.delete(id); reject(new Error(`timeout ${method}`)); }, 18000);
    pending.set(id, { resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } });
  });
}
const evaluate = async (expression, awaitPromise = false) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise, userGesture: true }, sessionId);
  if (r.exceptionDetails) throw new Error(`eval-exception: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ""}`);
  return r.result?.value;
};
const out = (o) => console.log(JSON.stringify(o));

try {
  ws = new WebSocket(CDP);
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id !== undefined && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.reject(new Error(`${m.error.code} ${m.error.message}`)); else p.resolve(m.result);
    }
  });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("relay /cdp timeout")), 5000);
    ws.addEventListener("open", () => { clearTimeout(t); res(); }, { once: true });
    ws.addEventListener("error", () => { clearTimeout(t); rej(new Error("relay offline")); }, { once: true });
  });
  sessionId = (await send("Target.attachToTarget", { targetId, flatten: true })).sessionId;

  const url = arg("--navigate");
  const call = arg("--call");
  const expr = arg("--expr");
  const ctxOrigin = arg("--context-origin");
  const ctxId = arg("--context-id");

  if (argv.includes("--list-contexts") || ctxOrigin || ctxId) {
    // Runtime.executionContextCreated events identify the isolated worlds a
    // content script runs in (origin = chrome-extension://<id>).
    const contexts = [];
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === "Runtime.executionContextCreated") contexts.push(m.params.context);
    });
    await send("Runtime.enable", {}, sessionId);
    await new Promise((r) => setTimeout(r, 900));
    const brief = (c) => ({ id: c.id, origin: c.origin, name: c.name, aux: c.auxData });
    if (argv.includes("--list-contexts")) out({ ok: true, contexts: contexts.map(brief) });
    if (ctxId) {
      const hit = contexts.find((c) => String(c.id) === String(ctxId));
      if (!hit) { out({ ok: false, error: "context id not found" }); exitCode = 1; }
      else {
        const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, contextId: hit.id, userGesture: true, awaitPromise: argv.includes("--await") }, sessionId);
        out(r.exceptionDetails ? { ok: false, error: r.exceptionDetails.text, detail: r.exceptionDetails.exception?.description ?? null, ctx: brief(hit) } : { ok: true, value: r.result?.value ?? null, ctx: brief(hit) });
      }
    } else if (ctxOrigin) {
      const tryAllCtx = true;
      const hits = contexts.filter((c) => String(c.origin) === ctxOrigin).sort((a, b) => b.id - a.id); // mais NOVO primeiro
      let hit = null, lastR = null;
      for (const h of hits) { const rr = await send("Runtime.evaluate", { expression: expr, returnByValue: true, contextId: h.id, userGesture: true, awaitPromise: argv.includes("--await") }, sessionId); if (!rr.exceptionDetails) { hit = h; lastR = rr; break; } lastR = rr; }
      if (!hit) { out({ ok: false, error: lastR?.exceptionDetails?.text, detail: lastR?.exceptionDetails?.exception?.description, ctxCount: hits.length }); exitCode = 1; }
      else out({ ok: true, value: lastR?.result?.value ?? null, ctx: brief(hit) });
    }
  } else if (url) {
    await send("Page.enable", {}, sessionId).catch(() => {});
    const nav = await send("Page.navigate", { url }, sessionId);
    const want = arg("--wait-href");
    const t0 = Date.now();
    let state = null;
    while (Date.now() - t0 < 15000) {
      try { state = await evaluate("({href:location.href,ready:document.readyState})"); } catch { state = null; }
      if (state && state.ready === "complete" && (!want || String(state.href).includes(want))) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    out({ ok: true, navigate: url, frameId: nav.frameId ?? null, errorText: nav.errorText ?? null, state, ms: Date.now() - t0 });
  } else if (call) {
    const params = arg("--params") ? JSON.parse(arg("--params")) : {};
    out({ ok: true, result: await send(call, params, sessionId) });
  } else if (expr !== null) {
    out({ ok: true, value: await evaluate(expr, argv.includes("--await")) });
  } else {
    console.error("nothing to do"); exitCode = 2;
  }
} catch (e) {
  exitCode = 1;
  out({ ok: false, error: e.message });
} finally {
  try { if (sessionId) await send("Target.detachFromTarget", { sessionId }); } catch { /* detach best-effort */ }
  try { if (ws) ws.close(); } catch { /* nothing */ }
  process.exitCode = exitCode;
}
