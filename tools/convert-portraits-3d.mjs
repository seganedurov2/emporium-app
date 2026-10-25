#!/usr/bin/env node
//
// 3D portrait conversion pipeline for public/portraits3d/.
//
// Takes raw .glb/.gltf exports (from Blender or a 3D generation
// backend), optimizes them with gltf-transform (Draco mesh
// compression + texture recompression), names them per the
// manifest scheme, writes them under public/portraits3d/, and
// keeps PORTRAIT_3D_COUNTS in src/portraitAssets.ts in sync.
//
// Models are served as static files (Cloudflare Pages + R2 in
// production) — they are never imported into the Vite bundle.
//
// Usage:
//   node tools/convert-portraits-3d.mjs --region 03_western_europe_nordics --gender women --src "C:\models\raw"
//   node tools/convert-portraits-3d.mjs --region 99_CEO --gender men --src "C:\models\ceo"
//   node tools/convert-portraits-3d.mjs --verify
//   node tools/convert-portraits-3d.mjs --dry-run --region 03_western_europe_nordics --gender trans --src ...
//
// Options:
//   --texture-compress <webp|ktx2>   default webp (works everywhere);
//                                    ktx2 requires KTX-Software 4.4.0+
//                                    on PATH (https://github.com/KhronosGroup/KTX-Software)
//   --r2 <bucket>                    additionally upload to a Cloudflare
//                                    R2 bucket via `wrangler r2 object put`
//   --r2-prefix <path>               R2 key prefix (default: portraits3d)
//   --budget-kb <n>                  warn when a model exceeds this size (default 150)
//
// Safety: the same as the 2D pipeline — subjects are always adults
// (the game's age range is 18-60).
//

import { mkdir, readdir, stat } from "node:fs/promises";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const MODELS_DIR = path.join(ROOT, "public", "portraits3d");
const MANIFEST_PATH = path.join(ROOT, "src", "portraitAssets.ts");

const GENDER_LETTER = { women: "w", men: "m", trans: "t" };
const GENDERS = Object.keys(GENDER_LETTER);

