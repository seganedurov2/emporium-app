/**
 * Квесты (задания) кампании.
 *
 * Каждый квест — цель с условием завершения, наградой и статусом.
 * Прогресс проверяется раз в неделю в advanceCampaignWeek (src/campaignWeek.ts).
 * Состояние квестов хранится в ManagedCampaignState.quests и мигрирует при загрузке.
 */

import type { ManagedCampaignState } from './saveState';

export type QuestStatus = 'active' | 'completed' | 'failed';

export interface QuestObjective {
  /** Человекочитаемое описание цели. */
  text: string;
  /** Функция проверки: true, когда цель достигнута. */
  check: (state: ManagedCampaignState) => boolean;
}

export interface QuestReward {
  /** Деньги, выданные при завершении. */
  funds?: number;
  /** Репутация, выданная при завершении. */
  reputation?: number;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  /** Неделя, в которой квест стал доступен. */
  availableFromWeek: number;
  objectives: QuestObjective[];
  reward: QuestReward;
  /** Квест скрыт до выполнения предыдущего (по id). */
  dependsOn?: string;
}

export interface QuestState {
  id: string;
  status: QuestStatus;
  /** Неделя завершения (для completed). */
  completedWeek?: number;
}

/** Начальный набор квестов кампании. */
export const QUESTS: Quest[] = [
  {
    id: 'build_school',
    title: 'Построить Школу',
    description: 'Постройте Школу любого уровня, чтобы начать обучение сотрудников.',
    availableFromWeek: 1,
    objectives: [
      {
        text: 'Школа построена (уровень ≥ 1)',
        check: (state) =>
          state.auxiliaryBuildings.some(
            (b) => b.id === 'school' && b.level >= 1
          ),
      },
    ],
    reward: { funds: 15000, reputation: 5 },
  },
  {
    id: 'hire_teacher',
    title: 'Нанять учителя',
    description: 'Наймите сотрудника со специальностью «Преподаватель» и назначьте его в Школу.',
    availableFromWeek: 1,
    dependsOn: 'build_school',
    objectives: [
      {
        text: 'Учитель работает в Школе',
        check: (state) =>
          state.employees.some(
            (e) =>
              e.specialty === 'teacher' &&
              e.status === 'active' &&
              e.assignedBuildingId === 'school'
          ),
      },
    ],
    reward: { funds: 10000, reputation: 3 },
  },
  {
    id: 'upgrade_clinic',
    title: 'Улучшить Клинику',
    description: 'Поднимите Клинику до уровня 2 или выше.',
    availableFromWeek: 2,
    objectives: [
      {
        text: 'Клиника уровня ≥ 2',
        check: (state) =>
          state.auxiliaryBuildings.some(
            (b) => b.id === 'clinic' && b.level >= 2
          ),
      },
    ],
    reward: { funds: 20000, reputation: 5 },
  },
  {
    id: 'build_auction_house',
    title: 'Построить Аукционный дом',
    description: 'Постройте Аукционный дом в городе или как вспомогательное здание.',
    availableFromWeek: 3,
    objectives: [
      {
        text: 'Аукционный дом построен (уровень ≥ 1)',
        check: (state) =>
          state.auxiliaryBuildings.some(
            (b) => b.id === 'auction_house' && b.level >= 1
          ),
      },
    ],
    reward: { funds: 25000, reputation: 8 },
  },
  {
    id: 'buy_second_territory',
    title: 'Купить вторую территорию',
    description: 'Приобретите дополнительную территорию для города.',
    availableFromWeek: 4,
    objectives: [
      {
        text: 'Территорий куплено ≥ 2',
        check: (state) => (state.cityTerritoriesOwned ?? 1) >= 2,
      },
    ],
    reward: { funds: 30000, reputation: 8 },
  },
  {
    id: 'hire_auctioneer',
    title: 'Нанять аукциониста',
    description: 'Наймите сотрудника со специальностью «Аукционист» и назначьте его в Аукционный дом.',
    availableFromWeek: 4,
    dependsOn: 'build_auction_house',
    objectives: [
      {
        text: 'Аукционист работает в Аукционном доме',
        check: (state) =>
          state.employees.some(
            (e) =>
              e.specialty === 'auctioneer' &&
              e.status === 'active' &&
              e.assignedBuildingId === 'auction_house'
          ),
      },
    ],
    reward: { funds: 15000, reputation: 5 },
  },
  {
    id: 'build_bdsm_room',
    title: 'Построить БДСМ-комнату',
    description: 'Постройте БДСМ-комнату для дрессировки пленниц.',
    availableFromWeek: 5,
    objectives: [
      {
        text: 'БДСМ-комната построена (уровень ≥ 1)',
        check: (state) =>
          state.auxiliaryBuildings.some(
            (b) => b.id === 'bdsm_room' && b.level >= 1
          ),
      },
    ],
    reward: { funds: 20000, reputation: 6 },
  },
  {
    id: 'reach_reputation_50',
    title: 'Репутация 50',
    description: 'Добейтесь репутации 50 или выше.',
    availableFromWeek: 6,
    objectives: [
      {
        text: 'Репутация ≥ 50',
        check: (state) => state.reputation >= 50,
      },
    ],
    reward: { funds: 50000, reputation: 15 },
  },
  {
    id: 'reach_funds_100000',
    title: 'Капитал 100 000',
    description: 'Накопите на счетах 100 000 или более.',
    availableFromWeek: 8,
    objectives: [
      {
        text: 'Средства ≥ 100 000',
        check: (state) => state.funds >= 100000,
      },
    ],
    reward: { funds: 0, reputation: 20 },
  },
  {
    id: 'build_self_development',
    title: 'Центр саморазвития',
    description: 'Постройте Центр саморазвития для повышения навыков сотрудников.',
    availableFromWeek: 7,
    objectives: [
      {
        text: 'Центр саморазвития построен (уровень ≥ 1)',
        check: (state) =>
          state.auxiliaryBuildings.some(
            (b) => b.id === 'self_development_center' && b.level >= 1
          ),
      },
    ],
    reward: { funds: 20000, reputation: 6 },
  },
  {
    id: 'build_hospital',
    title: 'Построить Госпиталь',
    description: 'Постройте Госпиталь для лечения раненых.',
    availableFromWeek: 9,
    objectives: [
      {
        text: 'Госпиталь построен (уровень ≥ 1)',
        check: (state) =>
          state.auxiliaryBuildings.some((b) => b.id === 'hospital' && b.level >= 1),
      },
    ],
    reward: { funds: 30000, reputation: 8 },
  },
  {
    id: 'build_legal_dept',
    title: 'Юридический отдел',
    description: 'Создайте Юридический отдел для снижения рисков.',
    availableFromWeek: 10,
    objectives: [
      {
        text: 'Юридический отдел построен (уровень ≥ 1)',
        check: (state) =>
          state.auxiliaryBuildings.some((b) => b.id === 'legal_dept' && b.level >= 1),
      },
    ],
    reward: { funds: 25000, reputation: 7 },
  },
  {
    id: 'build_guard_post',
    title: 'Пост охраны',
    description: 'Укрепите безопасность — постройте Пост охраны.',
    availableFromWeek: 6,
    objectives: [
      {
        text: 'Пост охраны построен (уровень ≥ 1)',
        check: (state) =>
          state.auxiliaryBuildings.some((b) => b.id === 'guard_post' && b.level >= 1),
      },
    ],
    reward: { funds: 18000, reputation: 5 },
  },
  {
    id: 'reach_reputation_100',
    title: 'Репутация 100',
    description: 'Добейтесь репутации 100 или выше.',
    availableFromWeek: 12,
    objectives: [
      {
        text: 'Репутация ≥ 100',
        check: (state) => state.reputation >= 100,
      },
    ],
    reward: { funds: 75000, reputation: 25 },
  },
  {
    id: 'reach_funds_250000',
    title: 'Капитал 250 000',
    description: 'Накопите на счетах 250 000 или более.',
    availableFromWeek: 14,
    objectives: [
      {
        text: 'Средства ≥ 250 000',
        check: (state) => state.funds >= 250000,
      },
    ],
    reward: { funds: 0, reputation: 30 },
  },
];

