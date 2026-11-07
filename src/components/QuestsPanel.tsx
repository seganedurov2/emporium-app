/**
 * Панель квестов (заданий) кампании.
 * Показывает активные и завершённые квесты с прогрессом и наградами.
 */

import { QUESTS, getQuestProgress, type Quest, type QuestState } from '../quests';
import type { ManagedCampaignState } from '../saveState';

interface QuestsPanelProps {
  quests: QuestState[];
  state: ManagedCampaignState;
  onClose: () => void;
}

export function QuestsPanel({ quests, state, onClose }: QuestsPanelProps) {
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
                const progress = getQuestProgress(state, quest);
                const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
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
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>Прогресс</span>
                        <span>{progress.done}/{progress.total} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded bg-slate-700 overflow-hidden">
                        <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      {progress.items.map((obj, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                          <span className={obj.done ? 'text-emerald-400' : 'text-amber-500'}>{obj.done ? '✓' : '▸'}</span>
                          <span className={obj.done ? 'text-emerald-200/90' : ''}>{obj.text}</span>
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

const QUEST_BY_ID: Record<string, Quest> = Object.fromEntries(
  QUESTS.map((q) => [q.id, q])
);
