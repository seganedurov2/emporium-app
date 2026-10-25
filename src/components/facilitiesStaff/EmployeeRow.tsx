import { useState } from 'react';
import { specialtyDefinitionOf } from '../../employeesEngine';
import type { Employee } from '../../expansionTypes';
import type { BuildingDefinition } from '../../buildingsEngine';
import { formatMoney } from '../../currency';

interface EmployeeRowProps {
  employee: Employee;
  buildings: BuildingDefinition[];
  onDismiss: (employeeId: string) => void;
}

export function EmployeeRow({ employee, buildings, onDismiss }: EmployeeRowProps) {
  const [expanded, setExpanded] = useState(false);
  const specialty = specialtyDefinitionOf(employee.specialty);
  const assignment = buildings.find(building => building.id === employee.assignedBuildingId)?.name ?? 'Не назначен';
  const moraleTone = employee.morale >= 65 ? 'text-emerald-300' : employee.morale >= 35 ? 'text-amber-300' : 'text-red-300';

  return (
    <article className="border-b border-slate-800/70 py-3 last:border-0">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(8rem,0.8fr)_minmax(8rem,0.8fr)_auto] md:items-center">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-100">{employee.name}</div>
          <div className="mt-0.5 text-xs text-slate-400">
            {specialty?.role ?? employee.specialty} · {employee.gender === 'women' ? 'Женщина' : 'Мужчина'}
          </div>
        </div>
        <div className="text-xs">
          <span className="text-slate-500">Назначение: </span>
          <span className="text-slate-200">{assignment}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono">
          <span className="text-amber-200">{formatMoney(employee.weeklyWage)}/нед.</span>
          <span className={moraleTone}>Мораль {employee.morale}</span>
          <span className="text-slate-300">Навык {employee.skill}</span>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`employee-details-${employee.id}`}
          onClick={() => setExpanded(value => !value)}
          className="min-h-9 justify-self-start rounded-md px-2 text-xs font-medium text-slate-400 underline decoration-slate-600 underline-offset-4 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 md:justify-self-end"
        >
          {expanded ? 'Скрыть детали' : 'Подробнее'}
        </button>
      </div>
      <div
        id={`employee-details-${employee.id}`}
        aria-hidden={!expanded}
        className={expanded ? 'mt-3 flex flex-wrap items-center justify-between gap-3 pl-0 text-xs text-slate-400 md:pl-2' : 'hidden'}
      >
        <span>Опыт: {employee.experience}/100 · Нанят на неделе {employee.hiredWeek}</span>
        <button
          type="button"
          onClick={() => onDismiss(employee.id)}
          className="min-h-9 rounded-md px-2 font-semibold text-red-300 underline decoration-red-900 underline-offset-4 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          Уволить сотрудника
        </button>
      </div>
    </article>
  );
}
