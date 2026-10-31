/**
 * The campaign script: the story of a run split into acts.
 *
 * The engine already knows how a campaign ends (week 100 + capital +
 * reputation, see metaProgressEngine). This module gives that long stretch a
 * shape — four acts with their own weeks, thesis and exit conditions — so the
 * UI can tell the player where they are and what the act is about.
 *
 * Kept free of React and of the campaign type: progress is computed from a
 * plain snapshot so it can be tested and reused by the ending modal.
 */
import { formatMoney } from './currency';

export type CampaignActId =
  | "founding"
  | "expansion"
  | "syndicate"
  | "reckoning";

/** Facts about a campaign that the script needs to judge progress. */
export interface ScriptSnapshot {
  week: number;
  funds: number;
  reputation: number;
  /** Venues that are up and running (pleasure house, club, salon, hospital…). */
  activeVenues: number;
  /** Employees on the payroll, including the CEO. */
  employees: number;
  /** Completed auction deals, caravans and capture operations. */
  dealsCompleted: number;
  /** Has the city hub been opened at least once. */
  cityHubUnlocked: boolean;
  /** Campaign has been declared bankrupt. */
  isBankrupt: boolean;
}

export interface ScriptObjective {
  id: string;
  label: string;
  /** How the objective reads its value out of the snapshot. */
  value: (snapshot: ScriptSnapshot) => number;
  /** Target the value is compared against. */
  target: number;
  /** Compact formatting for the UI ("3 / 5", "$320k / $300k"). */
  format: (value: number, target: number) => string;
}

export interface CampaignAct {
  id: CampaignActId;
  number: number;
  title: string;
  /** Short thesis, one line, shown under the act title. */
  thesis: string;
  /** Inclusive week range of the act. */
  weeks: [number, number];
  objectives: ScriptObjective[];
  /** Story beat the act is built around. */
  beat: string;
}

const money = (value: number, target: number) =>
  `${formatShortMoney(value)} / ${formatShortMoney(target)}`;
const count = (value: number) => `${Math.floor(value)}`;

/**
 * Money is stored in USD but displayed in BTC everywhere (see currency.ts), so
 * the script panel must not print dollars: a $ target next to a ₿ header in the
 * same screen reads as a bug.
 */
export function formatShortMoney(value: number): string {
  return formatMoney(value);
}

export const CAMPAIGN_ACTS: CampaignAct[] = [
  {
    id: "founding",
    number: 1,
    title: "Учреждение",
    thesis: "От стартового капитала до первой стабильной прибыли.",
    weeks: [1, 30],
    beat: "Первый серьёзный заказ: крупная предоплата в обмен на репутацию.",
    objectives: [
      {
        id: "capital",
        label: "Казна",
        value: (s) => s.funds,
        target: 300_000,
        format: money,
      },
      {
        id: "crew",
        label: "Команда",
        value: (s) => s.employees,
        target: 6,
        format: count,
      },
      {
        id: "venues",
        label: "Источники дохода",
        value: (s) => s.activeVenues,
        target: 2,
        format: count,
      },
    ],
  },
  {
    id: "expansion",
    number: 2,
    title: "Экспансия",
    thesis: "Три потока дохода и работающий аукционный дом.",
    weeks: [31, 60],
    beat: "Обыск: проверка юристов и службы безопасности.",
    objectives: [
      {
        id: "capital",
        label: "Казна",
        value: (s) => s.funds,
        target: 700_000,
        format: money,
      },
      {
        id: "venues",
        label: "Источники дохода",
        value: (s) => s.activeVenues,
        target: 4,
        format: count,
      },
      {
        id: "deals",
        label: "Сделок закрыто",
        value: (s) => s.dealsCompleted,
        target: 25,
        format: count,
      },
    ],
  },
  {
    id: "syndicate",
    number: 3,
    title: "Синдикат",
    thesis: "Экономика превращается в систему, а не в ручное управление.",
    weeks: [61, 85],
    beat: "Финансист рынка приносит пять треков улучшений — вместе с рисками.",
    objectives: [
      {
        id: "capital",
        label: "Казна",
        value: (s) => s.funds,
        target: 900_000,
        format: money,
      },
      {
        id: "reputation",
        label: "Репутация",
        value: (s) => s.reputation,
        target: 70,
        format: (v, t) => `${Math.floor(v)} / ${t}`,
      },
      {
        id: "hub",
        label: "Мезонин открыт",
        value: (s) => (s.cityHubUnlocked ? 1 : 0),
        target: 1,
        format: (v, t) => `${v} / ${t}`,
      },
    ],
  },
  {
    id: "reckoning",
    number: 4,
    title: "Отчёт",
    thesis: "Дожить до сотой недели миллионером и удержать имя.",
    weeks: [86, 100],
    beat: "Финальный отчёт перед советом: победа или внешнее управление.",
    objectives: [
      {
        id: "capital",
        label: "Казна",
        value: (s) => s.funds,
        target: 1_000_000,
        format: money,
      },
      {
        id: "reputation",
        label: "Репутация",
        value: (s) => s.reputation,
        target: 50,
        format: (v, t) => `${Math.floor(v)} / ${t}`,
      },
      {
        id: "week",
        label: "Неделя",
        value: (s) => s.week,
        target: 100,
        format: (v, t) => `${Math.min(Math.floor(v), t)} / ${t}`,
      },
    ],
  },
];

