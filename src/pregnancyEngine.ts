import type { Character, Dependent, PregnancyState } from './gameEngine';
import { generateCharacter } from './gameEngine';
import { COMPANY_PROPERTY_AGE_DAYS, CONCEPTION_CHANCE_PER_ACTIVE_WEEK, DAYS_PER_WEEK, GESTATION_DAYS } from './hospitalEngine';

export { COMPANY_PROPERTY_AGE_DAYS, CONCEPTION_CHANCE_PER_ACTIVE_WEEK, DAYS_PER_WEEK, GESTATION_DAYS };

export interface PregnancyWeekResult {
  roster: Character[];
  dependents: Dependent[];
  logs: string[];
}

/**
 * Turns a raised dependent into company property: a slave on the adult roster
 * at sixteen, tagged with the parent that bore them.
 */
function graduateDependent(dependent: Dependent, week: number): Character {
  const gender = dependent.gender === 'female' ? 'women' : 'men';
  const adult = generateCharacter(dependent.regionId, gender);
  return {
    ...adult,
    id: `adult_${dependent.id}`,
    name: dependent.name,
    age: Math.round(COMPANY_PROPERTY_AGE_DAYS / 365),
    role: `Company Property (child of ${dependent.guardianName})`,
    assignedVenue: 'trade',
    isSlave: true,
    slaveOrigin: `birth:${dependent.guardianCharacterId}`,
    acquiredWeek: week
  };
}

/**
 * Advances pregnancy and dependent state by one campaign week.
 *
 * Pregnancy runs the full twenty weeks. Reaching term does not deliver the baby
 * — the hospital engine admits her to a bed first, and she delivers there once
 * the ward has held her for a week. Characters already hospitalized are left
 * untouched here so the hospital owns their stay.
 *
 * A pregnancy is eligible only for an adult woman slave in the Pleasure House
 * with new vaginal contacts recorded during this week. Newborns stay outside the
 * adult Character roster until they become company property at sixteen.
 */
export function advancePregnancyWeek(
  previousRoster: Character[],
  weeklyRoster: Character[],
  currentDependents: Dependent[],
  week: number,
  random: () => number = Math.random
): PregnancyWeekResult {
  const previousById = new Map(previousRoster.map(character => [character.id, character]));
  const logs: string[] = [];
  const roster: Character[] = [];

  for (const character of weeklyRoster) {
    // Admitted patients are handled by the hospital engine.
    if (character.pregnancy?.status === 'hospitalized') {
      roster.push(character);
      continue;
    }

    if (character.pregnancy?.status === 'pregnant') {
      const daysPregnant = Math.min(GESTATION_DAYS, character.pregnancy.daysPregnant + DAYS_PER_WEEK);
      const weeks = Math.round(daysPregnant / DAYS_PER_WEEK);
      if (daysPregnant >= GESTATION_DAYS) {
        const pregnancy: PregnancyState = {
          status: 'pregnant',
          daysPregnant,
          hospitalWeeksRemaining: 0
        };
        roster.push({ ...character, pregnancy });
        logs.push(`Беременность: ${character.name} — срок ${weeks}/${GESTATION_DAYS / DAYS_PER_WEEK} недель, ждёт палату.`);
      } else {
        roster.push({ ...character, pregnancy: { ...character.pregnancy, daysPregnant } });
        logs.push(`Беременность: ${character.name} — срок ${weeks}/${GESTATION_DAYS / DAYS_PER_WEEK} недель.`);
      }
      continue;
    }

    const previous = previousById.get(character.id);
    const previousContacts = previous?.pleasureStats?.vaginalCount ?? 0;
    const currentContacts = character.pleasureStats?.vaginalCount ?? 0;
    const eligibleForConception = character.age >= 18
      && character.isSlave === true
      && character.gender === 'women'
      && character.assignedVenue === 'pleasure_house'
      && currentContacts > previousContacts;

    if (eligibleForConception && random() < CONCEPTION_CHANCE_PER_ACTIVE_WEEK) {
      roster.push({
        ...character,
        pregnancy: { status: 'pregnant', daysPregnant: DAYS_PER_WEEK, hospitalWeeksRemaining: 0 }
      });
      logs.push(`${character.name} забеременела на работе в Парадном зале.`);
      logs.push(`Беременность: ${character.name} — срок 1/${GESTATION_DAYS / DAYS_PER_WEEK} недель.`);
    } else {
      roster.push(character);
    }
  }

  const dependents: Dependent[] = [];
  const newlyAdultCharacters: Character[] = [];
  for (const dependent of currentDependents) {
    const ageDays = dependent.ageDays + DAYS_PER_WEEK;
    if (ageDays >= COMPANY_PROPERTY_AGE_DAYS) {
      const graduate = graduateDependent(dependent, week);
      newlyAdultCharacters.push(graduate);
      logs.push(`${dependent.name} исполнилось ${graduate.age} — собственность компании (родитель: ${dependent.guardianName}).`);
    } else {
      dependents.push({ ...dependent, ageDays });
    }
  }

  return {
    roster: [...roster, ...newlyAdultCharacters],
    dependents,
    logs
  };
}
