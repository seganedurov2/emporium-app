import { useMemo, useState } from 'react';
import { ArrowUpDown, Music, Sparkles } from 'lucide-react';
import { getTerm, type Platform } from '../../terminology';
import type { Character } from '../../gameEngine';
import { calculateAttractiveness } from '../../gameEngine';
import { calculateVenueSynergies } from '../../synergyEngine';
import { marketValueOf } from '../../slaveContractsEngine';
import {
  canWorkInStripClub,
  type RequestVenueId,
  type VenueAdministratorRequest
} from '../../administratorEngine';
import {
  STRIP_CLUB_UPGRADES,
  STRIP_CLUB_UPGRADE_IDS,
  type StripClubUpgradeId
} from '../../stripClubEngine';
import { PersonnelCard } from '../roster/PersonnelCard';
import { VenueAdministratorPanel } from '../venue/VenueAdministratorPanel';
import { VenueBanner, VenueToolbar, VENUE_APPEARANCES } from '../venue';
import { formatMoney } from '../../currency';
import {
  ROSTER_SORT_OPTIONS as SHARED_ROSTER_SORT_OPTIONS,
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

const VENUE_LABELS: Record<NonNullable<Character['assignedVenue']>, string> = {
  trade: 'Торговая сеть',
  beauty_salon: 'Салон красоты',
  strip_club: 'Стрип-клуб',
  pleasure_house: 'Дом удовольствия',
  security: 'Служба безопасности',
  auction_house: 'Аукционный дом',
  bdsm_room: 'БДСМ-комната',
  unassigned: 'Без работы'
};

type DancerFilter = 'all' | 'on_stage' | 'unassigned' | 'other';

const ROSTER_SORT_OPTIONS: { id: RosterSortId; label: string; descending: boolean }[] = SHARED_ROSTER_SORT_OPTIONS;

interface StripClubTabProps {
  funds: number;
  platform: Platform;
  /** Полный ростер; панель выбирает подходящих работников клуба. */
  roster: Character[];
  stripClubUpgrades: Record<StripClubUpgradeId, number>;
  /** Активный запрос администратора стрип-клуба. */
  administratorRequest: VenueAdministratorRequest | null;
  onAcceptRequest: (venue: RequestVenueId) => void;
  onUpgrade: (trackId: StripClubUpgradeId) => void;
  onAssignVenue: (charId: string, venue: NonNullable<Character['assignedVenue']>) => void;
  onBreakSlave: (charId: string) => void;
  onPreviewImage?: (imageUrl: string) => void;
}

const CONTROL_CLASS = 'min-h-8 rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 focus:border-pink-400 focus:outline-2 focus:outline-offset-1 focus:outline-pink-400';

export function StripClubTab({
  funds,
  platform,
  roster,
  stripClubUpgrades,
  administratorRequest,
  onAcceptRequest,
  onUpgrade,
  onAssignVenue,
  onBreakSlave,
  onPreviewImage
}: StripClubTabProps) {
  const [sortId, setSortId] = useState<RosterSortId>('none');
  const [sortFlipped, setSortFlipped] = useState<Partial<Record<RosterSortId, boolean>>>({});
  const [query, setQuery] = useState('');
  const [dancerFilter, setDancerFilter] = useState<DancerFilter>('all');

  // Правило клуба: на площадке — только пленники или работники стрип-клуба.
  const dancers = roster.filter(character =>
    (character.isSlave || character.assignedVenue === 'strip_club')
    && character.assignedVenue !== 'pleasure_house');
  const descending = sortFlipped[sortId] ?? rosterSortById(sortId).descending;
  const sortedDancers = useMemo(() => sortRoster(dancers, sortId, descending, rosterSortValue), [dancers, descending, sortId]);
  const needle = query.trim().toLocaleLowerCase('ru');
  const visibleDancers = sortedDancers.filter(character => {
    const unassigned = !character.assignedVenue || character.assignedVenue === 'unassigned';
    if (dancerFilter === 'on_stage' && character.assignedVenue !== 'strip_club') return false;
    if (dancerFilter === 'unassigned' && !unassigned) return false;
    if (dancerFilter === 'other' && (unassigned || character.assignedVenue === 'strip_club')) return false;
    if (!needle) return true;
    return [character.name, character.role, character.country, character.regionName]
      .some(value => value?.toLocaleLowerCase('ru').includes(needle));
  });
  const idleCount = dancers.filter(character => !character.assignedVenue || character.assignedVenue === 'unassigned').length;
  const onFloorCount = dancers.filter(character => character.assignedVenue === 'strip_club').length;
  const totalMarketValue = dancers.reduce((sum, character) => sum + marketValueOf(character), 0);

  const venueSynergies = useMemo(() => calculateVenueSynergies(roster.filter(c => c.assignedVenue === 'strip_club')), [roster]);

  const filtersActive = query.trim() !== '' || dancerFilter !== 'all';
  const resetFilters = () => {
    setQuery('');
    setDancerFilter('all');
  };
  const toggleDirection = () => setSortFlipped(previous => ({ ...previous, [sortId]: !descending }));

  return (
    <div className="space-y-3">
       <VenueBanner
         title={getTerm('strip_club', platform)}
         description="Состав клуба, назначения и улучшения сцены — все ключевые показатели в одном месте."
         imageSrc={VENUE_APPEARANCES.stripClub.imageSrc}
         imageAlt={VENUE_APPEARANCES.stripClub.imageAlt}
         accentClassName="text-rose-300"
         summary={(
           <>
             <span className="inline-flex items-center gap-1.5"><Music aria-hidden="true" className="h-3.5 w-3.5 text-pink-300" /> Танцовщиц <strong className="font-mono text-slate-100">{dancers.length}</strong></span>
             <span>На сцене <strong className="font-mono text-pink-300">{onFloorCount}</strong></span>
             <span>Без работы <strong className="font-mono text-amber-300">{idleCount}</strong></span>
             <span>Оценка рынком <strong className="font-mono text-emerald-300">{formatMoney(totalMarketValue)}</strong></span>
           </>
         )}
       />

       {venueSynergies.activeSynergies.length > 0 && (
         <div className="flex flex-wrap gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
           <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-amber-400 mr-2">
             <Sparkles aria-hidden="true" className="h-3 w-3" /> Синергии персонала:
           </div>
           {venueSynergies.activeSynergies.map(syn => (
             <span key={syn.id} className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
               {syn.name} <span className="opacity-60">({syn.description})</span>
             </span>
           ))}
         </div>
       )}


      <details className="group rounded-lg border border-slate-800 bg-slate-900/80">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-slate-300 focus-visible:outline-2 focus-visible:outline-pink-400">
          <span>Улучшения стрип-клуба</span>
          <span className="text-[10px] font-normal text-slate-500">Открыть / свернуть</span>
        </summary>
        <div className="grid grid-cols-1 gap-2 border-t border-slate-800 p-2 sm:grid-cols-2 xl:grid-cols-3">
          {STRIP_CLUB_UPGRADE_IDS.map(trackId => {
            const upgrade = STRIP_CLUB_UPGRADES[trackId];
            const currentLevel = stripClubUpgrades[trackId] ?? 0;
            const nextLevel = currentLevel + 1;
            const canUpgrade = nextLevel <= upgrade.maxLevel;
            const nextCost = canUpgrade ? upgrade.costs[nextLevel] : 0;
            return (
              <article key={trackId} className="rounded-md border border-slate-800 bg-slate-950 p-3">
                <h2 className="text-xs font-semibold text-white">{upgrade.name}</h2>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500" title={upgrade.tagline}>{upgrade.tagline}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                  <span>Уровень <strong className="font-mono text-amber-300">{currentLevel}/{upgrade.maxLevel}</strong></span>
                  <span className="truncate">{upgrade.effectDescriptions[currentLevel]}</span>
                </div>
                <div className="mt-1 flex gap-1" aria-label={`${upgrade.name}: уровень ${currentLevel} из ${upgrade.maxLevel}`}>
                  {Array.from({ length: upgrade.maxLevel }, (_, index) => (
                    <span key={index} className={`h-1 flex-1 rounded-full ${index < currentLevel ? 'bg-pink-500' : 'bg-slate-800'}`} />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => onUpgrade(trackId)}
                  disabled={!canUpgrade || funds < nextCost}
                  className="mt-2 min-h-8 w-full rounded-md bg-pink-700 px-2 text-[11px] font-bold text-white transition hover:bg-pink-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-300 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {canUpgrade ? `Улучшить · ${formatMoney(nextCost)}` : 'Максимальный уровень'}
                </button>
              </article>
            );
          })}
        </div>
      </details>

      <VenueAdministratorPanel
        venue="strip_club"
        request={administratorRequest}
        funds={funds}
        onAccept={onAcceptRequest}
      />

      <VenueToolbar
        query={query}
        onQueryChange={setQuery}
        searchLabel="Поиск по работникам стрип-клуба"
        placeholder="Поиск по имени, роли, стране или региону…"
        summary={<span>Показано <strong className="font-mono text-slate-200">{visibleDancers.length}/{dancers.length}</strong></span>}
        onReset={resetFilters}
        hasActiveFilters={filtersActive}
      >
        <label className="sr-only" htmlFor="strip-club-assignment-filter">Фильтр по назначению</label>
        <select id="strip-club-assignment-filter" value={dancerFilter} onChange={event => setDancerFilter(event.target.value as DancerFilter)} className={CONTROL_CLASS}>
          <option value="all">Все назначения</option>
          <option value="on_stage">На сцене</option>
          <option value="unassigned">Без работы</option>
          <option value="other">Другие площадки</option>
        </select>
        <label className="sr-only" htmlFor="strip-club-sort">Сортировка танцовщиц</label>
        <select id="strip-club-sort" value={sortId} onChange={event => setSortId(event.target.value as RosterSortId)} className={CONTROL_CLASS}>
          {ROSTER_SORT_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <button
          type="button"
          onClick={toggleDirection}
          disabled={sortId === 'none'}
          aria-label="Сменить направление сортировки"
          className={`${CONTROL_CLASS} inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-pink-300" />
          {descending ? 'По убыванию' : 'По возрастанию'}
        </button>
      </VenueToolbar>

       {visibleDancers.length === 0 ? (
         <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/70 px-4 py-10 text-center text-sm text-slate-400">
           {dancers.length === 0 ? `Танцовщиц пока нет. Назначьте ${getTerm('prisoner', platform).toLowerCase()} на площадку «${getTerm('strip_club', platform)}».` : 'Нет результатов по выбранному поиску или фильтрам.'}
         </div>
       ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {visibleDancers.map(character => {
            const assigned = character.assignedVenue === 'strip_club';
            return (
               <PersonnelCard
                 key={character.id}
                 character={character}
                 platform={platform}
                 accentClassName={assigned ? 'border-l-2 border-l-pink-500/80' : 'border-l-2 border-l-amber-500/60'}
                 onPreviewImage={onPreviewImage}
                 badges={(
                  <span className={`rounded border px-1 py-0.5 text-[8px] font-bold ${assigned ? 'border-pink-500/30 bg-pink-500/10 text-pink-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
                    {assigned ? 'НА СЦЕНЕ' : 'БЕЗ РАБОТЫ'}
                  </span>
                )}
                metrics={[
                  { label: 'Навык', value: character.skill },
                  { label: 'Привл.', value: `${calculateAttractiveness(character)}/100`, valueClassName: 'text-amber-300' },
                  { label: 'Покор.', value: `${character.submission || 50}%`, valueClassName: 'text-purple-300' },
                  { label: 'Здоровье', value: HEALTH_LABELS[character.healthLevel], valueClassName: 'text-emerald-300' },
                  { label: 'Усталость', value: EXHAUSTION_LABELS[character.exhaustionLevel], valueClassName: 'text-amber-300' },
                  { label: 'Возраст', value: character.age }
                ]}
                details={(
                  <>
                    <p className="truncate">Рынок {formatMoney(marketValueOf(character))} · нед. {character.acquiredWeek ?? '—'}</p>
                    <p className="truncate font-mono text-rose-300">ДУ · В {character.pleasureStats?.vaginalCount ?? 0} / А {character.pleasureStats?.analCount ?? 0} · доход {formatMoney((character.pleasureStats?.totalEarnings ?? 0))}</p>
                  </>
                )}
                actions={(
                  <div className="space-y-1.5">
                    <label className="sr-only" htmlFor={`strip-venue-${character.id}`}>Место работы для {character.name}</label>
                    <select
                      id={`strip-venue-${character.id}`}
                      value={character.assignedVenue || 'unassigned'}
                      onChange={event => onAssignVenue(character.id, event.target.value as NonNullable<Character['assignedVenue']>)}
                      className="min-h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-[10px] font-medium text-slate-200 focus:border-pink-400 focus:outline-2 focus:outline-pink-400"
                    >
                      {character.assignedVenue === 'trade' && <option value="trade">{VENUE_LABELS.trade}</option>}
                      <option value="beauty_salon">{VENUE_LABELS.beauty_salon}</option>
                      <option value="strip_club" disabled={!canWorkInStripClub(character)}>{VENUE_LABELS.strip_club}</option>
                      <option value="pleasure_house">{VENUE_LABELS.pleasure_house}</option>
                      <option value="auction_house">{VENUE_LABELS.auction_house}</option>
                      <option value="security">{VENUE_LABELS.security}</option>
                      <option value="unassigned">{VENUE_LABELS.unassigned}</option>
                    </select>
                    <button type="button" onClick={() => onBreakSlave(character.id)} className="min-h-7 w-full rounded bg-purple-700/80 px-2 text-[10px] font-bold text-white transition hover:bg-purple-600 focus-visible:outline-2 focus-visible:outline-purple-300">Умиротворить</button>
                  </div>
                )}
              />
            );
          })}
        </div>
      )}

       <p className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-[10px] leading-relaxed text-slate-500">
         В стрип-клубе работают только ${getTerm('prisoner', platform).toLowerCase()} или работники стрип-клуба. Диджей и администратор нанимаются в разделе «Найм сотрудников».
       </p>
    </div>
  );
}
