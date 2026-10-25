/**
 * Telegram Mini App (WebApp) integration.
 *
 * The game runs inside Telegram's WebView as a Mini App: this module
 * detects the host, expands the app to the full viewport, mirrors the
 * Telegram theme into CSS custom properties and keeps the WebApp
 * viewport height in sync so layouts never clip behind Telegram's
 * header. Every call is guarded — outside Telegram the module is a no-op.
 */

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
}

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    chat?: { id: number; type: string; title?: string };
    chat_type?: string;
    chat_instance?: string;
    start_param?: string;
    can_send_after?: number;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  isVerticalSwipesEnabled: boolean;
  isVersionAtLeast(version: string): boolean;
  requestFullscreen(): void;
  exitFullscreen(): void;
  lockOrientation(orientation: 'portrait' | 'landscape'): void;
  unlockOrientation(): void;
  ready(): void;
  expand(): void;
  close(): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  onEvent(eventType: string, callback: (arg?: unknown) => void): void;
  offEvent(eventType: string, callback: (arg?: unknown) => void): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  openLink(url: string): void;
  openTelegramLink(url: string): void;
  sendData(data: string): void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show(params?: { text?: string; color?: string; textColor?: string }): void;
    hide(): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
    enable(): void;
    disable(): void;
    setText(text: string): void;
  };
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy'): void;
    notificationOccurred(type: 'error' | 'warning' | 'success'): void;
    selectionChanged(): void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
    sendEmporiumLogs?: () => boolean;
  }
}

/** Returns the Telegram WebApp instance, or null outside Telegram. */
export const getTelegramWebApp = (): TelegramWebApp | null =>
  typeof window === 'undefined' ? null : window.Telegram?.WebApp ?? null;

/** True when the game is running inside a Telegram Mini App. */
export const isTelegramMiniApp = (): boolean => getTelegramWebApp() !== null;

/** Telegram user that opened the Mini App, when available. */
export const getTelegramUser = (): TelegramUser | undefined =>
  getTelegramWebApp()?.initDataUnsafe.user;

const THEME_VAR_MAP: Record<string, string> = {
  bg_color: '--tg-bg-color',
  text_color: '--tg-text-color',
  hint_color: '--tg-hint-color',
  link_color: '--tg-link-color',
  button_color: '--tg-button-color',
  button_text_color: '--tg-button-text-color',
  secondary_bg_color: '--tg-secondary-bg-color',
  header_bg_color: '--tg-header-bg-color',
  accent_text_color: '--tg-accent-text-color',
  section_bg_color: '--tg-section-bg-color'
};

/** Mirrors Telegram's theme params into CSS custom properties. */
const applyThemeColors = (tg: TelegramWebApp): void => {
  const root = document.documentElement;
  for (const [param, cssVar] of Object.entries(THEME_VAR_MAP)) {
    const value = tg.themeParams[param as keyof TelegramThemeParams];
    if (value) root.style.setProperty(cssVar, value);
  }
  root.style.setProperty('--tg-color-scheme', tg.colorScheme);
};

/** Keeps the WebApp viewport height available as a CSS length. */
const syncViewportHeight = (tg: TelegramWebApp): void => {
  const height = tg.viewportHeight ?? window.innerHeight;
  document.documentElement.style.setProperty('--tg-viewport-height', `${height}px`);
};

/**
 * Prepares the game to run as a Telegram Mini App: reports readiness,
 * expands to the full viewport and paints the header/background to
 * match the app's dark theme. No-op when opened outside Telegram.
 */
export function initTelegramApp(): TelegramWebApp | null {
  const tg = getTelegramWebApp();
  if (!tg) return null;

  try { tg.ready(); } catch { /* older WebApp builds */ }
  try { tg.expand(); } catch { /* ignore */ }

  // Fullscreen mode unlocks landscape orientation in the Mini App
  // (Bot API 8.0+). Without it the app stays portrait-only.
  if (tg.isVersionAtLeast('8.0')) {
    try { tg.requestFullscreen(); } catch { /* older WebApp builds */ }
    try { tg.unlockOrientation(); } catch { /* ignore */ }
  }

  const dark = tg.colorScheme === 'dark';
  try {
    tg.setHeaderColor(dark ? '#0f172a' : '#f8fafc');
    tg.setBackgroundColor(dark ? '#020617' : '#f8fafc');
  } catch { /* ignore */ }

  applyThemeColors(tg);
  syncViewportHeight(tg);

  tg.onEvent('viewportChanged', () => syncViewportHeight(tg));
  tg.onEvent('themeChanged', () => applyThemeColors(tg));

  return tg;
}

export type OrientationLock = 'auto' | 'portrait' | 'landscape';

