import type { AuxiliaryBuildingState, Employee } from '../../expansionTypes';
import { BUILDING_DEFINITIONS, getBuildingStatus } from '../../buildingsEngine';
import { FacilityRow } from './FacilityRow';

interface FacilityListProps {
  buildings: AuxiliaryBuildingState[];
  employees: Employee[];
  funds: number;
  onBuildOrUpgrade: (buildingId: AuxiliaryBuildingState['id']) => void;
  onAssignEmployee: (employeeId: string, buildingId: AuxiliaryBuildingState['id'] | null, slotIndex: number) => void;
}

const priority = { unbuilt: 0, unstaffed: 1, operating: 2 } as const;

export function FacilityList({ buildings, employees, funds, onBuildOrUpgrade, onAssignEmployee }: FacilityListProps) {
  const definitions = [...BUILDING_DEFINITIONS].sort((a, b) => {
    const aState = buildings.find(building => building.id === a.id);
    const bState = buildings.find(building => building.id === b.id);
    return priority[getBuildingStatus(aState ?? { id: a.id, level: 0, assignedEmployeeIds: [] }, employees)]
      - priority[getBuildingStatus(bState ?? { id: b.id, level: 0, assignedEmployeeIds: [] }, employees)];
  });

  return (
    <section aria-labelledby="facility-list-title">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h3 id="facility-list-title" className="text-sm font-bold text-white">Вспомогательные здания</h3>
        <span className="text-[10px] text-slate-500">Эффекты применяются, когда назначен совместимый сотрудник</span>
      </div>
      <div>
        {definitions.map(definition => {
          const building = buildings.find(item => item.id === definition.id) ?? { id: definition.id, level: 0, assignedEmployeeIds: [] };
          return (
            <FacilityRow
              key={definition.id}
              building={building}
              definition={definition}
              employees={employees}
              funds={funds}
              onBuildOrUpgrade={onBuildOrUpgrade}
              onAssignEmployee={onAssignEmployee}
            />
          );
        })}
      </div>
    </section>
  );
}
