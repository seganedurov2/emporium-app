# Developer Guide: Pawn Pleasure

This guide provides instructions for managing the content and economic systems of the Pawn Pleasure project.

## 🖼 Asset Pipeline (Portraits)

### Generation
The project uses an automated AI pipeline to generate character portraits.
- **Command:** `npm run gen:portraits` or `node tools/generate-portraits.mjs [options]`
- **Key Options:**
    - `--region <id>`: Target region (e.g., `03_western_europe_nordics`).
    - `--gender <women|men|trans>`: Target gender.
    - `--count <n>`: Number of images to generate.
    - `--provider <pollinations|openai|sd|ollama>`: Image backend.
    - `--framing <full|head|chest>`: Use `full` for full-body shots.
    - `--style <sfw|bdsm>`: Visual aesthetic.

### Verification
To check if the images on disk match the counts in `src/portraitAssets.ts`:
- **Command:** `npm run verify:portraits`

---

## 🧊 3D Portraits (glTF)

Character portraits can render as 3D glTF models instead of WebP
images. The feature is gated by the `emporium_3d` setting (off by
default) and additionally requires WebGL2 and no
`prefers-reduced-data`; anything else keeps the 2D path.

### Asset layout
- Models live in `public/portraits3d/<region>/<gender>/` with the
  same naming as the 2D portraits (`portrait03w_001.glb`,
  CEO: `3mo.glb`). They are served as static files (Cloudflare
  Pages + R2 in production) — never imported into the Vite bundle.
- `PORTRAIT_3D_COUNTS` in `src/portraitAssets.ts` mirrors
  `PORTRAIT_COUNTS`; a character only gets a `model3d` URL when
  a model exists for their folder/sex.

### Generation backends
Raw `.glb` busts come from one of two interchangeable
backends (both write raw, uncompressed exports):
- **Procedural Node backend (default):**
  `node tools/generate-portraits-3d.mjs --region 03_western_europe_nordics --gender women --count 3`
  Deterministic (seeded), region-aware skin palettes,
  no Blender required — use this in CI.
- **Blender backend:**
  `blender --background --python tools/blender/generate_portraits.py -- --region 03_western_europe_nordics --gender women --count 3`
  Same parametric bust, for the authored-art workflow.

Both write to `models/raw/<region>/<gender>/raw_NNN.glb`
(see `--out`). Models are stylized mannequin busts —
placeholders that exercise the whole pipeline before
final artwork lands.

### Conversion pipeline
Raw `.glb`/`.gltf` exports (Blender or a 3D generation
backend) are optimized with gltf-transform (Draco meshes +
texture recompression) and named per the manifest scheme:
- **Command:** `npm run convert:portraits-3d` or
  `node tools/convert-portraits-3d.mjs --region 03_western_europe_nordics --gender women --src "models/raw/03_western_europe_nordics/women"`
- `--texture-compress ktx2` additionally requires KTX-Software
  4.4.0+ on PATH; the default `webp` works everywhere.
- **Verify:** `npm run verify:portraits-3d`
- Budget: warn over 150 KB per model (`--budget-kb`).

### R2 hosting (production)
Converted models are served from a Cloudflare R2 bucket
(declared in `wrangler.toml`), not from the Pages deploy:
- **Create/verify the bucket:** `npm run r2:setup`
  (bucket name: `--bucket` > `$EMPORIUM_R2_BUCKET` >
  `wrangler.toml` > `emporium-portraits3d`)
- **Upload `public/portraits3d/`:** `npm run r2:sync`
  (`--prefix`, `--delete` to prune stale objects,
  `--dry-run` to preview). Both need the wrangler CLI,
  authenticated (`wrangler login`).
- Per-file upload during conversion:
  `node tools/convert-portraits-3d.mjs --r2 <bucket>`.

### Render layer
- `src/components/Portrait3D.tsx` — drop-in card renderer:
  IntersectionObserver-gated, lazy-loads the R3F canvas, falls
  back to WebP on any failure.
- `src/components/Portrait3DCanvas.tsx` — the R3F canvas
  (`frameloop="demand"` for battery, full geometry/texture
  disposal on unmount).
- three.js + react-three-fiber are code-split into
  `three-vendor` and load only when a 3D portrait renders.

---

## 🕸 CDP checks (headless Chrome)

The `tools/cdp-*.mjs` checks drive headless Chrome over
the Chrome DevTools Protocol. Shared harness:
`tools/cdp-lib.mjs` — Chrome discovery (`$CHROME_PATH` >
Playwright's bundled Chromium > system installs > Edge),
headless launch with a throwaway profile, and a minimal
CDP client (`CdpClient`, `launchChrome`,
`createDiagnosticsCollector`).

- **Page smoke check:** `node tools/cdp-check.mjs [url] [shot.png]`
  — loads the game, reports console errors, failed
  requests, broken images, buttons; optional screenshot.
- **WebGL-off fallback:** `node tools/cdp-webgl-off.mjs [url] [shot.png]`
  — launches Chrome with `--disable-webgl`, enables the
  `emporium_3d` setting, reloads, and asserts that no
  WebGL2 context can be created and no R3F canvas mounts
  (portraits stay on the 2D WebP path). Exit code 0 =
  fallback verified. Run it against a live server:
  `npm run preview` (or `npm run dev`), then
  `node tools/cdp-webgl-off.mjs http://localhost:4173/`.

---

## 💬 Telegram Mini App diagnostics

The game runs inside Telegram's WebView (`src/telegram.ts`).
- `probeGraphicsInfo()` — probes WebGL2/WebGL support and
  the unmasked renderer/vendor (`WEBGL_debug_renderer_info`
  when available), so 3D rollout issues (hardware GL vs
  software renderer vs blocked WebGL) can be told apart.
- The in-app **Logs** button (and `window.sendEmporiumLogs`)
  calls `sendLogsToBot()`, which sends a JSON payload via
  `WebApp.sendData`: app stamp, Telegram version/platform,
  user agent, viewport, **graphics info**, and captured
  errors. The bot (`tools/telegram-mini-app-bot.mjs`)
  appends it to `logs/mini-app-<chat_id>.jsonl`.

---

## ✍️ AI Biography System

Character dossiers are generated using a local LLM via Ollama.
- **Command:** `node tools/generate-bios.mjs [model_name]`
- **Default Model:** `llama3`
- **Output:** All bios are saved to `public/portraits/bios.json`.
- **Requirement:** Ollama must be running on `http://127.0.0.1:11434`.

---

## 💰 Economic Systems

### Black Market (High Risk/High Reward)
- **Mechanism:** A hidden channel for selling captives.
- **Multiplier:** Prices are multiplied by **2.5x** compared to the open market.
- **Risk:** There is a **15% chance** of total cargo loss during delivery.
- **Logic:** Implemented in `src/slaveContractsEngine.ts`.

### Leasing System (Passive Income)
- **Mechanism:** Instead of selling, elite characters can be leased to third parties.
- **Calculation:** Weekly fee is a percentage of the character's market value (up to 2% for High Tier).
- **Cycle:** Revenue is collected weekly during the game's advance-week process.
- **Logic:** Defined in `src/gameEngine.ts` and `src/slaveContractsEngine.ts`.

---

## 🚀 Build & Deployment
- **Development:** `npm run dev`
- **Build:** `npm run build`
- **Android:** Use Capacitor to sync and open in Android Studio:
  `npx cap sync android` $\rightarrow$ `npx cap open android`
