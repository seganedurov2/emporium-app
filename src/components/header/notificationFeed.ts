import type { AppTab } from '../../appNavigation';
import { formatMoney } from '../../currency';
import type { ActiveRaid } from '../../caravanRaidsEngine';
import { EXPANSION_EVENTS } from '../../content/expansionEvents';
import type { ExpansionEvent } from '../../expansionTypes';
import type { GameEvent } from '../../eventsEngine';
import { getWardDefinition } from '../../hospitalEngine';
import type { ManagedCampaignState } from '../../saveState';
import { assessSlaveUnrest } from '../../slaveContractsEngine';

export type FeedCategory = 'notification' | 'task' | 'event' | 'incident';
export type FeedTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type FeedIcon =
  | 'bell' | 'truck' | 'target' | 'shield' | 'file' | 'bed' | 'scissors'
  | 'hospital' | 'scroll' | 'sparkles' | 'siren' | 'alert';

export interface FeedItem {
  /** Stable across renders, so an acknowledged item does not reappear as unread. */
  id: string;
  category: FeedCategory;
  tone: FeedTone;
  icon: FeedIcon;
  title: string;
  detail?: string;
  meta?: string;
  /** Section the row opens when clicked. */
  tab?: AppTab;
  /** True when the player must act on it, so the row counts towards the badge. */
  actionable?: boolean;
}

/** Transient state that lives in App and is not part of the saved campaign. */
export interface FeedRuntime {
  raids: ActiveRaid[];
  activeEvent: GameEvent | ExpansionEvent | null;
  notices: { id: number; text: string }[];
}

export interface ActivityFeed {
  incidents: FeedItem[];
  tasks: FeedItem[];
  events: FeedItem[];
  notifications: FeedItem[];
  /** Ids of rows that need a decision, used for the unread badge. */
  actionableIds: string[];
}

export type FeedSectionKey = 'incidents' | 'tasks' | 'events' | 'notifications';

/** Order sections appear in, most pressing first. */
export const FEED_CATEGORY_ORDER: FeedCategory[] = ['incident', 'task', 'event', 'notification'];

/** Where each category keeps its rows inside {@link ActivityFeed}. */
export const FEED_SECTION_KEYS: Record<FeedCategory, FeedSectionKey> = {
  incident: 'incidents',
  task: 'tasks',
  event: 'events',
  notification: 'notifications'
};

/** How many rows a single section shows before it is cut off. */
export const FEED_SECTION_LIMIT = 25;

/** Prefixes the event resolver writes into the journal, used to recover closed events. */
const RESOLVED_EVENT_PREFIXES = ['Результат события:', 'Выигран лот аукциона'];

const RAID_SEVERITY_LABELS: Record<ActiveRaid['severity'], string> = {
  minor: 'незначительная угроза',
  moderate: 'умеренная угроза',
  severe: 'серьёзная угроза'
};

const ADMISSION_LABELS: Record<string, string> = {
  birth: 'роды',
  treatment: 'лечение',
  observation: 'наблюдение'
};

const CAPTURE_QUALITY_LABELS: Record<string, string> = {
  low: 'простой человек',
  medium: 'местный чиновник',
  high: 'известная персона',
  elite: 'элита'
};

const money = (value: number): string => formatMoney(value);

