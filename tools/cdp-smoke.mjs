#!/usr/bin/env node
//
// Production-preview smoke test, in-repo only.
//
// Replaces the old `qa:mezzanine` entry that pointed at a browser runner living
// outside this repository. Drives headless Chrome over CDP (tools/cdp-lib.mjs)
// against a built app served by `vite preview`:
//
//   register -> new campaign -> open the mezzanine hub -> reload -> assert
//
// Usage:
//   node tools/cdp-smoke.mjs [url] [shot.png]
//
// Env:
//   CHROME_PATH   explicit Chrome/Chromium binary (cdp-lib discovery otherwise)
//
// Exit code 0 only when every step rendered and no console error appeared.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CdpClient,
  createDiagnosticsCollector,
  enableDomains,
  launchChrome
} from "./cdp-lib.mjs";

const URL_ = process.argv[2] || "http://localhost:4173/";
const SHOT = process.argv[3] || "";
const USER = `qa_smoke_${Date.now().toString(36)}`;
const PASS = `qa_${Math.random().toString(36).slice(2, 10)}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];

function check(name, ok, detail = "") {
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
}

/** Clicks the first button whose visible text matches `pattern`. */
async function clickText(client, pattern, selector = "button") {
  return client.evaluate(`(() => {
    const re = new RegExp(${JSON.stringify(pattern)});
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find(node => re.test((node.innerText || "").trim()));
    if (!el) return false;
    el.click();
    return true;
  })()`);
}

/** Types into the first matching input through real key events. */
async function typeInto(client, selector, value) {
  const focused = await client.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.focus();
    el.value = "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
  if (!focused) return false;
  for (const ch of value) {
    await client.send("Input.dispatchKeyEvent", { type: "char", text: ch });
  }
  return true;
}

async function waitFor(client, expression, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await client.evaluate(expression)) return true;
    await sleep(300);
  }
  return false;
}

async function register(client) {
  // Unknown login switches the form to registration; create the smoke account.
  await typeInto(client, 'input[type="text"]', USER);
  await typeInto(client, 'input[type="password"]', PASS);
  await clickText(client, "^Войти$");
  await sleep(1500);
  if (await client.evaluate(`!![...document.querySelectorAll('button')].find(b => /^Зарегистрироваться$/.test(b.innerText.trim()))`)) {
    await typeInto(client, 'input[type="text"]', USER);
    // Password inputs are siblings; fill each one by index with real key events.
    const passCount = await client.evaluate(`document.querySelectorAll('input[type="password"]').length`);
    for (let index = 0; index < passCount; index++) {
      await client.evaluate(`(() => {
        const inputs = document.querySelectorAll('input[type="password"]');
        inputs[${index}].focus();
        return true;
      })()`);
      for (const ch of PASS) await client.send("Input.dispatchKeyEvent", { type: "char", text: ch });
    }
    await clickText(client, "^Зарегистрироваться$");
  }
}

async function main() {
  const profile = mkdtempSync(join(tmpdir(), "emporium-smoke-"));
  const browser = await launchChrome();
  try {
    const client = await CdpClient.connect(browser.wsUrl);
    const diagnostics = createDiagnosticsCollector(client);
    await enableDomains(client, "Runtime", "Network", "Page", "DOM", "CSS");

    await client.send("Page.navigate", { url: URL_ });
    check(
      "page loads",
      await waitFor(client, "!!document.body && document.body.innerText.length > 0", 25000)
    );

    // Auth screen of the local-only provider.
    check("auth screen renders", await waitFor(client, `document.querySelectorAll('input[type="password"]').length > 0`));
    await register(client);
    check(
      "registered / title screen",
      await waitFor(client, `!![...document.querySelectorAll('button')].find(b => /Продолжить кампанию|Новая игра/.test(b.innerText))`, 40000)
    );

    // New campaign.
    await clickText(client, "Новая игра");
    await waitFor(client, `!![...document.querySelectorAll('button')].find(b => /Создать и начать игру/.test(b.innerText))`);
    await clickText(client, "Создать и начать игру");
    check(
      "campaign starts",
      await waitFor(client, `!![...document.querySelectorAll('button')].find(b => /^Мезонин$/.test(b.innerText.trim()))`, 30000)
    );

    // Mezzanine hub.
    await clickText(client, "^Мезонин$");
    check("mezzanine renders", await waitFor(client, "!!document.querySelector('canvas')", 20000));
    await sleep(1200);

    // A fresh campaign starts with no region picked, so the hub has nothing to
    // restore yet. Choose the first region through its hotkey (1 = Brest), wait
    // for the view to reach the save, then reload.
    await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "1", code: "Digit1", text: "1" });
    await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "1", code: "Digit1" });
    check(
      "region selected",
      await waitFor(
        client,
        `(() => {
          const raw = localStorage.getItem('emporium_save_slot_1') || localStorage.getItem('emporium_save_06');
          if (!raw) return false;
          try { return Boolean(JSON.parse(raw).mezzanine?.selectedRegionId); } catch { return false; }
        })()`,
        15000
      )
    );
    await client.evaluate("window.dispatchEvent(new Event('pagehide'))");
    await sleep(500);
    const beforeReload = await client.evaluate(
      "localStorage.getItem('emporium_save_slot_1') || localStorage.getItem('emporium_save_06')"
    );
    check("campaign saved to localStorage", Boolean(beforeReload));

    await client.send("Page.reload", { ignoreCache: false });
    await sleep(4000);
    const afterReload = await client.evaluate(
      "localStorage.getItem('emporium_save_slot_1') || localStorage.getItem('emporium_save_06')"
    );
    check("save survives reload", Boolean(afterReload) && afterReload === beforeReload);
    const view = afterReload ? JSON.parse(afterReload).mezzanine : null;
    check("mezzanine view restored", Boolean(view && view.selectedRegionId), view ? view.selectedRegionId : "none");

    const consoleErrors = diagnostics.consoleMessages.filter((line) => !/localhost:5175/.test(String(line)));
    check("no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

    if (SHOT) {
      const shot = await client.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(SHOT, Buffer.from(shot.data, "base64"));
      console.log(`screenshot: ${SHOT}`);
    }
  } finally {
    browser.kill();
    // Throwaway profile; removing it is best-effort.
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // Chrome may still hold the directory on Windows.
    }
  }
}

await main();
if (failures.length > 0) {
  console.error(`\n${failures.length} smoke check(s) failed:`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log("\nsmoke passed");
