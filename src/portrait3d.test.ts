import { describe, expect, it } from 'vitest';
import { resolvePortraitRenderMode } from './portrait3dSupport';
import { setPortrait3dEnabled, isPortrait3dEnabled } from './portrait3dFlag';
import {
  PORTRAIT_3D_COUNTS,
  hasPortraitModel,
  pickCeoModelPath,
  pickPortraitModelNumber,
  pickPortraitModelPath,
  portraitModelCount,
  portraitModelFileName
} from './portraitAssets';
import { generateCharacter, REGION_FOLDERS } from './gameEngine';
import { loadSettings } from './settings';

describe('resolvePortraitRenderMode', () => {
  it('picks 3d only when the flag, WebGL2 and data policy all allow it', () => {
    expect(resolvePortraitRenderMode({ flag: true, webgl2: true, reducedData: false })).toBe('3d');
  });

  it('falls back to 2d when the flag is off', () => {
    expect(resolvePortraitRenderMode({ flag: false, webgl2: true, reducedData: false })).toBe('2d');
  });

  it('falls back to 2d without WebGL2', () => {
    expect(resolvePortraitRenderMode({ flag: true, webgl2: false, reducedData: false })).toBe('2d');
  });

  it('falls back to 2d when the user asks to reduce data', () => {
    expect(resolvePortraitRenderMode({ flag: true, webgl2: true, reducedData: true })).toBe('2d');
  });
});

describe('portrait3dFlag store', () => {
  it('mirrors the flag and reads it back', () => {
    setPortrait3dEnabled(true);
    expect(isPortrait3dEnabled()).toBe(true);
    setPortrait3dEnabled(false);
    expect(isPortrait3dEnabled()).toBe(false);
  });
});

describe('3D portrait manifest', () => {
  it('declares every 2D folder; game regions have models, CEO does not', () => {
    expect(Object.keys(PORTRAIT_3D_COUNTS).length).toBeGreaterThan(20);
    const reachableFolders = Object.values(REGION_FOLDERS);
    for (const [folder, counts] of Object.entries(PORTRAIT_3D_COUNTS)) {
      if (folder === '99_CEO') {
        // CEO models keep the index+suffix naming and
        // have not been generated yet.
        expect(counts.men).toBe(0);
        expect(counts.trans).toBe(0);
        expect(counts.women).toBe(0);
      } else if (reachableFolders.includes(folder)) {
        // Every folder reachable from the game has a
        // converted batch (3 models per sex).
        expect(counts.men).toBeGreaterThan(0);
        expect(counts.trans).toBeGreaterThan(0);
        expect(counts.women).toBeGreaterThan(0);
      }
    }
  });

  it('reports models and URLs for the pilot region', () => {
    expect(portraitModelCount('03_western_europe_nordics', 'women')).toBe(3);
    expect(hasPortraitModel('03_western_europe_nordics', 'women')).toBe(true);
    const num = pickPortraitModelNumber('03_western_europe_nordics', 'women');
    expect(num).toBeGreaterThanOrEqual(1);
    expect(num).toBeLessThanOrEqual(3);
    expect(pickPortraitModelPath('03_western_europe_nordics', '03', 'women')).toMatch(
      /^\/portraits3d\/03_western_europe_nordics\/women\/portrait03w_00[1-3]\.glb$/
    );
  });

  it('reports no models and no URLs while counts are zero', () => {
    expect(portraitModelCount('99_CEO', 'women')).toBe(0);
    expect(hasPortraitModel('99_CEO', 'women')).toBe(false);
    expect(pickPortraitModelNumber('99_CEO', 'women')).toBe(0);
    expect(pickPortraitModelPath('99_CEO', '99', 'women')).toBeUndefined();
    expect(pickCeoModelPath('men')).toBeUndefined();
  });

  it('builds glb file names mirroring the WebP scheme', () => {
    expect(portraitModelFileName('03', 'women', 1)).toBe('portrait03w_001.glb');
    expect(portraitModelFileName('03', 'men', 42)).toBe('portrait03m_042.glb');
    expect(portraitModelFileName('03', 'trans', 7)).toBe('portrait03t_007.glb');
    expect(portraitModelFileName('03', 'women', 0)).toBeNull();
  });
});

describe('character generation', () => {
  it('attaches a model3d URL in every game region, keeping the 2D image', () => {
    // generateCharacter takes a region id (02_south_america),
    // which maps to the 02_south_america folder.
    const character = generateCharacter('02_south_america');
    expect(character.image).toMatch(/^\/portraits\//);
    expect(character.model3d).toMatch(/^\/portraits3d\/02_south_america\/(women|men|trans)\/portrait02[wtm]_00[1-3]\.glb$/);
  });

  it('resolves a region id whose folder name differs from the id', () => {
    // Regression guard: the region id 03_western_europe maps to
    // the 03_western_europe_nordics folder. Passing the folder
    // name here used to fall back to REGIONS[0] and drop model3d.
    const character = generateCharacter('03_western_europe');
    expect(character.image).toMatch(/^\/portraits\/03_western_europe_nordics\//);
    expect(character.model3d).toMatch(/^\/portraits3d\/03_western_europe_nordics\/(women|men|trans)\/portrait03[wtm]_00[1-3]\.glb$/);
  });

  it('leaves model3d undefined while the CEO folder has no models', () => {
    const character = generateCharacter('99_ceo');
    expect(character.image).toMatch(/^\/portraits\/99_CEO\//);
    expect(character.model3d).toBeUndefined();
  });
});

describe('settings', () => {
  it('defaults the emporium_3d flag to off', () => {
    expect(loadSettings().emporium_3d).toBe(false);
  });
});
