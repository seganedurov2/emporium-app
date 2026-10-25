#!/usr/bin/env node
//
// Minimal CDP check: loads the game in headless Chrome,
// captures console errors + failed requests and dumps a
// JSON report. Chrome discovery and the CDP driver live
// in cdp-lib.mjs (shared with cdp-webgl-off.mjs).
//
//   node tools/cdp-check.mjs [url] [shot.png]
//
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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const browser = await launchChrome();
try {
  const client = await CdpClient.connect(browser.wsUrl);
  const diagnostics = createDiagnosticsCollector(client);
  await enableDomains(client, "Runtime", "Network", "Page");

  await client.send("Page.navigate", { url: URL_ });
  await sleep(4000);

  const report = {
    chrome: browser.chromePath,
    title: await client.evaluate("document.title"),
    bodyChars: await client.evaluate("document.body.innerText.length"),
    bodyText: ((await client.evaluate("document.body.innerText")) || "").slice(0, 700),
    buttons: await client.evaluate(
      `[...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(Boolean).slice(0, 40)`
    ),
    imgCount: await client.evaluate(`document.querySelectorAll('img').length`),
    brokenImages: await client.evaluate(
      `[...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')).slice(0, 15)`
    ),
    okImages: await client.evaluate(
      `[...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth > 0).length`
    ),
    localStorageKeys: await client.evaluate("Object.keys(localStorage)"),
    consoleErrors: diagnostics.consoleMessages.slice(0, 25),
    failedRequests: diagnostics.failedRequests.slice(0, 25)
  };

  if (SHOT) {
    const shot = await client.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(SHOT, Buffer.from(shot.data, "base64"));
    report.screenshot = SHOT;
  }

  console.log(JSON.stringify(report, null, 2));
} finally {
  browser.kill();
}
process.exit(0);
