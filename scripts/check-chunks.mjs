/**
 * Post-build guard for the split bundles.
 *
 * Rolldown (Vite 8) splits node_modules into nested vendor chunks and, when a
 * cyclic import lands on a chunk boundary, leaves a class that is still being
 * initialised as `undefined` at the point another chunk uses it. The result is
 * a runtime `X is not a constructor` deep inside the 3D scene, invisible to
 * `tsc` and to the test suite.
 *
 * Run after `vite build`:
 *   node scripts/check-chunks.mjs [distDir]
 *
 * Exit code 1 when any module crosses a three-vendor<->app-chunk boundary,
 * which is exactly the shape of that bug.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const distDir = process.argv[2] ?? "dist";
const assetsDir = join(distDir, "assets");

const IMPORT_RE = /\b(?:import|from)\s*\(?\s*"([^"]+)"\s*\)?/g;

const files = readdirSync(assetsDir).filter((name) => name.endsWith(".js"));
const modules = files.map((name) => {
  const code = readFileSync(join(assetsDir, name), "utf8");
  const imports = new Set();
  for (const match of code.matchAll(IMPORT_RE)) {
    const target = match[1];
    if (target.startsWith("./")) imports.add(target.slice(2));
  }
  return { name, size: statSync(join(assetsDir, name)).size, imports };
});

// Runtime and React are shared by every chunk; crossing into them is normal.
const SHARED_CHUNK = /^(rolldown-runtime|react-vendor)-/;

const problems = [];
for (const mod of modules) {
  const modIsThree = mod.name.startsWith("three-vendor-");
  // Only three.js is guarded: it is the library whose cyclic spot lives on a
  // chunk boundary. Plain vendor/ui/entry edges are normal chunk splits.
  if (!modIsThree) continue;
  for (const target of mod.imports) {
    if (SHARED_CHUNK.test(target) || target.startsWith("three-vendor-")) continue;
    problems.push({ from: mod.name, to: target });
  }
}

if (problems.length > 0) {
  console.error(
    "Chunk boundary check failed: three.js is split into chunks that import app code.",
  );
  for (const p of problems) {
    console.error(`  ${p.from} -> ${p.to}`);
  }
  console.error(
    "\nA cyclic import that crosses this boundary leaves a class undefined at\n" +
      'runtime ("x is not a constructor"). Fix the import graph or build three.js\n' +
      "into the app chunks (see vite.config.ts).",
  );
  process.exit(1);
}

const total = modules.reduce((sum, mod) => sum + mod.size, 0);
console.log(
  `Chunk boundary check passed: ${modules.length} modules, ${(total / 1024).toFixed(0)} KiB in ${relative(process.cwd(), assetsDir) || assetsDir}.`,
);
