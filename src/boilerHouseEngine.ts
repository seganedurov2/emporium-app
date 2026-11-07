/**
 * Котельная — тепловой контур синдиката.
 *
 * Котельная отапливает все площадки: дом удовольствия, стрип-клуб, салон,
 * больницу, зону отдыха, БДСМ-комнату и складской мезонин. Каждую неделю она
 * сжигает топливо, а взамен даёт «тепловой бонус» к выручке площадок и
 * снижает усталость персонала. Если топливо кончилось или котёл встал на
 * аварию — площадки мёрзнут: выручка падает, а усталость растёт.
 *
 * Модуль чистый: `advanceBoilerHouseWeek` считает неделю и возвращает новое
 * состояние плюс строки журнала и суммы для финансового отчёта. Компонент
 * только вызывает действия и записывает результат в кампанию.
 */

import { formatMoney } from "./currency";

export type BoilerFuelId = "coal" | "gas" | "bio";

export type BoilerId = "main" | "reserve" | "workshop";

export type BoilerStatus = "idle" | "running" | "broken";

export interface BoilerFuel {
  id: BoilerFuelId;
  name: string;
  /** Цена за единицу топлива. */
  unitCost: number;
  /** Единиц топлива в час работы котла. */
  burnPerHour: number;
  /** Теплоотдача: множитель к мощности котла. */
  heatMultiplier: number;
  /** Прибавка к риску аварии за неделю (0-1). */
  breakdownRisk: number;
  description: string;
}

export interface BoilerDefinition {
  id: BoilerId;
  name: string;
  /** Тепловая мощность в «градусах» — сколько площадок тянет котёл. */
  power: number;
  /** Цена постройки. */
  buildCost: number;
  /** Недельное обслуживание. */
  upkeep: number;
  description: string;
}

export interface BoilerState {
  id: BoilerId;
  status: BoilerStatus;
  /** 0-100: износ. Растёт от работы, падает от ремонта. */
  wear: number;
  /** Сколько часов в неделю котёл работает (0-168). */
  hoursPerWeek: number;
  /** Топливо, на котором котёл работает. */
  fuel: BoilerFuelId;
  /** Неделя, когда котёл сломался; null, если исправен. */
  brokenSinceWeek: number | null;
}

/**
 * Автоматика котельной. Включённая автоматика сама закупает топливо,
 * запускает и останавливает котлы, ремонтирует аварии и держит запас
 * на `reserveWeeks` недель вперёд — в пределах недельного бюджета.
 */
export interface BoilerAutomation {
  enabled: boolean;
  /** Сколько недель запаса топлива держать. */
  reserveWeeks: number;
  /** Недельный лимит на топливо и ремонт. */
  weeklyBudget: number;
  /** Чинить аварии сразу, не дожидаясь недельного простоя. */
  autoRepair: boolean;
  /** Запускать резервные котлы, когда покрытие падает ниже порога. */
  autoStart: boolean;
  /** Останавливать лишние котлы, когда тепла с избытком. */
  autoStop: boolean;
  /** Топливо, которое автоматика закупает. */
  preferredFuel: BoilerFuelId;
}

export interface BoilerHouseState {
  /** Построенные котлы. */
  boilers: BoilerState[];
  /** Настройки автоматики. */
  automation: BoilerAutomation;
  /** Запас топлива по видам. */
  fuelStock: Record<BoilerFuelId, number>;
  /** Температура в контуре, °C. Ниже 18 — площадки мёрзнут. */
  temperature: number;
  /** Последняя неделя, за которую начислялись расходы. */
  lastCalculatedWeek: number;
  /** Всего недель без отопления (для статистики и достижений). */
  coldWeeks: number;
  /** Сколько раз котлы вставали на аварию. */
  breakdowns: number;
}

