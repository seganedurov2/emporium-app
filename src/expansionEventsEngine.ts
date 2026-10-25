import type { CampaignState } from './gameEngine';
import type {
  AuxiliaryBuildingState,
  Employee,
  ExpansionEvent,
  ExpansionEventChoice,
  ExpansionEventContext,
  ExpansionEventEffect
} from './expansionTypes';
import { getBuildingDefinition } from './buildingsEngine';
import { EXPANSION_EVENTS } from './content/expansionEvents';

export type ExpandedEvent = ExpansionEvent;

export function matchesExpansionEvent(
  event: ExpansionEvent,
  context: ExpansionEventContext
): boolean {
  if (!event.conditions.length) return true;
  return event.conditions.some(condition => {
    if (condition.minWeek !== undefined && context.week < condition.minWeek) return false;
    if (condition.maxWeek !== undefined && context.week > condition.maxWeek) return false;
    if (condition.minFunds !== undefined && context.funds < condition.minFunds) return false;
    if (condition.employeeSpecialty && !context.employees.some(employee => employee.specialty === condition.employeeSpecialty && employee.status === 'active')) return false;
    if (condition.buildingId) {
      const building = context.auxiliaryBuildings.find(item => item.id === condition.buildingId);
      if (!building || building.level < (condition.minBuildingLevel ?? 1)) return false;
    }
    return true;
  });
}

export function getEligibleExpansionEvents(
  context: ExpansionEventContext,
  seenEventIds: string[]
): ExpansionEvent[] {
  const seen = new Set(seenEventIds);
  return EXPANSION_EVENTS.filter(event => !seen.has(event.id) && matchesExpansionEvent(event, context));
}

export function chooseExpansionEvent(
  context: ExpansionEventContext,
  seenEventIds: string[],
  random = Math.random
): ExpansionEvent | null {
  const eligible = getEligibleExpansionEvents(context, seenEventIds);
  if (!eligible.length) return null;
  return eligible[Math.floor(random() * eligible.length)] ?? eligible[0];
}

export interface ExpansionEffectsState extends CampaignState {
  employees: Employee[];
  auxiliaryBuildings: AuxiliaryBuildingState[];
  seenExpansionEventIds: string[];
}

export function applyExpansionEventChoice<T extends ExpansionEffectsState>(
  state: T,
  event: ExpansionEvent,
  choice: ExpansionEventChoice
): T {
  const fundsDelta = choice.effects.reduce((sum, effect) => sum + (effect.type === 'funds' ? effect.delta : 0), 0);
  const reputationDelta = choice.effects.reduce((sum, effect) => sum + (effect.type === 'reputation' ? effect.delta : 0), 0);
  const employeeMoraleEffects = choice.effects.filter((effect): effect is Extract<ExpansionEventEffect, { type: 'employeeMorale' }> => effect.type === 'employeeMorale');
  const employeeExperienceEffects = choice.effects.filter((effect): effect is Extract<ExpansionEventEffect, { type: 'employeeExperience' }> => effect.type === 'employeeExperience');
  const buildingEffects = choice.effects.filter((effect): effect is Extract<ExpansionEventEffect, { type: 'buildingLevel' }> => effect.type === 'buildingLevel');

  const employees = state.employees.map(employee => {
    const moraleDelta = employeeMoraleEffects
      .filter(effect => !effect.specialty || effect.specialty === employee.specialty)
      .reduce((sum, effect) => sum + effect.delta, 0);
    const experienceDelta = employeeExperienceEffects
      .filter(effect => !effect.specialty || effect.specialty === employee.specialty)
      .reduce((sum, effect) => sum + effect.delta, 0);
    let skill = employee.skill;
    let experience = employee.experience + experienceDelta;
    while (experience >= 100 && skill < 100) {
      experience -= 100;
      skill += 1;
    }
    if (skill >= 100) experience = 0;
    return {
      ...employee,
      morale: Math.max(0, Math.min(100, employee.morale + moraleDelta)),
      skill,
      experience
    };
  });

  const auxiliaryBuildings = state.auxiliaryBuildings.map(building => {
    const delta = buildingEffects.filter(effect => effect.buildingId === building.id).reduce((sum, effect) => sum + effect.delta, 0);
    if (!delta) return building;
    const maxLevel = getBuildingDefinition(building.id).maxLevel;
    return { ...building, level: Math.max(0, Math.min(maxLevel, building.level + delta)) };
  });

  return {
    ...state,
    funds: Math.max(0, state.funds + fundsDelta),
    reputation: Math.max(0, Math.min(100, state.reputation + reputationDelta)),
    employees,
    auxiliaryBuildings,
    seenExpansionEventIds: [...state.seenExpansionEventIds.filter(id => id !== event.id), event.id].slice(-4),
    log: [`${event.title}: ${choice.resultMessage}`, ...state.log].slice(0, 50)
  } as T;
}
