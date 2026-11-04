/**
 * Multiplayer hub address resolution.
 *
 * The studio hub (`server/websocket-server.mjs`, normally on port 5175) is an
 * optional service: production builds have no hub at all. Before this helper
 * every user reported a WebSocket error every two seconds because the default
 * address was dialled unconditionally.
 *
 * Rules:
 * - `VITE_WS_URL` wins when it holds a non-empty value; a relative path such as
 *   `/ws` is resolved against the page origin (and upgraded to `wss` on https).
 * - With no `VITE_WS_URL` at all, the local hub is only used from a localhost /
 *   127.0.0.1 page (development), never from a deployed build.
 * - An explicitly empty value disables multiplayer.
 */

export interface HubPageLocation {
  protocol: string;
  hostname: string;
  port: string;
  origin: string;
  secure: boolean;
}

export interface ResolveHubUrlInput {
  /** Raw `VITE_WS_URL`; `undefined`/`null` means "not configured". */
  configured: string | null | undefined;
  /** Current page location; defaults to the browser's own when available. */
  page?: HubPageLocation | null;
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
const LOCAL_HUB_PORT = 5175;
export const LOCAL_HUB_PATH = "/ws";

function currentPage(): HubPageLocation | null {
  if (typeof window === "undefined" || !window.location?.origin) return null;
  const { protocol, hostname, port, origin } = window.location;
  return { protocol, hostname, port, origin, secure: protocol === "https:" };
}

/** True when the page is served from this machine (dev server, preview). */
export function isLocalPage(page: HubPageLocation | null): boolean {
  return page !== null && LOCAL_HOSTNAMES.has(page.hostname);
}

/**
 * Returns the WebSocket URL to dial, or null when multiplayer must stay off.
 */
export function resolveHubUrl({
  configured,
  page,
}: ResolveHubUrlInput): string | null {
  if (typeof configured === "string") {
    const trimmed = configured.trim();
    if (!trimmed) return null;
    return resolveConfiguredUrl(trimmed, page ?? currentPage());
  }

  const current = page ?? currentPage();
  if (!current || !isLocalPage(current)) return null;
  // A plain http page can never reach a ws:// hub on another scheme/port without
  // a browser warning; https pages cannot reach ws:// at all, so use wss there
  // (the tunnel/proxy is expected to terminate TLS).
  return `${current.secure ? "wss" : "ws"}://${current.hostname}:${LOCAL_HUB_PORT}${LOCAL_HUB_PATH}`;
}

function resolveConfiguredUrl(
  configured: string,
  page: HubPageLocation | null,
): string | null {
  if (/^wss?:\/\//i.test(configured)) return configured;
  if (!page) return null;
  try {
    const url = new URL(configured, page.origin);
    // Same hub path, right scheme for the page: browsers block ws:// from https.
    url.protocol = page.secure ? "wss:" : "ws:";
    return url.toString();
  } catch {
    return null;
  }
}

/** Hub URL from the build-time environment, with the production-safe default. */
export const MULTIPLAYER_HUB_URL: string | null = resolveHubUrl({
  configured: import.meta.env?.VITE_WS_URL,
});

/**
 * Verifies that a hub WebSocket URL answers the `join` handshake.
 * Resolves true on `joined`, false on error, close or timeout.
 */
export function probeHub(url: string, room = "probe", timeoutMs = 4000): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // already closed
      }
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      finish(false);
      return;
    }
    socket.onopen = () => socket.send(JSON.stringify({ type: "join", room }));
    socket.onmessage = event => {
      try {
        if (JSON.parse(String(event.data)).type === "joined") finish(true);
      } catch {
        // ignore non-JSON frames
      }
    };
    socket.onerror = () => finish(false);
    socket.onclose = () => finish(false);
  });
}


