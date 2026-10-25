import { Baby, ShieldCheck, UserRound } from 'lucide-react';
import type { Dependent } from '../../gameEngine';
import { COMPANY_PROPERTY_AGE_DAYS } from '../../hospitalEngine';
import { formatDependentAge } from './dependentAge';

interface DependentsPanelProps {
  dependents: Dependent[];
}

const PROPERTY_AGE_YEARS = Math.round(COMPANY_PROPERTY_AGE_DAYS / 365);

export function DependentsPanel({ dependents }: DependentsPanelProps) {
  return (
    <section aria-labelledby="dependents-heading" className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-left shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="dependents-heading" className="flex items-center gap-2 text-base font-bold text-white">
            <Baby aria-hidden="true" className="h-5 w-5 text-amber-300" /> Дети сотрудников
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Дети числятся отдельно от взрослого ростера. В {PROPERTY_AGE_YEARS} лет ребёнок становится
            собственностью компании и попадает в ростер.
          </p>
        </div>
        <span className="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1 font-mono text-xs text-slate-400">{dependents.length}</span>
      </div>

      {dependents.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-center text-sm text-slate-500">Детей пока нет.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-800 border-y border-slate-800">
          {dependents.map(dependent => (
            <li key={dependent.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
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
          ))}
        </ul>
      )}
    </section>
  );
}
