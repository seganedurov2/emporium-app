import { Building2 } from 'lucide-react';
import type { AuxiliaryBuildingState, Employee } from '../../expansionTypes';
import type { BuildingDefinition } from '../../buildingsEngine';
import { getBuildingActionCost, getBuildingStatus, genderLockNote } from '../../buildingsEngine';
import { fitsSpecialty, specialtyDefinitionOf } from '../../employeesEngine';
import { specialtiesForSlot, totalPostCount } from '../../buildingsEngine';
import { formatMoney } from '../../currency';

interface FacilityRowProps {
  building: AuxiliaryBuildingState;
  definition: BuildingDefinition;
  employees: Employee[];
  funds: number;
  onBuildOrUpgrade: (buildingId: AuxiliaryBuildingState['id']) => void;
  onAssignEmployee: (employeeId: string, buildingId: AuxiliaryBuildingState['id'] | null, slotIndex: number) => void;
}

export function FacilityRow({ building, definition, employees, funds, onBuildOrUpgrade, onAssignEmployee }: FacilityRowProps) {
  const status = getBuildingStatus(building, employees);
  const cost = getBuildingActionCost(building);
  const isBuilt = building.level > 0;
  const slotCount = totalPostCount(definition);
  const availableEmployeesForSlot = (slotIndex: number) => employees.filter(employee =>
    employee.status === 'active'
    && specialtiesForSlot(definition, slotIndex).includes(employee.specialty)
    && fitsSpecialty(employee.specialty, employee.gender)
    && (!employee.assignedBuildingId || employee.assignedBuildingId === building.id)
    && !building.assignedEmployeeIds.some((id, index) => id === employee.id && index !== slotIndex)
  );
  const actionLabel = !isBuilt ? 'Построить' : cost !== null ? 'Улучшить' : 'Максимальный уровень';
  const effect = definition.effectDescriptions[Math.min(building.level, definition.maxLevel)];
  const disabledReason = cost !== null && funds < cost ? 'Недостаточно средств' : null;
  const statusLabel = status === 'unbuilt' ? 'Не построено' : status === 'unstaffed' ? 'Нет сотрудника' : 'Работает';

  return (
    <article className={`grid gap-4 border-b border-slate-800/70 py-4 last:border-0 md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.8fr)_auto] md:items-center ${status === 'unstaffed' ? 'bg-amber-500/[0.035]' : ''}`}>
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h4 className="font-semibold text-white">{definition.name}</h4>
              <span className={`text-[10px] font-semibold uppercase ${status === 'operating' ? 'text-emerald-300' : status === 'unstaffed' ? 'text-amber-300' : 'text-slate-500'}`}>
                {statusLabel}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{definition.shortDescription}</p>
            <p className="mt-1 text-xs font-mono text-slate-300">
              {isBuilt ? `Уровень ${building.level} · ${effect}` : 'Уровень 0 · здание ещё не построено'}
            </p>
          </div>
        </div>
      </div>

      {isBuilt && (
        <div className="flex min-w-0 flex-wrap items-center gap-2 md:justify-center">
          {Array.from({ length: slotCount }, (_, slotIndex) => {
            const assignedEmployee = employees.find(employee => employee.id === building.assignedEmployeeIds[slotIndex]);
            const availableEmployees = availableEmployeesForSlot(slotIndex);
            const optionalSlot = slotIndex >= definition.requiredEmployees;
            const selectId = `facility-employee-${building.id}${slotIndex === 0 ? '' : `-${slotIndex}`}`;
            // A slot can be gender-locked (госпожа / мастер); name the required role
            // and its sex so the player knows who to post.
            const slotSpecialties = specialtiesForSlot(definition, slotIndex);
            const lockedRole = slotSpecialties.length === 1 ? specialtyDefinitionOf(slotSpecialties[0]).role : null;
            const lockNote = slotSpecialties.length === 1 ? genderLockNote(slotSpecialties[0]) : null;
            return (
              <div key={selectId} className="flex min-w-0 flex-1 items-center gap-2">
                <label htmlFor={selectId} className="shrink-0 text-[10px] uppercase font-semibold text-slate-500">
                  {slotSpecialties.length === 1
                    ? `${lockedRole}${lockNote ? ` · ${lockNote}` : ''}`
                    : optionalSlot ? 'Доп. сотрудник' : 'Сотрудник'}
                </label>
                <select
                  id={selectId}
                  value={building.assignedEmployeeIds[slotIndex] ?? ''}
                  onChange={event => onAssignEmployee(event.target.value, building.id, slotIndex)}
                  aria-label={`Назначить ${optionalSlot ? 'дополнительного ' : ''}сотрудника: ${definition.name}`}
                  className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                >
                  <option value="">Не назначен</option>
                  {availableEmployees.map(employee => (
                    <option key={employee.id} value={employee.id}>{employee.name} · {specialtyDefinitionOf(employee.specialty).label}</option>
                  ))}
                  {assignedEmployee && !availableEmployees.some(employee => employee.id === assignedEmployee.id) && (
                    <option value={assignedEmployee.id}>{assignedEmployee.name} · {assignedEmployee.specialty}</option>
                  )}
                </select>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3 md:justify-end">
        {cost !== null ? (
          <button
            type="button"
            onClick={() => onBuildOrUpgrade(building.id)}
            disabled={funds < cost}
            className="min-h-10 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {actionLabel} · {formatMoney(cost)}
          </button>
        ) : (
          <span className="text-xs text-slate-500">Максимальный уровень</span>
        )}
        {disabledReason && <span className="text-[10px] text-red-300">{disabledReason}</span>}
      </div>
    </article>
  );
}
