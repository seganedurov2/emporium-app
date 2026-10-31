/**
 * Portrait asset manifest.
 *
 * Every character portrait lives under `public/portraits/<region folder>/<gender>/`
 * as a `.webp` whose trailing number is sequential from 1. The number of files
 * differs per region *and* per gender (roughly 17-66), so the count has to be
 * declared here rather than assumed: an old build hard-coded "1..20" for every
 * folder, which both missed most of the artwork and requested files that do not
 * exist (a broken image) whenever a folder had fewer than 20.
 *
 * Keep this in sync when portraits are added or removed. `portraitFileCount`
 * clamps to the real maximum, and {@link pickPortraitFileNumber} only ever
 * returns a number that actually has a file behind it.
 */

/** Portrait counts per region folder and sex. */
export const PORTRAIT_COUNTS: Record<string, Record<PortraitSex, number>> = {
  '01_north_america_central_caribbean': { men: 46, trans: 47, women: 77 },
  '02_south_america': { men: 35, trans: 41, women: 57 },
  '03_western_europe_nordics': { men: 36, trans: 30, women: 77 },
  '04_eastern_europe_balkans_european_russia': { men: 36, trans: 37, women: 67 },
  '05_middle_east_caucasus': { men: 29, trans: 36, women: 72 },
  '06_north_africa_sahara_horn': { men: 36, trans: 41, women: 67 },
  '07_west_africa': { men: 30, trans: 29, women: 63 },
  '08_central_africa': { men: 35, trans: 34, women: 52 },
  '09_east_south_africa': { men: 31, trans: 41, women: 54 },
  '10_central_asia_siberia': { men: 35, trans: 31, women: 58 },
  '11_east_asia': { men: 33, trans: 31, women: 52 },
  '12_south_asia': { men: 34, trans: 35, women: 53 },
  '13_southeast_asia': { men: 34, trans: 32, women: 49 },
  '14_australia_oceania': { men: 35, trans: 36, women: 50 },
  '15_roma': { men: 19, trans: 22, women: 31 },
  '16_jewish_diaspora': { men: 21, trans: 20, women: 36 },
  '17_kurdish': { men: 17, trans: 20, women: 46 },
  '18_assyrian': { men: 21, trans: 21, women: 39 },
  '19_native_american': { men: 21, trans: 24, women: 40 },
  '20_maya': { men: 20, trans: 19, women: 40 },
  '21_andean': { men: 22, trans: 23, women: 39 },
  // The CEO folder uses a different file naming scheme (see CEO_PORTRAIT_COUNT).
  '99_CEO': { men: 18, trans: 18, women: 18 }
};

export type PortraitSex = 'men' | 'women' | 'trans';

/** Fallback folder/id used when a region has no portraits of its own. */
export const DEFAULT_PORTRAIT_FOLDER = '03_western_europe_nordics';

/**
 * The CEO folder names files by index *and* an age/appearance suffix rather
 * than a flat sequence:
 *   men   → `1mo` … `9mo` (older) and `1my` … `9my` (younger)
 *   women → `1fo` … `9fo` (older) and `1fy` … `9fy` (younger)
 *   trans → `1ftm` … `9ftm` and `1mtf` … `9mtf`
 * The old picker only ever requested the `mo`/`fo`/`ftm` half, halving the pool.
 */
export const CEO_PORTRAIT_INDEX_COUNT = 9;

const CEO_SUFFIXES: Record<PortraitSex, string[]> = {
  men: ['mo', 'my'],
  women: ['fo', 'fy'],
  trans: ['ftm', 'mtf']
};

/** A random CEO portrait file name (without extension) that exists on disk. */
export function pickCeoPortraitName(sex: PortraitSex): string {
  const suffixes = CEO_SUFFIXES[sex];
  const index = Math.floor(Math.random() * CEO_PORTRAIT_INDEX_COUNT) + 1;
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  return `${index}${suffix}`;
}

/** Every CEO portrait file name (without extension) for a sex, index then suffix. */
export function ceoPortraitFileNames(sex: PortraitSex): string[] {
  const suffixes = CEO_SUFFIXES[sex];
  const names: string[] = [];
  for (let index = 1; index <= CEO_PORTRAIT_INDEX_COUNT; index += 1) {
    for (const suffix of suffixes) {
      names.push(`${index}${suffix}`);
    }
  }
  return names;
}

/** Every folder the manifest knows about. */
export function hasPortraitFolder(folder: string): boolean {
  return Object.prototype.hasOwnProperty.call(PORTRAIT_COUNTS, folder);
}

/** How many portraits exist for a folder/sex pair, or 0 when unknown. */
export function portraitFileCount(folder: string, sex: PortraitSex): number {
  return PORTRAIT_COUNTS[folder]?.[sex] ?? 0;
}

/** Picks a 1-based portrait number that is guaranteed to exist. */
export function pickPortraitFileNumber(folder: string, sex: PortraitSex): number {
  const count = portraitFileCount(folder, sex);
  if (count <= 0) return 1;
  return Math.floor(Math.random() * count) + 1;
}

