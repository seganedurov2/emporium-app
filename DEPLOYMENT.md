# Deployment: GitHub Pages + Telegram Mini App

Two targets share one build:

- **GitHub Pages:** `https://<owner>.github.io/<repo>/`
  (for this repository: `https://seganedurov2.github.io/emporium-app/`)
- **Telegram Mini App / Web App:** the same URL, opened inside Telegram's WebView.

The build is served from a project subpath (`vite.config.ts` sets `base: './'`), and
`scripts/add-spa-404.mjs` writes `dist/404.html` so deep links boot the SPA.

## 1. GitHub Pages

The workflow `.github/workflows/deploy-pages.yml` builds on every push to `0.6.5`
and publishes `dist/` with `actions/deploy-pages`.

**One-time setup (repository owner):**

1. **Settings → Pages → Build and deployment → Source: "GitHub Actions".**
   Without this the `deploy` job fails with _"Get Pages site failed"_.
2. First push to `0.6.5` (or **Actions → Deploy to GitHub Pages → Run workflow**).
3. The job summary shows the URL; it is
   `https://seganedurov2.github.io/emporium-app/`
   (the bare `https://seganedurov2.github.io/` is the user site and serves a different
   repository, or nothing — use the project URL).

**Checks after the first deploy:**

- `https://seganedurov2.github.io/emporium-app/` loads the title screen.
- Open a deep link, e.g. `…/emporium-app/some/path` — the SPA still boots (404.html fallback).
- DevTools → Application → Service Workers: the PWA worker (`public/sw.js`) installs.

> GitHub Pages always serves over **https**. That matters for the optional multiplayer
> hub: a page on https cannot open `ws://`, so set `VITE_WS_URL` to a `wss://` address
> (see `DEVELOPER_GUIDE.md` → Multiplayer hub) or leave it unset. Multiplayer stays off
> and silent either way.

## 2. Telegram Mini App

1. Create a bot with [@BotFather](https://t.me/BotFather) and set the app URL:
   - **Menu button:** `/setmenubutton` → choose the bot → URL
     `https://seganedurov2.github.io/emporium-app/` → button title "Эмпориум".
   - **Web App link:** `/newapp` (or `/addwebapp`) → same URL.
2. Telegram requires **https** — GitHub Pages provides it.
3. Open the bot → menu button. The app runs in Telegram's WebView; the code detects it
   via `window.Telegram.WebApp` (`src/telegram.ts`).

### Launch modes and what works

| Launched from                   | `sendData` (Logs / reports to bot) | `shareMessage` |
| ------------------------------- | ---------------------------------- | -------------- |
| Reply-keyboard `web_app` button | yes                                | Bot API 8.0+   |
| Menu button / inline `web_app`  | **no**                             | Bot API 8.0+   |

`sendData` is only available when the user taps a reply-keyboard button; everywhere
else the Mini App must use `shareMessage` (see `shareAsTelegramMessage` in
`src/telegram.ts`), which shows Telegram's own chat picker.

### Mini App checklist

- The URL must be reachable without auth redirects; the app has its own local login.
- Android and iOS WebViews differ in WebGL — the in-app **Logs → send to bot** payload
  includes `probeGraphicsInfo()` so a 3D-portrait problem can be told from a 2D one.
- Test both launch modes before tagging a release: menu button (no `sendData`) and the
  reply-keyboard button.

## 3. Local production check

```powershell
npm run build:web
npx vite preview --port 4173 --strictPort
node tools/cdp-smoke.mjs http://localhost:4173/ smoke.png
```

The smoke test is what CI's `qa` job runs on pull requests.