export const CAMPAIGN_ACT_BY_ID: Record<CampaignActId, CampaignAct> =
  CAMPAIGN_ACTS.reduce(
    (map, act) => {
      map[act.id] = act;
      return map;
    },
    {} as Record<CampaignActId, CampaignAct>,
  );

/** The act a campaign is in on the given week (acts cover weeks 1..100). */
export function actForWeek(week: number): CampaignAct {
  const clamped = Number.isFinite(week) ? week : 1;
  return (
    CAMPAIGN_ACTS.find(
      (act) => clamped >= act.weeks[0] && clamped <= act.weeks[1],
    ) ??
    (clamped > CAMPAIGN_ACTS[CAMPAIGN_ACTS.length - 1].weeks[1]
      ? CAMPAIGN_ACTS[CAMPAIGN_ACTS.length - 1]
      : CAMPAIGN_ACTS[0])
  );
}

export interface ScriptProgress {
  act: CampaignAct;
  /** 0..1 share of objectives met in the current act. */
  objectiveProgress: number;
  objectives: {
    objective: ScriptObjective;
    value: number;
    done: boolean;
    percent: number;
  }[];
  /** Act finished: every objective met. */
  actComplete: boolean;
  /** Weeks left in the current act (0 when the act is over). */
  weeksLeft: number;
  /** Previous acts whose objectives were all met. */
  completedActs: CampaignActId[];
}

export function evaluateScript(
  snapshot: ScriptSnapshot,
  week = snapshot.week,
): ScriptProgress {
  const act = actForWeek(week);
  const objectives = act.objectives.map((objective) => {
    const value = objective.value(snapshot);
    const percent =
      objective.target <= 0
        ? 100
        : Math.min(100, Math.round((value / objective.target) * 100));
    return { objective, value, done: value >= objective.target, percent };
  });
  const met = objectives.filter((item) => item.done).length;
  const weeksLeft = Math.max(0, act.weeks[1] - week);

  // A previous act counts as completed only if its own objectives were met by
  // now — the script is a checklist, not a timeline the player can outrun.
  const completedActs = CAMPAIGN_ACTS.filter(
    (previous) => previous.weeks[1] < act.weeks[0],
  )
    .filter((previous) =>
      previous.objectives.every(
        (objective) => objective.value(snapshot) >= objective.target,
      ),
    )
    .map((previous) => previous.id);

  return {
    act,
    objectiveProgress: met / objectives.length,
    objectives,
    actComplete: met === objectives.length,
    weeksLeft,
    completedActs,
  };
}

/** Groomed one-line summary for a header badge. */
export function describeAct(act: CampaignAct): string {
  return `Акт ${act.number} · ${act.title}`;
}

/** Save-safe shape: the script stores only the last act the player reached. */
export interface CampaignScriptState {
  actId: CampaignActId;
  /** Week the act was entered, used to show how long the player has been here. */
  enteredWeek: number;
}

export function createCampaignScript(week: number): CampaignScriptState {
  const act = actForWeek(week);
  return { actId: act.id, enteredWeek: act.weeks[0] };
}

/**
 * Normalizes a stored script for a campaign at `week`. Saves written before
 * 0.3.7 have no script at all, and a stored act that the week has outgrown is
 * advanced instead of trusted.
 */
export function normalizeCampaignScript(
  raw: unknown,
  week: number,
): CampaignScriptState {
  const expected = createCampaignScript(week);
  if (!raw || typeof raw !== "object") return expected;
  const record = raw as Partial<CampaignScriptState>;
  const stored = CAMPAIGN_ACT_BY_ID[record.actId as CampaignActId];
  if (!stored) return expected;
  // Never let a save keep the player in an act that is behind their week.
  if (stored.weeks[1] < actForWeek(week).weeks[0]) return expected;
  const enteredWeek = Number(record.enteredWeek);
  return {
    actId: stored.id,
    enteredWeek:
      Number.isFinite(enteredWeek) && enteredWeek >= 1
        ? Math.floor(enteredWeek)
        : stored.weeks[0],
  };
}

/** Returns the script advanced to the act the week belongs to. */
export function advanceCampaignScript(
  script: CampaignScriptState,
  week: number,
): CampaignScriptState {
  const act = actForWeek(week);
  if (script.actId === act.id) return script;
  return { actId: act.id, enteredWeek: act.weeks[0] };
}
