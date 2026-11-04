#!/usr/bin/env node
//
// Starts the Vite dev server together with the optional multiplayer hub
// (server/websocket-server.mjs) so multiplayer works locally without two
// terminals. Ctrl+C stops both.
//
//   npm run dev:full            # vite on its default port + hub on 5175
//   npm run dev:full -- 5174    # vite on 5174
//
// The hub is best-effort: if the port is taken (a hub already running) the
// script says so and keeps Vite alive.

import { spawn } from "node:child_process";

const HUB_PORT = process.env.PORT ?? "5175";
process.env.PORT = HUB_PORT;
const extraArgs = process.argv.slice(2);

// The client only dials the local hub from a localhost page (src/multiplayerConfig.ts),
// and a deployed build never dials it at all.
const children = [];
let stopping = false;

function start(cmd, args, label) {
  const child = spawn(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  children.push(child);
  child.on("exit", (code) => {
    if (stopping) return;
    if (label === "hub" && code !== 0) {
      console.warn(
        `[dev:full] hub exited with code ${code}. ` +
          `Is port ${HUB_PORT} already in use? Vite keeps running without multiplayer.`,
      );
      return;
    }
    stop(code ?? 0);
  });
  return child;
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      child.kill();
    } catch {
      // already gone
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

start(process.execPath, ["server/websocket-server.mjs"], "hub");
start("npx", ["vite", ...extraArgs], "vite");