/**
 * 3D portrait manifest (glTF/GLB, Draco-compressed meshes,
 * KTX2 textures).
 *
 * Mirrors the 2D manifest above: counts are declared per region
 * folder and sex, and file names mirror the WebP scheme with a
 * `.glb` extension:
 *
 *   public/portraits3d/<region folder>/<sex>/portrait<reg><gender>_NNN.glb
 *   public/portraits3d/99_CEO/<sex>/<index><suffix>.glb
 *
 * Every folder starts at 0 — no models exist until
 * `tools/convert-portraits-3d.mjs` converts them — so characters
 * only receive a `model3d` URL once a model actually exists for
 * their folder/sex pair. The pilot region is
 * `03_western_europe_nordics`; other folders light up as their
 * models are converted.
 */
export const PORTRAIT_3D_DIR = 'portraits3d';

export const PORTRAIT_3D_COUNTS: Record<string, Record<PortraitSex, number>> = {
  '01_north_america_central_caribbean': { men: 3, trans: 3, women: 3 },
  '02_south_america': { men: 3, trans: 3, women: 3 },
  '03_western_europe_nordics': { men: 3, trans: 3, women: 3 },
  '04_eastern_europe_balkans_european_russia': { men: 3, trans: 3, women: 3 },
  '05_middle_east_caucasus': { men: 3, trans: 3, women: 3 },
  '06_north_africa_sahara_horn': { men: 3, trans: 3, women: 3 },
  '07_west_africa': { men: 3, trans: 3, women: 3 },
  '08_central_africa': { men: 3, trans: 3, women: 3 },
  '09_east_south_africa': { men: 3, trans: 3, women: 3 },
  '10_central_asia_siberia': { men: 3, trans: 3, women: 3 },
  '11_east_asia': { men: 3, trans: 3, women: 3 },
  '12_south_asia': { men: 3, trans: 3, women: 3 },
  '13_southeast_asia': { men: 3, trans: 3, women: 3 },
  '14_australia_oceania': { men: 3, trans: 3, women: 3 },
  '15_roma': { men: 3, trans: 3, women: 3 },
  '16_jewish_diaspora': { men: 3, trans: 3, women: 3 },
  '17_kurdish': { men: 0, trans: 0, women: 0 },
  '18_assyrian': { men: 0, trans: 0, women: 0 },
  '19_native_american': { men: 0, trans: 0, women: 0 },
  '20_maya': { men: 0, trans: 0, women: 0 },
  '21_andean': { men: 0, trans: 0, women: 0 },
  '99_CEO': { men: 0, trans: 0, women: 0 }
};

/** How many 3D models exist for a folder/sex pair, or 0 when unknown. */
export function portraitModelCount(folder: string, sex: PortraitSex): number {
  return PORTRAIT_3D_COUNTS[folder]?.[sex] ?? 0;
}

/** True when at least one 3D model exists for the folder/sex pair. */
export function hasPortraitModel(folder: string, sex: PortraitSex): boolean {
  return portraitModelCount(folder, sex) > 0;
}

/** Picks a 1-based model number that is guaranteed to exist, or 0. */
export function pickPortraitModelNumber(folder: string, sex: PortraitSex): number {
  const count = portraitModelCount(folder, sex);
  if (count <= 0) return 0;
  return Math.floor(Math.random() * count) + 1;
}

/**
 * Builds a glb file name mirroring the WebP scheme
 * (`portrait03w_001.glb`), or null when the number is invalid.
 */
export function portraitModelFileName(
  regionCode: string,
  sex: PortraitSex,
  fileNum: number
): string | null {
  if (fileNum <= 0) return null;
  const genderCode = sex === 'women' ? 'w' : sex === 'men' ? 'm' : 't';
  return `portrait${regionCode}${genderCode}_${String(fileNum).padStart(3, '0')}.glb`;
}

/**
 * Picks a 3D model path for a region/sex pair (mirroring the 2D
 * picker), or undefined when the folder has no models yet.
 * The path is relative to the deploy base — wrap in `assetUrl`.
 */
export function pickPortraitModelPath(
  folder: string,
  regionCode: string,
  sex: PortraitSex
): string | undefined {
  const fileNum = pickPortraitModelNumber(folder, sex);
  const fileName = portraitModelFileName(regionCode, sex, fileNum);
  if (!fileName) return undefined;
  return `/${PORTRAIT_3D_DIR}/${folder}/${sex}/${fileName}`;
}

/**
 * Picks a 3D model path for the CEO folder using the same
 * index+suffix naming as the 2D CEO portraits, or undefined
 * when no CEO models exist yet.
 */
export function pickCeoModelPath(sex: PortraitSex): string | undefined {
  if (portraitModelCount('99_CEO', sex) <= 0) return undefined;
  return `/${PORTRAIT_3D_DIR}/99_CEO/${sex}/${pickCeoPortraitName(sex)}.glb`;
}