export interface BoilerHouseReport {
  /** Тепло, которое дали котлы за неделю, в «градусах». */
  heatProduced: number;
  /** Тепло, которое нужно всем площадкам. */
  heatDemand: number;
  /** 0-1: доля покрытой потребности. */
  coverage: number;
  /** Множитель выручки площадок (0.75 … 1.15). */
  revenueMultiplier: number;
  /** Прибавка к усталости персонала за неделю (0 … 8). */
  exhaustionBump: number;
  /** Стоимость сожжённого топлива. */
  fuelSpent: number;
  /** Обслуживание котлов. */
  upkeep: number;
  /** Ремонт аварийных котлов. */
  repairCost: number;
  /** Итоговые расходы недели. */
  totalCost: number;
  /** Температура после недели. */
  temperature: number;
  /** Котлы, которые встали на аварию на этой неделе. */
  brokenBoilers: BoilerId[];
  /** Котлы, которые были отремонтированы автоматически. */
  repairedBoilers: BoilerId[];
  /** Сколько топлива автоматика докупила за неделю. */
  autoFuelBought: number;
  /** Сколько автоматика потратила на топливо и ремонт. */
  autoSpent: number;
  /** Котлы, которые автоматика запустила или остановила. */
  autoStarted: BoilerId[];
  autoStopped: BoilerId[];
  logs: string[];
}

export const BOILER_FUELS: BoilerFuel[] = [
  {
    id: "coal",
    name: "Уголь",
    unitCost: 40,
    burnPerHour: 2,
    heatMultiplier: 1,
    breakdownRisk: 0.02,
    description:
      "Дешёвое и надёжное топливо. Много золы, котёл изнашивается быстрее.",
  },
  {
    id: "gas",
    name: "Газ",
    unitCost: 90,
    burnPerHour: 1,
    heatMultiplier: 1.25,
    breakdownRisk: 0.01,
    description: "Дороже угля, но даёт больше тепла и меньше износа.",
  },
  {
    id: "bio",
    name: "Биотопливо",
    unitCost: 150,
    burnPerHour: 1,
    heatMultiplier: 1.4,
    breakdownRisk: 0.005,
    description:
      "Экологичное топливо из отходов. Самое дорогое, но самое горячее.",
  },
];

export const BOILER_DEFINITIONS: BoilerDefinition[] = [
  {
    id: "main",
    name: "Главный котёл",
    power: 60,
    buildCost: 0,
    upkeep: 1200,
    description: "Базовый котёл котельной. Работает с первого дня кампании.",
  },
  {
    id: "reserve",
    name: "Резервный котёл",
    power: 45,
    buildCost: 60000,
    upkeep: 900,
    description: "Подхватывает нагрузку, когда главный встаёт на ремонт.",
  },
  {
    id: "workshop",
    name: "Промышленный котёл",
    power: 80,
    buildCost: 150000,
    upkeep: 1800,
    description:
      "Мощный котёл для расширенного синдиката: тянет все площадки с запасом.",
  },
];

export const BOILER_FUEL_BY_ID: Record<BoilerFuelId, BoilerFuel> =
  BOILER_FUELS.reduce(
    (acc, fuel) => ({ ...acc, [fuel.id]: fuel }),
    {} as Record<BoilerFuelId, BoilerFuel>,
  );

export const BOILER_DEFINITION_BY_ID: Record<BoilerId, BoilerDefinition> =
  BOILER_DEFINITIONS.reduce(
    (acc, boiler) => ({ ...acc, [boiler.id]: boiler }),
    {} as Record<BoilerId, BoilerDefinition>,
  );

/** Тепло, которое нужно одной площадке за неделю. */
export const HEAT_PER_VENUE = 20;
/** Площадки, которые отапливает котельная. */
export const HEATED_VENUES = [
  "pleasure_house",
  "strip_club",
  "beauty_salon",
  "bdsm_room",
  "auction_house",
] as const;
/** Больница, зона отдыха и склад тоже требуют тепла, но не дают выручки. */
export const HEATED_FACILITIES = 3;
/** Комфортная температура контура. */
export const COMFORT_TEMPERATURE = 22;
/** Ниже этой температуры площадки считаются замёрзшими. */
export const FREEZING_TEMPERATURE = 18;
/** Максимальный запас топлива на складе котельной. */
export const FUEL_STORAGE_CAP = 2000;
/** Цена ремонта одного котла за единицу износа. */
export const REPAIR_COST_PER_WEAR = 60;
/** Износ за час работы котла. */
export const WEAR_PER_HOUR = 0.06;
/** Покрытие, ниже которого автоматика запускает резервные котлы. */
export const AUTO_START_COVERAGE = 0.95;
/** Покрытие, выше которого автоматика останавливает лишние котлы. */
export const AUTO_STOP_COVERAGE = 1;
/** Границы настроек автоматики. */
export const AUTO_RESERVE_WEEKS_MIN = 1;
export const AUTO_RESERVE_WEEKS_MAX = 12;
export const AUTO_BUDGET_MIN = 0;
export const AUTO_BUDGET_MAX = 500000;