/** Создать начальные состояния квестов для новой кампании. */
export function createInitialQuestStates(week: number): QuestState[] {
  return QUESTS.filter((q) => q.availableFromWeek <= week).map((q) => ({
    id: q.id,
    status: 'active',
  }));
}

/** Проверить все активные квесты и вернуть завершённые с наградами. */
export function checkQuests(
  state: ManagedCampaignState,
  previous: QuestState[]
): { next: QuestState[]; completed: Quest[]; logs: string[] } {
  const byId = new Map(previous.map((qs) => [qs.id, qs]));
  const next: QuestState[] = [];
  const completed: Quest[] = [];
  const logs: string[] = [];

  for (const quest of QUESTS) {
    const prev = byId.get(quest.id) ?? { id: quest.id, status: 'active' };

    // Квест ещё не доступен по неделе — пропускаем.
    if (state.week < quest.availableFromWeek) {
      if (prev.status === 'active') next.push(prev);
      continue;
    }

    // Зависимость не выполнена — квест остаётся скрытым/активным без прогресса.
    if (quest.dependsOn) {
      const dep = byId.get(quest.dependsOn);
      if (!dep || dep.status !== 'completed') {
        if (prev.status === 'active') next.push(prev);
        continue;
      }
    }

    // Уже завершён — оставляем как есть.
    if (prev.status === 'completed') {
      next.push(prev);
      continue;
    }

    // Проверяем все цели.
    const allDone = quest.objectives.every((obj) => obj.check(state));
    if (allDone) {
      next.push({ id: quest.id, status: 'completed', completedWeek: state.week });
      completed.push(quest);
      const parts = [
        `📋 Квест завершён: «${quest.title}»`,
        quest.reward.funds ? `+${quest.reward.funds} ₽` : '',
        quest.reward.reputation ? `+${quest.reward.reputation} репутации` : '',
      ].filter(Boolean);
      logs.push(parts.join(' — '));
    } else if (prev.status === 'active') {
      next.push(prev);
    }
  }

  return { next, completed, logs };
}

