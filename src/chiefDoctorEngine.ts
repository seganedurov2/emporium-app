import type { EmployeeSpecialty } from './expansionTypes';
import type { WeeklyFinanceReport } from './gameEngine';
import type { HospitalEquipmentId, HospitalState, HospitalWardId } from './hospitalEngine';
import {
  HOSPITAL_EQUIPMENT,
  HOSPITAL_WARDS,
  equipmentStock,
  getEquipmentDefinition,
  getWardDefinition,
  weeklyUpkeep,
  wardCount
} from './hospitalEngine';
import { HIRING_SLOT_UPKEEP, midSpecialtyWage, nextHiringSlotCost } from './employeesEngine';
import { formatMoney } from './currency';

/**
 * Chief doctor engine.
 *
 * The chief doctor runs the hospital as a business: she reads the last
 * weekly finance report, weighs the ward upkeep and the medical payroll
 * against the revenue, and then issues two kinds of output.
 *
 * Requests ({@link ChiefDoctorRequest}) are what the hospital needs —
 * a shortage of beds, depleted consumables, an unstaffed night shift.
 * They are the diagnosis.
 *
 * Proposals ({@link ChiefDoctorProposal}) are the treatment plan: hire
 * this nurse, buy that ward, resupply the depot. Every proposal carries
 * its one-time cost, its recurring weekly cost and the care benefit it
 * buys, and is only marked affordable when the treasury can cover it.
 * A proposal whose weekly cost exceeds the weekly surplus is flagged as
 * a budget strain, so the player never hires the hospital into
 * bankruptcy.
 */

/** How many of each ward type the chief doctor will propose at most. */
const MAX_WARD_PROPOSALS_PER_TYPE = 4;
/** Stock, in deliveries, below which the chief doctor proposes a resupply. */
const EQUIPMENT_RESERVE_DELIVERIES = 3;
/** Deliveries the chief doctor keeps in the depot after a resupply. */
const EQUIPMENT_TARGET_DELIVERIES = 4;
/** Cap on the number of proposals shown at once. */
const PROPOSAL_CAP = 10;

export type ChiefDoctorPriority = 'critical' | 'high' | 'medium' | 'low';

const PRIORITY_RANK: Record<ChiefDoctorPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

export const PRIORITY_LABELS: Record<ChiefDoctorPriority, string> = {
  critical: 'Критично',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий'
};

export type ChiefDoctorRequestKind = 'building' | 'staff' | 'equipment' | 'ward' | 'budget';

export interface ChiefDoctorRequest {
  id: string;
  kind: ChiefDoctorRequestKind;
  priority: ChiefDoctorPriority;
  title: string;
  detail: string;
}

export type ChiefDoctorProposalKind =
  | 'hire'
  | 'buy_slot'
  | 'buy_ward'
  | 'buy_equipment'
  | 'upgrade_hospital';

export interface ChiefDoctorProposal {
  id: string;
  kind: ChiefDoctorProposalKind;
  priority: ChiefDoctorPriority;
  title: string;
  detail: string;
  /** What the proposal buys in care terms. */
  benefit: string;
  /** One-time cost: purchase price, or 0 for a hire. */
  cost: number;
  /** Recurring weekly cost: wage, ward upkeep or slot upkeep. */
  weeklyCost: number;
  /** Units the proposal buys, when the proposal is a purchase. */
  quantity?: number;
  affordable: boolean;
  blockReason: string;
  /** True when the recurring cost alone exceeds the weekly surplus. */
  strainsBudget: boolean;
  specialty?: EmployeeSpecialty;
  wardId?: HospitalWardId;
  equipmentId?: HospitalEquipmentId;
}

export interface ChiefDoctorAssessment {
  income: number;
  expenses: number;
  netIncome: number;
  /** Ward upkeep plus the medical payroll, per week. */
  hospitalExpenses: number;
  funds: number;
  /** Weeks the treasury lasts at the current burn rate; null while breaking even or better. */
  runwayWeeks: number | null;
  verdict: string;
}

export interface ChiefDoctorReport {
  week: number;
  assessment: ChiefDoctorAssessment;
  requests: ChiefDoctorRequest[];
  proposals: ChiefDoctorProposal[];
}

