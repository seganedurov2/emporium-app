#!/usr/bin/env node
//
// AI portrait generation pipeline for public/portraits/.
//
// Builds region/gender/age-aware prompts, calls an image backend, converts
// the result to lossy WebP q90 at the recommended portrait size, saves it
// under the correct folder with the next sequential file name, and keeps
// PORTRAIT_COUNTS in src/portraitAssets.ts in sync.
//
// Backends:
//   openai       DALL-E 3 via the OpenAI API       (env OPENAI_API_KEY)
//   pollinations free keyless API, Flux/SDXL       (https://pollinations.ai)
//   ollama       local Ollama image model            (env OLLAMA_ENDPOINT, default http://127.0.0.1:11434)
//                  NOTE: Ollama image models require the MLX runtime - macOS only.
//                  They do not run on Windows or Linux Ollama builds.
//   sd           Stable Diffusion WebUI (A1111) API   (env SD_ENDPOINT, default http://127.0.0.1:7860)
//                  Unfiltered local backend - the only adult-content-capable option.
//   copy         copy existing image files            (--src <dir>)
//
// Safety: prompts always describe ADULT subjects (the game's age range is
// 18-60). The "bdsm" style is a non-explicit adult aesthetic (fetish
// wardrobe, moody atmosphere). Never use this pipeline to generate images
// of minors or explicit content.
//
// Usage:
//   node tools/generate-portraits.mjs --region 03_western_europe_nordics --gender women --count 10 --provider openai
//   node tools/generate-portraits.mjs --region 07_west_africa --gender men --count 5 --provider sd --age young
//   node tools/generate-portraits.mjs --region 15_roma --gender trans --count 4 --provider copy --src "C:\photos"
//   node tools/generate-portraits.mjs --dry-run --region 11_east_asia --gender women --count 3
//   node tools/generate-portraits.mjs --verify
//

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORTRAITS_DIR = path.join(ROOT, "public", "portraits");
const MANIFEST_PATH = path.join(ROOT, "src", "portraitAssets.ts");

const GENDER_LETTER = { women: "w", men: "m", trans: "t" };
const GENDERS = Object.keys(GENDER_LETTER);

const AGE_RANGES = {
  young: [18, 30],
  middle: [31, 45],
  older: [46, 60],
  random: [18, 60],
};

// Appearance descriptors per region folder. The game links a picture to a
// character only by folder location, so the prompt must match the folder the
// file lands in.
const REGIONS = [
  { id: "01_north_america_central_caribbean", appearance: "of North American, Central American or Caribbean heritage, diverse facial features, tanned skin" },
  { id: "02_south_america", appearance: "of South American heritage, olive skin, expressive features" },
  { id: "03_western_europe_nordics", appearance: "nordic appearance, fair skin, light blonde or ash blonde hair, blue or green eyes, sharp facial features" },
  { id: "04_eastern_europe_balkans_european_russia", appearance: "slavic appearance, pale skin, light brown or ash blonde hair, soft facial features" },
  { id: "05_middle_east_caucasus", appearance: "of Middle Eastern or Caucasian heritage, almond-shaped eyes, olive skin" },
  { id: "06_north_africa_sahara_horn", appearance: "of North African, Saharan or Horn of African heritage, deep skin tones, distinct facial structure" },
  { id: "07_west_africa", appearance: "of West African heritage, dark rich skin, full lips, expressive eyes" },
  { id: "08_central_africa", appearance: "of Central African heritage, deep skin tones, athletic build" },
  { id: "09_east_south_africa", appearance: "of East African or Southern African heritage, elegant facial features, deep skin" },
  { id: "10_central_asia_siberia", appearance: "of Central Asian or Siberian heritage, mixed east-west features, high cheekbones" },
  { id: "11_east_asia", appearance: "east asian appearance, porcelain skin, straight black hair, almond-shaped eyes" },
  { id: "12_south_asia", appearance: "of South Asian heritage, warm skin tones, dark hair, deep brown eyes" },
  { id: "13_southeast_asia", appearance: "of Southeast Asian heritage, golden skin, soft features" },
  { id: "14_australia_oceania", appearance: "of Australian or Oceanian heritage, tanned skin, athletic appearance" },
  { id: "15_roma", appearance: "Roma heritage, olive skin, curly dark hair, expressive dark eyes" },
  { id: "16_jewish_diaspora", appearance: "of Jewish diaspora heritage, distinct facial structure, expressive eyes" },
  { id: "17_kurdish", appearance: "Kurdish heritage, olive skin, strong facial features" },
  { id: "18_assyrian", appearance: "Assyrian heritage, distinct middle eastern features" },
  { id: "19_native_american", appearance: "Native American heritage, copper skin, strong cheekbones" },
  { id: "20_maya", appearance: "Maya heritage, indigenous central american features" },
  { id: "21_andean", appearance: "Andean heritage, indigenous south american features" },
];