/** Применить награды завершённых квестов к состоянию игры. */
export function applyQuestRewards(
  state: ManagedCampaignState,
  completed: Quest[]
): ManagedCampaignState {
  let next = state;
  for (const quest of completed) {
    next = {
      ...next,
      funds: next.funds + (quest.reward.funds ?? 0),
      reputation: next.reputation + (quest.reward.reputation ?? 0),
    };
  }
  return next;
}

/** Прогресс выполнения целей квеста (для UI). */
export function getQuestProgress(
  state: ManagedCampaignState,
  quest: Quest
): { done: number; total: number; items: { text: string; done: boolean }[] } {
  const items = quest.objectives.map((obj) => {
    let done = false;
    try {
      done = !!obj.check(state);
    } catch {
      done = false;
    }
    return { text: obj.text, done };
  });
  return { done: items.filter((i) => i.done).length, total: items.length, items };
}

/** Нормализоватьquests при загрузке старого сохранения (обратная совместимость). */
export function normalizeQuests(
  value: unknown,
  week: number
): QuestState[] {
  if (!Array.isArray(value)) return createInitialQuestStates(week);
  return value.filter(
    (qs): qs is QuestState =>
      typeof qs === 'object' &&
      qs !== null &&
      typeof (qs as QuestState).id === 'string' &&
      ['active', 'completed', 'failed'].includes((qs as QuestState).status)
  );
}

/** Проверить, открыт ли квест для отображения в UI. */
export function isQuestVisible(quest: Quest, states: QuestState[]): boolean {
  const state = states.find((qs) => qs.id === quest.id);
  if (!state) return quest.availableFromWeek <= 1;
  if (quest.dependsOn) {
    const dep = states.find((qs) => qs.id === quest.dependsOn);
    if (!dep || dep.status !== 'completed') return false;
  }
  return true;
}