export interface ChiefDoctorInput {
  week: number;
  funds: number;
  hospital: HospitalState;
  hospitalLevel: number;
  /** Cost of the next hospital upgrade (or of construction), null at max level. */
  hospitalUpgradeCost: number | null;
  hospitalUpgradeBenefit: string;
  nurses: number;
  midwives: number;
  clinicians: number;
  psychologists: number;
  /** Weekly wages of every medical employee on the payroll. */
  medicalWages: number;
  recommendedDoctors: number;
  recommendedNurses: number;
  recommendedPsychologists: number;
  psychologistCases: number;
  waitingForBed: number;
  waitingForObservation: number;
  waitingForTreatment: number;
  hiringSlots: number;
  employeeCount: number;
  weeklyReport: WeeklyFinanceReport | null;
}

/** Midpoint of a specialty's wage range, rounded to the pay grade. */
function midWage(specialty: EmployeeSpecialty): number {
  return midSpecialtyWage(specialty);
}

function sortByPriority<T extends { priority: ChiefDoctorPriority }>(items: T[]): T[] {
  return [...items].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
}

/** Proposals sort by urgency first, then by what the treasury can cover today. */
function sortProposals(items: ChiefDoctorProposal[]): ChiefDoctorProposal[] {
  return [...items].sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      || (a.affordable === b.affordable ? 0 : a.affordable ? -1 : 1)
  );
}

