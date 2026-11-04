import { describe, expect, it } from "vitest";
import { resolveHubUrl } from "./multiplayerConfig";

const pageUrl = (href: string) => {
  const url = new URL(href);
  return {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    origin: url.origin,
    secure: url.protocol === "https:",
  };
};

describe("multiplayer hub URL", () => {
  it("stays disabled until a hub is configured", () => {
    expect(resolveHubUrl({ configured: "" })).toBeNull();
    expect(resolveHubUrl({ configured: undefined })).toBeNull();
    expect(resolveHubUrl({ configured: "   " })).toBeNull();
  });

  it("accepts an absolute hub URL as-is", () => {
    expect(resolveHubUrl({ configured: "wss://hub.example.com/ws" })).toBe(
      "wss://hub.example.com/ws",
    );
    expect(resolveHubUrl({ configured: "ws://127.0.0.1:5200/ws" })).toBe(
      "ws://127.0.0.1:5200/ws",
    );
  });

  it("resolves a relative path against the page origin", () => {
    const page = pageUrl("http://localhost:5173/");
    expect(resolveHubUrl({ configured: "/ws", page })).toBe(
      "ws://localhost:5173/ws",
    );
  });

  it("uses wss on an https page", () => {
    const page = pageUrl("https://emporium.example.com/game/");
    expect(resolveHubUrl({ configured: "/ws", page })).toBe(
      "wss://emporium.example.com/ws",
    );
  });

  it("only enables the default local hub on a localhost dev page", () => {
    expect(
      resolveHubUrl({
        configured: null,
        page: pageUrl("http://localhost:5173/"),
      }),
    ).toBe("ws://localhost:5175/ws");
    expect(
      resolveHubUrl({
        configured: null,
        page: pageUrl("http://127.0.0.1:5174/"),
      }),
    ).toBe("ws://127.0.0.1:5175/ws");
    expect(
      resolveHubUrl({
        configured: null,
        page: pageUrl("https://localhost:5173/"),
      }),
    ).toBe("wss://localhost:5175/ws");
    // Production builds must not hammer a hub that does not exist.
    expect(
      resolveHubUrl({
        configured: null,
        page: pageUrl("https://emporium.example.com/"),
      }),
    ).toBeNull();
    expect(
      resolveHubUrl({
        configured: null,
        page: pageUrl("file:///C:/game/index.html"),
      }),
    ).toBeNull();
  });

  it("never falls back to the relative path for an empty configured value", () => {
    // An explicitly empty VITE_WS_URL means "no multiplayer", even locally.
    expect(
      resolveHubUrl({
        configured: "",
        page: pageUrl("http://localhost:5173/"),
      }),
    ).toBeNull();
  });
});
