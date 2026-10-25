import { formatMoney } from '../../currency';
import {
  CAMPAIGN_GOAL_FUNDS,
  CAMPAIGN_GOAL_REPUTATION,
  CAMPAIGN_GOAL_WEEK,
  prestigeRevenueMultiplier,
  type CampaignGoalStatus
} from '../../metaProgressEngine';
import { Crown, Target } from 'lucide-react';

interface CampaignGoalPanelProps {
  week: number;
  funds: number;
  reputation: number;
  goalStatus: CampaignGoalStatus;
  prestigeLevel: number;
}

function ProgressBar({ label, current, goal, format }: { label: string; current: number; goal: number; format: (value: number) => string }) {
  const percent = Math.min(100, Math.round((current / goal) * 100));
  const done = current >= goal;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className={`font-mono ${done ? 'text-emerald-400' : 'text-slate-200'}`}>
          {format(current)} / {format(goal)}
        </span>
      </div>
      <div className="h-2 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${done ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** The campaign goal (win condition) with live progress bars. */
export function CampaignGoalPanel({ week, funds, reputation, goalStatus, prestigeLevel }: CampaignGoalPanelProps) {
  const victory = goalStatus === 'victory';
  const defeat = goalStatus === 'defeat';

  return (
    <div className={`rounded-xl border p-6 shadow-xl text-left ${victory ? 'border-emerald-500/40 bg-emerald-950/20' : defeat ? 'border-red-500/40 bg-red-950/20' : 'bg-slate-900 border-slate-800'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-white text-base mb-1 flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-400" /> Цель кампании
          </h3>
          <p className="text-slate-400 text-sm">
            Достигните {CAMPAIGN_GOAL_WEEK}-й недели с казной {formatMoney(CAMPAIGN_GOAL_FUNDS)} и репутацией {CAMPAIGN_GOAL_REPUTATION}+,
            чтобы завершить кампанию победой и открыть New Game+.
          </p>
        </div>
        {prestigeLevel > 0 && (
          <span className="font-mono text-xs text-purple-300 border border-purple-500/30 bg-purple-500/10 rounded-md px-2 py-1 flex items-center gap-1">
            <Crown className="w-3 h-3" /> Престиж {prestigeLevel} · доход ×{prestigeRevenueMultiplier(prestigeLevel).toFixed(2)}
          </span>
        )}
      </div>

      {victory ? (
        <p className="text-emerald-300 text-sm font-semibold">Цель выполнена — кампания выиграна. New Game+ доступен через меню достижений.</p>
      ) : defeat ? (
        <p className="text-red-300 text-sm font-semibold">Синдикат объявлен банкротом. Кампания проиграна — но вы можете продолжить под внешним управлением.</p>
      ) : (
        <div className="space-y-3">
          <ProgressBar label="Неделя кампании" current={week} goal={CAMPAIGN_GOAL_WEEK} format={v => `${Math.floor(v)}`} />
          <ProgressBar label="Казна" current={funds} goal={CAMPAIGN_GOAL_FUNDS} format={formatMoney} />
          <ProgressBar label="Репутация" current={reputation} goal={CAMPAIGN_GOAL_REPUTATION} format={v => `${Math.floor(v)}%`} />
        </div>
      )}
    </div>
  );
}
