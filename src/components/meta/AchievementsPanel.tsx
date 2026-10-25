import type { MetaProgressState } from '../../metaProgressEngine';
import { ACHIEVEMENTS } from '../../metaProgressEngine';
import { Trophy } from 'lucide-react';

interface AchievementsPanelProps {
  metaProgress: MetaProgressState;
}

/** Grid of every achievement with its unlock week, if unlocked. */
export function AchievementsPanel({ metaProgress }: AchievementsPanelProps) {
  const unlockedCount = ACHIEVEMENTS.filter(def => metaProgress.achievements[def.id] !== undefined).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-white text-base mb-1 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" /> Достижения синдиката
          </h3>
          <p className="text-slate-400 text-sm">Вехи истории компании: первые продажи, недели, капитал и события.</p>
        </div>
        <span className="font-mono text-xs text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded-md px-2 py-1">
          {unlockedCount}/{ACHIEVEMENTS.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ACHIEVEMENTS.map(def => {
          const unlockedWeek = metaProgress.achievements[def.id];
          const unlocked = unlockedWeek !== undefined;
          return (
            <div
              key={def.id}
              className={`rounded-lg border p-3 ${unlocked
                ? 'border-amber-500/40 bg-amber-500/5'
                : 'border-slate-800 bg-slate-950 opacity-60'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-bold ${unlocked ? 'text-amber-300' : 'text-slate-400'}`}>
                  {def.title}
                </span>
                {unlocked && (
                  <span className="font-mono text-[10px] text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">
                    нед. {unlockedWeek}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">{def.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
