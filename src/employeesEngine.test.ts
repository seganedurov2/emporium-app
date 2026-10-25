import { describe, expect, it } from 'vitest';
import {
  BASE_EMPLOYEE_SLOTS,
  EMPLOYEE_SPECIALTIES,
  EMPLOYEE_SPECIALTY_IDS,
  EXPERIENCE_PER_SKILL_POINT,
  HIRING_SLOT_BASE_COST,
  HIRING_SLOT_COST_GROWTH,
  HIRING_SLOT_UPKEEP,
  advanceEmployeesWeek,
  createEmployeeCandidates,
  ensureEmployeeCandidatesForVacancies,
  fitsSpecialty,
  getEmployeeWages,
  getVacantSpecialties,
  hiringSlotUpkeep,
  makeHiredEmployee,
  midSpecialtyWage,
  nextHiringSlotCost,
  quoteHiringSlot,
  refreshEmployeeCandidates,
  requiredGenderForSpecialty,
  specialtyDefinitionOf,
  specialtyWageRange
} from './employeesEngine';
import type { Employee, EmployeeSpecialty } from './expansionTypes';
import { BUILDING_DEFINITIONS } from './buildingsEngine';

describe('employee specialties', () => {
  it('covers every EmployeeSpecialty in the Record and IDs list', () => {
    const idsFromRecord = Object.keys(EMPLOYEE_SPECIALTIES) as EmployeeSpecialty[];
    expect(idsFromRecord.sort()).toEqual([...EMPLOYEE_SPECIALTY_IDS].sort());
  });

  it('returns the same definition via Record and via lookup function', () => {
    for (const id of EMPLOYEE_SPECIALTY_IDS) {
      expect(specialtyDefinitionOf(id)).toBe(EMPLOYEE_SPECIALTIES[id]);
    }
  });

  it('exposes wage range and midpoint consistently', () => {
    for (const id of EMPLOYEE_SPECIALTY_IDS) {
      const [min, max] = specialtyWageRange(id);
      const mid = midSpecialtyWage(id);
      expect(mid).toBeGreaterThanOrEqual(min);
      expect(mid).toBeLessThanOrEqual(max);
      expect(mid % 50).toBe(0);
    }
  });

  it('gates gender-locked specialties only for the matching sex', () => {
    expect(fitsSpecialty('mistress', 'women')).toBe(true);
    expect(fitsSpecialty('mistress', 'men')).toBe(false);
    expect(fitsSpecialty('master', 'men')).toBe(true);
    expect(fitsSpecialty('master', 'women')).toBe(false);
    expect(fitsSpecialty('teacher', undefined)).toBe(true);
    expect(fitsSpecialty('nurse', 'men')).toBe(true);
  });

  it('reports required gender for gated specialties', () => {
    expect(requiredGenderForSpecialty('mistress')).toBe('women');
    expect(requiredGenderForSpecialty('master')).toBe('men');
    expect(requiredGenderForSpecialty('janitor')).toBeUndefined();
  });
});

describe('hiring slots', () => {
  it('charges nothing for the first BASE_EMPLOYEE_SLOTS', () => {
    expect(nextHiringSlotCost(BASE_EMPLOYEE_SLOTS)).toBe(HIRING_SLOT_BASE_COST);
    expect(hiringSlotUpkeep(BASE_EMPLOYEE_SLOTS)).toBe(0);
  });

  it('makes the next slot affordable only with enough funds', () => {
    const cost = nextHiringSlotCost(BASE_EMPLOYEE_SLOTS);
    const affordable = quoteHiringSlot(BASE_EMPLOYEE_SLOTS, cost);
    expect(affordable.affordable).toBe(true);
    expect(affordable.slotsAfter).toBe(BASE_EMPLOYEE_SLOTS + 1);
    expect(affordable.upkeep).toBe(HIRING_SLOT_UPKEEP);

    const broke = quoteHiringSlot(BASE_EMPLOYEE_SLOTS, cost - 1);
    expect(broke.affordable).toBe(false);
  });

  it('grows cost by the configured percentage per extra slot', () => {
    const first = nextHiringSlotCost(BASE_EMPLOYEE_SLOTS);
    const second = nextHiringSlotCost(BASE_EMPLOYEE_SLOTS + 1);
    expect(second).toBe(Math.round(first * (1 + HIRING_SLOT_COST_GROWTH)));
    expect(hiringSlotUpkeep(BASE_EMPLOYEE_SLOTS + 2)).toBe(2 * HIRING_SLOT_UPKEEP);
  });
});

