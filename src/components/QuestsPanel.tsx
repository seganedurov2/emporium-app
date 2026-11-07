/**
 * Панель квестов (заданий) кампании.
 * Показывает активные и завершённые квесты с прогрессом и наградами.
 */

import { type Quest, type QuestState } from '../quests';

interface QuestsPanelProps {
  quests: QuestState[];
  onClose: () => void;
}

export function QuestsPanel({ quests, onClose }: QuestsPanelProps) {
  const active = quests.filter((q) => q.status === 'active');
  const completed = quests.filter((q) => q.status === 'completed');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 border border-amber-600/50 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-amber-300">Задания кампании</h2>
          <button
            onClick={onClose}
            className="rounded hover:bg-slate-800 px-3 py-1 text-slate-400 hover:text-white transition"
          >
            Закрыть
          </button>
        </div>

        {active.length > 0 ? (
          <>
            <div className="mb-4 text-amber-400 text-xs font-bold uppercase tracking-wider">Активные</div>
            <div className="space-y-3 mb-8">
              {active.map((qs) => {
                const quest = QUEST_BY_ID[qs.id];
                if (!quest) return null;
                return (
                  <div
                    key={quest.id}
                    className="rounded-lg border border-slate-700 bg-slate-800/50 p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-white">{quest.title}</div>
                      <span className="text-xs bg-amber-600/20 text-amber-300 rounded px-2 py-0.5">
                        Неделя {quest.availableFromWeek}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm mb-3">{quest.description}</p>
                    <div className="space-y-1">
                      {quest.objectives.map((obj, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                          <span className="text-amber-500">▸</span>
                          <span>{obj.text}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase">Награда</span>
                      <div className="text-xs text-emerald-400 font-mono">
                        {quest.reward.funds ? `+${quest.reward.funds} ₽  ` : ''}{quest.reward.reputation ? `+${quest.reward.reputation} репутации` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-10 text-slate-500">
            Нет активных заданий.
          </div>
        )}

        {completed.length > 0 ? (
          <>
            <div className="mt-8 mb-4 text-emerald-400 text-xs font-bold uppercase tracking-wider">Завершённые</div>
            <div className="space-y-2">
              {completed.map((qs) => {
                const quest = QUEST_BY_ID[qs.id];
                if (!quest) return null;
                return (
                  <div
                    key={quest.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-700/50 bg-slate-800/30"
                  >
                    <span className="text-emerald-500">✓</span>
                    <div>
                      <div className="text-sm text-emerald-300 font-medium">{quest.title}</div>
                      <div className="text-xs text-slate-500">
                        Завершено на неделе {qs.completedWeek}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-4 text-slate-500 text-sm">Ещё нет завершённых заданий.</div>
        )}
      </div>
    </div>
  );
}

/** Квесты, доступные в кампании (дублирует QUESTS из quests.ts для UI). */
const QUESTS: Quest[] = [
  {
    id: 'build_school',
    title: 'Построить Школу',
    description: 'Постройте Школу любого уровня, чтобы начать обучение сотрудников.',
    availableFromWeek: 1,
    objectives: [{ text: 'Школа построена (уровень ≥ 1)', check: () => false }],
    reward: { funds: 15000, reputation: 5 },
  },
  {
    id: 'hire_teacher',
    title: 'Нанять учителя',
    description: 'Наймите сотрудника со специальностью «Преподаватель» и назначьте его в Школу.',
    availableFromWeek: 1,
    dependsOn: 'build_school',
    objectives: [{ text: 'Учитель работает в Школе', check: () => false }],
    reward: { funds: 10000, reputation: 3 },
  },
  {
    id: 'upgrade_clinic',
    title: 'Улучшить Клинику',
    description: 'Поднимите Клинику до уровня 2 или выше.',
    availableFromWeek: 2,
    objectives: [{ text: 'Клиника уровня ≥ 2', check: () => false }],
    reward: { funds: 20000, reputation: 5 },
  },
  {
    id: 'build_auction_house',
    title: 'Построить Аукционный дом',
    description: 'Постройте Аукционный дом.',
    availableFromWeek: 3,
    objectives: [{ text: 'Аукционный дом построен (уровень ≥ 1)', check: () => false }],
    reward: { funds: 25000, reputation: 8 },
  },
  {
    id: 'buy_second_territory',
    title: 'Купить вторую территорию',
    description: 'Приобретите дополнительную территорию для города.',
    availableFromWeek: 4,
    objectives: [{ text: 'Территорий куплено ≥ 2', check: () => false }],
    reward: { funds: 30000, reputation: 8 },
  },
  {
    id: 'hire_auctioneer',
    title: 'Нанять аукциониста',
    description: 'Наймите аукциониста и назначьте его в Аукционный дом.',
    availableFromWeek: 4,
    dependsOn: 'build_auction_house',
    objectives: [{ text: 'Аукционист работает в Аукционном доме', check: () => false }],
    reward: { funds: 15000, reputation: 5 },
  },
  {
    id: 'build_bdsm_room',
    title: 'Построить БДСМ-комнату',
    description: 'Постройте БДСМ-комнату для дрессировки пленниц.',
    availableFromWeek: 5,
    objectives: [{ text: 'БДСМ-комната построена (уровень ≥ 1)', check: () => false }],
    reward: { funds: 20000, reputation: 6 },
  },
  {
    id: 'reach_reputation_50',
    title: 'Репутация 50',
    description: 'Добейтесь репутации 50 или выше.',
    availableFromWeek: 6,
    objectives: [{ text: 'Репутация ≥ 50', check: () => false }],
    reward: { funds: 50000, reputation: 15 },
  },
  {
    id: 'reach_funds_100000',
    title: 'Капитал 100 000',
    description: 'Накопите на счетах 100 000 или более.',
    availableFromWeek: 8,
    objectives: [{ text: 'Средства ≥ 100 000', check: () => false }],
    reward: { funds: 0, reputation: 20 },
  },
];

const QUEST_BY_ID: Record<string, Quest> = Object.fromEntries(
  QUESTS.map((q) => [q.id, q])
);
