/**
 * Self-Development Centre — planned module for managing psychological traits.
 *
 * The centre lets the player strengthen, remove or replace a character's traits,
 * and lets the CEO develop traits tied to their background. The engine is pure
 * and works on a trait list carried by the character.
 */

import type { Character } from './gameEngine';

export type TraitId =
  | 'docile'
  | 'defiant'
  | 'ambitious'
  | 'loyal'
  | 'cold'
  | 'passionate'
  | 'cunning'
  | 'naive'
  | 'resilient'
  | 'fragile';

export interface TraitDefinition {
  id: TraitId;
  name: string;
  description: string;
  /** Traits that cannot coexist; adding one removes the listed counterparts. */
  conflictsWith?: TraitId[];
  /** Whether the trait can be developed only from the CEO's background. */
  ceoBackgroundOnly?: boolean;
}

export const TRAIT_DEFINITIONS: TraitDefinition[] = [
  { id: 'docile', name: 'Покладистый', description: 'Легко подчиняется, быстрее принимает правила дома.', conflictsWith: ['defiant'] },
  { id: 'defiant', name: 'Строптивый', description: 'Сопротивляется давлению, дольше держит волю.', conflictsWith: ['docile'] },
  { id: 'ambitious', name: 'Амбициозный', description: 'Стремится к росту и берёт больше ответственности.' },
  { id: 'loyal', name: 'Преданный', description: 'Слабо поддаётся внешнему влиянию, крепко держится компании.' },
  { id: 'cold', name: 'Холодный', description: 'Слабо реагирует на эмоциональные рычаги.', conflictsWith: ['passionate'] },
  { id: 'passionate', name: 'Страстный', description: 'Острее реагирует на удовольствие и внимание.', conflictsWith: ['cold'] },
  { id: 'cunning', name: 'Хитрый', description: 'Находит обходные пути и умеет торговаться.', conflictsWith: ['naive'] },
  { id: 'naive', name: 'Наивный', description: 'Легко ведёт за собой тот, кто обещает лучшее.', conflictsWith: ['cunning'] },
  { id: 'resilient', name: 'Стойкий', description: 'Быстрее восстанавливается после тяжёлых недель.', conflictsWith: ['fragile'] },
  { id: 'fragile', name: 'Хрупкий', description: 'Тяжелее переносит страх и наказания.', conflictsWith: ['resilient'] }
];

export const TRAIT_BY_ID: Record<TraitId, TraitDefinition> = TRAIT_DEFINITIONS.reduce((acc, trait) => {
  acc[trait.id] = trait;
  return acc;
}, {} as Record<TraitId, TraitDefinition>);

export type TraitOperation = 'strengthen' | 'remove' | 'replace';

export interface TraitPlan {
  operation: TraitOperation;
  traitId: TraitId;
  /** Replacement target, required when the operation is 'replace'. */
  replacementId?: TraitId;
}

/** Cost in funds for a trait operation; replacements cost more than removals. */
export const TRAIT_OPERATION_COSTS: Record<TraitOperation, number> = {
  strengthen: 3200,
  remove: 4800,
  replace: 7600
};

export interface TraitResult {
  character: Character;
  success: boolean;
  cost: number;
  log: string;
}

const ensureTraits = (character: Character): TraitId[] => Array.isArray(character.traits) ? character.traits : [];

/**
 * Applies one trait operation to a character. Returns the updated character and
 * the cost; `success` is false when the plan is impossible (removing a trait the
 * character lacks, or replacing with a conflicting one).
 */
export function applyTraitOperation(
  character: Character,
  plan: TraitPlan
): TraitResult {
  const traits = ensureTraits(character);
  const cost = TRAIT_OPERATION_COSTS[plan.operation];
  const definition = TRAIT_BY_ID[plan.traitId];

  if (!definition) {
    return { character, success: false, cost: 0, log: `Неизвестная черта: ${plan.traitId}.` };
  }

  if (plan.operation === 'strengthen') {
    const next = traits.includes(plan.traitId) ? traits : [...traits, plan.traitId];
    return {
      character: { ...character, traits: next },
      success: true,
      cost,
      log: `${character.name} закрепил(а) черту «${definition.name}».`
    };
  }

  if (plan.operation === 'remove') {
    if (!traits.includes(plan.traitId)) {
      return { character, success: false, cost: 0, log: `${character.name} не обладает чертой «${definition.name}».` };
    }
    return {
      character: { ...character, traits: traits.filter(id => id !== plan.traitId) },
      success: true,
      cost,
      log: `${character.name} избавился(ась) от черты «${definition.name}».`
    };
  }

  // replace
  const replacement = plan.replacementId ? TRAIT_BY_ID[plan.replacementId] : undefined;
  if (!replacement) {
    return { character, success: false, cost: 0, log: 'Не указана черта для замены.' };
  }
  if (replacement.conflictsWith?.includes(plan.traitId) || definition.conflictsWith?.includes(replacement.id)) {
    return { character, success: false, cost: 0, log: `«${replacement.name}» несовместима с «${definition.name}».` };
  }
  const withoutConflicts = traits.filter(
    id => id !== plan.traitId && !(replacement.conflictsWith ?? []).includes(id)
  );
  return {
    character: { ...character, traits: [...withoutConflicts, replacement.id] },
    success: true,
    cost,
    log: `${character.name} заменил(а) черту «${definition.name}» на «${replacement.name}».`
  };
}

/** Traits a character can still be given, respecting conflicts. */
export function availableTraits(character: Character): TraitDefinition[] {
  const traits = ensureTraits(character);
  return TRAIT_DEFINITIONS.filter(definition => !traits.includes(definition.id));
}

/** Human-readable trait names carried by a character. */
export function describeTraits(character: Character): string {
  const traits = ensureTraits(character);
  if (traits.length === 0) return 'Черты не заданы';
  return traits.map(id => TRAIT_BY_ID[id]?.name ?? id).join(', ');
}
