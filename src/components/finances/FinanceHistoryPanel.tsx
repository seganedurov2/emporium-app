import type { WeeklyFinanceReport } from '../../gameEngine';
import { BarChart3 } from 'lucide-react';
import { formatMoney } from '../../currency';

interface FinanceHistoryPanelProps {
  reports: WeeklyFinanceReport[];
}

const CHART_HEIGHT = 160;
const CHART_WIDTH = 720;

/** Tiny dependency-free SVG charts over the weekly report history. */
export function FinanceHistoryPanel({ reports }: FinanceHistoryPanelProps) {
  if (reports.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
        <h3 className="font-bold text-white text-base mb-1 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-400" /> История финансов
        </h3>
        <p className="text-slate-500 text-xs py-6 text-center">
          История появится после первой завершённой недели кампании.
        </p>
      </div>
    );
  }

  const totalRevenue = (report: WeeklyFinanceReport) =>
    report.revenue.venue + report.revenue.caravans + report.revenue.captureOps + report.revenue.contracts + report.revenue.salon;
  const totalExpenses = (report: WeeklyFinanceReport) =>
    report.expenses.wages + report.expenses.hospital + report.expenses.restZone + report.expenses.staffSlots + report.expenses.loanPayment;

  const maxValue = Math.max(1, ...reports.map(report => Math.max(totalRevenue(report), totalExpenses(report))));
  const maxAbsNet = Math.max(1, ...reports.map(report => Math.abs(report.netIncome)));

  const barWidth = CHART_WIDTH / reports.length;
  const revenuePoints = reports.map((report, index) => {
    const x = (index + 0.5) * barWidth;
    const y = CHART_HEIGHT - (totalRevenue(report) / maxValue) * (CHART_HEIGHT - 20);
    return `${x},${y}`;
  }).join(' ');
  const expensesPoints = reports.map((report, index) => {
    const x = (index + 0.5) * barWidth;
    const y = CHART_HEIGHT - (totalExpenses(report) / maxValue) * (CHART_HEIGHT - 20);
    return `${x},${y}`;
  }).join(' ');

  const netZero = CHART_HEIGHT / 2;
  const netBars = reports.map((report, index) => {
    const barHeight = (Math.abs(report.netIncome) / maxAbsNet) * (CHART_HEIGHT / 2 - 10);
    const positive = report.netIncome >= 0;
    return {
      x: index * barWidth + barWidth * 0.15,
      width: Math.max(1, barWidth * 0.7),
      y: positive ? netZero - barHeight : netZero,
      height: Math.max(1, barHeight),
      fill: positive ? '#34d399' : '#f87171'
    };
  });

  const recent = [...reports].reverse();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-white text-base mb-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" /> История финансов
          </h3>
          <p className="text-slate-400 text-sm">Выручка, расходы и чистый доход по неделям кампании.</p>
        </div>
        <span className="font-mono text-[10px] text-slate-400 border border-slate-700 bg-slate-950 rounded-md px-2 py-1">
          {reports.length} нед. в истории
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-2">Доходы vs расходы</h4>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full bg-slate-950 border border-slate-800 rounded-lg" role="img" aria-label="График доходов и расходов по неделям">
            <line x1="0" y1={CHART_HEIGHT - 0.5} x2={CHART_WIDTH} y2={CHART_HEIGHT - 0.5} stroke="#1e293b" strokeWidth="1" />
            <polyline points={revenuePoints} fill="none" stroke="#34d399" strokeWidth="2" />
            <polyline points={expensesPoints} fill="none" stroke="#f87171" strokeWidth="2" />
          </svg>
          <div className="flex gap-4 mt-2 text-[10px] font-mono">
            <span className="text-emerald-400">— доходы</span>
            <span className="text-red-400">— расходы</span>
          </div>
        </div>

        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-2">Чистый доход</h4>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full bg-slate-950 border border-slate-800 rounded-lg" role="img" aria-label="График чистого дохода по неделям">
            <line x1="0" y1={netZero} x2={CHART_WIDTH} y2={netZero} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
            {netBars.map((bar, index) => (
              <rect key={index} x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={bar.fill} />
            ))}
          </svg>
          <div className="flex gap-4 mt-2 text-[10px] font-mono">
            <span className="text-emerald-400">прибыль</span>
            <span className="text-red-400">убыток</span>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-800">
              <th className="py-2 pr-3">Неделя</th>
              <th className="py-2 pr-3">Доходы</th>
              <th className="py-2 pr-3">Расходы</th>
              <th className="py-2 pr-3">Чистый доход</th>
              <th className="py-2">Казна после</th>
            </tr>
          </thead>
          <tbody>
            {recent.map(report => (
              <tr key={report.week} className="border-b border-slate-800/60">
                <td className="py-1.5 pr-3 text-slate-300">{report.week}</td>
                <td className="py-1.5 pr-3 text-emerald-400">+{formatMoney(totalRevenue(report))}</td>
                <td className="py-1.5 pr-3 text-red-400">-{formatMoney(totalExpenses(report))}</td>
                <td className={`py-1.5 pr-3 ${report.netIncome >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {report.netIncome >= 0 ? '+' : '-'}{formatMoney(Math.abs(report.netIncome))}
                </td>
                <td className="py-1.5 text-slate-200">{formatMoney(report.treasuryAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
