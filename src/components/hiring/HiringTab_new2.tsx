import { Briefcase, UserPlus, Wallet, ArrowRight } from 'lucide-react';
import type { AuxiliaryBuildingState, BuildingId, Employee, EmployeeCandidate, EmployeeSpecialty } from '../../expansionTypes';
import type { RestZoneState } from '../../restZoneEngine';
import { recommendedAttendantCount } from '../../restZoneEngine';
import { BUILDING_DEFINITIONS } from '../../buildingsEngine';
import { getEmployeeWages, specialtyDefinitionOf } from '../../employeesEngine';
import { HireCandidatesPanel } from '../facilitiesStaff/HireCandidatesPanel';
import { StaffSlotsPanel } from './StaffSlotsPanel';
import { formatMoney } from '../../currency';

interface VacantPost {
  buildingId: BuildingId;
  name: string;
  built: boolean;
  required: number;
  staffed: number;
  specialties: EmployeeSpecialty[];
  /** Optional roles the building would take but does not need in order to run. */
  optionalGaps: EmployeeSpecialty[];
}

const specialtyRole = (specialty: EmployeeSpecialty): string =>
  specialtyDefinitionOf(specialty).role;

/** Built posts with an unfilled slot, i.e. the hiring targets the player can act on. */
function getVacantPosts(buildings: AuxiliaryBuildingState[], employees: Employee[]): VacantPost[] {
  return BUILDING_DEFINITIONS.flatMap(definition => {
    const state = buildings.find(item => item.id === definition.id);
    const built = (state?.level ?? 0) > 0;
    const required = built ? definition.requiredEmployees : 0;
    if (required === 0) return [];
    const assignedIds = new Set(state?.assignedEmployeeIds ?? []);
    const staffed = employees.filter(employee =>
      employee.status === 'active'
      && assignedIds.has(employee.id)
      && employee.assignedBuildingId === definition.id
      && definition.compatibleSpecialties.includes(employee.specialty)
    ).length;
    const posted = (specialty: EmployeeSpecialty): boolean => employees.some(employee =>
      employee.status === 'active'
      && assignedIds.has(employee.id)
      && employee.assignedBuildingId === definition.id
      && employee.specialty === specialty
    );
    return [{
      buildingId: definition.id,
      name: definition.name,
      built,
      required,
      staffed,
      specialties: definition.compatibleSpecialties,
      optionalGaps: (definition.optionalSpecialties ?? []).filter(specialty => !posted(specialty))
    }];
  });
}

export interface HiringTabProps {
  week: number;
  funds: number;
  employees: Employee[];
  buildings: AuxiliaryBuildingState[];
  restZone: RestZoneState;
  candidates: EmployeeCandidate[];
  /** Staff positions the company can fill; grows by purchase. */
  hiringSlots: number;
  onHire: (candidateId: string) => void;
  onRefresh: () => void;
  onBuySlot: () => void;
  onOpenStaffTab: () => void;
}

export function HiringTab({ week, funds, employees, buildings, restZone, candidates, hiringSlots, onHire, onRefresh, onBuySlot, onOpenStaffTab }: HiringTabProps) {
  const posts = getVacantPosts(buildings, employees);
  const openPosts = posts.filter(post => post.staffed < post.required || post.optionalGaps.length > 0);
  const recommendedAttendants = recommendedAttendantCount(restZone.seats);
  const attendantGap = Math.max(0, recommendedAttendants - restZone.attendantIds.length);
  const matchPost = (specialty: EmployeeSpecialty): string | undefined => {
    if (specialty === 'attendant' && attendantGap > 0) return 'Зона отдыха';
    const post = openPosts.find(item => item.specialties.includes(specialty));
    if (post) return post.name;
    return openPosts.find(item => item.optionalGaps.includes(specialty))?.name;
  };
  const optionalGaps = openPosts.flatMap(post => post.optionalGaps.map(specialty => ({ post, specialty })));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <UserPlus className="mt-1 h-5 w-5 text-amber-300" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold text-white">Найм сотрудников</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Кандидаты подбираются под вакантные посты: преподавание, саморазвитие, клиника, больница
              (медсёстры, акушерки и психолог), сопровождение караванов, охрана пленных, канцелярия CEO,
              юридическая служба, аукционный дом (аукционист и оценщик), БДСМ-комната (госпожа — только женщина, мастер — только мужчина),
              а также стрип-клуб (диджей и администратор).
              Наймите сотрудника, затем назначьте его на пост.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-slate-300">
            <Briefcase aria-hidden="true" className="h-4 w-4 text-amber-300" />
            {employees.length}/{hiringSlots}
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-slate-300">
            <Wallet aria-hidden="true" className="h-4 w-4 text-emerald-300" />
            {formatMoney(funds)}
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-emerald-300">
            <Wallet aria-hidden="true" className="h-4 w-4" />
            {formatMoney(getEmployeeWages(employees))}/нед. фонд оплаты
          </span>
        </div>
      </header>

      <StaffSlotsPanel
        hiringSlots={hiringSlots}
        employeeCount={employees.length}
        funds={funds}
        onBuySlot={onBuySlot}
      />

      <section aria-labelledby="vacant-posts-title" className="border-t border-slate-800 pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 id="vacant-posts-title" className="text-sm font-bold text-white">Вакансии на неделю {week}</h3>
          <button
            type="button"
            onClick={onOpenStaffTab}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-amber-300 underline underline-offset-4 transition hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            Назначить сотрудников на посты
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </div>

        {openPosts.length === 0 && attendantGap === 0 && optionalGaps.length === 0 ? (
          <p className="mt-4 py-3 text-sm text-slate-500">
            Открытых постов нет. Постройте вспомогательное здание в отделе кадров, чтобы открыть вакансию.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {attendantGap > 0 && (
              <li className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-100">Зона отдыха</h4>
                  <span className="shrink-0 rounded-full border border-purple-500/40 px-2 py-0.5 text-[11px] font-semibold text-purple-200">
                    {restZone.attendantIds.length}/{recommendedAttendants}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">Нужен: {specialtyRole('attendant')}</p>
                <p className="mt-2 text-[11px] text-slate-500">
                  Смотритель повышает покорность отдыхающих; без него зона работает вхолостую.
                </p>
              </li>
            )}
            {openPosts.map(post => (
              <li key={post.buildingId} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-100">{post.name}</h4>
                  <span className="shrink-0 rounded-full border border-amber-500/40 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                    {post.staffed}/{post.required}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Нужен: {post.specialties.map(specialtyRole).join(', ')}
                </p>
                {post.optionalGaps.length > 0 && (
                  <p className="mt-1 text-xs text-violet-300">
                    Дополнительно: {post.optionalGaps.map(specialtyRole).join(', ')}
                  </p>
                )}
                <p className="mt-2 text-[11px] text-slate-500">
                  {post.staffed < post.required ? 'Пост не работает, пока обязательный слот пуст.' : 'Обязательный пост работает; дополнительная роль необязательна.'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <HireCandidatesPanel
        candidates={candidates}
        employeeCount={employees.length}
        maxEmployees={hiringSlots}
        onHire={onHire}
        onRefresh={onRefresh}
        alwaysOpen
        matchPostLabel={matchPost}
      />
    </div>
  );
}

export default HiringTab;
