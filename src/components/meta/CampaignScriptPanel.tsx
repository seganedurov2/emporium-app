import { BookOpen, Flag, Hourglass, ScrollText } from 'lucide-react';
import {
  CAMPAIGN_ACTS,
  evaluateScript,
  type CampaignActId,
  type ScriptSnapshot
} from '../../campaignScript';

interface CampaignScriptPanelProps {
  snapshot: ScriptSnapshot;
  /** Act stored in the save; the week is the source of truth for display. */
  actId?: CampaignActId;
  onSelectAct?: (actId: CampaignActId) => void;
}

/**
 * The campaign script as a mission board: all four acts, the current one lit,
 * and its objectives measured against the live campaign snapshot.
 *
 * Styling follows the app's "Interstellar" surface language (index.css): glass
 * over a starfield, hairline rules, wide-tracked labels and monospaced
 * telemetry with tabular digits so values do not jitter as they change.
 */
export function CampaignScriptPanel({ snapshot, actId, onSelectAct }: CampaignScriptPanelProps) {
  const progress = evaluateScript(snapshot);
  const activeId = actId ?? progress.act.id;
  const actNumber = String(progress.act.number).padStart(2, '0');

  return (
    <section className="nasa-panel p-5 text-left sm:p-6" aria-labelledby="campaign-script-title">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="nasa-label mb-1.5 flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-sky-300/80" aria-hidden="true" />
            Миссия · сценарий кампании
          </div>
          <h3 id="campaign-script-title" className="text-lg font-semibold tracking-wide text-slate-50">
            <span className="nasa-readout nasa-accent mr-2">АКТ {actNumber}</span>
            {progress.act.title}
          </h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-400">{progress.act.thesis}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="nasa-readout rounded-md border border-sky-400/20 bg-sky-400/5 px-2.5 py-1.5 text-xs text-sky-200">
            <span className="nasa-label mr-2 inline">Неделя</span>
            {String(snapshot.week).padStart(3, '0')} / 100
          </div>
          <div
            className={`nasa-readout flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${
              progress.weeksLeft > 0
                ? 'border-amber-400/25 bg-amber-400/5 text-amber-200'
                : 'border-emerald-400/25 bg-emerald-400/5 text-emerald-200'
            }`}
          >
            <Hourglass className="h-3 w-3" aria-hidden="true" />
            {progress.weeksLeft > 0 ? `T−${progress.weeksLeft}` : 'акт закрыт'}
          </div>
        </div>
      </header>

      {/* Act stepper: a timeline, not a row of cards. */}
      <div className="mb-5">
        <div className="nasa-label mb-2">Хронология</div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {CAMPAIGN_ACTS.map(act => {
          const isCurrent = act.id === progress.act.id;
          const isPast = progress.completedActs.includes(act.id);
          return (
            <button
              key={act.id}
              type="button"
              onClick={() => onSelectAct?.(act.id)}
              aria-current={isCurrent ? 'step' : undefined}
              className={`nasa-button group relative overflow-hidden rounded-md px-2.5 py-2 text-left ${isCurrent ? 'nasa-pulse' : ''}`}
            >
              {/* Lit strip marks the state of the act without shouting. */}
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 w-0.5 ${isPast ? 'bg-emerald-400/80' : isCurrent ? 'bg-amber-400/90' : 'bg-slate-600/40'}`}
              />
              <div className="nasa-label flex items-center justify-between">
                <span>Акт {String(act.number).padStart(2, '0')}</span>
                <span className="text-slate-600">{act.weeks[0]}–{act.weeks[1]}</span>
              </div>
              <div
                className={`mt-1 truncate text-xs font-medium ${isCurrent ? 'text-amber-100' : isPast ? 'text-emerald-200/90' : 'text-slate-400'}`}
              >
                {act.title}
              </div>
            </button>
          );
        })}
        </div>
      </div>

      {activeId !== progress.act.id && (
        <p className="mb-4 border-l-2 border-sky-400/40 pl-3 text-xs text-slate-400">
          Просмотр другого акта — прогресс всегда считается для текущего (акт {progress.act.number}).
        </p>
      )}

      {/* Objectives: telemetry rows with a thin lit rail. */}
      <div>
        <div className="nasa-label mb-2 flex items-center justify-between">
          <span>Задачи акта</span>
          <span className="nasa-readout text-slate-500">
            {progress.objectives.filter(item => item.done).length}/{progress.objectives.length}
          </span>
        </div>
        <div className="space-y-3">
          {progress.objectives.map(({ objective, value, done, percent }) => (
            <div key={objective.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-xs text-slate-300">{objective.label}</span>
                <span className={`nasa-readout text-xs ${done ? 'text-emerald-300' : 'text-slate-100'}`}>
                  {objective.format(value, objective.target)}
                </span>
              </div>
              <div
                className="nasa-rail"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={objective.label}
              >
                <span data-done={done} style={{ width: `${percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-start gap-3 border-t border-slate-400/10 pt-4">
        <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/90" aria-hidden="true" />
        <div>
          <div className="nasa-label">Сюжетный поворот</div>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">{progress.act.beat}</p>
        </div>
      </div>

      {progress.actComplete && (
        <p className="nasa-readout mt-3 flex items-center gap-2 text-[11px] tracking-widest text-emerald-300">
          <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
          ЗАДАЧИ АКТА ВЫПОЛНЕНЫ · ПРОХОД ОТКРЫТ
        </p>
      )}
    </section>
  );
}
