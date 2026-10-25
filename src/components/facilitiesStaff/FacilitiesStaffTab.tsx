import { Building2, Users } from 'lucide-react';
import type { AuxiliaryBuildingState, BuildingId, Employee, EmployeeCandidate } from '../../expansionTypes';
import { BUILDING_DEFINITIONS } from '../../buildingsEngine';
import { WeeklyOperationsSummary } from './WeeklyOperationsSummary';
import { FacilityList } from './FacilityList';
import { EmployeeRoster } from './EmployeeRoster';
import { formatMoney } from '../../currency';

export interface FacilitiesStaffTabProps {
  week: number;
  funds: number;
  employees: Employee[];
  buildings: AuxiliaryBuildingState[];
  candidates: EmployeeCandidate[];
  /** Staff positions the company can fill; grows by purchase. */
  hiringSlots: number;
  onBuildOrUpgrade: (buildingId: BuildingId) => void;
  onAssignEmployee: (employeeId: string, buildingId: BuildingId | null, slotIndex: number) => void;
  onHireEmployee: (candidateId: string) => void;
  onDismissEmployee: (employeeId: string) => void;
  onRefreshCandidates: () => void;
  onBuyHiringSlot: () => void;
}

export function FacilitiesStaffTab({
  week, funds, employees, buildings, candidates, hiringSlots,
  onBuildOrUpgrade, onAssignEmployee, onHireEmployee, onDismissEmployee, onRefreshCandidates, onBuyHiringSlot
}: FacilitiesStaffTabProps) {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <Building2 className="mt-1 h-5 w-5 text-amber-300" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold text-white">Отдел кадров</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">Постройте и укомплектуйте вспомогательные здания: школу, клинику, караванную станцию, канцелярию CEO, юридический отдел, аукционный дом и другие объекты. Каждый обязательный пост требует сотрудника нужной специальности.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-300">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>{formatMoney(funds)} в казне</span>
        </div>
      </header>

      <WeeklyOperationsSummary week={week} employees={employees} buildings={buildings} />

      <FacilityList
        buildings={buildings}
        employees={employees}
        funds={funds}
        onBuildOrUpgrade={onBuildOrUpgrade}
        onAssignEmployee={onAssignEmployee}
      />

      <EmployeeRoster
        employees={employees}
        candidates={candidates}
        buildings={BUILDING_DEFINITIONS}
        hiringSlots={hiringSlots}
        funds={funds}
        onDismiss={onDismissEmployee}
        onHire={onHireEmployee}
        onRefreshCandidates={onRefreshCandidates}
        onBuyHiringSlot={onBuyHiringSlot}
      />
    </div>
  );
}