describe('employee candidates', () => {
  it('generates candidates with valid fields', () => {
    const candidates = createEmployeeCandidates(5);
    expect(candidates).toHaveLength(5);
    for (const candidate of candidates) {
      expect(candidate.id).toMatch(/^emp_/);
      expect(candidate.skill).toBeGreaterThanOrEqual(35);
      expect(candidate.skill).toBeLessThanOrEqual(100);
      expect(candidate.morale).toBeGreaterThanOrEqual(70);
      expect(candidate.morale).toBeLessThanOrEqual(90);
      expect(candidate.weeklyWage).toBeGreaterThan(0);
    }
  });

  it('places priority specialties at the front', () => {
    const candidates = createEmployeeCandidates(5, ['mistress']);
    expect(candidates[0].specialty).toBe('mistress');
  });

  it('rolls gender-locked roles with the required sex', () => {
    const candidates = createEmployeeCandidates(10, Array(10).fill('mistress') as EmployeeSpecialty[]);
    for (const candidate of candidates) {
      expect(candidate.gender).toBe('women');
    }
  });

  it('fills empty candidate slots on refresh', () => {
    const seed = createEmployeeCandidates(3);
    const refreshed = refreshEmployeeCandidates(seed, 1);
    expect(refreshed).toHaveLength(5);
    expect(refreshed.slice(0, 3)).toEqual(seed);
  });

  it('does not refresh a full pool', () => {
    const full = createEmployeeCandidates(5);
    const refreshed = refreshEmployeeCandidates(full, 1);
    expect(refreshed).toBe(full);
  });

  it('ensures a vacancy specialty appears in a full pool', () => {
    const full = createEmployeeCandidates(5);
    const result = ensureEmployeeCandidatesForVacancies(full, ['mistress'], 1);
    expect(result.some(candidate => candidate.specialty === 'mistress')).toBe(true);
  });

  it('rerolls the entire pool', () => {
    const batch = createEmployeeCandidates(5);
    const rerolled = createEmployeeCandidates(5);
    expect(rerolled).toHaveLength(5);
    expect(rerolled).not.toEqual(batch);
  });
});

describe('hired employees', () => {
  it('converts a candidate into an active employee', () => {
    const candidate = createEmployeeCandidates(1, ['teacher'])[0]!;
    const employee = makeHiredEmployee(candidate, 5);
    expect(employee.status).toBe('active');
    expect(employee.assignedBuildingId).toBeNull();
    expect(employee.hiredWeek).toBe(5);
    expect(employee.id).toBe(candidate.id);
  });

  it('sums wages of active employees only', () => {
    const candidate = createEmployeeCandidates(1, ['teacher'])[0]!;
    const active = makeHiredEmployee(candidate, 1);
    const onLeave: Employee = { ...active, id: 'emp_leave', status: 'leave', weeklyWage: 1000 };
    expect(getEmployeeWages([active, onLeave])).toBe(active.weeklyWage);
  });

  it('advances week: pays wages, trains assigned staff, boosts morale', () => {
    const candidate = createEmployeeCandidates(1, ['teacher'])[0]!;
    const employee = makeHiredEmployee(candidate, 1);
    employee.assignedBuildingId = 'school';
    employee.experience = 99;

    const result = advanceEmployeesWeek([employee], { employeeTrainingBonus: 1, employeeMoraleBonus: 0 });
    expect(result.wagesPaid).toBe(employee.weeklyWage);
    expect(result.employees[0]!.skill).toBe(employee.skill + 1);
    expect(result.employees[0]!.experience).toBe(2);
    expect(result.employees[0]!.morale).toBe(employee.morale + 1);
    expect(result.logs.length).toBe(1);
  });

  it('does not train or pay unassigned leaves', () => {
    const candidate = createEmployeeCandidates(1, ['teacher'])[0]!;
    const employee = makeHiredEmployee(candidate, 1);
    employee.status = 'leave';
    employee.assignedBuildingId = null;

    const result = advanceEmployeesWeek([employee], { employeeTrainingBonus: 5, employeeMoraleBonus: 5 });
    expect(result.wagesPaid).toBe(0);
    expect(result.employees[0]).toBe(employee);
  });
});

describe('vacant specialties', () => {
  it('returns empty for no buildings', () => {
    expect(getVacantSpecialties()).toHaveLength(0);
  });

  it('surfaces required posts for built buildings', () => {
    const buildings = BUILDING_DEFINITIONS.map(definition => ({
      id: definition.id,
      level: 1,
      assignedEmployeeIds: []
    }));
    const vacant = getVacantSpecialties(buildings, [], [], 0);
    const requiredTotal = BUILDING_DEFINITIONS.reduce(
      (sum, definition) => sum + definition.requiredEmployees, 0
    );
    expect(vacant.length).toBeGreaterThanOrEqual(requiredTotal);
    expect(vacant.some(specialty => specialty === 'auctioneer')).toBe(true);
    expect(vacant.some(specialty => specialty === 'mistress')).toBe(true);
    expect(vacant.some(specialty => specialty === 'master')).toBe(true);
  });
});

describe('constant integrity', () => {
  it('BASE_EMPLOYEE_SLOTS is 12', () => {
    expect(BASE_EMPLOYEE_SLOTS).toBe(12);
  });

  it('EXPERIENCE_PER_SKILL_POINT is 100', () => {
    expect(EXPERIENCE_PER_SKILL_POINT).toBe(100);
  });

  it('IDs array length matches Record keys', () => {
    expect(EMPLOYEE_SPECIALTY_IDS.length).toBe(Object.keys(EMPLOYEE_SPECIALTIES).length);
  });
});
