/**
 * GitHub Pages fallback for the web build: copy `dist/index.html` to
 * `dist/404.html`.
 *
 * `_redirects` is a Netlify/Cloudflare format and GitHub Pages ignores it, so
 * a nested URL (/emporium-app/mezzanine, a Telegram Mini App deep link) used to
 * answer with GitHub's 404 page. Pages does serve 404.html for unknown paths,
 * so pointing it at the same entry loads the app and lets it restore state from
 * the save. Asset URLs are relative (`base: './'`), so the copy resolves them
 * against the directory the URL lives in — fine for one level of nesting.
 *
 * Runs automatically after `vite build` (see the `build` script).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const distDir = process.argv[2] ?? "dist";
const source = readFileSync(join(distDir, "index.html"), "utf8");
const fallback = source.replace(
  "</head>",
  `\n    <!-- GitHub Pages fallback: make this file a copy of index.html (scripts/add-spa-404.mjs). -->\n  </head>`,
);
writeFileSync(join(distDir, "404.html"), fallback);
console.log(`SPA fallback written: ${join(distDir, "404.html")}`);