const LIGHTING = [
  "soft studio lighting",
  "natural window light",
  "warm golden-hour light",
  "gentle rim lighting",
  "soft diffused daylight",
];

const BACKGROUNDS = [
  "neutral grey studio background",
  "soft blurred neutral background",
  "muted earth-toned background",
  "plain dark charcoal background",
  "soft cream-colored background",
];

const FRAMINGS = [
  "head and shoulders portrait",
  "three-quarter view portrait",
  "medium shot from the chest up",
];

// Full-body framings for --framing full (head-to-feet character shots).
const FULL_BODY_FRAMINGS = [
  "full-body portrait, head to feet visible",
  "full-length portrait of the complete figure",
];

const FRAMING_CHOICES = {
  head: ["head and shoulders portrait"],
  "three-quarter": ["three-quarter view portrait"],
  chest: ["medium shot from the chest up"],
  full: FULL_BODY_FRAMINGS,
};

// Style presets. "bdsm" is a non-explicit adult aesthetic:
// fetish wardrobe and moody atmosphere, subjects always 18+.
const STYLES = {
  sfw: { 
    wardrobe: [
      "professional casual clothing",
      "elegant simple attire",
      "classic modern outfit",
      "neutral daily wear",
    ], 
    atmosphere: [
      "soft professional studio light",
      "natural daytime atmosphere",
      "bright airy environment",
    ] 
  },
  bdsm: {
    wardrobe: [
      "black glossy latex bodysuit with matching gloves",
      "leather corset with metal studs and straps",
      "black vinyl catsuit, high gloss",
      "leather harness with straps and buckles",
      "PVC outfit with matching boots",
      "lace-and-leather fetish ensemble",
    ],
    atmosphere: [
      "dim dungeon lighting with moody red rim light",
      "dark moody studio with dramatic shadows",
      "industrial loft with candle glow and deep contrast",
      "underground club atmosphere with neon accents",
    ],
  },
  adult: {
    wardrobe: [
      "detailed shibari rope bondage art",
      "elaborate black leather bondage harness",
      "tight transparent latex outfit",
      "fetish gear with metal rings and chains",
      "bondage restraints and leather straps",
      "intricate rope bondage pattern",
    ],
    atmosphere: [
      "dark adult studio, provocative mood, cinematic lighting",
      "underground fetish club lighting, deep red and black tones",
      "moody industrial dungeon atmosphere, high contrast",
      "private luxury dungeon setting, velvet and leather",
    ],
  },
};

const QUALITY_BASE = "score_9, score_8_up, score_7_up, photorealistic, 8k uhd, masterpiece, highres, ultra-detailed, sharp focus, cinematic lighting";

const NEGATIVE_PROMPT = [
  "score_4, score_5, score_6, minor, child, teenager, underage, cartoon, anime, 3d render, painting, drawing, illustration, text, watermark, signature, logo, nudity, explicit, sexual, deformed, disfigured, bad anatomy, extra fingers, mutated hands, blurry, low quality, jpeg artifacts, bad hands, missing fingers",
].join(", ");

// Recommended library format: lossy WebP q90, about 768x1152.
const TARGET_WIDTH = 768;
const TARGET_HEIGHT = 1152;
const WEBP_QUALITY = 90;