/**
 * Locks the Mini App orientation. 'auto' follows the device
 * sensor. Only effective in fullscreen Mini Apps (Bot API 8.0+);
 * outside Telegram this is a no-op.
 */
export function setOrientationLock(mode: OrientationLock): void {
  const tg = getTelegramWebApp();
  if (!tg || !tg.isVersionAtLeast('8.0')) return;
  try {
    if (mode === 'auto') {
      tg.unlockOrientation();
    } else {
      tg.lockOrientation(mode);
    }
  } catch { /* ignore */ }
}

const MAX_SEND_DATA_BYTES = 4096;

/**
 * Sends a payload to the bot via WebApp.sendData.
 *
 * Only available when the Mini App was launched from a
 * reply-keyboard web_app button; the Mini App closes right
 * after sending. The payload is truncated to Telegram's
 * 4096-byte limit. Returns false outside Telegram or when
 * the launch mode does not support sendData.
 */
export function sendDataToBot(data: unknown): boolean {
  const tg = getTelegramWebApp();
  if (!tg) return false;
  try {
    let payload = typeof data === 'string' ? data : JSON.stringify(data);
    if (payload.length > MAX_SEND_DATA_BYTES) {
      payload = payload.slice(0, MAX_SEND_DATA_BYTES);
    }
    tg.sendData(payload);
    return true;
  } catch {
    return false;
  }
}

export interface GraphicsInfo {
  /** A WebGL2 context could be created. */
  webgl2: boolean;
  /** A WebGL (1 or 2) context could be created. */
  webgl: boolean;
  /** Unmasked renderer string when the debug extension is exposed. */
  renderer?: string;
  /** Unmasked vendor string when the debug extension is exposed. */
  vendor?: string;
  /** GL version string. */
  version?: string;
  /** Set instead of the flags when probing threw or no context exists. */
  failure?: string;
}

/**
 * Probes the WebView's graphics stack: WebGL2/WebGL
 * support plus the unmasked renderer/vendor when the
 * WEBGL_debug_renderer_info extension is available.
 *
 * Sent with the diagnostics payload so 3D rollout
 * issues can be told apart — a working hardware GL,
 * a software renderer (SwiftShader/llvmpipe) and a
 * WebGL-blocked WebView look identical from the app
 * logic alone. Returns null outside a DOM.
 */
export function probeGraphicsInfo(): GraphicsInfo | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    const gl = gl2 ?? canvas.getContext('webgl');
    if (!gl) {
      return { webgl2: false, webgl: false, failure: 'no-webgl-context' };
    }
    const info: GraphicsInfo = {
      webgl2: Boolean(gl2),
      webgl: true,
      version: gl.getParameter(gl.VERSION)
    };
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      info.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      info.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    } else {
      info.renderer = gl.getParameter(gl.RENDERER);
      info.vendor = gl.getParameter(gl.VENDOR);
    }
    return info;
  } catch (err) {
    return {
      webgl2: false,
      webgl: false,
      failure: err instanceof Error ? err.message : String(err)
    };
  }
}

export interface CapturedError {
  kind: 'error' | 'unhandledrejection';
  message: string;
  stack?: string;
  url?: string;
  timestamp: number;
}

const capturedErrors: CapturedError[] = [];
const MAX_CAPTURED_ERRORS = 40;

function pushError(entry: CapturedError): void {
  capturedErrors.push(entry);
  if (capturedErrors.length > MAX_CAPTURED_ERRORS) capturedErrors.shift();
}

/** Buffers window errors and unhandled promise rejections. */
export function startErrorCapture(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (event: ErrorEvent) => {
    pushError({
      kind: 'error',
      message: event.message,
      stack: event.error?.stack,
      url: event.filename,
      timestamp: Date.now()
    });
  });
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    pushError({
      kind: 'unhandledrejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      timestamp: Date.now()
    });
  });
}

/** Errors captured since app start. */
export function getCapturedErrors(): CapturedError[] {
  return [...capturedErrors];
}

/** Collects diagnostics and sends them to the bot as Mini App data. */
export function sendLogsToBot(): boolean {
  const tg = getTelegramWebApp();
  return sendDataToBot({
    app: 'emporium',
    sentAt: new Date().toISOString(),
    telegram: tg
      ? { version: tg.version, platform: tg.platform, colorScheme: tg.colorScheme }
      : null,
    userAgent: typeof navigator === 'undefined' ? undefined : navigator.userAgent,
    viewport:
      typeof window === 'undefined'
        ? undefined
        : { width: window.innerWidth, height: window.innerHeight },
    graphics: probeGraphicsInfo(),
    errors: getCapturedErrors()
  });
}
