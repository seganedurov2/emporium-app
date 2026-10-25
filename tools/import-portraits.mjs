/**
 * CLI portrait importer.
 *
 * Usage:
 *   node tools/import-portraits.mjs <srcDir> <regionFolder> <sex>
 *
 * Example:
 *   node tools/import-portraits.mjs C:\photos\europe 03_western_europe_nordics women
 *
 * Converts every image in <srcDir> to WebP, saves it under
 * public/portraits/<regionFolder>/<sex>/ and bumps the count
 * in src/portraitAssets.ts.
 */

import { importPortraits, listPortraitCounts } from './portraitImporter.mjs';

const [srcDir, regionFolder, sex] = process.argv.slice(2);

if (!srcDir || !regionFolder || !sex) {
  console.error('Usage: node tools/import-portraits.mjs <srcDir> <regionFolder> <sex>');
  console.error('Sex must be one of: men, women, trans');
  process.exit(1);
}

try {
  const { imported, total } = await importPortraits({ srcDir, regionFolder, sex });
  console.log(`Imported ${imported.length} portrait(s) into ${regionFolder}/${sex}:`);
  for (const file of imported) console.log(`  ${file}`);
  console.log(`Total in manifest: ${total}`);
} catch (err) {
  console.error(`Import failed: ${err.message}`);
  process.exit(1);
}

if (process.argv.includes('--list')) {
  console.log(JSON.stringify(listPortraitCounts(), null, 2));
}
