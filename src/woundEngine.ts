/**
 * Wound system — a character can carry up to two wounds in different body
 * locations. A character dies when they receive a third wound, when a single
 * wound heals into a permanent critical state, or from a critical head/chest
 * wound. Head, chest, belly, arm and leg wounds have escalating consequences;
 * belly wounds additionally risk infertility.
 *
 * Wounds are produced by venue events (BDSM room, violent clients, correction
 * procedures) and resolved in the hospital. This module is pure: callers pass a
 * character in and receive a new one plus a human-readable log line.
 */

import type { Character } from './gameEngine';

export type WoundLocation = 'head' | 'chest' | 'belly' | 'left_arm' | 'right_arm' | 'left_leg' | 'right_leg';

export interface Wound {
  id: string;
  location: WoundLocation;
  /** 0-100; the wound kills the character when it reaches 100 or on the third wound. */
  severity: number;
  /** Campaign week the wound was received. */
  receivedWeek: number;
}

export interface WoundLocationMeta {
  id: WoundLocation;
  label: string;
  /** Base chance weight when a random wound is generated. */
  weight: number;
  /** Extra weekly bleeding damage applied while the wound is untreated. */
  bleed: number;
}

export const WOUND_LOCATIONS: WoundLocationMeta[] = [
  { id: 'head', label: 'Голова', weight: 1, bleed: 9 },
  { id: 'chest', label: 'Грудь', weight: 1.4, bleed: 8 },
  { id: 'belly', label: 'Живот', weight: 2, bleed: 7 },
  { id: 'left_arm', label: 'Левая рука', weight: 2.2, bleed: 4 },
  { id: 'right_arm', label: 'Правая рука', weight: 2.2, bleed: 4 },
  { id: 'left_leg', label: 'Левая нога', weight: 2.4, bleed: 4.5 },
  { id: 'right_leg', label: 'Правая нога', weight: 2.4, bleed: 4.5 }
];

export const MAX_WOUNDS = 2;

const getLocationMeta = (location: WoundLocation): WoundLocationMeta =>
  WOUND_LOCATIONS.find(entry => entry.id === location) ?? WOUND_LOCATIONS[0];

/** Picks a random wound location using the per-location weights. */
export function rollWoundLocation(random: () => number = Math.random): WoundLocation {
  const total = WOUND_LOCATIONS.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of WOUND_LOCATIONS) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return WOUND_LOCATIONS[WOUND_LOCATIONS.length - 1].id;
}

/** Existing wounds on the character (defensive against legacy saves). */
export function getWounds(character: Character): Wound[] {
  return Array.isArray(character.wounds) ? character.wounds : [];
}

/** A character with two wounds is on the brink — a third will kill them. */
export function isCriticallyWounded(character: Character): boolean {
  return getWounds(character).length >= MAX_WOUNDS;
}

/** Total weekly bleeding damage from all untreated wounds. */
export function getWoundBleedPerWeek(character: Character): number {
  return getWounds(character).reduce((sum, wound) => sum + getLocationMeta(wound.location).bleed, 0);
}

export interface WoundResult {
  character: Character;
  /** Set when the wound proved fatal; the character should be removed from the roster. */
  fatal: boolean;
  log: string;
}

/**
 * Adds a wound to the character. A third wound — or a single wound whose
 * severity reaches 100 — is fatal. Belly wounds above 60 severity may leave the
 * character permanently infertile.
 */
export function applyWound(
  character: Character,
  options: { location?: WoundLocation; severity?: number; week?: number; random?: () => number } = {}
): WoundResult {
  const random = options.random ?? Math.random;
  const location = options.location ?? rollWoundLocation(random);
  const severity = Math.max(1, Math.min(100, Math.round(options.severity ?? 25 + random() * 40)));
  const week = options.week ?? 0;
  const existing = getWounds(character);

  if (existing.length >= MAX_WOUNDS) {
    return {
      character,
      fatal: true,
      log: `${character.name} получил(а) смертельное третье ранение (${getLocationMeta(location).label}).`
    };
  }

  const wound: Wound = { id: `wound_${week}_${Math.floor(random() * 1e6)}`, location, severity, receivedWeek: week };
  const next: Character = { ...character, wounds: [...existing, wound] };
  const meta = getLocationMeta(location);

  if (severity >= 100) {
    return { character: next, fatal: true, log: `${character.name} скончал(ась) от критического ранения (${meta.label}).` };
  }

  const details: string[] = [`${meta.label} — ${severity}%`];
  if (location === 'belly' && severity >= 60 && character.gender === 'women' && !character.infertile) {
    next.infertile = true;
    details.push('возможная потеря фертильности');
  }
  if (location === 'head' && severity >= 70) {
    next.exhaustionLevel = 'Burned Out';
    next.exactExhaustion = 100;
    details.push('сильное истощение');
  }
  if (location === 'chest' && severity >= 70) {
    next.healthLevel = 'Critical';
    next.exactHealth = Math.min(next.exactHealth ?? 0, 15);
    details.push('критическое состояние');
  }

  return {
    character: next,
    fatal: false,
    log: `${character.name} получил(а) ранение: ${details.join(', ')}.`
  };
}

export interface HealWoundResult {
  character: Character;
  removed: boolean;
  log: string;
}

/**
 * Treats a single wound. Each hospital week restores `amount` severity; once a
 * wound reaches zero it is removed. `untreatedBleed` adds the weekly damage from
 * the remaining wounds before the treatment is applied.
 */
export function healWound(
  character: Character,
  options: { amount?: number; woundId?: string; untreatedBleed?: boolean } = {}
): HealWoundResult {
  const wounds = getWounds(character);
  if (wounds.length === 0) {
    return { character, removed: false, log: '' };
  }
  const target = options.woundId ? wounds.find(w => w.id === options.woundId) ?? wounds[0] : wounds[0];
  const bleed = options.untreatedBleed ? getWoundBleedPerWeek(character) : 0;
  const amount = (options.amount ?? 35) - bleed;
  const severity = target.severity - amount;

  if (severity <= 0) {
    const next: Character = { ...character, wounds: wounds.filter(w => w.id !== target.id) };
    return {
      character: next,
      removed: true,
      log: `${character.name} залечил(а) ранение (${getLocationMeta(target.location).label}) — травма закрыта.`
    };
  }

  const next: Character = {
    ...character,
    wounds: wounds.map(w => (w.id === target.id ? { ...w, severity } : w))
  };
  return {
    character: next,
    removed: false,
    log: `${character.name} залечил(а) ранение (${getLocationMeta(target.location).label}) — осталось ${Math.round(severity)}%.`
  };
}

/** Human-readable summary of a character's wounds, for roster badges. */
export function describeWounds(character: Character): string {
  const wounds = getWounds(character);
  if (wounds.length === 0) return 'Ранений нет';
  return wounds
    .map(w => `${getLocationMeta(w.location).label} (${Math.round(w.severity)}%)`)
    .join(', ');
}
