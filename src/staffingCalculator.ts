import type { Character } from './gameEngine';
import type { HospitalState } from './hospitalEngine';
import type { Psychologist } from './psychologistEngine';
import { assessPsychologistCase, psychologistThresholds } from './psychologistEngine';

export interface StaffingInput {
  roster: Character[];
  hospital: HospitalState;
  psychologistsOnDuty: Psychologist[];
}

export interface StaffingRecommendation {
  doctors: number;
  nurses: number;
  psychologists: number;
  totalPatients: number;
  breakdown: {
    hospitalPatients: number;
    waitingPatients: number;
    psychologistCases: number;
  };
}

const PATIENTS_PER_DOCTOR = 4;
const PATIENTS_PER_NURSE = 3;
const CASES_PER_PSYCHOLOGIST = 4;

export function calculateStaffing(input: StaffingInput): StaffingRecommendation {
  const hospitalPatients = input.hospital.patients.length;

  const waitingForBed = input.roster.filter(
    c => c.pregnancy?.status === 'pregnant'
      && c.pregnancy.daysPregnant >= 140
      && !input.hospital.patients.some(p => p.characterId === c.id)
  );

  const waitingForTreatment = input.roster.filter(
    c => (c.exactHealth ?? 100) <= 40
      && !c.assignedTask
      && !input.hospital.patients.some(p => p.characterId === c.id)
  );

  const waitingForObservation = input.roster.filter(
    c => !c.assignedTask
      && !input.hospital.patients.some(p => p.characterId === c.id)
      && c.pregnancy?.status === 'pregnant'
      && c.pregnancy.daysPregnant < 140
  );

  const waitingPatients = waitingForBed.length + waitingForTreatment.length + waitingForObservation.length;

  const thresholds = input.psychologistsOnDuty.length > 0
    ? psychologistThresholds(Math.max(...input.psychologistsOnDuty.map(p => p.skill)))
    : psychologistThresholds(0);

  const psychologistCases = input.roster.filter(c => {
    if (c.assignedTask || c.role === 'Chief Executive Officer') return false;
    return assessPsychologistCase(c, thresholds) !== null;
  }).length;

  const totalPatients = hospitalPatients + waitingPatients + psychologistCases;

  const doctors = Math.max(1, Math.ceil(totalPatients / PATIENTS_PER_DOCTOR));
  const nurses = Math.max(1, Math.ceil(totalPatients / PATIENTS_PER_NURSE));
  const psychologists = Math.max(1, Math.ceil(psychologistCases / CASES_PER_PSYCHOLOGIST));

  return {
    doctors,
    nurses,
    psychologists,
    totalPatients,
    breakdown: {
      hospitalPatients,
      waitingPatients,
      psychologistCases
    }
  };
}
