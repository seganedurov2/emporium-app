/**
 * Portrait import pipeline.
 *
 * Converts images (JPEG/PNG/WebP/AVIF) to WebP and places
 * them into public/portraits/<regionFolder>/<sex>/ using the
 * game's naming scheme: portrait<regionCode><w|m|t>_<NNN>.webp.
 * Updates PORTRAIT_COUNTS in src/portraitAssets.ts so the
 * picker only ever returns numbers that have a file behind
 * them.
 *
 * The region code is taken from the first two characters of
 * the folder name (e.g. 03_western_europe_nordics -> 03).
 */

import sharp from 'sharp';
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';

export const PORTRAIT_SEXES = ['men', 'women', 'trans'];
const GENDER_CODES = { men: 'm', women: 'w', trans: 't' };
const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i;

/** Validates the target and returns the 2-digit region code. */
function resolveRegionCode(regionFolder) {
  if (regionFolder === '99_CEO') {
    throw new Error(
      '99_CEO uses a different naming scheme (1mo..9my, 1fo..9fy, 1ftm..9mtf) — add CEO portraits manually'
    );
  }
  const code = regionFolder.slice(0, 2);
  if (!/^\d{2}$/.test(code)) {
    throw new Error(
      'region folder must start with a 2-digit code, e.g. 03_western_europe_nordics'
    );
  }
  return code;
}

function targetDir(appRoot, regionFolder, sex) {
  return join(appRoot, 'public', 'portraits', regionFolder, sex);
}

/** Next free 1-based portrait number for a folder/sex pair. */
function nextFileNumber(dir) {
  let max = 0;
  if (exists(dir)) {
    for (const file of readdirSync(dir)) {
      const match = file.match(/_(\d{3})\.webp$/);
      if (match) max = Math.max(max, parseInt(match[1], 10));
    }
  }
  return max + 1;
}

function exists(path) {
  try {
    readdirSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts one image buffer and saves it as the next portrait
 * of the folder/sex pair. Returns the file name and the new
 * total count.
 */
export async function importPortraitBuffer(
  buffer,
  { regionFolder, sex, appRoot = process.cwd() }
) {
  if (!PORTRAIT_SEXES.includes(sex)) {
    throw new Error(`sex must be one of: ${PORTRAIT_SEXES.join(', ')}`);
  }
  const code = resolveRegionCode(regionFolder);
  const dir = targetDir(appRoot, regionFolder, sex);
  mkdirSync(dir, { recursive: true });

  const num = String(nextFileNumber(dir)).padStart(3, '0');
  const fileName = `portrait${code}${GENDER_CODES[sex]}_${num}.webp`;
  await sharp(buffer).webp({ quality: 85 }).toFile(join(dir, fileName));

  const total = updateManifest(appRoot, regionFolder, sex, parseInt(num, 10));
  return { fileName, total };
}

/**
 * Imports every image from a local directory. Returns the
 * imported file names and the new total count.
 */
export async function importPortraits({
  srcDir,
  regionFolder,
  sex,
  appRoot = process.cwd()
}) {
  if (!PORTRAIT_SEXES.includes(sex)) {
    throw new Error(`sex must be one of: ${PORTRAIT_SEXES.join(', ')}`);
  }
  resolveRegionCode(regionFolder);

  const files = readdirSync(srcDir).filter(file => IMAGE_EXT.test(file));
  if (files.length === 0) throw new Error(`no images found in ${srcDir}`);

  const imported = [];
  let total = 0;
  for (const file of files) {
    const buffer = readFileSync(join(srcDir, file));
    const result = await importPortraitBuffer(buffer, {
      regionFolder,
      sex,
      appRoot
    });
    imported.push(result.fileName);
    total = result.total;
  }
  return { imported, total };
}

/**
 * Bumps the count for a folder/sex pair in src/portraitAssets.ts.
 * Only ever grows — never lowers an existing count.
 */
function updateManifest(appRoot, regionFolder, sex, newCount) {
  const manifestPath = join(appRoot, 'src', 'portraitAssets.ts');
  let source = readFileSync(manifestPath, 'utf8');
  const pattern = new RegExp(
    `('${regionFolder}':\\s*\\{[^}]*?)(${sex}:\\s*)(\\d+)`
  );
  const match = source.match(pattern);
  if (!match) {
    throw new Error(
      `folder ${regionFolder} not found in PORTRAIT_COUNTS — add it manually first`
    );
  }
  const oldCount = parseInt(match[3], 10);
  const total = Math.max(oldCount, newCount);
  if (total !== oldCount) {
    source = source.replace(pattern, `$1$2${total}`);
    writeFileSync(manifestPath, source);
  }
  return total;
}

/** Lists every folder/sex pair with its current count. */
export function listPortraitCounts(appRoot = process.cwd()) {
  const manifestPath = join(appRoot, 'src', 'portraitAssets.ts');
  const source = readFileSync(manifestPath, 'utf8');
  const counts = {};
  const folderPattern = /'([^']+)':\s*\{([^}]*)\}/g;
  let folderMatch;
  while ((folderMatch = folderPattern.exec(source)) !== null) {
    const folder = folderMatch[1];
    const sexCounts = {};
    const sexPattern = /(men|women|trans):\s*(\d+)/g;
    let sexMatch;
    while ((sexMatch = sexPattern.exec(folderMatch[2])) !== null) {
      sexCounts[sexMatch[1]] = parseInt(sexMatch[2], 10);
    }
    counts[folder] = sexCounts;
  }
  return counts;
}
