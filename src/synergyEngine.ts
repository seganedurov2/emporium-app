import type { Character } from './gameEngine';

export interface SynergyBonus {
  id: string;
  name: string;
  description: string;
  multiplier: number;
  type: 'revenue' | 'efficiency';
}

export interface SynergyResult {
  activeSynergies: SynergyBonus[];
  totalRevenueMultiplier: number;
  totalEfficiencyMultiplier: number;
}

/**
 * Calculates synergies based on the group of characters assigned to a venue.
 */
export function calculateVenueSynergies(characters: Character[]): SynergyResult {
  const activeSynergies: SynergyBonus[] = [];
  let revenueMult = 1.0;
  let efficiencyMult = 1.0;

  if (characters.length === 0) {
    return { activeSynergies, totalRevenueMultiplier: revenueMult, totalEfficiencyMultiplier: efficiencyMult };
  }

  // 1. Professional Synergy: High-skill operative + Administrator
  const hasAdmin = characters.some(c => c.managerialRole === 'administrator');
  const highSkillCount = characters.filter(c => c.skill >= 80).length;
  if (hasAdmin && highSkillCount >= 2) {
    const bonus: SynergyBonus = {
      id: 'prof_synergy',
      name: 'Professional Management',
      description: 'An administrator leading high-skill operatives increases efficiency.',
      multiplier: 1.15,
      type: 'revenue'
    };
    activeSynergies.push(bonus);
    revenueMult *= bonus.multiplier;
  }

  // 2. Charisma-Intelligence Synergy: The "Power Couple" effect
  const highCharisma = characters.some(c => (c.charisma ?? 0) >= 70);
  const highIntelligence = characters.some(c => (c.intelligence ?? 0) >= 70);
  if (highCharisma && highIntelligence) {
    const bonus: SynergyBonus = {
      id: 'intel_char_synergy',
      name: 'Perfect Balance',
      description: 'A mix of raw intelligence and high charisma attracts premium clients.',
      multiplier: 1.10,
      type: 'revenue'
    };
    activeSynergies.push(bonus);
    revenueMult *= bonus.multiplier;
  }

  // 3. Regional Diversity Synergy: Global Appeal
  const uniqueRegions = new Set(characters.map(c => c.region)).size;
  if (uniqueRegions >= 3) {
    const bonus: SynergyBonus = {
      id: 'diversity_synergy',
      name: 'Global Appeal',
      description: 'Diverse origins attract a wider range of international clientele.',
      multiplier: 1.05,
      type: 'revenue'
    };
    activeSynergies.push(bonus);
    revenueMult *= bonus.multiplier;
  }

  // 4. Loyalty Synergy: Trusted Team
  const avgLoyalty = characters.reduce((sum, c) => sum + c.loyalty, 0) / characters.length;
  if (avgLoyalty >= 85) {
    const bonus: SynergyBonus = {
      id: 'loyalty_synergy',
      name: 'Unshakable Trust',
      description: 'High team loyalty reduces operational friction.',
      multiplier: 1.10,
      type: 'efficiency'
    };
    activeSynergies.push(bonus);
    efficiencyMult *= bonus.multiplier;
  }

  return {
    activeSynergies,
    totalRevenueMultiplier: revenueMult,
    totalEfficiencyMultiplier: efficiencyMult
  };
}