const SUPPORTED_EXTENSIONS = [".webp", ".png", ".jpg", ".jpeg"];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RETRY_STATUS = new Set([402, 408, 429, 500, 502, 503, 504]);

async function fetchWithRetry(url, { label, attempts = 4, baseDelay = 2000, ...options }) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let res;
    try {
      res = await fetch(url, { ...options, signal: AbortSignal.timeout(180000) });
    } catch (err) {
      lastError = err;
      if (attempt === attempts) break;
      const wait = baseDelay * 2 ** (attempt - 1);
      console.warn(`  ${label}: network error, retry ${attempt}/${attempts - 1} in ${wait}ms`);
      await sleep(wait);
      continue;
    }
    if (res.ok) return res;
    const body = await res.text();
    if (!RETRY_STATUS.has(res.status) || attempt === attempts) {
      throw new Error(`${label} ${res.status}: ${body.slice(0, 300)}`);
    }
    const wait = res.status === 402 ? 15000 * attempt : baseDelay * 2 ** (attempt - 1);
    console.warn(`  ${label}: HTTP ${res.status}, retry ${attempt}/${attempts - 1} in ${wait}ms`);
    await sleep(wait);
  }
  throw lastError;
}

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
Portrait generation pipeline for public/portraits/

Usage:
  node tools/generate-portraits.mjs [options]
  node tools/generate-portraits.mjs --verify

