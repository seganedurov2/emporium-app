import { formatMoney } from './currency';

export type WarehouseLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface WarehouseAutomation {
  /** Конвейерная система между уровнями (разблокировано на уровне 2+). */
  conveyor: boolean;
  /** Подъёмник/лифт для автоматической выдачи (уровень 3+). */
  lift: boolean;
  /** AS/RS крановая система (уровень 5). */
  asrs: boolean;
  /** WMS/WCS управление складом. */
  wms: boolean;
}

export interface WarehouseState {
  level: WarehouseLevel;
  /** Базовая вместимость на уровне (единиц груза). */
  capacity: number;
  /** Текущая заполненность. */
  occupancy: number;
  /** Автоматизация по уровням. */
  automation: WarehouseAutomation;
  /** Количество автоматических операций в неделю. */
  autoOpsPerWeek: number;
  /** Последняя неделя расчёта. */
  lastCalculatedWeek: number;
}

export interface WarehouseUpgrade {
  level: WarehouseLevel;
  name: string;
  cost: number;
  capacityBonus: number;
  automationUnlock: keyof WarehouseAutomation;
  description: string;
}

export const WAREHOUSE_UPGRADES: WarehouseUpgrade[] = [
  {
    level: 0,
    name: 'Цокольный склад',
    cost: 0,
    capacityBonus: 0,
    automationUnlock: 'wms',
    description: 'Ручной приём и выдача. Базовая вместимость.'
  },
  {
    level: 1,
    name: 'Автоматизированный приём',
    cost: 40000,
    capacityBonus: 500,
    automationUnlock: 'wms',
    description: 'WMS-учёт поступлений. Сkan-метки на каждой паллете.'
  },
  {
    level: 2,
    name: 'Конвейерный уровень',
    cost: 90000,
    capacityBonus: 1200,
    automationUnlock: 'conveyor',
    description: 'Конвейер между этажами. Автоперемещение груза без ручной тележки.'
  },
  {
    level: 3,
    name: 'Лифтовая выдача',
    cost: 180000,
    capacityBonus: 2000,
    automationUnlock: 'lift',
    description: 'Автоматический подъёмник. Выдача груза на этаж за минуты.'
  },
  {
    level: 4,
    name: 'Робот-комплектовщик',
    cost: 320000,
    capacityBonus: 3000,
    automationUnlock: 'asrs',
    description: 'Роботизированный штабелер. Сборка заказов без участия pessoal.'
  },
  {
    level: 5,
    name: 'Полный AS/RS',
    cost: 550000,
    capacityBonus: 5000,
    automationUnlock: 'asrs',
    description: 'Автоматизированная система хранения и выдачи. Полный цикл без рук.'
  }
] as const;

export const WAREHOUSE_BASE_CAPACITY = 300;
export const WAREHOUSE_MAX_LEVEL = 5;

export function createWarehouseState(): WarehouseState {
  return {
    level: 0,
    capacity: WAREHOUSE_BASE_CAPACITY,
    occupancy: 0,
    automation: { conveyor: false, lift: false, asrs: false, wms: false },
    autoOpsPerWeek: 0,
    lastCalculatedWeek: 0
  };
}

export function normalizeWarehouseState(raw: unknown): WarehouseState {
  const base = createWarehouseState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const level = typeof r.level === 'number' && Number.isFinite(r.level)
    ? Math.min(WAREHOUSE_MAX_LEVEL, Math.max(0, Math.floor(r.level)))
    : base.level;
  const capacity = typeof r.capacity === 'number' && Number.isFinite(r.capacity)
    ? Math.max(0, Math.floor(r.capacity))
    : base.capacity;
  const occupancy = typeof r.occupancy === 'number' && Number.isFinite(r.occupancy)
    ? Math.max(0, Math.floor(r.occupancy))
    : base.occupancy;
  const automation = {
    conveyor: Boolean(r.automation && (r.automation as Record<string, unknown>).conveyor),
    lift: Boolean(r.automation && (r.automation as Record<string, unknown>).lift),
    asrs: Boolean(r.automation && (r.automation as Record<string, unknown>).asrs),
    wms: Boolean(r.automation && (r.automation as Record<string, unknown>).wms)
  };
  const autoOpsPerWeek = typeof r.autoOpsPerWeek === 'number' && Number.isFinite(r.autoOpsPerWeek)
    ? Math.max(0, Math.floor(r.autoOpsPerWeek))
    : base.autoOpsPerWeek;
  const lastCalculatedWeek = typeof r.lastCalculatedWeek === 'number' && Number.isFinite(r.lastCalculatedWeek)
    ? Math.floor(r.lastCalculatedWeek)
    : base.lastCalculatedWeek;
  return { level, capacity, occupancy, automation, autoOpsPerWeek, lastCalculatedWeek };
}

