import { describe, it, expect } from 'vitest';
import { generateCharacter, generateSlaveCharacter } from './gameEngine';

describe('gameEngine character physique fields (0.6.2)', () => {
  it('generateCharacter sets optional physique/appearance fields', () => {
    const c = generateCharacter();
    expect(typeof c.height).toBe('number');
    expect(typeof c.bodyWeight).toBe('number');
    expect(typeof c.hairColor).toBe('string');
    expect(typeof c.eyeColor).toBe('string');
    expect(c.height).toBeGreaterThanOrEqual(155);
    expect(c.bodyWeight).toBeGreaterThanOrEqual(45);
  });

  it('generateSlaveCharacter sets optional physique/appearance fields', () => {
    const c = generateSlaveCharacter({ regionId: '03_western_europe', quality: 'high', origin: 'market' });
    expect(typeof c.height).toBe('number');
    expect(typeof c.bodyWeight).toBe('number');
    expect(typeof c.hairColor).toBe('string');
  });

  it('old saves missing physique fields remain valid (optional)', () => {
    const legacy: any = {
      id: 'x', name: 'Legacy', gender: 'women', region: '03_western_europe',
      regionName: 'R', age: 25, role: 'r', price: 1, skill: 1, loyalty: 1, image: '',
      managerialRole: 'none', healthLevel: 'Good', exhaustionLevel: 'Rested',
      exactHealth: 80, exactExhaustion: 10, headHairStyle: '', headHairLength: 0,
      facialHairStyle: '', pubicHairStyle: '', pubicHairLength: '', tanningLevel: 0,
      skinCondition: 'Clear', submission: 50, pleasureStats: { vaginalCount: 0, analCount: 0, totalEarnings: 0 }
    };
    expect(legacy.height).toBeUndefined();
    expect(legacy.bodyWeight).toBeUndefined();
    expect(legacy.name).toBe('Legacy');
  });
});
