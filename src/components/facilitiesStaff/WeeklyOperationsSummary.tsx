import type { Employee } from '../../expansionTypes';
import type { AuxiliaryBuildingState } from '../../expansionTypes';
import { getBuildingStatus } from '../../buildingsEngine';
import { getEmployeeWages } from '../../employeesEngine';
import { formatMoney } from '../../currency';

interface WeeklyOperationsSummaryProps {
  week: number;
  employees: Employee[];
  buildings: AuxiliaryBuildingState[];
}

export function WeeklyOperationsSummary({ week, employees, buildings }: WeeklyOperationsSummaryProps) {
  const wages = getEmployeeWages(employees);
  const unstaffed = buildings.filter(building => getBuildingStatus(building, employees) === 'unstaffed').length;

  return (
    <section aria-label="Обязательства на следующую неделю" className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-slate-800 pb-5">
      <div>
        <div className="text-[10px] uppercase font-semibold text-slate-500">Следующая неделя</div>
        <div className="mt-1 font-mono text-sm font-semibold text-slate-200">Неделя {week + 1}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase font-semibold text-slate-500">Недельная оплата сотрудников</div>
        <div className="mt-1 font-mono text-sm font-semibold text-amber-300">{formatMoney(wages)}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase font-semibold text-slate-500">Постройки без сотрудника</div>
        <div className={`mt-1 font-mono text-sm font-semibold ${unstaffed ? 'text-amber-300' : 'text-emerald-300'}`}>
          {unstaffed}
        </div>
      </div>
    </section>
  );
}
