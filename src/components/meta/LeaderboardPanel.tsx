import type { GameRecords, LeaderboardEntry } from '../../metaProgressEngine';
import { Medal, Trophy } from 'lucide-react';
import { formatMoney } from '../../currency';

interface LeaderboardPanelProps {
  records: GameRecords;
  leaderboard: LeaderboardEntry[];
}

const RESULT_LABEL: Record<LeaderboardEntry['result'], string> = {
  victory: 'Победа',
  defeat: 'Банкротство',
  retired: 'Завершена'
};

const RESULT_STYLE: Record<LeaderboardEntry['result'], string> = {
  victory: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  defeat: 'text-red-400 border-red-500/30 bg-red-500/10',
  retired: 'text-slate-400 border-slate-700 bg-slate-800/50'
};

/** Local records board: all-time bests and the finished-campaign leaderboard. */
export function LeaderboardPanel({ records, leaderboard }: LeaderboardPanelProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-left">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400 mb-3 flex items-center gap-2">
            <Medal className="w-4 h-4" /> Лучшая неделя
          </h4>
          <div className="text-2xl font-bold font-mono text-white">{records.bestWeek}</div>
          <div className="text-xs text-slate-400 mt-1">{records.bestWeekCampaign || '—'}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-left">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400 mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4" /> Пиковый капитал
          </h4>
          <div className="text-2xl font-bold font-mono text-white">{formatMoney(records.peakFunds)}</div>
          <div className="text-xs text-slate-400 mt-1">{records.peakFundsCampaign || '—'}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-left">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-3">Кампаний завершено</h4>
          <div className="text-2xl font-bold font-mono text-white">{records.campaignsCompleted}</div>
          <div className="text-xs text-slate-400 mt-1">всего за всё время</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-left">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400 mb-3">Побед</h4>
          <div className="text-2xl font-bold font-mono text-emerald-400">{records.campaignsWon}</div>
          <div className="text-xs text-slate-400 mt-1">цель кампании выполнена</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
        <h3 className="font-bold text-white text-base mb-1">Зал славы синдиката</h3>
        <p className="text-slate-400 text-sm mb-4">Лучшие завершённые кампании на этом устройстве.</p>
        {leaderboard.length === 0 ? (
          <p className="text-slate-500 text-xs py-8 text-center">
            Пока пусто. Завершите кампанию — победой или банкротством — чтобы попасть в таблицу рекордов.
          </p>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry, index) => (
              <div key={`${entry.date}-${entry.campaignName}-${index}`} className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`font-mono text-xs font-bold w-6 text-center ${index === 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{entry.campaignName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      неделя {entry.week} · пик {formatMoney(entry.peakFunds)} · доходы {formatMoney(entry.totalRevenue)}
                      {entry.prestigeLevel > 0 ? ` · престиж ${entry.prestigeLevel}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold border rounded px-2 py-0.5 ${RESULT_STYLE[entry.result]}`}>
                    {RESULT_LABEL[entry.result]}
                  </span>
                  {entry.date && <span className="text-[10px] text-slate-500 font-mono">{entry.date}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
