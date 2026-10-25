import { Brain, Stethoscope, UserRound } from 'lucide-react';
import type { Character } from '../../gameEngine';
import type { HospitalState } from '../../hospitalEngine';
import type { Psychologist } from '../../psychologistEngine';
import { calculateStaffing } from '../../staffingCalculator';

interface StaffingCalculatorProps {
  roster: Character[];
  hospital: HospitalState;
  psychologistsOnDuty: Psychologist[];
}

export function StaffingCalculator({ roster, hospital, psychologistsOnDuty }: StaffingCalculatorProps) {
  const recommendation = calculateStaffing({
    roster,
    hospital,
    psychologistsOnDuty
  });

  return (
    <section aria-labelledby="staffing-calc-title" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-left shadow-xl">
      <h3 id="staffing-calc-title" className="flex items-center gap-2 text-base font-bold text-white">
        Калькулятор кадрового обеспечения
      </h3>
      <p className="mt-1 text-xs text-slate-400">
        Рекомендуемое количество сотрудников на основе текущей нагрузки пациентов.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-100">
            <Stethoscope className="h-4 w-4 text-sky-300" aria-hidden="true" />
            Врачи
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-sky-200">{recommendation.doctors}</p>
          <p className="mt-1 text-[11px] text-sky-300/70">
            1 врач на {4} пациента
          </p>
        </div>

        <div className="rounded-xl border border-pink-500/30 bg-pink-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-pink-100">
            <UserRound className="h-4 w-4 text-pink-300" aria-hidden="true" />
            Медсёстры
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-pink-200">{recommendation.nurses}</p>
          <p className="mt-1 text-[11px] text-pink-300/70">
            1 медсестра на {3} пациента
          </p>
        </div>

        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-100">
            <Brain className="h-4 w-4 text-violet-300" aria-hidden="true" />
            Психологи
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-violet-200">{recommendation.psychologists}</p>
          <p className="mt-1 text-[11px] text-violet-300/70">
            1 психолог на {4} случая/нед.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3">
        <p className="text-[11px] font-mono text-slate-400">
          Всего пациентов: <strong className="text-slate-200">{recommendation.totalPatients}</strong>
          {' '}(в палатах: {recommendation.breakdown.hospitalPatients}, в очереди: {recommendation.breakdown.waitingPatients}, психологических случаев: {recommendation.breakdown.psychologistCases})
        </p>
      </div>
    </section>
  );
}