function pluralWeeks(weeks: number): string {
  const mod10 = weeks % 10;
  const mod100 = weeks % 100;
  if (mod10 === 1 && mod100 !== 11) return `${weeks} неделя`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${weeks} недели`;
  return `${weeks} недель`;
}

function pluralCaptives(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} пленный`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} пленных`;
  return `${count} пленные`;
}

/** Task rows are what the syndicate is already committed to; they are read straight off the save. */
function collectTasks(state: ManagedCampaignState): FeedItem[] {
  const tasks: FeedItem[] = [];

  state.caravans
    .filter(caravan => caravan.status === 'traveling')
    .forEach(caravan => tasks.push({
      id: `task:caravan:${caravan.id}`,
      category: 'task',
      tone: 'info',
      icon: 'truck',
      title: caravan.name,
      detail: `Караван · направление: ${caravan.destRegion} · глава: ${caravan.leaderName} · вложено ${money(caravan.investment)}`,
      meta: `Осталось ${pluralWeeks(caravan.weeksRemaining)} из ${caravan.weeksTotal}`,
      tab: 'caravans'
    }));

  (state.captureOperations || [])
    .filter(operation => operation.status === 'outbound')
    .forEach(operation => tasks.push({
      id: `task:capture:${operation.id}`,
      category: 'task',
      tone: 'info',
      icon: 'target',
      title: operation.codename,
      detail: `Захват · цель: ${operation.targetName} · ${operation.targetRegionName} · ${CAPTURE_QUALITY_LABELS[operation.targetQuality] ?? operation.targetQuality} · отряд ${operation.squadSize}`,
      meta: `Осталось ${pluralWeeks(operation.weeksRemaining)} · награда ${money(operation.bounty)}`,
      tab: 'capture_ops'
    }));

  (state.contracts || [])
    .filter(contract => contract.status === 'active')
    .forEach(contract => tasks.push({
      id: `task:contract:${contract.id}`,
      category: 'task',
      tone: 'info',
      icon: 'file',
      title: contract.title,
      detail: `${contract.clientName} · награда ${money(contract.rewardFunds)} и ${contract.rewardReputation} реп. · нужна привлекательность от ${contract.requiredAttractiveness}`,
      meta: `Осталось ${pluralWeeks(contract.weeksRemaining)}`,
      tab: 'contracts'
    }));

  (state.slaveContracts || [])
    .filter(contract => contract.status === 'active')
    .forEach(contract => tasks.push({
      id: `task:slaveContract:${contract.id}`,
      category: 'task',
      tone: 'info',
      icon: 'file',
      title: `Заказ: ${contract.buyerName}`,
      detail: `${contract.title} · сдано ${contract.quantityDelivered} из ${contract.quantityWanted} · ${money(contract.pricePerHead)} за голову`,
      meta: `Осталось ${pluralWeeks(contract.weeksRemaining)}`,
      tab: 'contracts'
    }));

  (state.tradeSupplyContracts || [])
    .filter(contract => contract.status === 'active')
    .forEach(contract => {
      const remainingLot = Math.max(0, contract.weeklyQuantity - contract.purchasedThisWeek);
      tasks.push({
        id: `task:supplyContract:${contract.id}`,
        category: 'task',
        tone: contract.signed ? 'info' : 'warning',
        icon: 'truck',
        title: `Поставка из региона: ${contract.regionName}`,
        detail: contract.signed
          ? `${remainingLot > 0 ? `доступно ${remainingLot}/${contract.weeklyQuantity} по ${money(contract.pricePerHead)} за голову` : 'недельная партия выкуплена'} · всего выкуплено ${contract.totalPurchased}`
          : `контракт не подписан — подпишите, чтобы выкупать по ${money(contract.pricePerHead)} за голову`,
        meta: `Осталось ${pluralWeeks(contract.weeksRemaining)}`,
        tab: 'supply_contracts'
      });
    });

  (state.restZone?.placements || []).forEach(placement => tasks.push({
    id: `task:rest:${placement.id}`,
    category: 'task',
    tone: 'info',
    icon: 'bed',
    title: `Отдых: ${placement.characterName}`,
    detail: placement.programName,
    meta: `Осталось ${pluralWeeks(placement.weeksRemaining)} из ${placement.weeksTotal}`,
    tab: 'rest_zone'
  }));

  (state.beautySalon?.scheduledTreatments || [])
    .filter(treatment => treatment.status === 'queued')
    .forEach(treatment => tasks.push({
      id: `task:salon:${treatment.id}`,
      category: 'task',
      tone: 'info',
      icon: 'scissors',
      title: `${treatment.characterName}: ${treatment.treatmentName}`,
      detail: treatment.isAutomatic ? `Автоповтор каждые ${pluralWeeks(treatment.intervalWeeks)}` : 'Разовое посещение',
      meta: `Следующий запуск: неделя ${treatment.nextRunWeek}`,
      tab: 'salon'
    }));

  (state.hospital?.patients || []).forEach(patient => tasks.push({
    id: `task:hospital:${patient.characterId}:${patient.admittedWeek}`,
    category: 'task',
    tone: 'info',
    icon: 'hospital',
    title: `${patient.characterName}: ${getWardDefinition(patient.wardId)?.name ?? 'палата'}`,
    detail: `Госпитализация с недели ${patient.admittedWeek}${patient.admission ? ` · ${ADMISSION_LABELS[patient.admission] ?? patient.admission}` : ''}${patient.complicated ? ' · осложнённое течение' : ''}`,
    meta: `Осталось ${pluralWeeks(patient.weeksRemaining)}`,
    tab: 'hospital'
  }));

  return tasks.slice(0, FEED_SECTION_LIMIT);
}

/** Events are decisions and their aftermath: open now, queued, or already closed. */
function collectEvents(state: ManagedCampaignState, runtime: FeedRuntime): FeedItem[] {
  const events: FeedItem[] = [];

  if (runtime.activeEvent) {
    events.push({
      id: `event:active:${runtime.activeEvent.id}`,
      category: 'event',
      tone: 'warning',
      icon: 'sparkles',
      title: runtime.activeEvent.title,
      detail: runtime.activeEvent.description,
      meta: 'Ждёт вашего решения',
      actionable: true
    });
  }

  (state.pendingExpansionEvents || []).forEach(event => events.push({
    id: `event:pending:${event.id}`,
    category: 'event',
    tone: 'warning',
    icon: 'sparkles',
    title: event.title,
    detail: event.description,
    meta: 'В очереди на решение',
    actionable: true
  }));

  [...state.seenExpansionEventIds].reverse().forEach(eventId => {
    const event = EXPANSION_EVENTS.find(candidate => candidate.id === eventId);
    if (!event) return;
    events.push({
      id: `event:seen:${event.id}`,
      category: 'event',
      tone: 'success',
      icon: 'sparkles',
      title: event.title,
      detail: event.description,
      meta: 'Решено'
    });
  });

  state.log
    .filter(entry => RESOLVED_EVENT_PREFIXES.some(prefix => entry.startsWith(prefix)))
    .slice(0, FEED_SECTION_LIMIT)
    .forEach(entry => events.push({
      id: `event:log:${entry}`,
      category: 'event',
      tone: 'neutral',
      icon: 'scroll',
      title: entry,
      meta: 'Из журнала синдиката'
    }));

  return events;
}

/** Incidents are everything that is going wrong and needs a decision before the next week. */
function collectIncidents(state: ManagedCampaignState, runtime: FeedRuntime): FeedItem[] {
  const incidents: FeedItem[] = [];

  runtime.raids.forEach(raid => incidents.push({
    id: `incident:raid:${raid.raidId}`,
    category: 'incident',
    tone: 'danger',
    icon: 'siren',
    title: `${raid.missionKind === 'capture' ? 'Нападение на отряд' : 'Нападение на караван'} «${raid.missionName}»`,
    detail: `${raid.enemyType === 'pirates' ? 'Пираты' : 'Бандиты'} ${raid.enemyName} · дорога в ${raid.destRegion} · ставка ${money(raid.stakeValue)}`,
    meta: `${RAID_SEVERITY_LABELS[raid.severity]} · недели ${state.week}`,
    actionable: true,
    tab: raid.missionKind === 'capture' ? 'capture_ops' : 'caravans'
  }));

  if (state.isBankrupt) {
    incidents.push({
      id: 'incident:bankrupt',
      category: 'incident',
      tone: 'danger',
      icon: 'alert',
      title: 'Внешнее управление и банкротство',
      detail: 'Казна отрицательна: внешний управляющий контролирует доходы салона.',
      meta: `Неделя ${state.week}`,
      actionable: true,
      tab: 'board'
    });
  }

  if (state.isReceivership) {
    incidents.push({
      id: 'incident:receivership',
      category: 'incident',
      tone: 'danger',
      icon: 'alert',
      title: 'Процедура банкротства синдиката',
      detail: 'Синдикат передан внешнему управляющему.',
      meta: `Неделя ${state.week}`,
      actionable: true,
      tab: 'board'
    });
  }

  (state.hospital?.ledger || [])
    .filter(entry => entry.tone === 'loss' || entry.tone === 'shortage')
    .slice(0, FEED_SECTION_LIMIT)
    .forEach(entry => incidents.push({
      id: `incident:hospital:${entry.week}:${entry.message}`,
      category: 'incident',
      tone: entry.tone === 'loss' ? 'danger' : 'warning',
      icon: 'hospital',
      title: entry.message,
      meta: `Неделя ${entry.week}`,
      tab: 'hospital'
    }));

  const unrest = assessSlaveUnrest(state.roster.filter(character => character.isSlave), state.roster);
  if (unrest.atRiskIds.length > 0) {
    incidents.push({
      id: 'incident:unrest',
      category: 'incident',
      tone: unrest.escapeChance >= 20 ? 'danger' : 'warning',
      icon: 'alert',
      title: `Побег пленных: риск ${unrest.escapeChance}%`,
      detail: `${pluralCaptives(unrest.atRiskIds.length)} на грани побега · индекс тревоги ${unrest.unrestIndex}/100`,
      meta: 'Проверяется каждую неделю',
      actionable: true,
      tab: 'slave_market'
    });
  }

  const criticalHealth = state.roster.filter(character => character.healthLevel === 'Critical').length;
  const burnedOut = state.roster.filter(character => character.exhaustionLevel === 'Burned Out').length;
  if (criticalHealth + burnedOut > 0) {
    incidents.push({
      id: 'incident:rosterCondition',
      category: 'incident',
      tone: burnedOut > 0 ? 'warning' : 'info',
      icon: 'alert',
      title: 'Состав на грани: нужна медицинская помощь',
      detail: `Критическое здоровье: ${criticalHealth} · выгоревшие: ${burnedOut}`,
      meta: `Штат ${state.roster.length} чел.`,
      tab: 'roster'
    });
  }

  return incidents;
}

/** The journal is the campaign's own notification stream: the syndicate log plus live toasts. */
function collectNotifications(state: ManagedCampaignState, runtime: FeedRuntime): FeedItem[] {
  const notifications: FeedItem[] = runtime.notices.map(notice => ({
    id: `notification:notice:${notice.id}`,
    category: 'notification',
    tone: 'warning' as const,
    icon: 'bell' as const,
    title: notice.text,
    meta: `Неделя ${state.week} · только что`
  }));

  const seenIds = new Set<string>();
  state.log.slice(0, FEED_SECTION_LIMIT).forEach(entry => {
    let id = `notification:log:${entry}`;
    while (seenIds.has(id)) id += ' ';
    seenIds.add(id);
    notifications.push({
      id,
      category: 'notification',
      tone: 'neutral',
      icon: 'scroll',
      title: entry,
      meta: 'Хронологический журнал'
    });
  });

  return notifications;
}

/** Folds the whole campaign into the four sections the header dropdown shows. */
export function buildActivityFeed(state: ManagedCampaignState, runtime: FeedRuntime): ActivityFeed {
  const incidents = collectIncidents(state, runtime);
  const events = collectEvents(state, runtime);
  const tasks = collectTasks(state);
  const notifications = collectNotifications(state, runtime);

  return {
    notifications,
    tasks,
    events,
    incidents,
    actionableIds: [...incidents, ...events, ...tasks]
      .filter(item => item.actionable)
      .map(item => item.id)
  };
}