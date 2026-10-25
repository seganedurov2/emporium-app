import { formatMoney } from './currency';
/**
 * Bankruptcy procedure engine.
 *
 * A filed case answers two questions: who initiated it (the debtor himself
 * or authorized bodies) and which way out was chosen — through the court and
 * the syndicate's own lawyers (financial recovery, external management or a
 * settlement agreement) or only through the bank and the board of directors
 * (an out-of-court restructuring).
 */

export type BankruptcyInitiator = 'debtor' | 'authorized_bodies';
export type BankruptcyPath = 'court' | 'bank_board';
export type BankruptcyProcedure = 'financial_recovery' | 'external_management' | 'settlement_agreement';
export type BankruptcyCaseStatus = 'active' | 'resolved';

export interface BankruptcyCase {
  id: string;
  initiator: BankruptcyInitiator;
  path: BankruptcyPath;
  procedure: BankruptcyProcedure;
  filedWeek: number;
  weeksElapsed: number;
  totalWeeks: number;
  status: BankruptcyCaseStatus;
  outcomeNote: string | null;
}

export interface BankruptcyProcedureDefinition {
  id: BankruptcyProcedure;
  title: string;
  shortDescription: string;
  durationWeeks: number;
  /** Weekly lawyer / external manager fee deducted from the treasury. */
  weeklyFee: number;
  /** Loan payments are frozen for the whole procedure. */
  loanMoratorium: boolean;
  /** Share of the remaining loan principal forgiven when the case resolves. */
  debtHaircut: number;
  /** Reputation penalty applied when the case resolves. */
  reputationPenalty: number;
  /** An external manager controls the syndicate's income during the procedure. */
  receivershipDuring: boolean;
}

/** Court-approved procedures — each requires the syndicate's own lawyers. */
export const COURT_PROCEDURES: BankruptcyProcedureDefinition[] = [
  {
    id: 'financial_recovery',
    title: 'Финансовое оздоровление',
    shortDescription: 'Суд утверждает план оздоровления: платежи по займам замораживаются, управление остаётся у должника.',
    durationWeeks: 8,
    weeklyFee: 800,
    loanMoratorium: true,
    debtHaircut: 0.4,
    reputationPenalty: 0,
    receivershipDuring: false
  },
  {
    id: 'external_management',
    title: 'Внешнее управление',
    shortDescription: 'Внешний управляющий контролирует доходы и расходы синдиката на весь срок процедуры.',
    durationWeeks: 12,
    weeklyFee: 1200,
    loanMoratorium: false,
    debtHaircut: 0.25,
    reputationPenalty: 5,
    receivershipDuring: true
  },
  {
    id: 'settlement_agreement',
    title: 'Мировое соглашение',
    shortDescription: 'Суд утверждает сделку с кредиторами: половина долга списывается, репутация страдает.',
    durationWeeks: 4,
    weeklyFee: 600,
    loanMoratorium: true,
    debtHaircut: 0.5,
    reputationPenalty: 10,
    receivershipDuring: false
  }
];

/** Out-of-court path — restructuring directly through the bank and the board. */
export const BANK_BOARD_PROCEDURE: BankruptcyProcedureDefinition = {
  id: 'settlement_agreement',
  title: 'Внесудебное мировое соглашение',
  shortDescription: 'Реструктуризация напрямую через банк и совет директоров — без суда и без юристов.',
  durationWeeks: 6,
  weeklyFee: 400,
  loanMoratorium: true,
  debtHaircut: 0.35,
  reputationPenalty: 0,
  receivershipDuring: false
};

export const INITIATOR_LABELS: Record<BankruptcyInitiator, string> = {
  debtor: 'Сам должник',
  authorized_bodies: 'Уполномоченные органы'
};

export const PATH_LABELS: Record<BankruptcyPath, string> = {
  court: 'Через суд и юристов',
  bank_board: 'Только через банк или совет директоров'
};

