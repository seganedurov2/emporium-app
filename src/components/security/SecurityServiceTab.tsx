import React, { useState, useMemo } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { calculateAttractiveness, type Character } from '../../gameEngine';
import type { ManagedCampaignState } from '../../saveState';
import { assetUrl } from '../../assetUrl';
import { PersonnelCard } from '../roster/PersonnelCard';
import { VenueBanner, VenueToolbar } from '../venue';
import {
  ROSTER_SORT_OPTIONS,
  rosterSortById,
  rosterSortValue,
  sortRoster,
  type RosterSortId
} from '../../rosterSort';

const HEALTH_LABELS: Record<Character['healthLevel'], string> = {
  Pristine: 'Отличное',
  Good: 'Хорошее',
  Fair: 'Среднее',
  Poor: 'Плохое',
  Critical: 'Критическое'
};

const EXHAUSTION_LABELS: Record<Character['exhaustionLevel'], string> = {
  Rested: 'Отдохнувший',
  Tired: 'Уставший',
  Exhausted: 'Истощённый',
  'Burned Out': 'Выгоревший'
};

const CONTROL_CLASS = 'min-h-8 rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 focus:border-slate-500 focus:outline-2 focus:outline-offset-1 focus:outline-amber-400';

interface SecurityServiceTabProps {
  state: ManagedCampaignState;
}

export const SecurityServiceTab: React.FC<SecurityServiceTabProps> = ({ state }) => {
  const [query, setQuery] = useState('');
  const [sortId, setSortId] = useState<RosterSortId>('none');
  const [sortFlipped, setSortFlipped] = useState<Partial<Record<RosterSortId, boolean>>>({});

  const securityStaff = state.roster.filter(c => c.role === 'guard' || c.role === 'security' || c.role === 'master' || c.role === 'dominatrix');
  const totalSecurityPower = securityStaff.reduce((acc, s) => acc + s.skill, 0);
  const criticalStaff = securityStaff.filter(c => c.healthLevel === 'Critical' || c.exhaustionLevel === 'Burned Out').length;

  const descending = sortFlipped[sortId] ?? rosterSortById(sortId).descending;
  const sortedStaff = useMemo(() => sortRoster(securityStaff, sortId, descending, rosterSortValue), [securityStaff, sortId, descending]);

  const visibleStaff = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru');
    return sortedStaff.filter(character => {
      if (!needle) return true;
      return [character.name, character.role, character.country, character.regionName]
        .some(value => value?.toLocaleLowerCase('ru').includes(needle));
    });
  }, [query, sortedStaff]);

  return (
    <div className="space-y-3">
      <VenueBanner
        title="Служба безопасности"
        description="Контроль порядка, охрана объектов и подавление беспорядков внутри синдиката."
        imageSrc={assetUrl('/assets/security-banner.webp')}
        imageAlt="Security HQ"
        accentClassName="text-blue-300"
        summary={(
          <>
            <span>Штат охраны <strong className="font-mono text-slate-100">{securityStaff.length}</strong></span>
            <span>Общая мощь <strong className="font-mono text-blue-300">{totalSecurityPower}</strong></span>
            <span>Критические <strong className="font-mono text-red-300">{criticalStaff}</strong></span>
            <span>Статус <strong className="font-mono text-emerald-300">Стабильно</strong></span>
          </>
        )}
      />

      <VenueToolbar
        query={query}
        onQueryChange={setQuery}
        searchLabel="Поиск по охране"
        placeholder="Поиск сотрудника по имени или роли…"
        summary={<span>Показано <strong className="font-mono text-slate-200">{visibleStaff.length}/{securityStaff.length}</strong></span>}
        hasActiveFilters={query.trim() !== '' || sortId !== 'none'}
        onReset={() => { setQuery(''); setSortId('none'); setSortFlipped({}); }}
      >
        <label className="sr-only" htmlFor="security-sort">Сортировка охраны</label>
        <select id="security-sort" value={sortId} onChange={event => setSortId(event.target.value as RosterSortId)} className={CONTROL_CLASS}>
          {ROSTER_SORT_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setSortFlipped(previous => ({ ...previous, [sortId]: !descending }))}
          disabled={sortId === 'none'}
          aria-label="Сменить направление сортировки"
          className={`${CONTROL_CLASS} inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-blue-300" />
          {descending ? 'По убыванию' : 'По возрастанию'}
        </button>
      </VenueToolbar>

      {visibleStaff.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/70 px-4 py-10 text-center text-sm text-slate-400">
          {securityStaff.length === 0 ? 'В службе безопасности пока нет сотрудников.' : 'Нет результатов по поиску.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {visibleStaff.map(character => {
            const metrics = [
              { label: 'Навык', value: character.skill, valueClassName: 'text-blue-300' },
              { label: 'Здоровье', value: HEALTH_LABELS[character.healthLevel], valueClassName: 'text-emerald-300' },
              { label: 'Усталость', value: EXHAUSTION_LABELS[character.exhaustionLevel], valueClassName: 'text-amber-300' },
              { label: 'Привл.', value: `${calculateAttractiveness(character)}/100` },
              { label: 'Возраст', value: character.age }
            ];
            return (
              <PersonnelCard
                key={character.id}
                character={character}
                platform={'original'}
                accentClassName="border-l-2 border-l-blue-500/70"
                metrics={metrics}
                badges={(
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    {character.role === 'master' && <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-[8px] font-bold text-amber-200">МАСТЕР</span>}
                    {character.role === 'dominatrix' && <span className="rounded border border-purple-500/30 bg-purple-500/10 px-1 py-0.5 text-[8px] font-bold text-purple-200">ГОСПОЖА</span>}
                    {character.healthLevel === 'Critical' && <span className="rounded border border-red-500/30 bg-red-500/10 px-1 py-0.5 text-[8px] font-bold text-red-200">КРИТИЧЕСКИЙ</span>}
                  </div>
                )}
                details={(
                  <>
                    <p className="truncate">{character.role} · {character.country || character.regionName}</p>
                    <p className="truncate font-mono text-slate-500">Специализация: Охрана и Подавление</p>
                    {character.exhaustionLevel === 'Burned Out' && <p className="truncate text-red-400">Требуется срочный отдых!</p>}
                  </>
                )}
                actions={
                  <div className="flex gap-2">
                    <button className="flex-1 min-h-8 rounded bg-blue-700/80 px-2 text-[10px] font-bold text-white transition hover:bg-blue-600">Проверить</button>
                    <button className="flex-1 min-h-8 rounded bg-slate-700/80 px-2 text-[10px] font-bold text-white transition hover:bg-slate-600">Отправить</button>
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
