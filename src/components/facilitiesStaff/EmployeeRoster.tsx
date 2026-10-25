import type { Employee, EmployeeCandidate } from '../../expansionTypes';
import type { BuildingDefinition } from '../../buildingsEngine';
import { EmployeeRow } from './EmployeeRow';
import { HireCandidatesPanel } from './HireCandidatesPanel';
import { StaffSlotsPanel } from '../hiring/StaffSlotsPanel';

interface EmployeeRosterProps {
  employees: Employee[];
  candidates: EmployeeCandidate[];
  buildings: BuildingDefinition[];
  /** Staff positions the company can fill; grows by purchase. */
  hiringSlots: number;
  funds: number;
  onDismiss: (employeeId: string) => void;
  onHire: (candidateId: string) => void;
  onRefreshCandidates: () => void;
  onBuyHiringSlot: () => void;
}

export function EmployeeRoster({ employees, candidates, buildings, hiringSlots, funds, onDismiss, onHire, onRefreshCandidates, onBuyHiringSlot }: EmployeeRosterProps) {
  return (
    <section aria-labelledby="employee-roster-title" className="border-t border-slate-800 pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 id="employee-roster-title" className="text-sm font-bold text-white">Сотрудники</h3>
          <p className="mt-1 text-xs text-slate-500">{employees.length} из {hiringSlots} в штате</p>
        </div>
        <div className="text-xs text-slate-500">Недельная оплата начисляется только наёмным сотрудникам</div>
      </div>

      <StaffSlotsPanel
        hiringSlots={hiringSlots}
        employeeCount={employees.length}
        funds={funds}
        onBuySlot={onBuyHiringSlot}
        variant="plain"
      />

      {employees.length === 0 ? (
        <p className="mt-4 py-4 text-sm text-slate-500">Сотрудников пока нет. Наймите кандидата, чтобы открыть вспомогательное здание.</p>
      ) : (
        <div className="mt-2">
          {employees.map(employee => (
            <EmployeeRow key={employee.id} employee={employee} buildings={buildings} onDismiss={onDismiss} />
          ))}
        </div>
      )}

      <HireCandidatesPanel
        candidates={candidates}
        employeeCount={employees.length}
        maxEmployees={hiringSlots}
        onHire={onHire}
        onRefresh={onRefreshCandidates}
      />
    </section>
  );
}