export function getProcedureDefinition(path: BankruptcyPath, procedure: BankruptcyProcedure): BankruptcyProcedureDefinition {
  if (path === 'bank_board') return BANK_BOARD_PROCEDURE;
  return COURT_PROCEDURES.find(definition => definition.id === procedure) ?? COURT_PROCEDURES[0];
}

let caseCounter = 0;

export function fileBankruptcyCase(
  initiator: BankruptcyInitiator,
  path: BankruptcyPath,
  procedure: BankruptcyProcedure,
  week: number
): BankruptcyCase {
  const definition = getProcedureDefinition(path, procedure);
  return {
    id: `bankruptcy_${week}_${++caseCounter}`,
    initiator,
    path,
    procedure,
    filedWeek: week,
    weeksElapsed: 0,
    totalWeeks: definition.durationWeeks,
    status: 'active',
    outcomeNote: null
  };
}

export interface BankruptcyWeekResult {
  updatedCase: BankruptcyCase;
  resolved: boolean;
  logs: string[];
  weeklyFee: number;
  loanMoratorium: boolean;
  receivershipDuring: boolean;
  /** Share of remaining principal forgiven — only set when the case resolves. */
  debtHaircut: number;
  /** Reputation penalty — only applied when the case resolves. */
  reputationPenalty: number;
}

function resolutionNote(bankruptcyCase: BankruptcyCase, definition: BankruptcyProcedureDefinition): string {
  const haircut = Math.round(definition.debtHaircut * 100);
  switch (bankruptcyCase.procedure) {
    case 'financial_recovery':
      return `План финансового оздоровления выполнен: долг реструктурирован (-${haircut}%), синдикат выходит из банкротства под контролем должника.`;
    case 'external_management':
      return `Внешнее управление завершено: долг сокращён на ${haircut}%, управление возвращено совету директоров.`;
    default:
      return bankruptcyCase.path === 'bank_board'
        ? `Внесудебное соглашение с банком и советом директоров закрыто: ${haircut}% долга реструктурировано.`
        : `Мировое соглашение утверждено судом: ${haircut}% долга списано, синдикат выходит из банкротства.`;
  }
}

/** Advances a filed case by one week and reports the effects to apply. */
export function advanceBankruptcyWeek(bankruptcyCase: BankruptcyCase): BankruptcyWeekResult {
  const definition = getProcedureDefinition(bankruptcyCase.path, bankruptcyCase.procedure);
  const weeksElapsed = bankruptcyCase.weeksElapsed + 1;
  const resolved = weeksElapsed >= bankruptcyCase.totalWeeks;
  const logs: string[] = [];

  if (resolved) {
    logs.push(`ПРОЦЕДУРА БАНКРОТСТВА ЗАВЕРШЕНА: «${definition.title}» (${PATH_LABELS[bankruptcyCase.path]}). ${resolutionNote(bankruptcyCase, definition)}`);
  } else {
    const effects: string[] = [];
    if (definition.loanMoratorium) effects.push('мораторий на платежи по займам');
    if (definition.receivershipDuring) effects.push('внешнее управление доходами');
    effects.push(`сборы ${formatMoney(definition.weeklyFee)}/нед.`);
    logs.push(`ПРОЦЕДУРА БАНКРОТСТВА: «${definition.title}» — неделя ${weeksElapsed}/${bankruptcyCase.totalWeeks} (${effects.join(', ')}).`);
  }

  return {
    updatedCase: {
      ...bankruptcyCase,
      weeksElapsed,
      status: resolved ? 'resolved' : 'active',
      outcomeNote: resolved ? resolutionNote(bankruptcyCase, definition) : null
    },
    resolved,
    logs,
    weeklyFee: definition.weeklyFee,
    loanMoratorium: definition.loanMoratorium,
    receivershipDuring: definition.receivershipDuring,
    debtHaircut: resolved ? definition.debtHaircut : 0,
    reputationPenalty: resolved ? definition.reputationPenalty : 0
  };
}