export function warehouseCapacityForLevel(level: WarehouseLevel): number {
  const upgrade = WAREHOUSE_UPGRADES.find(u => u.level === level);
  return WAREHOUSE_BASE_CAPACITY + (upgrade?.capacityBonus ?? 0);
}

export function warehouseUpgradeCost(level: WarehouseLevel): number {
  const upgrade = WAREHOUSE_UPGRADES.find(u => u.level === level);
  return upgrade?.cost ?? 0;
}

export function upgradeWarehouse(state: WarehouseState): { state: WarehouseState; log: string } | null {
  const nextLevel = state.level + 1 as WarehouseLevel;
  const upgrade = WAREHOUSE_UPGRADES.find(u => u.level === nextLevel);
  if (!upgrade) return null;
  const automation = { ...state.automation, [upgrade.automationUnlock]: true };
  const capacity = warehouseCapacityForLevel(nextLevel);
  const next: WarehouseState = {
    ...state,
    level: nextLevel,
    capacity,
    automation,
    lastCalculatedWeek: state.lastCalculatedWeek
  };
  return {
    state: next,
    log: `Складской мезонин улучшен до «${upgrade.name}» — вместимость ${formatMoney(capacity)} ед., автоматизация: ${upgrade.description}.`
  };
}

export function calculateWeeklyAutoOps(state: WarehouseState, week: number): { ops: number; state: WarehouseState } {
  let ops = 0;
  if (state.automation.wms) ops += 50;
  if (state.automation.conveyor) ops += 100;
  if (state.automation.lift) ops += 150;
  if (state.automation.asrs) ops += 250;
  if (state.level === WAREHOUSE_MAX_LEVEL && state.automation.asrs && state.automation.lift && state.automation.conveyor && state.automation.wms) ops += 200;
  return {
    ops,
    state: { ...state, autoOpsPerWeek: ops, lastCalculatedWeek: week }
  };
}

export function warehouseOccupancyPercent(state: WarehouseState): number {
  if (state.capacity <= 0) return 0;
  return Math.min(100, Math.round((state.occupancy / state.capacity) * 100));
}

export function canStore(state: WarehouseState, amount: number): boolean {
  return state.occupancy + amount <= state.capacity;
}

/** Экономическая интеграция */

/** Множитель спроса на рынке от уровня мезонина: больше склад — ниже срочность закупки, ниже цена. */
export function warehouseDemandMultiplier(state: WarehouseState): number {
  // Каждый уровень снижает спрос на 5%, до минимума 0.6 (40% скидка на срочность).
  return Math.max(0.6, 1 - state.level * 0.05);
}

/** Максимальное количество пленных, которое можно удерживать для контрактов поставки. */
export function warehouseContractCapacity(state: WarehouseState): number {
  return Math.floor(state.capacity / 2);
}

/** Еженедельное содержание мезонина (растёт с уровнем и автоматизацией). */
export function warehouseWeeklyUpkeep(state: WarehouseState): number {
  const base = state.level * 500;
  const automationBonus = [
    state.automation.wms ? 200 : 0,
    state.automation.conveyor ? 400 : 0,
    state.automation.lift ? 600 : 0,
    state.automation.asrs ? 1000 : 0
  ].reduce((a, b) => a + b, 0);
  return base + automationBonus;
}

/** Влияние заполненности на рентабельность контрактов: переполнение штрафует. */
export function warehouseOccupancyPenalty(state: WarehouseState): number {
  const pct = warehouseOccupancyPercent(state);
  if (pct < 80) return 0;
  if (pct < 95) return 0.05;
  return 0.15;
}