Options:
  --region <id>        Region folder id, e.g. 03_western_europe_nordics
                       (also 99_CEO and other)
  --gender <g>         women | men | trans
  --count <n>          Images to generate (default 1)
  --provider <p>       openai | pollinations | ollama | sd | copy (default openai)
  --model <m>          Ollama image model (default x/z-image-turbo, macOS only)
  --style <s>          sfw (default) | bdsm (non-explicit adult aesthetic)
  --framing <f>        head | three-quarter | chest | full | random (default random)
  --age <a>            young (18-30) | middle (31-45) | older (46-60) | random (default)
  --trans-variant <v>  mtf | ftm | mix (default mix, only for gender=trans)
  --src <dir>          Source directory for the copy provider
  --endpoint <url>     SD WebUI endpoint (default http://127.0.0.1:7860)
  --seed <n>           Fixed seed for the sd provider
  --delay <ms>         Pause between API calls (default 1000)
  --dry-run            Print the prompts without calling any backend
  --verify             Compare on-disk portrait counts with the manifest
  --help               Show this help

Environment:
  OPENAI_API_KEY       Required for the openai provider
  OLLAMA_ENDPOINT      Endpoint for the ollama provider
  SD_ENDPOINT          Default endpoint for the sd provider
`);
}

function genderTextFor(gender, transVariant) {
  if (gender === "women") return "woman";
  if (gender === "men") return "man";
  const variant = transVariant === "mix" ? pick(["mtf", "ftm"]) : transVariant;
  return variant === "mtf" ? "transgender woman" : "transgender man";
}

function buildPrompt({ region, gender, age, transVariant, style, framing }) {
  const [lo, hi] = AGE_RANGES[age] ?? AGE_RANGES.random;
  const ageText = lo === hi ? `${lo}` : `${lo} to ${hi}`;
  
  const appearance = region ? region.appearance : "of diverse heritage";
  const preset = STYLES[style] ?? STYLES.sfw;
  
  const wardrobe = preset.wardrobe.length
    ? `wearing ${pick(preset.wardrobe)}, `
    : "";
  const atmosphere = preset.atmosphere.length
    ? `${pick(preset.atmosphere)}, `
    : "";
  
  const framingList = FRAMING_CHOICES[framing] ?? FRAMINGS;
  
  return [
    QUALITY_BASE,
    `photorealistic portrait photograph of an adult ${genderTextFor(gender, transVariant)}, aged ${ageText},`,
    `${appearance},`,
    `${pick(framingList)}, natural relaxed expression, ${wardrobe}${atmosphere}${pick(LIGHTING)}, ${pick(BACKGROUNDS)},`,
    "sharp focus on the face, high detail, professional character reference photo, portrait orientation, not a painting or illustration",
  ].join(", ");
}

async function generateOpenai(prompt, { apiKey }) {
  const res = await fetchWithRetry("https://api.openai.com/v1/images/generations", {
    label: "OpenAI API",
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1792",
      quality: "standard",
      response_format: "b64_json",
    }),
  });
  const data = await res.json();
  return Buffer.from(data.data[0].b64_json, "base64");
}

async function generatePollinations(prompt, { seed }) {
  const params = new URLSearchParams({
    width: String(TARGET_WIDTH),
    height: String(TARGET_HEIGHT),
    nologo: "true",
    model: "flux",
    ...(seed !== undefined ? { seed: String(seed) } : {}),
  });
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
  const res = await fetchWithRetry(url, { label: "Pollinations" });
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 1000) throw new Error("Pollinations returned an empty image");
  return bytes;
}

async function generateOllama(prompt, { endpoint, model }) {
  const res = await fetch(`${endpoint.replace(/\/+$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  if (!data.images?.length) {
    throw new Error(
      `Ollama returned no images (model "${model}" may not be an image model)`,
    );
  }
  return Buffer.from(data.images[0], "base64");
}

async function generateSd(prompt, { endpoint, seed }) {
  const res = await fetch(`${endpoint.replace(/\/+$/, "")}/sdapi/v1/txt2img`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      negative_prompt: NEGATIVE_PROMPT,
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      steps: 28,
      cfg_scale: 7,
      ...(seed !== undefined ? { seed: Number(seed) } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`SD WebUI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  if (!data.images?.length) throw new Error("SD WebUI returned no images");
  return Buffer.from(data.images[0], "base64");
}

function isWebp(bytes) {
  return (
    bytes.length > 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  );
}

async function finalizeImage(bytes, dir, fileName) {
  // Already WebP: store as-is (re-encoding a lossy format only loses quality).
  if (isWebp(bytes)) {
    await writeFile(path.join(dir, fileName), bytes);
    return fileName;
  }
  // sharp is an optional dev dependency; without it the original format is
  // kept, which the game also supports (.png .jpg .jpeg).
  const sharp = await import("sharp")
    .then((m) => m.default)
    .catch(() => null);
  if (sharp) {
    const out = await sharp(bytes)
      .resize({
        width: TARGET_WIDTH,
        height: TARGET_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    const webpName = fileName.replace(/\.[^.]+$/, ".webp");
    await writeFile(path.join(dir, webpName), out);
    return webpName;
  }
  await writeFile(path.join(dir, fileName), bytes);
  return fileName;
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function listImages(dir) {
  try {
    return (await readdir(dir)).filter((name) =>
      SUPPORTED_EXTENSIONS.includes(path.extname(name).toLowerCase()),
    );
  } catch {
    return [];
  }
}

async function nextSequenceNumber(dir, regionCode, gender) {
  const letter = GENDER_LETTER[gender];
  const pattern = new RegExp(
    `^portrait${regionCode}${letter}_(\\d+)\\.(?:webp|png|jpe?g)$`,
    "i",
  );
  let max = 0;
  for (const name of await listImages(dir)) {
    const m = name.match(pattern);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

function sequenceFileName(regionCode, gender, n) {
  return `portrait${regionCode}${GENDER_LETTER[gender]}_${String(n).padStart(3, "0")}.webp`;
}

// 99_CEO names files by variant index and age/appearance suffix:
//   1fy..9fy  1fo..9fo  1my..9my  1mo..9mo  1ftm..9ftm  1mtf..9mtf
function ceoSuffixFor(gender, age, transVariant) {
  if (gender === "trans") {
    const variant = transVariant === "mix" ? pick(["mtf", "ftm"]) : transVariant;
    return variant === "mtf" ? "mtf" : "ftm";
  }
  const young = gender === "women" ? "fy" : "my";
  const older = gender === "women" ? "fo" : "mo";
  if (age === "young") return young;
  if (age === "older") return older;
  return pick([young, older]);
}

async function nextCeoIndex(dir, suffix) {
  const pattern = new RegExp(`^(\\d+)${suffix}\\.webp$`, "i");
  let max = 0;
  for (const name of await listImages(dir)) {
    const m = name.match(pattern);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

function updateManifestCounts(folderId, gender, added) {
  if (added <= 0) return true;
  const src = readFileSync(MANIFEST_PATH, "utf8");
  const re = new RegExp(
    `^(  '${folderId}': \\{ men: )(\\d+)(, trans: )(\\d+)(, women: )(\\d+)( \\},?)$`,
    "m",
  );
  const m = src.match(re);
  if (!m) return false;
  const counts = { men: Number(m[2]), trans: Number(m[4]), women: Number(m[6]) };
  counts[gender] += added;
  const replacement = `${m[1]}${counts.men}${m[3]}${counts.trans}${m[5]}${counts.women}${m[7]}`;
  writeFileSync(MANIFEST_PATH, src.replace(re, replacement));
  return true;
}

function parseManifest() {
  const src = readFileSync(MANIFEST_PATH, "utf8");
  const re = /^  '([^']+)': \{ men: (\d+), trans: (\d+), women: (\d+) \},?$/gm;
  const out = {};
  let m;
  while ((m = re.exec(src))) {
    out[m[1]] = { men: Number(m[2]), trans: Number(m[3]), women: Number(m[4]) };
  }
  return out;
}

async function verifyManifest() {
  const manifest = parseManifest();
  const rows = [];
  let mismatches = 0;
  for (const [folder, expected] of Object.entries(manifest)) {
    for (const gender of GENDERS) {
      const dir = path.join(PORTRAITS_DIR, folder, gender);
      const onDisk = (await listImages(dir)).length;
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
      row.match ? "ok" : "MISMATCH",
    );
  }
  console.log(mismatches === 0 ? "\nAll counts match the manifest." : `\n${mismatches} mismatched count(s).`);
  return mismatches === 0;
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
  const count = Math.max(1, Number(args.count ?? 1));
  const provider = (args.provider ?? "openai").toLowerCase();
  const style = (args.style ?? "sfw").toLowerCase();
  const framing = (args.framing ?? "random").toLowerCase();
  const age = (args.age ?? "random").toLowerCase();
  const transVariant = (args["trans-variant"] ?? "mix").toLowerCase();
  const dryRun = !!args["dry-run"];
  const delay = Number(args.delay ?? 1000);

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
  if (!Object.hasOwn(AGE_RANGES, age)) {
    console.error(`error: --age must be one of ${Object.keys(AGE_RANGES).join(", ")}`);
    process.exitCode = 1;
    return;
  }
  if (!["openai", "pollinations", "ollama", "sd", "copy"].includes(provider)) {
    console.error("error: --provider must be openai, pollinations, ollama, sd or copy");
    process.exitCode = 1;
    return;
  }
  if (!Object.hasOwn(STYLES, style)) {
    console.error(`error: --style must be one of ${Object.keys(STYLES).join(", ")}`);
    process.exitCode = 1;
    return;
  }
  if (framing !== "random" && !Object.hasOwn(FRAMING_CHOICES, framing)) {
    console.error(
      `error: --framing must be one of ${[...Object.keys(FRAMING_CHOICES), "random"].join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  const isCeo = regionId === "99_CEO";
  const isOther = regionId === "other";
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region && !isCeo && !isOther) {
    console.error(`error: unknown region "${regionId}"`);
    console.error(`       known: ${REGIONS.map((r) => r.id).join(", ")}, 99_CEO, other`);
    process.exitCode = 1;
    return;
  }
  if (isCeo) {
    console.log('note: 99_CEO is a manual-only folder - generated characters never draw from it.');
  }
  if (isOther) {
    console.log('note: "other" is a manual-only folder - generated characters never draw from it.');
  }

  const dir = path.join(PORTRAITS_DIR, regionId, gender);
  await ensureDir(dir);

  // Copy provider: gather source images up front.
  let copySources = [];
  if (provider === "copy") {
    const srcDir = args.src;
    if (!srcDir) {
      console.error("error: copy provider requires --src <dir>");
      process.exitCode = 1;
      return;
    }
    copySources = (await listImages(srcDir)).map((name) => path.join(srcDir, name));
    if (copySources.length === 0) {
      console.error(`error: no supported images (${SUPPORTED_EXTENSIONS.join(" ")}) in "${srcDir}"`);
      process.exitCode = 1;
      return;
    }
    console.log(`copy provider: ${copySources.length} source image(s) in "${srcDir}"`);
  }

  const regionCode = isCeo ? "99" : regionId.slice(0, 2);
  let nextSeq = isCeo ? null : await nextSequenceNumber(dir, regionCode, gender);

  const prompts = [];
  const saved = [];
  const failures = [];

  for (let i = 0; i < count; i++) {
    const prompt = buildPrompt({ region, gender, age, transVariant, style, framing });
    prompts.push(prompt);

    if (dryRun) {
      console.log(`\n[prompt ${i + 1}/${count}]\n${prompt}`);
      continue;
    }

    let bytes;
    try {
      if (provider === "openai") {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          console.error("error: openai provider requires OPENAI_API_KEY");
          process.exitCode = 1;
          return;
        }
        bytes = await generateOpenai(prompt, { apiKey });
      } else if (provider === "pollinations") {
        bytes = await generatePollinations(prompt, { seed: args.seed });
      } else if (provider === "ollama") {
        const endpoint = args.endpoint ?? process.env.OLLAMA_ENDPOINT ?? "http://127.0.0.1:11434";
        const model = args.model ?? "x/z-image-turbo";
        bytes = await generateOllama(prompt, { endpoint, model });
      } else if (provider === "sd") {
        const endpoint = args.endpoint ?? process.env.SD_ENDPOINT ?? "http://127.0.0.1:7860";
        bytes = await generateSd(prompt, { endpoint, seed: args.seed });
      } else {
        const source = copySources[i % copySources.length];
        bytes = await readFile(source);
      }
    } catch (err) {
      // A failed image must not abort the batch: the files already
      // saved still need their manifest update below.
      failures.push(`image ${i + 1}: ${err.message}`);
      console.error(`failed image ${i + 1}/${count}: ${err.message}`);
      if (i < count - 1 && provider !== "copy") await sleep(delay);
      continue;
    }

    let fileName;
    if (isCeo) {
      const suffix = ceoSuffixFor(gender, age, transVariant);
      const index = await nextCeoIndex(dir, suffix);
      if (index > 9) {
        failures.push(`99_CEO/${gender}: all 9 slots for suffix "${suffix}" are used`);
        continue;
      }
      fileName = `${index}${suffix}.webp`;
      await finalizeImage(bytes, dir, fileName);
    } else if (isOther) {
      fileName = `other_${String(nextSeq).padStart(3, "0")}.webp`;
      await finalizeImage(bytes, dir, fileName);
      nextSeq++;
    } else {
      fileName = sequenceFileName(regionCode, gender, nextSeq);
      await finalizeImage(bytes, dir, fileName);
      nextSeq++;
    }
    saved.push(fileName);
    console.log(`saved ${path.join(regionId, gender, fileName)}`);
    if (i < count - 1 && provider !== "copy") await sleep(delay);
  }

  if (dryRun) {
    console.log(`\ndry-run: ${count} prompt(s) printed, nothing generated.`);
    return;
  }

  // Keep the manifest in sync for the 21 auto-selected region folders.
  if (!isCeo && !isOther && saved.length > 0) {
    const ok = updateManifestCounts(regionId, gender, saved.length);
    if (ok) {
      console.log(`manifest updated: ${regionId}/${gender} +${saved.length}`);
    } else {
      console.warn(`warning: could not update PORTRAIT_COUNTS for "${regionId}" - edit src/portraitAssets.ts by hand`);
    }
  }

  console.log(`\ndone: ${saved.length} saved, ${failures.length} failed`);
  for (const f of failures) console.log(`  failed: ${f}`);
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
});
