import { useState } from 'react';
import { requiredGenderForSpecialty, specialtyDefinitionOf } from '../../employeesEngine';
import type { EmployeeCandidate, EmployeeSpecialty } from '../../expansionTypes';
import { formatMoney } from '../../currency';

interface HireCandidatesPanelProps {
  candidates: EmployeeCandidate[];
  employeeCount: number;
  maxEmployees: number;
  onHire: (candidateId: string) => void;
  onRefresh: () => void;
  /** Keeps the list visible without a disclosure toggle, for the standalone hiring page. */
  alwaysOpen?: boolean;
  /** Names the vacant post a candidate can be assigned to, when one matches. */
  matchPostLabel?: (specialty: EmployeeSpecialty) => string | undefined;
}

export function HireCandidatesPanel({
  candidates, employeeCount, maxEmployees, onHire, onRefresh, alwaysOpen = false, matchPostLabel
}: HireCandidatesPanelProps) {
  const [open, setOpen] = useState(false);
  const atCapacity = employeeCount >= maxEmployees;
  const expanded = alwaysOpen || open;

  return (
    <section className="mt-5 border-t border-slate-800 pt-4" aria-labelledby="hire-candidates-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 id="hire-candidates-title" className="text-sm font-semibold text-slate-200">Найм сотрудников</h4>
          <p className="mt-1 text-xs text-slate-500">Сотрудники добровольно работают по найму; их оплата не относится к ростеру пленных.</p>
        </div>
        {!alwaysOpen && (
          <button
            type="button"
            onClick={() => setOpen(value => !value)}
            disabled={atCapacity}
            aria-expanded={open}
            aria-controls="employee-candidate-list"
            className="min-h-10 rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-amber-400 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:text-slate-500"
          >
            {atCapacity ? 'Штат заполнен' : open ? 'Закрыть список кандидатов' : 'Показать кандидатов'}
          </button>
        )}
        {alwaysOpen && atCapacity && (
          <span className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-500">
            Штат заполнен: купите место выше, чтобы нанять ещё
          </span>
        )}
      </div>

      <div id="employee-candidate-list" hidden={!expanded || atCapacity} className="mt-3" aria-live="polite">
          {candidates.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs text-slate-400">
              <span>Кандидатов пока нет.</span>
              <button type="button" onClick={onRefresh} className="rounded px-2 py-1 text-amber-300 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">Обновить список</button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/70">
              {candidates.map(candidate => {
                const specialty = specialtyDefinitionOf(candidate.specialty);
                const post = matchPostLabel?.(candidate.specialty);
                return (
                  <li key={candidate.id} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-100">{candidate.name}</div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {specialty?.role ?? candidate.specialty} · Навык {candidate.skill} · {candidate.gender === 'women' ? 'Женщина' : 'Мужчина'}
                        {requiredGenderForSpecialty(candidate.specialty) && (
                          <span className="ml-2 rounded border border-pink-500/30 bg-pink-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-pink-300">
                            {requiredGenderForSpecialty(candidate.specialty) === 'women' ? 'только госпожа' : 'только мастер'}
                          </span>
                        )}
                      </div>
                      {post && <div className="mt-0.5 text-[11px] text-amber-300">Подходит на пост: {post}</div>}
                    </div>
                    <div className="text-xs font-mono text-amber-200">{formatMoney(candidate.weeklyWage)}/нед.</div>
                    <button
                      type="button"
                      onClick={() => onHire(candidate.id)}
                      className="min-h-10 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                    >
                      Нанять
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {candidates.length > 0 && (
            <div className="pt-1 text-right">
              <button type="button" onClick={onRefresh} className="rounded px-2 py-1 text-xs text-amber-300 underline underline-offset-4 transition hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">Обновить список</button>
            </div>
          )}
      </div>
    </section>
  );
}
