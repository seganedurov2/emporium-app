import { Building2 } from 'lucide-react';
import type { AuxiliaryBuildingState, Employee } from '../../expansionTypes';
import { getBuildingDefinition, getBuildingStatus } from '../../buildingsEngine';
import { useEffect, useState } from 'react';

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  unbuilt: { bg: 'bg-slate-800/60', border: 'border-slate-700', text: 'text-slate-500', label: 'Не построено' },
  unstaffed: { bg: 'bg-amber-500/10', border: 'border-amber-500/40', text: 'text-amber-300', label: 'Нет сотрудника' },
  operating: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-300', label: 'Работает' }
};

/** Layout grid for the office floor plan. Each cell is a building slot. */
const FLOOR_LAYOUT: { buildingId: string; col: number; row: number; span: number }[] = [
  { buildingId: 'school', col: 0, row: 0, span: 1 },
  { buildingId: 'self_development_center', col: 1, row: 0, span: 1 },
  { buildingId: 'clinic', col: 2, row: 0, span: 1 },
  { buildingId: 'hospital', col: 0, row: 1, span: 2 },
  { buildingId: 'caravan_depot', col: 2, row: 1, span: 1 },
  { buildingId: 'guard_post', col: 3, row: 1, span: 1 },
  { buildingId: 'ceo_office', col: 0, row: 2, span: 1 },
  { buildingId: 'legal_dept', col: 1, row: 2, span: 1 },
  { buildingId: 'bdsm_room', col: 2, row: 2, span: 1 },
  { buildingId: 'auction_house', col: 3, row: 2, span: 1 }
];

const GRID_COLS = 4;
const GRID_ROWS = 3;

interface OfficeFloorPlanProps {
  buildings: AuxiliaryBuildingState[];
  employees: Employee[];
}

export function OfficeFloorPlan({ buildings, employees }: OfficeFloorPlanProps) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const cells: { buildingId: string; col: number; row: number; span: number }[][][] = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => [])
  );

  for (const slot of FLOOR_LAYOUT) {
    cells[slot.row][slot.col].push(slot);
  }

  return (
    <section aria-label="План офиса" className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
      <div className="mb-3 flex items-center gap-2">
        <Building2 className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-bold text-white">План офиса (вид сверху)</h3>
      </div>
      <div className={`grid gap-2 transition-all duration-700 ${revealed ? 'opacity-100' : 'opacity-0 translate-y-2'}`} style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}>
        {cells.flat(2).map((slot, index) => {
          const building = buildings.find(item => item.id === slot.buildingId);
          const definition = building ? getBuildingDefinition(building.id) : null;
          if (!building || !definition) {
            return <div key={index} className="aspect-square rounded-lg border border-slate-800 bg-slate-950" />;
          }
          const status = getBuildingStatus(building, employees);
          const style = STATUS_STYLES[status];
          const assignedCount = building.assignedEmployeeIds.filter(
            id => employees.find(e => e.id === id && e.status === 'active')
          ).length;
          const requiredCount = definition.requiredEmployees;
          const isOperating = status === 'operating';

          return (
            <div
              key={slot.buildingId}
              className={`relative flex flex-col items-center justify-center rounded-lg border p-2 text-center ${style.bg} ${style.border} transition-all duration-500 hover:border-slate-500 ${revealed ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
              style={{ transitionDelay: `${index * 60}ms` }}
              title={`${definition.name} — ${style.label}`}
            >
              <Building2 className={`h-5 w-5 ${style.text}`} aria-hidden="true" />
              <span className={`mt-1 text-[10px] font-semibold uppercase ${style.text}`}>
                {definition.name}
              </span>
              <span className="text-[9px] text-slate-400">
                Ур. {building.level} · {assignedCount}/{requiredCount}
              </span>
              {isOperating ? (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400" aria-label="Работает" />
              ) : status === 'unstaffed' ? (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400" aria-label="Не укомплектовано" />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Работает
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Нет сотрудника
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-slate-600" /> Не построено
        </span>
      </div>
    </section>
  );
}