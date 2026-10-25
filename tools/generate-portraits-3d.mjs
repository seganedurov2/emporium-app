#!/usr/bin/env node
//
// Procedural 3D portrait generator — the local "3D backend".
//
// Produces raw, uncompressed .glb portrait busts (low-poly,
// flat-shaded, no textures) that feed the conversion
// pipeline:
//
//   node tools/generate-portraits-3d.mjs --region 03_western_europe_nordics --gender women --count 3
//   node tools/convert-portraits-3d.mjs --region 03_western_europe_nordics --gender women --src "models/raw/03_western_europe_nordics/women"
//
// The Blender backend (tools/blender/generate_portraits.py)
// builds the same parametric bust inside Blender for the
// authored-art workflow; both write raw .glb exports that
// the converter optimizes (Draco + texture recompression).
//
// Models are stylized mannequin busts — placeholders that
// exercise the whole pipeline (generation -> conversion ->
// manifest -> R3F render) before final artwork lands.
//
// Safety: the same as the 2D pipeline — subjects are always
// adults (the game's age range is 18-60).
//

import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

// GLTFExporter is written for the browser and reads its output
// Blob through FileReader. Node has Blob but not FileReader, so
// provide the two methods the exporter uses (readAsArrayBuffer,
// readAsDataURL) before any export runs.
if (typeof globalThis.FileReader === "undefined") {
  class NodeFileReader {
    readAsArrayBuffer(blob) {
      blob
        .arrayBuffer()
        .then(buffer => {
          this.result = buffer;
          this.onloadend?.();
        })
        .catch(err => this.onerror?.(err));
    }
    readAsDataURL(blob) {
      blob
        .arrayBuffer()
        .then(buffer => {
          const base64 = Buffer.from(buffer).toString("base64");
          this.result = `data:${blob.type || "application/octet-stream"};base64,${base64}`;
          this.onloadend?.();
        })
        .catch(err => this.onerror?.(err));
    }
  }
  globalThis.FileReader = NodeFileReader;
}

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const MANIFEST_PATH = path.join(ROOT, "src", "portraitAssets.ts");

const GENDERS = ["women", "men", "trans"];
const DEFAULT_COUNT = 3;
const DEFAULT_SEED = 42;
const DEFAULT_OUT = "models/raw";

// --- deterministic RNG -------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

function jitter(rng, value, amount) {
  return value * (1 + (rng() * 2 - 1) * amount);
}

// --- palettes ----------------------------------------------------------

// Skin tones are hex colors; palettes are coarse and
// region-aware without claiming to be exhaustive.
const SKIN_PALETTES = {
  default: ["#f5d0b0", "#eec39a", "#e0aa7e", "#d69a68"],
  africa: ["#8d5a3b", "#7a4a2e", "#6b3d26", "#9c6a45"],
  eastAsia: ["#f2d4b8", "#e8c39e", "#dbb285", "#f5dcc0"],
  southAsia: ["#c98e5f", "#b87a4e", "#a06a42", "#d9a06e"],
  nordics: ["#f8dcc0", "#f0c8a4", "#e6b48c", "#fbdcc4"]
};

const HAIR_COLORS = [
  "#2b2b2b", "#4a3220", "#6e4a2f", "#8a6a45", "#b0906a",
  "#3a3a3a", "#5c5c5c", "#7a7a7a", "#a0a0a0", "#c0c0c0",
  "#5a3a28", "#7a4a2a", "#26221f"
];

const EYE_COLORS = ["#3b2f2f", "#4a3a2a", "#2f3a4a", "#3a4a3a", "#5a4632"];

function skinPalette(regionId) {
  if (/^(06|07|08|09)_/.test(regionId)) return SKIN_PALETTES.africa;
  if (/^(11|13)_/.test(regionId)) return SKIN_PALETTES.eastAsia;
  if (/^12_/.test(regionId)) return SKIN_PALETTES.southAsia;
  if (/^(03|14)_/.test(regionId)) return SKIN_PALETTES.nordics;
  return SKIN_PALETTES.default;
}

// Hair style pools per gender (weighted by repetition).
const HAIR_STYLES = {
  women: ["long", "long", "bun", "ponytail", "curly", "long"],
  men: ["short", "short", "short", "bald", "curly"],
  trans: ["short", "long", "bun", "ponytail", "curly", "short"]
};

// --- bust construction ---------------------------------------------------

function buildBust(rng, gender) {
  const group = new THREE.Group();

  const skin = new THREE.Color(pick(rng, skinPaletteCurrent));
  const hairColor = new THREE.Color(pick(rng, HAIR_COLORS));
  const eyeColor = new THREE.Color(pick(rng, EYE_COLORS));

  const skinMat = new THREE.MeshStandardMaterial({
    color: skin,
    roughness: 0.85,
    flatShading: true
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: hairColor,
    roughness: 0.95,
    flatShading: true
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: eyeColor,
    roughness: 0.4
  });

  // Head: low-segment sphere, slightly egg-shaped, per-model jitter.
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 14, 10),
    skinMat
  );
  head.scale.set(
    jitter(rng, 1.0, 0.08),
    jitter(rng, 1.22, 0.08),
    jitter(rng, 1.05, 0.08)
  );
  head.position.y = 1.55;
  group.add(head);

  // Neck.
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.21, 0.4, 10),
    skinMat
  );
  neck.position.y = 1.02;
  group.add(neck);

  // Shoulders / upper chest: tapered cylinder.
  const shoulders = new THREE.Mesh(
    new THREE.CylinderGeometry(
      jitter(rng, 0.92, 0.1),
      jitter(rng, 0.42, 0.08),
      jitter(rng, 0.62, 0.1),
      12
    ),
    skinMat
  );
  shoulders.position.y = 0.36;
  group.add(shoulders);

  // Face hints: eyes + nose.
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), eyeMat);
    eye.position.set(side * 0.17, 1.62, 0.42);
    group.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), skinMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.5, 0.52);
  group.add(nose);

  // Hair: style pool depends on gender.
  addHair(group, pick(rng, HAIR_STYLES[gender] ?? HAIR_STYLES.trans), hairMat, head);

  return group;
}

