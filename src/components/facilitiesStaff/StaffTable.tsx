import type { Employee } from '../../expansionTypes';
import type { AuxiliaryBuildingState } from '../../expansionTypes';
import { BUILDING_DEFINITIONS } from '../../buildingsEngine';
import type { BuildingId } from '../../expansionTypes';
import { formatMoney } from '../../currency';

interface StaffTableProps {
  employees: Employee[];
  buildings: AuxiliaryBuildingState[];
  /** Current game week, used to show the remaining contract term. */
  currentWeek?: number;
  onDismiss: (employeeId: string) => void;
  onAssignEmployee: (employeeId: string, buildingId: BuildingId | null, slotIndex: number) => void;
  /** Manual «renew by loyalty» action; the contract is extended for a full term. */
  onRenewContract?: (employeeId: string) => void;
}

const SPECIALTY_LABELS: Record<string, string> = {
  teacher: 'Учитель',
  coach: 'Тренер',
  clinician: 'Врач',
  nurse: 'Медсестра',
  midwife: 'Акушерка',
  psychologist: 'Психолог',
  escort: 'Эскорт',
  guard: 'Охранник',
  secretary: 'Секретарь',
  lawyer: 'Юрист',
  attendant: 'Смотритель',
  mistress: 'Госпожа',
  master: 'Мастер',
  auctioneer: 'Аукционист',
  appraiser: 'Оценщик'
};

const GENDER_LABELS: Record<string, string> = {
  women: 'Женщина',
  men: 'Мужчина'
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Активен',
  leave: 'В отпуске'
};

const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-300',
  leave: 'text-amber-300'
};

const getBuildingName = (buildingId: string | null, buildings: AuxiliaryBuildingState[]): string => {
  if (!buildingId) return 'Не назначен';
  const building = buildings.find(b => b.id === buildingId);
  if (!building) return 'Неизвестно';
  const definition = BUILDING_DEFINITIONS.find(d => d.id === building.id);
  return definition?.name ?? building.id;
};

const CONTRACT_RENEWAL_MORALE = 60;

/** Weeks left on the contract; null when the term is unknown/indefinite. */
const contractWeeksLeft = (employee: Employee, currentWeek: number): number | null => {
  if (typeof employee.contractEndWeek !== 'number') return null;
  return Math.max(0, employee.contractEndWeek - currentWeek);
};

export function StaffTable({ employees, buildings, currentWeek = 0, onDismiss, onAssignEmployee, onRenewContract }: StaffTableProps) {
  const getSpecialtyLabel = (specialty: string): string => {
    return SPECIALTY_LABELS[specialty] ?? specialty;
  };

  const contractLabel = (employee: Employee): string => {
    const left = contractWeeksLeft(employee, currentWeek);
    if (left === null) return 'Бессрочный';
    if (left === 0) return 'Истёк';
    if (left <= 2) return `${left} нед.`;
    return `${left} нед.`;
  };

  const contractColor = (employee: Employee): string => {
    const left = contractWeeksLeft(employee, currentWeek);
    if (left === null) return 'text-slate-400';
    if (left === 0) return 'text-red-300';
    if (left <= 2) return 'text-amber-300';
    return 'text-slate-300';
  };

  const getMoraleColor = (morale: number): string => {
    if (morale >= 65) return 'text-emerald-300';
    if (morale >= 35) return 'text-amber-300';
    return 'text-red-300';
  };

  if (employees.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p>Сотрудников пока нет.</p>
        <p className="text-xs mt-1">Наймите кандидатов во вкладке «Найм сотрудников».</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-sm" role="table">
        <thead className="bg-slate-950 border-b border-slate-800">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-slate-300 uppercase tracking-wider text-[10px]">Имя</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-300 uppercase tracking-wider text-[10px]">Специальность</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-300 uppercase tracking-wider text-[10px]">Пол</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-300 uppercase tracking-wider text-[10px]">Назначение</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-300 uppercase tracking-wider text-[10px]">Статус</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-300 uppercase tracking-wider text-[10px]">Навык</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-300 uppercase tracking-wider text-[10px]">Мораль</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-300 uppercase tracking-wider text-[10px]">Оплата/нед.</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-300 uppercase tracking-wider text-[10px]">Нанят (нед.)</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-300 uppercase tracking-wider text-[10px]">Контракт</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-300 uppercase tracking-wider text-[10px]">Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {employees.map((employee) => (
            <tr key={employee.id} className="hover:bg-slate-800/50 transition-colors">
              <td className="px-3 py-2 font-medium text-slate-100 truncate max-w-[150px]">{employee.name}</td>
              <td className="px-3 py-2 text-slate-300">{getSpecialtyLabel(employee.specialty)}</td>
              <td className="px-3 py-2 text-slate-400">{GENDER_LABELS[employee.gender] ?? employee.gender}</td>
              <td className="px-3 py-2 text-slate-300 truncate max-w-[180px]">{getBuildingName(employee.assignedBuildingId, buildings)}</td>
              <td className="px-3 py-2">
                <span className={`${STATUS_COLORS[employee.status] ?? 'text-slate-400'} font-mono`}>
                  {STATUS_LABELS[employee.status] ?? employee.status}
                </span>
              </td>
              <td className="px-3 py-2 text-slate-300 font-mono">{employee.skill}</td>
              <td className="px-3 py-2">
                <span className={`${getMoraleColor(employee.morale)} font-mono`}>{employee.morale}</span>
              </td>
              <td className="px-3 py-2 text-amber-300 font-mono">{formatMoney(employee.weeklyWage)}</td>
              <td className="px-3 py-2 text-slate-400 font-mono">{employee.hiredWeek}</td>
              <td className="px-3 py-2">
                <span className={`${contractColor(employee)} font-mono text-xs`} title="Остаток контракта">
                  {contractLabel(employee)}
                </span>
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1">
                  <select
                    value={employee.assignedBuildingId ?? ''}
                    onChange={(e) => onAssignEmployee(employee.id, (e.target.value || null) as BuildingId | null, 0)}
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:border-amber-400 focus:outline-none w-[140px]"
                  >
                    <option value="">— Не назначен —</option>
                    {buildings
                      .filter(b => b.level > 0)
                      .map((building) => (
                        <option key={building.id} value={building.id}>
                          {getBuildingName(building.id, buildings)}
                        </option>
                      ))}
                  </select>
                  {onRenewContract && (
                    <button
                      type="button"
                      onClick={() => onRenewContract(employee.id)}
                      disabled={employee.morale < CONTRACT_RENEWAL_MORALE}
                      className="px-2 py-1 text-[10px] rounded border border-emerald-800 text-emerald-300 hover:bg-emerald-900/40 disabled:border-slate-800 disabled:text-slate-600 disabled:hover:bg-transparent transition-colors whitespace-nowrap"
                      title={employee.morale < CONTRACT_RENEWAL_MORALE
                        ? `Продление доступно при морали не ниже ${CONTRACT_RENEWAL_MORALE}`
                        : 'Продлить контракт по лояльности'}
                    >
                      Продлить
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDismiss(employee.id)}
                    className="px-2 py-1 text-[10px] text-red-400 hover:text-red-300 underline decoration-red-900 underline-offset-2"
                    title="Уволить"
                  >
                    Уволить
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}