export function createBoilerAutomation(): BoilerAutomation {
  return {
    enabled: false,
    reserveWeeks: 3,
    weeklyBudget: 20000,
    autoRepair: true,
    autoStart: true,
    autoStop: false,
    preferredFuel: "coal",
  };
}

export function createBoilerHouseState(): BoilerHouseState {
  return {
    boilers: [
      {
        id: "main",
        status: "running",
        wear: 0,
        hoursPerWeek: 84,
        fuel: "coal",
        brokenSinceWeek: null,
      },
    ],
    automation: createBoilerAutomation(),
    fuelStock: { coal: 400, gas: 0, bio: 0 },
    temperature: COMFORT_TEMPERATURE,
    lastCalculatedWeek: 0,
    coldWeeks: 0,
    breakdowns: 0,
  };
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const num = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function normalizeBoilerHouseState(raw: unknown): BoilerHouseState {
  const base = createBoilerHouseState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;

  const boilers: BoilerState[] = Array.isArray(r.boilers)
    ? (r.boilers as Partial<BoilerState>[])
        .filter(
          (boiler) =>
            boiler &&
            typeof boiler.id === "string" &&
            boiler.id in BOILER_DEFINITION_BY_ID,
        )
        .map((boiler) => {
          const id = boiler.id as BoilerId;
          const status: BoilerStatus =
            boiler.status === "broken" || boiler.status === "idle"
              ? boiler.status
              : "running";
          const fuel: BoilerFuelId =
            boiler.fuel === "gas" || boiler.fuel === "bio"
              ? boiler.fuel
              : "coal";
          return {
            id,
            status,
            wear: clamp(num(boiler.wear, 0), 0, 100),
            hoursPerWeek: clamp(
              Math.round(num(boiler.hoursPerWeek, 84)),
              0,
              168,
            ),
            fuel,
            brokenSinceWeek:
              status === "broken"
                ? Math.max(1, Math.floor(num(boiler.brokenSinceWeek, 1)))
                : null,
          };
        })
    : base.boilers;

  const stock = (
    r.fuelStock && typeof r.fuelStock === "object" ? r.fuelStock : {}
  ) as Record<string, unknown>;

  const rawAutomation = (
    r.automation && typeof r.automation === "object" ? r.automation : {}
  ) as Record<string, unknown>;
  const automation: BoilerAutomation = {
    enabled: Boolean(rawAutomation.enabled),
    reserveWeeks: clamp(
      Math.round(num(rawAutomation.reserveWeeks, base.automation.reserveWeeks)),
      AUTO_RESERVE_WEEKS_MIN,
      AUTO_RESERVE_WEEKS_MAX,
    ),
    weeklyBudget: clamp(
      Math.floor(num(rawAutomation.weeklyBudget, base.automation.weeklyBudget)),
      AUTO_BUDGET_MIN,
      AUTO_BUDGET_MAX,
    ),
    autoRepair:
      rawAutomation.autoRepair === undefined
        ? base.automation.autoRepair
        : Boolean(rawAutomation.autoRepair),
    autoStart:
      rawAutomation.autoStart === undefined
        ? base.automation.autoStart
        : Boolean(rawAutomation.autoStart),
    autoStop: Boolean(rawAutomation.autoStop),
    preferredFuel:
      rawAutomation.preferredFuel === "gas" ||
      rawAutomation.preferredFuel === "bio"
        ? rawAutomation.preferredFuel
        : "coal",
  };

  return {
    boilers: boilers.length > 0 ? boilers : base.boilers,
    automation,
    fuelStock: {
      coal: clamp(
        Math.floor(num(stock.coal, base.fuelStock.coal)),
        0,
        FUEL_STORAGE_CAP,
      ),
      gas: clamp(Math.floor(num(stock.gas, 0)), 0, FUEL_STORAGE_CAP),
      bio: clamp(Math.floor(num(stock.bio, 0)), 0, FUEL_STORAGE_CAP),
    },
    temperature: clamp(num(r.temperature, base.temperature), -20, 40),
    lastCalculatedWeek: Math.max(0, Math.floor(num(r.lastCalculatedWeek, 0))),
    coldWeeks: Math.max(0, Math.floor(num(r.coldWeeks, 0))),
    breakdowns: Math.max(0, Math.floor(num(r.breakdowns, 0))),
  };
}

/** Сколько тепла даёт котёл за неделю при текущем топливе и износе. */
export function boilerHeatOutput(boiler: BoilerState): number {
  if (boiler.status !== "running") return 0;
  const definition = BOILER_DEFINITION_BY_ID[boiler.id];
  const fuel = BOILER_FUEL_BY_ID[boiler.fuel];
  const wearPenalty = 1 - boiler.wear / 200; // до -50% на полностью изношенном котле
  return Math.round(
    definition.power *
      (boiler.hoursPerWeek / 84) *
      fuel.heatMultiplier *
      wearPenalty,
  );
}

/** Сколько топлива сожжёт котёл за неделю. */
export function boilerFuelDemand(boiler: BoilerState): number {
  if (boiler.status !== "running") return 0;
  return Math.ceil(
    BOILER_FUEL_BY_ID[boiler.fuel].burnPerHour * boiler.hoursPerWeek,
  );
}

/** Потребность в тепле: площадки + служебные помещения. */
export function boilerHeatDemand(activeVenues: number): number {
  return (
    Math.max(0, activeVenues) * HEAT_PER_VENUE +
    HEATED_FACILITIES * HEAT_PER_VENUE
  );
}

/** Стоимость закупки топлива. */
export function fuelPurchaseCost(fuelId: BoilerFuelId, units: number): number {
  return Math.max(0, Math.ceil(units)) * BOILER_FUEL_BY_ID[fuelId].unitCost;
}

/** Стоимость ремонта котла до нулевого износа. */
export function boilerRepairCost(boiler: BoilerState): number {
  return Math.ceil(boiler.wear * REPAIR_COST_PER_WEAR);
}

/** Множитель выручки площадок от покрытия теплом. */
export function heatRevenueMultiplier(coverage: number): number {
  const c = clamp(coverage, 0, 1);
  // 0% тепла — -25% выручки, 100% — +15%.
  return Math.round((0.75 + c * 0.4) * 100) / 100;
}

/** Прибавка к усталости персонала за неделю без тепла. */
export function heatExhaustionBump(coverage: number): number {
  const c = clamp(coverage, 0, 1);
  return Math.round((1 - c) * 8);
}

export interface BoilerWeekInput {
  state: BoilerHouseState;
  week: number;
  /** Сколько площадок реально работает (отапливается). */
  activeVenues: number;
  /** Свободные средства казны на автозакупку и авторемонт. */
  funds?: number;
  /** Случайность для броска аварии; по умолчанию Math.random. */
  random?: () => number;
}

/**
 * План автоматики на неделю: что она сделает до расчёта котлов.
 * Чистая функция — её же показывает вкладка как «план на неделю».
 */
export interface BoilerAutomationPlan {
  /** Котлы, которые автоматика запустит. */
  start: BoilerId[];
  /** Котлы, которые автоматика остановит. */
  stop: BoilerId[];
  /** Котлы, которые автоматика отремонтирует до расчёта. */
  repair: BoilerId[];
  /** Сколько топлива докупить по видам. */
  buy: Record<BoilerFuelId, number>;
  /** Стоимость закупки топлива. */
  fuelCost: number;
  /** Стоимость ремонта. */
  repairCost: number;
  /** Итого расход автоматики. */
  totalCost: number;
  /** Тепло после запуска/остановки котлов. */
  heatAfter: number;
  /** Потребность в тепле. */
  heatDemand: number;
  /** Покрытие после действий автоматики (0-1). */
  coverageAfter: number;
  /** Почему автоматика ничего не делает или что ограничило план. */
  notes: string[];
}

/**
 * Считает план автоматики: ремонт аварий, запуск/остановка котлов и
 * закупка топлива на `reserveWeeks` недель в пределах недельного бюджета.
 * Ничего не меняет — только описывает, что произойдёт.
 */
export function planBoilerAutomation(input: BoilerWeekInput): BoilerAutomationPlan {
  const { state } = input;
  const automation = state.automation;
  const funds = Math.max(0, input.funds ?? 0);
  const heatDemand = boilerHeatDemand(input.activeVenues);
  const plan: BoilerAutomationPlan = {
    start: [],
    stop: [],
    repair: [],
    buy: { coal: 0, gas: 0, bio: 0 },
    fuelCost: 0,
    repairCost: 0,
    totalCost: 0,
    heatAfter: 0,
    heatDemand,
    coverageAfter: 1,
    notes: [],
  };

  if (!automation.enabled) {
    plan.heatAfter = state.boilers.reduce(
      (sum, boiler) => sum + boilerHeatOutput(boiler),
      0,
    );
    plan.coverageAfter =
      heatDemand > 0 ? clamp(plan.heatAfter / heatDemand, 0, 1) : 1;
    plan.notes.push("Автоматика выключена — котлы работают вручную.");
    return plan;
  }

  const budget = Math.min(automation.weeklyBudget, funds);
  if (automation.weeklyBudget > funds) {
    plan.notes.push(
      `Бюджет автоматики ограничен кассой: ${formatMoney(funds)} вместо ${formatMoney(automation.weeklyBudget)}.`,
    );
  }

  // 1. Ремонт аварий — до расчёта, чтобы котёл успел поработать неделю.
  let boilers = state.boilers.map((boiler) => ({ ...boiler }));
  if (automation.autoRepair) {
    for (const boiler of boilers) {
      if (boiler.status !== "broken") continue;
      const cost = Math.max(
        BOILER_DEFINITION_BY_ID[boiler.id].upkeep,
        boilerRepairCost(boiler),
      );
      if (plan.repairCost + cost > budget) {
        plan.notes.push(
          `Ремонт «${BOILER_DEFINITION_BY_ID[boiler.id].name}» не влез в бюджет.`,
        );
        continue;
      }
      plan.repair.push(boiler.id);
      plan.repairCost += cost;
      boiler.status = "idle";
      boiler.wear = 0;
      boiler.brokenSinceWeek = null;
    }
  }

  // 2. Запуск резервных котлов, пока покрытие ниже порога. Сначала главный,
  // затем остальные по порядку постройки.
  const heatOf = () =>
    boilers.reduce((sum, boiler) => sum + boilerHeatOutput(boiler), 0);
  if (automation.autoStart) {
    const startOrder = [
      ...boilers.filter((boiler) => boiler.id === "main"),
      ...boilers.filter((boiler) => boiler.id !== "main"),
    ];
    for (const boiler of startOrder) {
      if (boiler.status !== "idle") continue;
      const coverage = heatDemand > 0 ? heatOf() / heatDemand : 1;
      if (coverage >= AUTO_START_COVERAGE) break;
      boiler.status = "running";
      plan.start.push(boiler.id);
    }
  }

  // 3. Остановка лишних котлов, если тепла с большим избытком. Главный
  // котёл автоматика не гасит — он базовый, остальные только подхватывают.
  // Котлы, которые автоматика только что запустила, не гасим в ту же неделю.
  if (automation.autoStop) {
    for (const boiler of [...boilers].reverse()) {
      if (boiler.status !== "running" || boiler.id === "main") continue;
      if (plan.start.includes(boiler.id)) continue;
      const without = heatOf() - boilerHeatOutput(boiler);
      const coverage = heatDemand > 0 ? without / heatDemand : 1;
      if (coverage < AUTO_STOP_COVERAGE) continue;
      boiler.status = "idle";
      plan.stop.push(boiler.id);
    }
  }

  plan.heatAfter = heatOf();
  plan.coverageAfter =
    heatDemand > 0 ? clamp(plan.heatAfter / heatDemand, 0, 1) : 1;

  // 4. Закупка топлива на reserveWeeks недель вперёд.
  const demandByFuel: Record<BoilerFuelId, number> = {
    coal: 0,
    gas: 0,
    bio: 0,
  };
  boilers.forEach((boiler) => {
    if (boiler.status !== "running") return;
    demandByFuel[boiler.fuel] += boilerFuelDemand(boiler);
  });

  const fuelIds: BoilerFuelId[] = [
    automation.preferredFuel,
    ...BOILER_FUELS.map((fuel) => fuel.id).filter(
      (id) => id !== automation.preferredFuel,
    ),
  ];
  for (const fuelId of fuelIds) {
    const weekly = demandByFuel[fuelId];
    if (weekly <= 0) continue;
    const target = Math.min(
      FUEL_STORAGE_CAP,
      weekly * automation.reserveWeeks,
    );
    const missing = Math.max(0, target - state.fuelStock[fuelId]);
    if (missing <= 0) continue;
    const affordable = Math.floor(
      Math.max(0, budget - plan.totalCost) /
        BOILER_FUEL_BY_ID[fuelId].unitCost,
    );
    const units = Math.min(missing, affordable);
    if (units <= 0) {
      plan.notes.push(
        `На закупку «${BOILER_FUEL_BY_ID[fuelId].name}» не хватает бюджета.`,
      );
      continue;
    }
    plan.buy[fuelId] = units;
    plan.fuelCost += fuelPurchaseCost(fuelId, units);
    if (units < missing) {
      plan.notes.push(
        `«${BOILER_FUEL_BY_ID[fuelId].name}»: докуплено ${units} из ${missing} ед. — бюджет.`,
      );
    }
  }

  plan.totalCost = plan.fuelCost + plan.repairCost;
  if (plan.totalCost === 0 && plan.start.length === 0 && plan.stop.length === 0) {
    plan.notes.push("Автоматика: всё в норме, действий не требуется.");
  }
  return plan;
}

/**
 * Считает неделю котельной: сжигает топливо, изнашивает котлы, бросает
 * аварии, обновляет температуру и возвращает отчёт для финансов и площадок.
 */
export function advanceBoilerHouseWeek(input: BoilerWeekInput): {
  state: BoilerHouseState;
  report: BoilerHouseReport;
} {
  const random = input.random ?? Math.random;
  const logs: string[] = [];
  const brokenBoilers: BoilerId[] = [];
  const repairedBoilers: BoilerId[] = [];

  // Автоматика отрабатывает до расчёта: ремонт, запуск/остановка, закупка.
  const plan = planBoilerAutomation(input);
  const fuelStock: Record<BoilerFuelId, number> = { ...input.state.fuelStock };
  (Object.keys(plan.buy) as BoilerFuelId[]).forEach((fuelId) => {
    if (plan.buy[fuelId] <= 0) return;
    fuelStock[fuelId] = clamp(
      fuelStock[fuelId] + plan.buy[fuelId],
      0,
      FUEL_STORAGE_CAP,
    );
  });
  const autoFuelBought = plan.buy.coal + plan.buy.gas + plan.buy.bio;
  if (autoFuelBought > 0) {
    logs.push(
      `Автоматика котельной: закуплено ${autoFuelBought} ед. топлива за ${formatMoney(plan.fuelCost)}.`,
    );
  }
  plan.repair.forEach((id) => {
    logs.push(
      `Автоматика котельной: «${BOILER_DEFINITION_BY_ID[id].name}» отремонтирован до расчёта (-${formatMoney(Math.max(BOILER_DEFINITION_BY_ID[id].upkeep, boilerRepairCost(input.state.boilers.find((b) => b.id === id)!)))}).`,
    );
  });
  plan.start.forEach((id) => {
    logs.push(
      `Автоматика котельной: «${BOILER_DEFINITION_BY_ID[id].name}» запущен — покрытие падало.`,
    );
  });
  plan.stop.forEach((id) => {
    logs.push(
      `Автоматика котельной: «${BOILER_DEFINITION_BY_ID[id].name}» остановлен — тепла в избытке.`,
    );
  });

  let fuelSpent = 0;
  let upkeep = 0;
  let repairCost = plan.repairCost;
  let heatProduced = 0;
  let breakdowns = input.state.breakdowns;

  const boilers = input.state.boilers.map<BoilerState>((source) => {
    const definition = BOILER_DEFINITION_BY_ID[source.id];
    upkeep += definition.upkeep;

    // Автоматика уже отремонтировала или переключила этот котёл. Ремонт и
    // запуск могут прийти на один и тот же котёл — запуск важнее.
    const boiler: BoilerState = plan.start.includes(source.id)
      ? { ...source, status: "running", wear: plan.repair.includes(source.id) ? 0 : source.wear, brokenSinceWeek: null }
      : plan.repair.includes(source.id)
        ? { ...source, status: "idle", wear: 0, brokenSinceWeek: null }
        : plan.stop.includes(source.id)
          ? { ...source, status: "idle" }
          : source;

    if (boiler.status === "broken") {
      // Аварийный котёл чинится сам за неделю простоя — за деньги.
      const cost = Math.max(definition.upkeep, boilerRepairCost(boiler));
      repairCost += cost;
      repairedBoilers.push(boiler.id);
      logs.push(
        `${definition.name}: ремонт после аварии (-${formatMoney(cost)}).`,
      );
      return {
        ...boiler,
        status: "idle",
        wear: Math.max(0, boiler.wear - 40),
        brokenSinceWeek: null,
      };
    }

    if (boiler.status === "idle") {
      return boiler;
    }

    const demand = boilerFuelDemand(boiler);
    const available = fuelStock[boiler.fuel];
    if (available < demand) {
      // Топлива не хватило: котёл работает на том, что есть, и гаснет.
      const burned = available;
      fuelStock[boiler.fuel] = 0;
      fuelSpent += burned * BOILER_FUEL_BY_ID[boiler.fuel].unitCost;
      const partial = demand > 0 ? burned / demand : 0;
      heatProduced += Math.round(boilerHeatOutput(boiler) * partial);
      logs.push(
        `${definition.name}: топливо «${BOILER_FUEL_BY_ID[boiler.fuel].name}» закончилось — котёл погас.`,
      );
      return {
        ...boiler,
        status: "idle",
        wear: clamp(
          boiler.wear + WEAR_PER_HOUR * boiler.hoursPerWeek * partial,
          0,
          100,
        ),
      };
    }

    fuelStock[boiler.fuel] = available - demand;
    fuelSpent += demand * BOILER_FUEL_BY_ID[boiler.fuel].unitCost;
    heatProduced += boilerHeatOutput(boiler);

    const wear = clamp(
      boiler.wear + WEAR_PER_HOUR * boiler.hoursPerWeek,
      0,
      100,
    );
    const risk = BOILER_FUEL_BY_ID[boiler.fuel].breakdownRisk + wear / 2000;
    if (random() < risk) {
      breakdowns += 1;
      brokenBoilers.push(boiler.id);
      logs.push(`${definition.name}: АВАРИЯ! Котёл встал на неделю.`);
      return { ...boiler, status: "broken", wear, brokenSinceWeek: input.week };
    }
    return { ...boiler, wear };
  });

  const heatDemand = boilerHeatDemand(input.activeVenues);
  const coverage = heatDemand > 0 ? clamp(heatProduced / heatDemand, 0, 1) : 1;

  // Температура тянется к комфортной при полном покрытии и падает без тепла.
  const targetTemperature =
    FREEZING_TEMPERATURE -
    6 +
    coverage * (COMFORT_TEMPERATURE - FREEZING_TEMPERATURE + 6);
  const temperature =
    Math.round((input.state.temperature * 0.4 + targetTemperature * 0.6) * 10) /
    10;
  const cold = temperature < FREEZING_TEMPERATURE;

  if (cold) {
    logs.push(
      `Котельная: в контуре ${temperature}°C — площадки мёрзнут, выручка падает.`,
    );
  } else if (coverage >= 1) {
    logs.push(`Котельная: ${temperature}°C, все площадки отапливаются.`);
  }

  const totalCost = fuelSpent + upkeep + repairCost;
  const report: BoilerHouseReport = {
    heatProduced,
    heatDemand,
    coverage: Math.round(coverage * 100) / 100,
    revenueMultiplier: heatRevenueMultiplier(coverage),
    exhaustionBump: heatExhaustionBump(coverage),
    fuelSpent,
    upkeep,
    repairCost,
    totalCost,
    temperature,
    brokenBoilers,
    repairedBoilers,
    autoFuelBought,
    autoSpent: plan.totalCost,
    autoStarted: plan.start,
    autoStopped: plan.stop,
    logs,
  };

  return {
    state: {
      ...input.state,
      boilers,
      fuelStock,
      temperature,
      lastCalculatedWeek: input.week,
      coldWeeks: input.state.coldWeeks + (cold ? 1 : 0),
      breakdowns,
    },
    report,
  };
}

/** Строит новый котёл, если он ещё не построен. */
export function buildBoiler(
  state: BoilerHouseState,
  id: BoilerId,
): BoilerHouseState | null {
  if (state.boilers.some((boiler) => boiler.id === id)) return null;
  return {
    ...state,
    boilers: [
      ...state.boilers,
      {
        id,
        status: "idle",
        wear: 0,
        hoursPerWeek: 84,
        fuel: "coal",
        brokenSinceWeek: null,
      },
    ],
  };
}

/** Меняет режим котла: запуск, остановка или смена топлива. */
export function setBoilerMode(
  state: BoilerHouseState,
  id: BoilerId,
  patch: Partial<Pick<BoilerState, "status" | "fuel" | "hoursPerWeek">>,
): BoilerHouseState {
  return {
    ...state,
    boilers: state.boilers.map((boiler) => {
      if (boiler.id !== id) return boiler;
      // Сломанный котёл нельзя запустить — только отремонтировать.
      if (boiler.status === "broken" && patch.status === "running")
        return boiler;
      return {
        ...boiler,
        ...patch,
        hoursPerWeek:
          patch.hoursPerWeek !== undefined
            ? clamp(Math.round(patch.hoursPerWeek), 0, 168)
            : boiler.hoursPerWeek,
      };
    }),
  };
}

/** Ремонт котла за деньги: сбрасывает износ и снимает аварию. */
export function repairBoiler(
  state: BoilerHouseState,
  id: BoilerId,
): BoilerHouseState {
  return {
    ...state,
    boilers: state.boilers.map((boiler) =>
      boiler.id === id
        ? { ...boiler, status: "idle", wear: 0, brokenSinceWeek: null }
        : boiler,
    ),
  };
}

/** Доливает топливо в бак, не превышая вместимость. */
export function addFuel(
  state: BoilerHouseState,
  fuelId: BoilerFuelId,
  units: number,
): BoilerHouseState {
  return {
    ...state,
    fuelStock: {
      ...state.fuelStock,
      [fuelId]: clamp(
        state.fuelStock[fuelId] + Math.max(0, Math.floor(units)),
        0,
        FUEL_STORAGE_CAP,
      ),
    },
  };
}

/** Включает или выключает автоматику и меняет её настройки. */
export function setBoilerAutomation(
  state: BoilerHouseState,
  patch: Partial<BoilerAutomation>,
): BoilerHouseState {
  const next: BoilerAutomation = { ...state.automation, ...patch };
  return {
    ...state,
    automation: {
      ...next,
      reserveWeeks: clamp(
        Math.round(next.reserveWeeks),
        AUTO_RESERVE_WEEKS_MIN,
        AUTO_RESERVE_WEEKS_MAX,
      ),
      weeklyBudget: clamp(
        Math.floor(next.weeklyBudget),
        AUTO_BUDGET_MIN,
        AUTO_BUDGET_MAX,
      ),
    },
  };
}

/** Сколько недель проработает запас топлива при текущих настройках. */
export function fuelWeeksRemaining(
  state: BoilerHouseState,
): Record<BoilerFuelId, number> {
  const demand: Record<BoilerFuelId, number> = { coal: 0, gas: 0, bio: 0 };
  state.boilers.forEach((boiler) => {
    if (boiler.status !== "running") return;
    demand[boiler.fuel] += boilerFuelDemand(boiler);
  });
  return {
    coal:
      demand.coal > 0
        ? Math.floor(state.fuelStock.coal / demand.coal)
        : Infinity,
    gas:
      demand.gas > 0 ? Math.floor(state.fuelStock.gas / demand.gas) : Infinity,
    bio:
      demand.bio > 0 ? Math.floor(state.fuelStock.bio / demand.bio) : Infinity,
  };
}