const SOURCE_EXTENSIONS = [".glb", ".gltf"];
const DEFAULT_TEXTURE_COMPRESS = "webp";
const DEFAULT_BUDGET_KB = 150;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      args[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
3D portrait conversion pipeline for public/portraits3d/

Usage:
  node tools/convert-portraits-3d.mjs [options]
  node tools/convert-portraits-3d.mjs --verify

Options:
  --region <id>        Region folder id, e.g. 03_western_europe_nordics
                       (also 99_CEO)
  --gender <g>         women | men | trans
  --src <dir>          Directory with raw .glb/.gltf exports
  --texture-compress <webp|ktx2>   default webp; ktx2 needs
                       KTX-Software 4.4.0+ on PATH
  --r2 <bucket>        Upload results to a Cloudflare R2 bucket
                       (requires wrangler CLI, authenticated)
  --r2-prefix <path>   R2 key prefix (default: portraits3d)
  --budget-kb <n>      Size budget warning threshold (default 150)
  --delay <ms>         Pause between conversions (default 250)
  --dry-run            Print the plan without converting anything
  --verify             Compare on-disk model counts with the manifest
  --help               Show this help
`);
}

// --- manifest sync -------------------------------------------------------

// The 3D manifest block starts at this marker; line regexes are
// anchored inside the block so the 2D PORTRAIT_COUNTS above is
// never touched.
const MANIFEST_3D_MARKER = "export const PORTRAIT_3D_COUNTS";

function parseManifest3d() {
  const src = readFileSync(MANIFEST_PATH, "utf8");
  const start = src.indexOf(MANIFEST_3D_MARKER);
  if (start === -1) throw new Error("PORTRAIT_3D_COUNTS block not found in src/portraitAssets.ts");
  const block = src.slice(start);
  const re = /^  '([^']+)': \{ men: (\d+), trans: (\d+), women: (\d+) \},?$/gm;
  const out = {};
  let m;
  while ((m = re.exec(block))) {
    out[m[1]] = { men: Number(m[2]), trans: Number(m[3]), women: Number(m[4]) };
  }
  return out;
}

function updateManifest3dCounts(folderId, gender, added) {
  if (added <= 0) return true;
  const src = readFileSync(MANIFEST_PATH, "utf8");
  const start = src.indexOf(MANIFEST_3D_MARKER);
  if (start === -1) return false;
  const block = src.slice(start);
  const re = new RegExp(
    `^(  '${folderId}': \\{ men: )(\\d+)(, trans: )(\\d+)(, women: )(\\d+)( \\},?)$`,
    "m"
  );
  const m = block.match(re);
  if (!m) return false;
  const counts = { men: Number(m[2]), trans: Number(m[4]), women: Number(m[6]) };
  counts[gender] += added;
  const replacement = `${m[1]}${counts.men}${m[3]}${counts.trans}${m[5]}${counts.women}${m[7]}`;
  const nextBlock = block.replace(re, replacement);
  writeFileSync(MANIFEST_PATH, src.slice(0, start) + nextBlock);
  return true;
}

async function verifyManifest() {
  const manifest = parseManifest3d();
  const rows = [];
  let mismatches = 0;
  for (const [folder, expected] of Object.entries(manifest)) {
    for (const gender of GENDERS) {
      const dir = path.join(MODELS_DIR, folder, gender);
      const onDisk = (await listModels(dir)).length;
      const match = onDisk === expected[gender];
      if (!match) mismatches++;
      rows.push({ folder, gender, onDisk, expected: expected[gender], match });
    }
  }
  console.log("folder".padEnd(42), "gender".padEnd(7), "disk".padStart(5), "manifest".padStart(9), " ");
  for (const row of rows) {
    console.log(
      row.folder.padEnd(42),
      row.gender.padEnd(7),
      String(row.onDisk).padStart(5),
      String(row.expected).padStart(9),
      row.match ? "ok" : "MISMATCH"
    );
  }
  console.log(mismatches === 0 ? "\nAll counts match the manifest." : `\n${mismatches} mismatched count(s).`);
  return mismatches === 0;
}

async function listModels(dir) {
  try {
    return (await readdir(dir)).filter(name =>
      SOURCE_EXTENSIONS.includes(path.extname(name).toLowerCase())
    );
  } catch {
    return [];
  }
}

async function nextSequenceNumber(dir, regionCode, gender) {
  const letter = GENDER_LETTER[gender];
  const pattern = new RegExp(`^portrait${regionCode}${letter}_(\\d+)\\.glb$`, "i");
  let max = 0;
  for (const name of await listModels(dir)) {
    const m = name.match(pattern);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

function sequenceFileName(regionCode, gender, n) {
  return `portrait${regionCode}${GENDER_LETTER[gender]}_${String(n).padStart(3, "0")}.glb`;
}

// --- conversion --------------------------------------------------------

async function optimizeModel(srcPath, dstPath, textureCompress) {
  const args = [
    "optimize",
    srcPath,
    dstPath,
    "--compress", "draco",
    "--texture-compress", textureCompress,
    // Portrait models are already low-poly; simplification would
    // alter the authored geometry.
    "--simplify", "false"
  ];
  // Run the CLI's JS entry through node directly: spawning the
  // .bin shim (.cmd on Windows) fails with EINVAL on Node >= 22,
  // and this form is spaces-safe on every platform.
  const cliEntry = path.join(
    ROOT, "node_modules", "@gltf-transform", "cli", "bin", "cli.js"
  );
  const { stderr } = await execFileAsync(
    process.execPath,
    [cliEntry, ...args],
    { maxBuffer: 16 * 1024 * 1024 }
  );
  if (stderr && /error/i.test(stderr)) throw new Error(stderr.trim().split("\n").pop());
}

async function uploadToR2(bucket, key, filePath) {
  // wrangler must be installed and authenticated (wrangler login).
  await execFileAsync("wrangler", [
    "r2", "object", "put",
    `${bucket}/${key}`,
    "--file", filePath
  ], { stdio: "inherit" });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args.verify) {
    process.exitCode = (await verifyManifest()) ? 0 : 1;
    return;
  }

  const regionId = args.region;
  const gender = args.gender;
  const srcDir = args.src;
  const textureCompress = args["texture-compress"] ?? DEFAULT_TEXTURE_COMPRESS;
  const r2Bucket = args.r2;
  const r2Prefix = args["r2-prefix"] ?? "portraits3d";
  const budgetKb = Number(args["budget-kb"] ?? DEFAULT_BUDGET_KB);
  const delay = Number(args.delay ?? 250);
  const dryRun = !!args["dry-run"];

  if (!regionId) {
    console.error("error: --region is required (or use --verify / --help)");
    process.exitCode = 1;
    return;
  }
  if (!GENDERS.includes(gender)) {
    console.error(`error: --gender must be one of ${GENDERS.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  if (!["webp", "ktx2"].includes(textureCompress)) {
    console.error("error: --texture-compress must be webp or ktx2");
    process.exitCode = 1;
    return;
  }
  if (!srcDir) {
    console.error("error: --src <dir> is required");
    process.exitCode = 1;
    return;
  }

  const isCeo = regionId === "99_CEO";
  const regionCode = isCeo ? "99" : regionId.slice(0, 2);
  const dir = path.join(MODELS_DIR, regionId, gender);

  const sources = (await readdir(srcDir))
    .filter(name => SOURCE_EXTENSIONS.includes(path.extname(name).toLowerCase()))
    .sort();
  if (sources.length === 0) {
    console.error(`error: no .glb/.gltf files in "${srcDir}"`);
    process.exitCode = 1;
    return;
  }

  let nextSeq = await nextSequenceNumber(dir, regionCode, gender);
  await mkdir(dir, { recursive: true });

  const saved = [];
  const failures = [];
  const overBudget = [];

  for (const sourceName of sources) {
    const sourcePath = path.join(srcDir, sourceName);
    let fileName;
    if (isCeo) {
      // CEO models keep the 2D CEO naming: <index><suffix>.glb (e.g. 3mo.glb).
      fileName = `${path.basename(sourceName, path.extname(sourceName))}.glb`;
    } else {
      fileName = sequenceFileName(regionCode, gender, nextSeq);
      nextSeq++;
    }
    const dstPath = path.join(dir, fileName);

    if (dryRun) {
      console.log(`would convert ${sourceName} -> ${path.join(regionId, gender, fileName)}`);
      saved.push(fileName);
      continue;
    }

    try {
      await optimizeModel(sourcePath, dstPath, textureCompress);
    } catch (err) {
      failures.push(`${sourceName}: ${err.message}`);
      console.error(`failed ${sourceName}: ${err.message}`);
      continue;
    }

    const sizeKb = (await stat(dstPath)).size / 1024;
    if (sizeKb > budgetKb) overBudget.push({ fileName, sizeKb });
    saved.push(fileName);
    console.log(`saved ${path.join(regionId, gender, fileName)} (${sizeKb.toFixed(1)} KB)`);

    if (r2Bucket) {
      try {
        await uploadToR2(r2Bucket, `${r2Prefix}/${regionId}/${gender}/${fileName}`, dstPath);
        console.log(`  uploaded to r2://${r2Bucket}/${r2Prefix}/${regionId}/${gender}/${fileName}`);
      } catch (err) {
        failures.push(`r2 upload ${fileName}: ${err.message}`);
        console.error(`  r2 upload failed for ${fileName}: ${err.message}`);
      }
    }

    if (delay > 0) await sleep(delay);
  }

  if (!dryRun && saved.length > 0) {
    const ok = updateManifest3dCounts(regionId, gender, saved.length);
    if (ok) {
      console.log(`manifest updated: ${regionId}/${gender} +${saved.length}`);
    } else {
      console.warn(`warning: could not update PORTRAIT_3D_COUNTS for "${regionId}" - edit src/portraitAssets.ts by hand`);
    }
  }

  console.log(`\ndone: ${saved.length} converted, ${failures.length} failed`);
  for (const f of failures) console.log(`  failed: ${f}`);
  if (overBudget.length > 0) {
    console.log(`\nover ${budgetKb} KB budget (consider more Draco/texture compression):`);
    for (const item of overBudget) console.log(`  ${item.fileName}: ${item.sizeKb.toFixed(1)} KB`);
  }
  if (failures.length > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
});
