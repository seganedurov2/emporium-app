#!/usr/bin/env node
//
// Shared Chrome DevTools Protocol harness for the
// tools/cdp-*.mjs checks.
//
// - discoverChrome(): finds a Chrome/Chromium binary
//   ($CHROME_PATH > Playwright's bundled Chromium >
//   system install locations > Edge on Windows).
// - launchChrome(): spawns it headless with a remote
//   debugging port and a throwaway profile.
// - CdpClient: minimal CDP driver over WebSocket
//   (request/response ids, event subscription,
//   Runtime.evaluate helper).
// - createDiagnosticsCollector(): wires console,
//   exception and failed-request capture onto a
//   client.
//
// Env:
//   CHROME_PATH — explicit Chrome/Chromium binary

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import net from "node:net";
import os from "node:os";
import { join } from "node:path";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- Chrome discovery -------------------------------------------------

function envChrome() {
  const candidate = process.env.CHROME_PATH;
  return candidate && existsSync(candidate) ? candidate : null;
}

function playwrightChrome() {
  // Playwright's browser cache, e.g.
  // %LOCALAPPDATA%\ms-playwright\chromium-1228\chrome-win64\chrome.exe
  const localAppData =
    process.env.LOCALAPPDATA ||
    join(os.homedir(), "AppData", "Local");
  const cacheDir = join(localAppData, "ms-playwright");
  const candidates = [];
  try {
    const revisions = readdirSync(cacheDir)
      .filter(name => /^chromium-\d+$/.test(name))
      .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
    for (const revision of revisions) {
      const dir = join(cacheDir, revision);
      candidates.push(
        join(dir, "chrome-win64", "chrome.exe"),
        join(dir, "chrome-win", "chrome.exe"),
        join(dir, "chrome-linux64", "chrome"),
        join(dir, "chrome-linux", "chrome"),
        join(dir, "chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
        join(dir, "chromium-mac", "Chromium.app", "Contents", "MacOS", "Chromium")
      );
    }
  } catch {
    return null; // no Playwright cache
  }
  return candidates.find(existsSync) || null;
}

function systemChrome() {
  const candidates = [];
  if (process.platform === "win32") {
    const programFiles = process.env["ProgramFiles"] || "C:\\Program Files";
    const programFilesX86 =
      process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    const localAppData =
      process.env.LOCALAPPDATA || join(os.homedir(), "AppData", "Local");
    candidates.push(
      join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
      // Edge shares the CDP surface; last resort on Windows.
      join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
      join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe")
    );
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    );
  } else {
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/snap/bin/chromium"
    );
  }
  return candidates.find(existsSync) || null;
}

/** Path to a Chrome/Chromium binary, or null when none is found. */
export function discoverChrome() {
  return envChrome() || playwrightChrome() || systemChrome();
}

// --- process / port helpers --------------------------------------------

/** A free TCP port on loopback (for the debugging server). */
export function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function waitForPageWsUrl(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find(
        target => target.type === "page" && target.webSocketDebuggerUrl
      );
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // DevTools endpoint not up yet.
    }
    await sleep(250);
  }
  throw new Error("Chrome DevTools endpoint never came up");
}

/**
 * Launches Chrome headless with a remote debugging
 * port and a throwaway profile. Call kill() on the
 * returned handle when done.
 */
export async function launchChrome({
  headless = true,
  port,
  extraArgs = [],
  width = 1600,
  height = 1000
} = {}) {
  const chromePath = discoverChrome();
  if (!chromePath) {
    throw new Error(
      "No Chrome/Chromium binary found — install Chrome or set CHROME_PATH"
    );
  }
  const debugPort = port ?? (await freePort());
  const profile = mkdtempSync(join(tmpdir(), "cdp-"));
  const args = [
    ...(headless ? ["--headless=new"] : []),
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    `--window-size=${width},${height}`,
    ...extraArgs,
    "about:blank"
  ];
  const chrome = spawn(chromePath, args, { stdio: "ignore" });
  const wsUrl = await waitForPageWsUrl(debugPort);
  return {
    chrome,
    chromePath,
    port: debugPort,
    profile,
    wsUrl,
    kill() {
      try {
        chrome.kill();
      } catch {
        // already gone
      }
    }
  };
}

// --- CDP client ---------------------------------------------------------

/** Minimal CDP driver: request/response ids + event handlers. */
export class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.handlers = new Map();
    ws.onmessage = event => this.dispatch(JSON.parse(event.data));
  }

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error(`WebSocket connection failed: ${wsUrl}`));
    });
    return new CdpClient(ws);
  }

  dispatch(message) {
    if (message.id !== undefined && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
      return;
    }
    if (message.method) {
      for (const handler of this.handlers.get(message.method) ?? []) {
        handler(message.params);
      }
      for (const handler of this.handlers.get("*") ?? []) {
        handler(message);
      }
    }
  }

  /** Subscribes to a CDP event (or "*" for all); returns an unsubscribe fn. */
  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event).push(handler);
    return () => {
      const list = this.handlers.get(event);
      if (!list) return;
      const index = list.indexOf(handler);
      if (index !== -1) list.splice(index, 1);
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Evaluates an expression in the page; returns its JSON value. */
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text ||
        "evaluation failed"
      );
    }
    return result.result?.value;
  }

  close() {
    this.ws.close();
  }
}

/** Enables the CDP domains the checks rely on. */
export async function enableDomains(client, ...domains) {
  for (const domain of domains) {
    await client.send(`${domain}.enable`);
  }
}

/**
 * Wires console, uncaught-exception and failed-request
 * capture onto a client. Returns the collected arrays.
 */
export function createDiagnosticsCollector(client) {
  const consoleMessages = [];
  const failedRequests = [];
  client.on("Runtime.consoleAPICalled", params => {
    if (["error", "warning"].includes(params.type)) {
      consoleMessages.push({
        level: params.type,
        text: (params.args ?? [])
          .map(arg => arg.value ?? arg.description ?? arg.type)
          .join(" ")
      });
    }
  });
  client.on("Runtime.exceptionThrown", params => {
    const details = params.exceptionDetails;
    consoleMessages.push({
      level: "uncaught",
      text: details.exception?.description || details.text
    });
  });
  client.on("Network.loadingFailed", params => {
    failedRequests.push({ url: params.url, error: params.errorText });
  });
  client.on("Network.responseReceived", params => {
    const { status, url } = params.response;
    if (status >= 400) failedRequests.push({ url, error: `HTTP ${status}` });
  });
  return { consoleMessages, failedRequests };
}