// The active skin palette is set per generation run (region-aware).
let skinPaletteCurrent = SKIN_PALETTES.default;

function addHair(group, style, hairMat, head) {
  const hair = new THREE.Group();
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.54, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMat
  );
  cap.position.copy(head.position);
  cap.scale.copy(head.scale).multiplyScalar(1.02);
  hair.add(cap);

  if (style === "long") {
    const back = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.42, 1.1, 10),
      hairMat
    );
    back.position.set(0, 1.05, -0.28);
    hair.add(back);
  } else if (style === "bun") {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), hairMat);
    bun.position.set(0, 2.15, -0.3);
    hair.add(bun);
  } else if (style === "ponytail") {
    const tail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.05, 0.85, 8),
      hairMat
    );
    tail.rotation.x = -0.5;
    tail.position.set(0, 1.95, -0.45);
    hair.add(tail);
  } else if (style === "curly") {
    for (let i = 0; i < 9; i++) {
      const curl = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 7, 5),
        hairMat
      );
      const angle = (i / 9) * Math.PI * 2;
      curl.position.set(
        Math.cos(angle) * 0.5,
        1.85 + Math.sin(i * 2.3) * 0.18,
        Math.sin(angle) * 0.5
      );
      hair.add(curl);
    }
  }
  // "short" and "bald" keep just the cap (bald: cap removed below).
  if (style === "bald") {
    hair.remove(cap);
  }
  group.add(hair);
}

// --- export --------------------------------------------------------------

async function exportGlb(scene) {
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      result => {
        if (result instanceof ArrayBuffer) resolve(Buffer.from(result));
        else reject(new Error("GLTFExporter returned JSON instead of binary"));
      },
      err => reject(err instanceof Error ? err : new Error(String(err))),
      { binary: true }
    );
  });
}

// --- manifest region list -------------------------------------------------

function listRegions() {
  const src = readFileSync(MANIFEST_PATH, "utf8");
  const start = src.indexOf("export const PORTRAIT_COUNTS");
  const block = src.slice(start, src.indexOf("export type PortraitSex"));
  const re = /^  '([^']+)': \{ men:/gm;
  const out = [];
  let m;
  while ((m = re.exec(block))) out.push(m[1]);
  return out;
}

// --- CLI ------------------------------------------------------------------

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
Procedural 3D portrait generator (raw .glb for convert-portraits-3d.mjs --src)

Usage:
  node tools/generate-portraits-3d.mjs [options]

Options:
  --region <ids>   Comma-separated region folder ids
                   (default: 03_western_europe_nordics;
                   use --list-regions to see all)
  --gender <g>     women | men | trans | all (default: all)
  --count <n>      Models per region/gender (default: ${DEFAULT_COUNT})
  --seed <n>       RNG seed (default: ${DEFAULT_SEED})
  --out <dir>      Output root (default: ${DEFAULT_OUT})
  --list-regions   Print known region folder ids
  --help           Show this help
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args["list-regions"]) {
    for (const region of listRegions()) console.log(region);
    return;
  }

  const regionIds = args.region
    ? String(args.region).split(",").map(s => s.trim()).filter(Boolean)
    : ["03_western_europe_nordics"];
  const known = new Set(listRegions());
  for (const regionId of regionIds) {
    if (!known.has(regionId)) {
      console.error(`error: unknown region "${regionId}" (see --list-regions)`);
      process.exitCode = 1;
      return;
    }
  }

  const genders = args.gender === "all" || args.gender === undefined
    ? GENDERS
    : [String(args.gender)];
  for (const gender of genders) {
    if (!GENDERS.includes(gender)) {
      console.error(`error: --gender must be one of ${GENDERS.join(", ")}, all`);
      process.exitCode = 1;
      return;
    }
  }

  const count = Number(args.count ?? DEFAULT_COUNT);
  const seed = Number(args.seed ?? DEFAULT_SEED);
  const outRoot = path.resolve(ROOT, String(args.out ?? DEFAULT_OUT));

  if (!Number.isFinite(count) || count < 1 || count > 200) {
    console.error("error: --count must be 1..200");
    process.exitCode = 1;
    return;
  }

  let generated = 0;
  for (const regionId of regionIds) {
    skinPaletteCurrent = skinPalette(regionId);
    for (const gender of genders) {
      const dir = path.join(outRoot, regionId, gender);
      await mkdir(dir, { recursive: true });
      for (let i = 0; i < count; i++) {
        const rng = mulberry32(seed + generated * 7919);
        const bust = buildBust(rng, gender);
        const buffer = await exportGlb(bust);
        const fileName = `raw_${String(i + 1).padStart(3, "0")}.glb`;
        await writeFile(path.join(dir, fileName), buffer);
        generated++;
        console.log(
          `generated ${path.join(regionId, gender, fileName)} (${(buffer.length / 1024).toFixed(1)} KB)`
        );
      }
    }
  }
  console.log(`\ndone: ${generated} raw models in ${outRoot}`);
  console.log("next: node tools/convert-portraits-3d.mjs --region <id> --gender <g> --src <out>/<region>/<gender>");
}

main().catch(err => {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
});
