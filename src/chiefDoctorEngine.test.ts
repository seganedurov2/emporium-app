import { describe, expect, it } from 'vitest';
import { buildChiefDoctorReport } from './chiefDoctorEngine';
import { createHospitalState, HOSPITAL_EQUIPMENT } from './hospitalEngine';
import type { WeeklyFinanceReport } from './gameEngine';

const weeklyReport: WeeklyFinanceReport = {
  week: 4,
  revenue: { venue: 10000, caravans: 2000, captureOps: 0, contracts: 0, salon: 0 },
  expenses: { wages: 5000, hospital: 500, restZone: 0, staffSlots: 0, loanPayment: 0 },
  netIncome: 6500,
  treasuryAfter: 100000
};

const hospital = createHospitalState();
hospital.wardCounts.ward_standard = 1;

const baseInput = {
  week: 5,
  funds: 100000,
  hospital,
  hospitalLevel: 1,
  hospitalUpgradeCost: 30000,
  hospitalUpgradeBenefit: 'Уход +20 очков качества, открыта операционная палата.',
  nurses: 0,
  midwives: 0,
  clinicians: 0,
  psychologists: 0,
  medicalWages: 2000,
  recommendedDoctors: 2,
  recommendedNurses: 3,
  recommendedPsychologists: 1,
  psychologistCases: 2,
  waitingForBed: 1,
  waitingForObservation: 0,
  waitingForTreatment: 0,
  hiringSlots: 12,
  employeeCount: 5,
  weeklyReport
};

describe('chief doctor engine', () => {
  it('reads income, expenses and surplus from the weekly report', () => {
    const report = buildChiefDoctorReport(baseInput);
    expect(report.assessment.income).toBe(12000);
    expect(report.assessment.expenses).toBe(5500);
    expect(report.assessment.netIncome).toBe(6500);
    expect(report.assessment.runwayWeeks).toBeNull();
    expect(report.assessment.hospitalExpenses).toBe(2500);
  });

  it('flags missing medical staff as critical and proposes hires', () => {
    const report = buildChiefDoctorReport(baseInput);
    expect(report.requests.some(request => request.id === 'req_no_staff' && request.priority === 'critical')).toBe(true);
    const nurseProposal = report.proposals.find(proposal => proposal.id === 'prop_hire_nurse');
    expect(nurseProposal).toBeDefined();
    expect(nurseProposal?.affordable).toBe(true);
    expect(nurseProposal?.specialty).toBe('nurse');
    expect(nurseProposal?.cost).toBe(0);
    expect(nurseProposal?.weeklyCost).toBeGreaterThan(0);
  });

  it('computes the runway when the budget runs a deficit', () => {
    const report = buildChiefDoctorReport({
      ...baseInput,
      weeklyReport: {
        ...weeklyReport,
        revenue: { venue: 1000, caravans: 0, captureOps: 0, contracts: 0, salon: 0 },
        expenses: { wages: 5000, hospital: 500, restZone: 0, staffSlots: 0, loanPayment: 0 }
      }
    });
    expect(report.assessment.netIncome).toBe(-4500);
    expect(report.assessment.runwayWeeks).toBe(Math.floor(100000 / 4500));
    expect(report.requests.some(request => request.id === 'req_budget_deficit' && request.priority === 'critical')).toBe(true);
  });

  it('proposes wards and equipment with quantities and prices', () => {
    const report = buildChiefDoctorReport(baseInput);
    const wardProposal = report.proposals.find(proposal => proposal.kind === 'buy_ward');
    expect(wardProposal).toBeDefined();
    expect(wardProposal?.quantity).toBe(1);
    expect(wardProposal?.cost).toBeGreaterThan(0);
    const equipmentProposal = report.proposals.find(proposal => proposal.kind === 'buy_equipment');
    expect(equipmentProposal).toBeDefined();
    expect(equipmentProposal?.quantity).toBeGreaterThan(0);
    const unit = HOSPITAL_EQUIPMENT.find(item => item.id === equipmentProposal?.equipmentId);
    expect(unit).toBeDefined();
    expect(equipmentProposal?.cost).toBe((unit?.cost ?? 0) * (equipmentProposal?.quantity ?? 0));
  });

  it('blocks hires when the staff cap is reached and proposes a slot', () => {
    const report = buildChiefDoctorReport({ ...baseInput, employeeCount: 12, hiringSlots: 12 });
    const nurseProposal = report.proposals.find(proposal => proposal.id === 'prop_hire_nurse');
    expect(nurseProposal?.affordable).toBe(false);
    expect(nurseProposal?.blockReason).toContain('Штат заполнен');
    expect(report.requests.some(request => request.id === 'req_slots')).toBe(true);
    expect(report.proposals.some(proposal => proposal.kind === 'buy_slot')).toBe(true);
  });

  it('proposes construction when the hospital is unbuilt', () => {
    const report = buildChiefDoctorReport({ ...baseInput, hospitalLevel: 0, hospitalUpgradeCost: 45000 });
    expect(report.requests.some(request => request.id === 'req_building' && request.priority === 'critical')).toBe(true);
    const build = report.proposals.find(proposal => proposal.id === 'prop_build_hospital');
    expect(build?.cost).toBe(45000);
    expect(build?.affordable).toBe(true);
    // No medical hires while there is no building to staff.
    expect(report.proposals.some(proposal => proposal.kind === 'hire')).toBe(false);
  });

  it('flags waiting mothers and depleted consumables', () => {
    const report = buildChiefDoctorReport(baseInput);
    expect(report.requests.some(request => request.id === 'req_waiting_bed' && request.priority === 'high')).toBe(true);
    expect(report.requests.some(request => request.id === 'req_equipment' && request.priority === 'high')).toBe(true);
  });

  it('sorts critical requests ahead of low ones', () => {
    const report = buildChiefDoctorReport(baseInput);
    const ranks = report.requests.map(request => request.priority);
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...ranks].sort((a, b) => order[a] - order[b]);
    expect(ranks).toEqual(sorted);
  });
});
