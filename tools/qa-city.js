// CDP driver: opens the mezzanine, clicks through to the city builder, places
// buildings and writes screenshots. Run with tsx/node after Chrome is up.
// `vite`/`npm run` treat tools/*.js as ES modules (package.json has "type": "module"),
// so use imports instead of require().
import fs from "node:fs";

const BASE = process.env.QA_URL || "http://localhost:4180/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  const res = await fetch("http://127.0.0.1:9222/json");
  const tabs = await res.json();
  const page = tabs.find((t) => t.type === "page");
  if (!page) throw new Error("no page target");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    } else if (
      msg.method === "Runtime.consoleAPICalled" &&
      msg.params.type === "error"
    ) {
      logs.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
    } else if (msg.method === "Runtime.exceptionThrown") {
      logs.push(
        "EXCEPTION " +
          (msg.params.exceptionDetails.exception?.description ||
            msg.params.exceptionDetails.text),
      );
    }
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const mid = ++id;
      pending.set(mid, { res, rej });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  return { send, logs, close: () => ws.close() };
}

async function evalJs(send, expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails)
    throw new Error(r.exceptionDetails.exception?.description || "eval failed");
  return r.result.value;
}

async function clickText(send, text) {
  const found = await evalJs(
    send,
    `(() => {
    const t = ${JSON.stringify(text)};
    const els = [...document.querySelectorAll('button,a,div[role=button],li,span')];
    const el = els.reverse().find(e => e.offsetParent !== null && e.textContent.trim() === t)
      || els.find(e => e.offsetParent !== null && e.textContent.trim().includes(t));
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return true;
  })()`,
  );
  await sleep(500);
  return found;
}

(async () => {
  const { send, logs, close } = await connect();
  const out = {};
  try {
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Page.navigate", { url: BASE });
    await sleep(3000);

    // Sign in offline: AuthScreen reads localStorage.
    await evalJs(
      send,
      `localStorage.setItem('emporium_auth_user', JSON.stringify({login:'qa',password:'qa',createdAt:new Date().toISOString()}))`,
    );
    await send("Page.reload");
    await sleep(2500);

    // Main menu -> "Новая игра" screen, then the form's submit button. The main
    // menu has its own "Создать и начать игру" button, so if we are still in the
    // menu, click "Новая игра" first.
    await clickText(send, "Новая игра");
    await sleep(800);
    out.start = await evalJs(
      send,
      `(() => {
      const all = [...document.querySelectorAll('button')].filter(b => b.offsetParent && b.textContent.includes('Создать и начать игру'));
      const el = all[all.length - 1];
      if (!el) return false;
      el.click();
      return all.length;
    })()`,
    );
    await sleep(1500);

    out.mezzanine = await clickText(send, "Мезонин");
    await sleep(800);

    out.city = await clickText(send, "Стройка города");
    await sleep(1200);

    const rect = await evalJs(
      send,
      `(() => {
      const c = document.querySelector('canvas');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    })()`,
    );
    out.canvas = rect;

    if (rect) {
      const cx = rect.x + rect.w / 2 + 40;
      const cy = rect.y + rect.h / 2 - 60;
      const click = async (x, y) => {
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
        await send("Input.dispatchMouseEvent", {
          type: "mousePressed",
          x,
          y,
          button: "left",
          clickCount: 1,
        });
        await send("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          x,
          y,
          button: "left",
          clickCount: 1,
        });
        await sleep(350);
      };
      await click(cx, cy);
      out.toast = await evalJs(
        send,
        `document.body.innerText.match(/[^\\n]*(стройка начата|Нельзя|Проезжая)[^\\n]*/i)?.[0] || null`,
      );
      await click(cx + 72, cy + 36);
      await click(cx - 72, cy - 36);
      await sleep(2200);
    }

    const shot = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("tools/qa-city.png", Buffer.from(shot.data, "base64"));
    out.text = await evalJs(send, `document.body.innerText.slice(0, 1200)`);
    out.consoleErrors = logs;
  } catch (e) {
    out.error = String((e && e.stack) || e);
  } finally {
    close();
  }
  console.log(JSON.stringify(out, null, 2));
})();