export function buildChiefDoctorReport(input: ChiefDoctorInput): ChiefDoctorReport {
  const report = input.weeklyReport;
  const income = report
    ? report.revenue.venue + report.revenue.caravans + report.revenue.captureOps
      + report.revenue.contracts + report.revenue.salon
    : 0;
  const expenses = report
    ? report.expenses.wages + report.expenses.hospital + report.expenses.restZone
      + report.expenses.staffSlots + report.expenses.loanPayment + report.expenses.warehouse
    : 0;
  const netIncome = income - expenses;
  const hospitalExpenses = weeklyUpkeep(input.hospital) + input.medicalWages;
  const runwayWeeks = netIncome < 0
    ? Math.floor(input.funds / Math.max(1, -netIncome))
    : null;
  const slotAvailable = input.employeeCount < input.hiringSlots;
  const hasFinancials = report !== null;

  // --- Assessment: can the hospital afford to grow? ---
  let verdict: string;
  if (!report) {
    verdict = 'Финансовый отчёт ещё не составлен — первая неделя не завершена. Доходы и расходы неизвестны, решения принимаются по казне.';
  } else if (input.hospitalLevel <= 0) {
    verdict = 'Больница не построена. Без здания нет ни палат, ни дежурных, ни ухода — постройка идёт первой в списке.';
  } else if (netIncome < 0) {
    verdict = `Больница работает в убыток: каждую неделю компания теряет ${formatMoney(Math.abs(netIncome))}. При таком раскладе казны хватит на ${runwayWeeks} нед. — нанимать и закупать можно только самое необходимое.`;
  } else {
    verdict = `Доходы покрывают расходы с профицитом ${formatMoney(netIncome)} в неделю. Больница может расти: палаты, персонал и расходники закупаются без ущерба казне.`;
  }

  const requests: ChiefDoctorRequest[] = [];
  const proposals: ChiefDoctorProposal[] = [];

  // --- Budget ---
  if (netIncome < 0) {
    requests.push({
      id: 'req_budget_deficit',
      kind: 'budget',
      priority: 'critical',
      title: 'Дефицит бюджета',
      detail: `Расходы превышают доходы на ${formatMoney(Math.abs(netIncome))} в неделю. Казны хватит на ${runwayWeeks} нед.`
    });
  }

  // --- Building ---
  if (input.hospitalLevel <= 0) {
    requests.push({
      id: 'req_building',
      kind: 'building',
      priority: 'critical',
      title: 'Построить больницу',
      detail: 'Здание не построено: палат нет, роженицы и больные остаются без ухода.'
    });
    if (input.hospitalUpgradeCost !== null) {
      proposals.push({
        id: 'prop_build_hospital',
        kind: 'upgrade_hospital',
        priority: 'critical',
        title: 'Построить больницу',
        detail: `Стоимость строительства ${formatMoney(input.hospitalUpgradeCost)}.`,
        benefit: input.hospitalUpgradeBenefit,
        cost: input.hospitalUpgradeCost,
        weeklyCost: 0,
        affordable: input.funds >= input.hospitalUpgradeCost,
        blockReason: input.funds >= input.hospitalUpgradeCost ? '' : 'Не хватает средств на строительство',
        strainsBudget: false
      });
    }
  }

  // --- Staffing ---
  if (input.hospitalLevel > 0 && input.nurses + input.midwives === 0) {
    requests.push({
      id: 'req_no_staff',
      kind: 'staff',
      priority: 'critical',
      title: 'Нет медперсонала на дежурстве',
      detail: 'Без медсестёр и акушерок наблюдение за беременными и лечение персонала приостановлены.'
    });
  }

  if (input.hospitalLevel > 0 && input.nurses < input.recommendedNurses) {
    requests.push({
      id: 'req_nurse_shortage',
      kind: 'staff',
      priority: input.nurses === 0 ? 'critical' : 'medium',
      title: `Медсестёр меньше нормы (${input.nurses} из ${input.recommendedNurses})`,
      detail: 'По нагрузке пациентов нужно больше медсестёр — уход и лечение замедляются.'
    });
    proposals.push({
      id: 'prop_hire_nurse',
      kind: 'hire',
      priority: input.nurses === 0 ? 'critical' : 'high',
      title: 'Нанять медсестру',
      detail: `Зарплата около ${formatMoney(midWage('nurse'))}/нед.`,
      benefit: '+уход на палатах, быстрее восстановление пациентов',
      cost: 0,
      weeklyCost: midWage('nurse'),
      affordable: slotAvailable,
      blockReason: slotAvailable ? '' : 'Штат заполнен — купите место в отделе кадров',
        strainsBudget: hasFinancials && netIncome < midWage('nurse'),
        specialty: 'nurse'
    });
  }

  if (input.hospitalLevel > 0 && input.midwives < Math.max(1, Math.ceil(input.recommendedNurses / 2))) {
    requests.push({
      id: 'req_midwife_shortage',
      kind: 'staff',
      priority: input.midwives === 0 ? 'high' : 'medium',
      title: `Акушерок меньше нормы (${input.midwives})`,
      detail: 'Акушерки повышают исход родов и сокращают восстановление после них.'
    });
    proposals.push({
      id: 'prop_hire_midwife',
      kind: 'hire',
      priority: input.midwives === 0 ? 'high' : 'medium',
      title: 'Нанять акушерку',
      detail: `Зарплата около ${formatMoney(midWage('midwife'))}/нед.`,
      benefit: '+исходы родов, короче восстановление',
      cost: 0,
      weeklyCost: midWage('midwife'),
      affordable: slotAvailable,
      blockReason: slotAvailable ? '' : 'Штат заполнен — купите место в отделе кадров',
        strainsBudget: hasFinancials && netIncome < midWage('midwife'),
        specialty: 'midwife'
    });
  }

  if (input.hospitalLevel > 0 && input.clinicians < input.recommendedDoctors) {
    requests.push({
      id: 'req_doctor_shortage',
      kind: 'staff',
      priority: 'medium',
      title: `Врачей меньше нормы (${input.clinicians} из ${input.recommendedDoctors})`,
      detail: 'Врачебный контроль нужен на каждые несколько пациентов.'
    });
    proposals.push({
      id: 'prop_hire_clinician',
      kind: 'hire',
      priority: 'medium',
      title: 'Нанять врача',
      detail: `Зарплата около ${formatMoney(midWage('clinician'))}/нед.`,
      benefit: 'врачебный контроль приёмов',
      cost: 0,
      weeklyCost: midWage('clinician'),
      affordable: slotAvailable,
      blockReason: slotAvailable ? '' : 'Штат заполнен — купите место в отделе кадров',
        strainsBudget: hasFinancials && netIncome < midWage('clinician'),
        specialty: 'clinician'
    });
  }

  if (input.hospitalLevel > 0 && input.psychologists < input.recommendedPsychologists && input.psychologistCases > 0) {
    requests.push({
      id: 'req_psychologist_shortage',
      kind: 'staff',
      priority: 'medium',
      title: `Психологических случаев больше, чем психологов (${input.psychologistCases} случаев)`,
      detail: 'Выгорание и плохое здоровье остаются без разбора.'
    });
    proposals.push({
      id: 'prop_hire_psychologist',
      kind: 'hire',
      priority: 'medium',
      title: 'Нанять психолога',
      detail: `Зарплата около ${formatMoney(midWage('psychologist'))}/нед.`,
      benefit: `разбор до ${Math.max(1, Math.ceil(input.psychologistCases / Math.max(1, input.recommendedPsychologists)))} случаев в неделю`,
      cost: 0,
      weeklyCost: midWage('psychologist'),
      affordable: slotAvailable,
      blockReason: slotAvailable ? '' : 'Штат заполнен — купите место в отделе кадров',
        strainsBudget: hasFinancials && netIncome < midWage('psychologist'),
        specialty: 'psychologist'
    });
  }

  if (input.employeeCount >= input.hiringSlots) {
    requests.push({
      id: 'req_slots',
      kind: 'staff',
      priority: 'medium',
      title: 'Штат заполнен',
      detail: `Все ${input.hiringSlots} мест заняты — новые наймы невозможны без покупки места.`
    });
    proposals.push({
      id: 'prop_buy_slot',
      kind: 'buy_slot',
      priority: 'medium',
      title: 'Открыть место в штате',
      detail: `Цена ${formatMoney(nextHiringSlotCost(input.hiringSlots))}, содержание ${formatMoney(HIRING_SLOT_UPKEEP)}/нед.`,
      benefit: 'снимает лимит на наймы',
      cost: nextHiringSlotCost(input.hiringSlots),
      weeklyCost: HIRING_SLOT_UPKEEP,
      affordable: input.funds >= nextHiringSlotCost(input.hiringSlots),
      blockReason: input.funds >= nextHiringSlotCost(input.hiringSlots) ? '' : 'Не хватает средств',
        strainsBudget: hasFinancials && netIncome < HIRING_SLOT_UPKEEP
    });
  }

  // --- Waiting lists ---
  if (input.waitingForBed > 0) {
    requests.push({
      id: 'req_waiting_bed',
      kind: 'ward',
      priority: 'high',
      title: `${input.waitingForBed} рожениц(ы) ждут палат`,
      detail: 'Срок вышел, а свободных коек нет — каждая неделя ожидания рискованна.'
    });
  }

  if (input.waitingForObservation > 0) {
    requests.push({
      id: 'req_waiting_observation',
      kind: 'ward',
      priority: 'high',
      title: `${input.waitingForObservation} беременность под риском без наблюдения`,
      detail: 'Медперсонал оценил случай как рискованный, но палаты заняты.'
    });
  }

  if (input.waitingForTreatment > 0) {
    requests.push({
      id: 'req_waiting_treatment',
      kind: 'ward',
      priority: 'high',
      title: `${input.waitingForTreatment} сотрудник(ов) ждут лечения`,
      detail: 'Здоровье в опасной зоне, а свободных палат нет.'
    });
  }

  // --- Consumables ---
  const depleted = HOSPITAL_EQUIPMENT.filter(item =>
    item.timing === 'always' && equipmentStock(input.hospital.equipment, item.id) < item.perDelivery
  );
  if (input.hospitalLevel > 0 && depleted.length > 0) {
    requests.push({
      id: 'req_equipment',
      kind: 'equipment',
      priority: 'high',
      title: `Закончились расходники: ${depleted.map(item => item.name).join(', ')}`,
      detail: 'Следующий приём пройдёт без них — исходы будут хуже.'
    });
  }

  if (input.hospitalLevel > 0) {
    for (const item of HOSPITAL_EQUIPMENT) {
      const stock = equipmentStock(input.hospital.equipment, item.id);
      if (stock >= item.perDelivery * EQUIPMENT_RESERVE_DELIVERIES) continue;
      const quantity = Math.max(item.perDelivery * EQUIPMENT_TARGET_DELIVERIES - stock, 1);
      const cost = item.cost * quantity;
      proposals.push({
        id: `prop_equipment_${item.id}`,
        kind: 'buy_equipment',
        priority: depleted.some(entry => entry.id === item.id) ? 'high' : 'low',
        title: `Закупить «${item.name}» ×${quantity}`,
        detail: `На складе ${stock}, расход ${item.perDelivery} на приём.`,
        benefit: item.timing === 'always'
          ? `резерв на ${EQUIPMENT_TARGET_DELIVERIES} приёмов, исход +${item.missingPenalty} каждый`
          : 'нужен при осложнениях — страховка для тяжёлых родов',
        cost,
        weeklyCost: 0,
        affordable: input.funds >= cost,
        blockReason: input.funds >= cost ? '' : 'Не хватает средств',
        strainsBudget: false,
        quantity,
        equipmentId: item.id
      });
    }
  }

  // --- Ward capacity ---
  if (input.hospitalLevel > 0) {
    const waiting = input.waitingForBed + input.waitingForObservation + input.waitingForTreatment;
    for (const ward of HOSPITAL_WARDS) {
      const owned = wardCount(input.hospital, ward.id);
      if (owned >= MAX_WARD_PROPOSALS_PER_TYPE) continue;
      if (input.hospitalLevel < ward.requiredHospitalLevel) continue;
      proposals.push({
        id: `prop_ward_${ward.id}`,
        kind: 'buy_ward',
        priority: waiting > 0 ? 'high' : 'low',
        title: `Купить «${ward.name}»`,
        detail: `${ward.beds} койк(и), качество ухода ${ward.quality}, содержание ${formatMoney(ward.weeklyUpkeep)}/нед.`,
        benefit: `+${ward.beds} койки, уход качества ${ward.quality}`,
        cost: ward.cost,
        weeklyCost: ward.weeklyUpkeep,
        affordable: input.funds >= ward.cost,
        blockReason: input.funds >= ward.cost ? '' : 'Не хватает средств',
        strainsBudget: hasFinancials && netIncome < ward.weeklyUpkeep,
        quantity: 1,
        wardId: ward.id
      });
    }
  }

  // --- Hospital level ---
  if (input.hospitalLevel > 0 && input.hospitalUpgradeCost !== null) {
    requests.push({
      id: 'req_level',
      kind: 'building',
      priority: 'low',
      title: `Уровень больницы ${input.hospitalLevel} из 3`,
      detail: 'Повышение уровня открывает лучшие палаты и увеличивает бонусы ухода.'
    });
    proposals.push({
      id: 'prop_upgrade_hospital',
      kind: 'upgrade_hospital',
      priority: 'medium',
      title: `Улучшить больницу до уровня ${input.hospitalLevel + 1}`,
      detail: `Стоимость ${formatMoney(input.hospitalUpgradeCost)}.`,
      benefit: input.hospitalUpgradeBenefit,
      cost: input.hospitalUpgradeCost,
      weeklyCost: 0,
      affordable: input.funds >= input.hospitalUpgradeCost,
      blockReason: input.funds >= input.hospitalUpgradeCost ? '' : 'Не хватает средств',
      strainsBudget: false
    });
  }

  return {
    week: input.week,
    assessment: {
      income,
      expenses,
      netIncome,
      hospitalExpenses,
      funds: input.funds,
      runwayWeeks,
      verdict
    },
    requests: sortByPriority(requests),
    proposals: sortProposals(proposals).slice(0, PROPOSAL_CAP)
  };
}

/** Human-readable label for a request kind. */
export function requestKindLabel(kind: ChiefDoctorRequestKind): string {
  switch (kind) {
    case 'building': return 'Здание';
    case 'staff': return 'Персонал';
    case 'equipment': return 'Расходники';
    case 'ward': return 'Палаты';
    case 'budget': return 'Бюджет';
  }
}

/** Human-readable label for a proposal kind. */
export function proposalKindLabel(kind: ChiefDoctorProposalKind): string {
  switch (kind) {
    case 'hire': return 'Найм';
    case 'buy_slot': return 'Штат';
    case 'buy_ward': return 'Палата';
    case 'buy_equipment': return 'Закупка';
    case 'upgrade_hospital': return 'Строительство';
  }
}

/** Ward name for a proposal, when the proposal concerns a ward. */
export function proposalWardName(proposal: ChiefDoctorProposal): string | undefined {
  return proposal.wardId ? getWardDefinition(proposal.wardId)?.name : undefined;
}

/** Equipment name for a proposal, when the proposal concerns a consumable. */
export function proposalEquipmentName(proposal: ChiefDoctorProposal): string | undefined {
  return proposal.equipmentId ? getEquipmentDefinition(proposal.equipmentId)?.name : undefined;
}
