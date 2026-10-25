import { Baby, GraduationCap, ShieldCheck, UserRound } from 'lucide-react';
import type { Dependent } from '../../gameEngine';
import { COMPANY_PROPERTY_AGE_DAYS } from '../../hospitalEngine';
import { formatDependentAge } from '../roster/dependentAge';

interface SchoolKindergartenTabProps {
  dependents: Dependent[];
}

/** До этого возраста ребёнок числится в детском саду, после — в школе. */
const SCHOOL_AGE_DAYS = 6 * 365;

const PROPERTY_AGE_YEARS = Math.round(COMPANY_PROPERTY_AGE_DAYS / 365);

function ChildRow({ dependent }: { dependent: Dependent }) {
  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-500">
          <UserRound aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">{dependent.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {dependent.gender === 'female' ? 'Девочка' : 'Мальчик'} · {formatDependentAge(dependent.ageDays)} ·
            Родитель: <span className="text-slate-300">{dependent.guardianName}</span>
          </p>
        </div>
      </div>
      <span className="inline-flex max-w-sm items-start gap-2 rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
        Собственность компании с {PROPERTY_AGE_YEARS} лет — до этого в залы не назначается.
      </span>
    </li>
  );
}

export function SchoolKindergartenTab({ dependents }: SchoolKindergartenTabProps) {
  const kindergarten = dependents.filter(dependent => dependent.ageDays < SCHOOL_AGE_DAYS);
  const school = dependents.filter(dependent => dependent.ageDays >= SCHOOL_AGE_DAYS);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
        <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-sky-400" /> Школа и детский сад
        </h2>
        <p className="text-slate-400 text-sm">
          Дети сотрудников и пленников синдиката. До шести лет ребёнок числится в детском саду,
          с шести — в школе; в {PROPERTY_AGE_YEARS} лет он становится собственностью компании
          и попадает в ростер.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <div className="text-slate-400 text-xs uppercase mb-1 font-semibold">Всего детей</div>
          <div className="text-2xl font-bold font-mono text-white">{dependents.length}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <div className="text-slate-400 text-xs uppercase mb-1 font-semibold">Детский сад</div>
          <div className="text-2xl font-bold font-mono text-sky-300">{kindergarten.length}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <div className="text-slate-400 text-xs uppercase mb-1 font-semibold">Школа</div>
          <div className="text-2xl font-bold font-mono text-emerald-300">{school.length}</div>
        </div>
      </div>

      <section aria-labelledby="kindergarten-heading" className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-left shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="kindergarten-heading" className="flex items-center gap-2 text-base font-bold text-white">
              <Baby aria-hidden="true" className="h-5 w-5 text-sky-300" /> Детский сад
            </h2>
            <p className="mt-1 text-xs text-slate-500">Дети до шести лет — младшая группа синдиката.</p>
          </div>
          <span className="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1 font-mono text-xs text-slate-400">{kindergarten.length}</span>
        </div>

        {kindergarten.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-center text-sm text-slate-500">
            В детском саду пока нет детей.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-800 border-y border-slate-800">
            {kindergarten.map(dependent => <ChildRow key={dependent.id} dependent={dependent} />)}
          </ul>
        )}
      </section>

      <section aria-labelledby="school-heading" className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-left shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="school-heading" className="flex items-center gap-2 text-base font-bold text-white">
              <GraduationCap aria-hidden="true" className="h-5 w-5 text-emerald-300" /> Школа
            </h2>
            <p className="mt-1 text-xs text-slate-500">Дети от шести лет — старшая группа синдиката.</p>
          </div>
          <span className="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1 font-mono text-xs text-slate-400">{school.length}</span>
        </div>

        {school.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-center text-sm text-slate-500">
            В школе пока нет детей.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-800 border-y border-slate-800">
            {school.map(dependent => <ChildRow key={dependent.id} dependent={dependent} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
