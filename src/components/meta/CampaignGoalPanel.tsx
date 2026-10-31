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
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-xs text-slate-300">{label}</span>
        <span className={`nasa-readout text-xs ${done ? 'text-emerald-300' : 'text-slate-100'}`}>
          {format(current)} / {format(goal)}
        </span>
      </div>
      <div className="nasa-rail">
        <span data-done={done} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** The campaign goal (win condition) with live progress bars. */
export function CampaignGoalPanel({ week, funds, reputation, goalStatus, prestigeLevel }: CampaignGoalPanelProps) {
  const victory = goalStatus === 'victory';
  const defeat = goalStatus === 'defeat';

  return (
    <section
      className={`nasa-panel p-5 text-left sm:p-6 ${victory ? '!border-emerald-400/35' : defeat ? '!border-red-400/35' : ''}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="nasa-label mb-1.5 flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-amber-300/90" aria-hidden="true" /> Условие победы
          </div>
          <h3 className="text-lg font-semibold tracking-wide text-slate-50">Цель кампании</h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-400">
            Достигните {CAMPAIGN_GOAL_WEEK}-й недели с казной {formatMoney(CAMPAIGN_GOAL_FUNDS)} и репутацией {CAMPAIGN_GOAL_REPUTATION}+,
            чтобы завершить кампанию победой и открыть New Game+.
          </p>
        </div>
        {prestigeLevel > 0 && (
          <span className="nasa-readout flex items-center gap-1 rounded-md border border-purple-400/25 bg-purple-400/5 px-2 py-1 text-xs text-purple-200">
            <Crown className="h-3 w-3" aria-hidden="true" /> Престиж {prestigeLevel} · доход ×{prestigeRevenueMultiplier(prestigeLevel).toFixed(2)}
          </span>
        )}
      </div>

      {victory ? (
        <p className="text-sm font-semibold text-emerald-300">Цель выполнена — кампания выиграна. New Game+ доступен через меню достижений.</p>
      ) : defeat ? (
        <p className="text-sm font-semibold text-red-300">Синдикат объявлен банкротом. Кампания проиграна — но вы можете продолжить под внешним управлением.</p>
      ) : (
        <div className="space-y-3">
          <ProgressBar label="Неделя кампании" current={week} goal={CAMPAIGN_GOAL_WEEK} format={v => `${Math.floor(v)}`} />
          <ProgressBar label="Казна" current={funds} goal={CAMPAIGN_GOAL_FUNDS} format={formatMoney} />
          <ProgressBar label="Репутация" current={reputation} goal={CAMPAIGN_GOAL_REPUTATION} format={v => `${Math.floor(v)}%`} />
        </div>
      )}
    </section>
  );
}
