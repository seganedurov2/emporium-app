#!/usr/bin/env node
//
// Verifies the 2D portrait fallback when WebGL is
// unavailable: launches Chrome with WebGL disabled
// (--disable-webgl), turns the emporium_3d setting
// on, loads the game and asserts that
//   1. no WebGL2 context can be created, and
//   2. no R3F canvas mounts — portraits stay on the
//      2D WebP path (Portrait3D renders <img>).
//
//   node tools/cdp-webgl-off.mjs [url] [shot.png]
//
// Exit code 0 = fallback verified, 1 = failure.
// Env:
//   CHROME_PATH — explicit Chrome/Chromium binary

import { writeFileSync } from "node:fs";
import {
  CdpClient,
  createDiagnosticsCollector,
  enableDomains,
  launchChrome
} from "./cdp-lib.mjs";

const URL_ = process.argv[2] || "http://localhost:5173/";
const SHOT = process.argv[3] || "";
const SETTINGS_KEY = "emporium_settings";
// Mirrors DEFAULT_SETTINGS in src/settings.ts with the
// 3D flag forced on, so the fallback is actually exercised.
const SETTINGS_VALUE = JSON.stringify({
  orientation: "auto",
  notifications: true,
  emporium_3d: true
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Resolves on the next Page.loadEventFired (or after timeoutMs). */
function waitForLoad(client, timeoutMs = 20000) {
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeoutMs);
    const unsubscribe = client.on("Page.loadEventFired", () => {
      clearTimeout(timer);
      unsubscribe();
      resolve(true);
    });
  });
}

async function navigate(client, url) {
  const loadDone = waitForLoad(client);
  await client.send("Page.navigate", { url });
  await loadDone;
  // Let the SPA mount before probing the DOM.
  await sleep(1500);
}

/** Fails fast when the page did not reach the expected origin. */
async function assertOrigin(client, url) {
  const href = await client.evaluate("location.href");
  if (!href.startsWith(url)) {
    throw new Error(`page did not load: expected ${url}, got ${href}`);
  }
}

const browser = await launchChrome({ extraArgs: ["--disable-webgl"] });
try {
  const client = await CdpClient.connect(browser.wsUrl);
  const diagnostics = createDiagnosticsCollector(client);
  await enableDomains(client, "Runtime", "Network", "Page");

  // First load establishes the origin so the setting
  // can be flipped for the reload below.
  await navigate(client, URL_);
  await assertOrigin(client, URL_);
  await client.evaluate(
    `localStorage.setItem(${JSON.stringify(SETTINGS_KEY)}, ${JSON.stringify(SETTINGS_VALUE)})`
  );

  // Reload with the 3D flag on and WebGL disabled.
  const loadDone = waitForLoad(client);
  await client.send("Page.reload");
  await loadDone;
  await sleep(1500);
  await assertOrigin(client, URL_);

  // The same probe the app uses (src/portrait3dSupport.ts
  // supportsWebGL2) — must fail in this Chrome instance.
  const webgl2Available = await client.evaluate(
    `Boolean(document.createElement("canvas").getContext("webgl2"))`
  );
  const webglAvailable = await client.evaluate(
    `Boolean(document.createElement("canvas").getContext("webgl"))`
  );
  // R3F mounts a <canvas> per 3D portrait; the 2D path
  // renders <img> elements instead.
  const canvasCount = await client.evaluate(
    `document.querySelectorAll("canvas").length`
  );
  const portraitImgCount = await client.evaluate(
    `document.querySelectorAll('img[src*="/portraits/"]').length`
  );
  const settings = await client.evaluate(
    `localStorage.getItem(${JSON.stringify(SETTINGS_KEY)})`
  );

  const report = {
    chrome: browser.chromePath,
    url: URL_,
    launchArgs: ["--disable-webgl"],
    webgl2Available,
    webglAvailable,
    canvasCount,
    portraitImgCount,
    settings,
    consoleErrors: diagnostics.consoleMessages.slice(0, 25),
    failedRequests: diagnostics.failedRequests.slice(0, 25),
    checks: {
      webgl2Unavailable: webgl2Available === false,
      noR3fCanvas: canvasCount === 0
    }
  };

  if (SHOT) {
    const shot = await client.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(SHOT, Buffer.from(shot.data, "base64"));
    report.screenshot = SHOT;
  }

  console.log(JSON.stringify(report, null, 2));

  const ok = report.checks.webgl2Unavailable && report.checks.noR3fCanvas;
  console.log(
    ok
      ? "\nPASS: WebGL2 unavailable and no R3F canvas mounted — 2D fallback verified"
      : "\nFAIL: expected WebGL2 to be unavailable and no R3F canvas in the DOM"
  );
  if (!ok) process.exitCode = 1;
} finally {
  browser.kill();
}
process.exit(process.exitCode ?? 0);
