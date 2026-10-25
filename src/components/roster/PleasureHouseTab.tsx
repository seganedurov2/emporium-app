import { useMemo, useState } from 'react';
import { ArrowUpDown, HeartPulse, Sparkles } from 'lucide-react';
import { calculateAttractiveness, type Character } from '../../gameEngine';
import { calculateVenueSynergies } from '../../synergyEngine';
import { getTerm, type Platform } from '../../terminology';
import type { ManagedCampaignState } from '../../saveState';
import type { PleasureHouseUpgradeId } from '../../pleasureHouseEngine';
import { PLEASURE_HOUSE_UPGRADES, PLEASURE_HOUSE_UPGRADE_IDS } from '../../pleasureHouseEngine';
import type { RequestVenueId, VenueAdministratorRequest } from '../../administratorEngine';
import { GESTATION_DAYS, getWardDefinition, isObservationStay, isTreatmentStay } from '../../hospitalEngine';
import { isOnCaptureOp } from '../../captureOpsEngine';
import { marketValueOf } from '../../slaveContractsEngine';
import { DependentsPanel } from './DependentsPanel';
import { PersonnelCard } from './PersonnelCard';
import { VenueAdministratorPanel } from '../venue/VenueAdministratorPanel';
import { VenueBanner, VenueToolbar, VENUE_APPEARANCES } from '../venue';
import { formatMoney } from '../../currency';

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

const GENDER_LABELS: Record<Character['gender'], string> = {
  women: 'Женщина',
  men: 'Мужчина',
  trans: 'Трансгендер'
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

interface CareSummary {
  status: string;
  needs: string[];
  tone: string;
}

interface PleasureHouseTabProps {
  gameState: ManagedCampaignState;
  sortedRoster: Character[];
  rosterSortId: string;
  rosterSortDescending: boolean;
  rosterSortOptions: { id: string; label: string; descending: boolean }[];
  onSortChange: (value: string) => void;
  onSortDirectionToggle: () => void;
  platform: Platform;
  /** Активный запрос администратора дома удовольствия. */
  administratorRequest: VenueAdministratorRequest | null;
  onAcceptRequest: (venue: RequestVenueId) => void;
  onUpgrade: (trackId: PleasureHouseUpgradeId) => void;
  onAssignVenue: (charId: string, venue: NonNullable<Character['assignedVenue']>) => void;
  onBreakSlave: (charId: string) => void;
  onSellSlave: (character: Character) => void;
  onPreviewImage: (imageUrl: string) => void;
  roleLabel: (role: string) => string;
  getCareSummary: (character: Character) => CareSummary;
}

const CONTROL_CLASS = 'min-h-8 rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 focus:border-slate-500 focus:outline-2 focus:outline-offset-1 focus:outline-amber-400';

export function PleasureHouseTab({
  gameState,
  sortedRoster,
  rosterSortId,
  rosterSortDescending,
  rosterSortOptions,
  onSortChange,
  onSortDirectionToggle,
  platform,
  administratorRequest,
  onAcceptRequest,
  onUpgrade,
  onAssignVenue,
  onBreakSlave,
  onSellSlave,
  onPreviewImage,
  roleLabel,
  getCareSummary
}: PleasureHouseTabProps) {
  const [query, setQuery] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  const idleCount = gameState.roster.filter(character => !character.assignedVenue || character.assignedVenue === 'unassigned').length;
  const pregnantCount = gameState.roster.filter(character => Boolean(character.pregnancy)).length;
  const rosterValue = gameState.roster.reduce((sum, character) => sum + marketValueOf(character), 0);

  const venueSynergies = useMemo(() => calculateVenueSynergies(gameState.roster.filter(c => c.assignedVenue === 'pleasure_house')), [gameState.roster]);

  const visibleRoster = useMemo(() => {

    const needle = query.trim().toLocaleLowerCase('ru');
    return sortedRoster.filter(character => {
      const unassigned = !character.assignedVenue || character.assignedVenue === 'unassigned';
      if (assignmentFilter === 'unassigned' && !unassigned) return false;
      if (assignmentFilter === 'assigned' && unassigned) return false;
      if (!needle) return true;
      return [character.name, character.role, character.country, character.regionName]
        .some(value => value?.toLocaleLowerCase('ru').includes(needle));
    });
  }, [assignmentFilter, query, sortedRoster]);

  const hasFilters = query.trim() !== '' || assignmentFilter !== 'all';
  const resetFilters = () => {
    setQuery('');
    setAssignmentFilter('all');
  };

  return (
    <div className="space-y-3">
       <VenueBanner
          title={getTerm('pleasure_house', platform)}
          description="Персонал и развитие заведения — назначения, состояние команды и ключевые показатели кампании."
          imageSrc={VENUE_APPEARANCES.pleasureHouse.imageSrc}
          imageAlt={VENUE_APPEARANCES.pleasureHouse.imageAlt}
          accentClassName="text-rose-300"
          summary={(
            <>
              <span>Персонал <strong className="font-mono text-slate-100">{gameState.roster.length}</strong></span>
              <span>Без назначения <strong className="font-mono text-amber-300">{idleCount}</strong></span>
              <span>Беременных <strong className="font-mono text-pink-300">{pregnantCount}</strong></span>
              <span>Оценка ростера <strong className="font-mono text-emerald-300">{formatMoney(rosterValue)}</strong></span>
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


      <VenueAdministratorPanel
        venue="pleasure_house"
        request={administratorRequest}
        funds={gameState.funds}
        onAccept={onAcceptRequest}
      />

      <details className="group rounded-lg border border-slate-800 bg-slate-900/80">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-slate-300 focus-visible:outline-2 focus-visible:outline-amber-400">
          <span>Улучшения дома удовольствия</span>
          <span className="text-[10px] font-normal text-slate-500">Открыть / свернуть</span>
        </summary>
        <div className="grid grid-cols-1 gap-2 border-t border-slate-800 p-2 sm:grid-cols-2 xl:grid-cols-4">
          {PLEASURE_HOUSE_UPGRADE_IDS.map(trackId => {
            const upgrade = PLEASURE_HOUSE_UPGRADES[trackId];
            const currentLevel = gameState.pleasureHouseUpgrades[trackId] ?? 0;
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
                    <span key={index} className={`h-1 flex-1 rounded-full ${index < currentLevel ? 'bg-rose-500' : 'bg-slate-800'}`} />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => onUpgrade(trackId)}
                  disabled={!canUpgrade || gameState.funds < nextCost}
                  className="mt-2 min-h-8 w-full rounded-md bg-rose-700 px-2 text-[11px] font-bold text-white transition hover:bg-rose-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {canUpgrade ? `Улучшить · ${formatMoney(nextCost)}` : 'Максимальный уровень'}
                </button>
              </article>
            );
          })}
        </div>
      </details>

      <VenueToolbar
        query={query}
        onQueryChange={setQuery}
        searchLabel="Поиск по персоналу"
        placeholder="Поиск по имени, роли, стране или региону…"
        summary={<span>Показано <strong className="font-mono text-slate-200">{visibleRoster.length}/{gameState.roster.length}</strong></span>}
        hasActiveFilters={hasFilters}
        onReset={resetFilters}
      >
        <div role="group" aria-label="Фильтр назначения" className="flex items-center gap-1">
          {([
            ['all', 'Персонал'],
            ['unassigned', 'Без назначения'],
            ['assigned', 'Назначенные']
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={assignmentFilter === value}
              onClick={() => setAssignmentFilter(value)}
              className={`min-h-8 rounded-md border px-2.5 text-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 ${assignmentFilter === value ? 'border-rose-400/60 bg-rose-500/10 text-rose-200' : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-100'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="pleasure-house-sort">Сортировка персонала</label>
        <select id="pleasure-house-sort" value={rosterSortId} onChange={event => onSortChange(event.target.value)} className={CONTROL_CLASS}>
          {rosterSortOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <button
          type="button"
          onClick={onSortDirectionToggle}
          disabled={rosterSortId === 'none'}
          aria-label="Сменить направление сортировки"
          className={`${CONTROL_CLASS} inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-rose-300" />
          {rosterSortDescending ? 'По убыванию' : 'По возрастанию'}
        </button>
      </VenueToolbar>

      {visibleRoster.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/70 px-4 py-10 text-center text-sm text-slate-400">
          {gameState.roster.length === 0 ? 'В ростере пока нет персонала.' : 'Нет результатов по выбранному поиску или фильтрам.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {visibleRoster.map(character => {
            const isCEO = character.role.includes('Chief Executive');
            const restPlacement = gameState.restZone.placements.find(item => item.characterId === character.id);
            const stay = gameState.hospital.patients.find(patient => patient.characterId === character.id);
            const listedAtAuction = gameState.auctionHouse.pendingLots.some(lot => 'characterId' in lot && lot.characterId === character.id);
            const careSummary = character.isSlave && character.gender === 'women' ? getCareSummary(character) : null;
            const metrics = [
              { label: 'Навык', value: character.skill },
              { label: 'Привл.', value: `${calculateAttractiveness(character)}/100`, valueClassName: 'text-amber-300' },
              { label: 'Покор.', value: `${character.submission || 50}%`, valueClassName: 'text-purple-300' },
              { label: 'Здоровье', value: isCEO ? `${character.exactHealth}%` : HEALTH_LABELS[character.healthLevel], valueClassName: 'text-emerald-300' },
              { label: 'Усталость', value: isCEO ? `${character.exactExhaustion}%` : EXHAUSTION_LABELS[character.exhaustionLevel], valueClassName: 'text-amber-300' },
              { label: 'Возраст', value: character.age }
            ];
            return (
               <PersonnelCard
                 key={character.id}
                 character={character}
                 platform={platform}
                 accentClassName={character.isSlave ? 'border-l-2 border-l-rose-500/70' : ''}
                 onPreviewImage={onPreviewImage}
                 metrics={metrics}
                 badges={(
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    {character.role.includes('Chief Executive') && <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-[8px] font-bold text-amber-200">CEO</span>}
                             {character.isSlave && <span className="rounded border border-rose-500/30 bg-rose-500/10 px-1 py-0.5 text-[8px] font-bold text-rose-200">{getTerm('prisoner', platform).toUpperCase()}</span>}
                    {isOnCaptureOp(character) && <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-[8px] font-bold text-amber-200">В ПОЛЕ</span>}
                  </div>
                )}
                details={(
                  <>
                    <p className="truncate" title={`${roleLabel(character.role)} · ${GENDER_LABELS[character.gender]} · ${character.country || character.regionName}`}>
                      {roleLabel(character.role)} · {GENDER_LABELS[character.gender]} · {character.country || character.regionName}
                    </p>
                    <p className="truncate font-mono text-slate-500" title={`Рынок ${formatMoney(marketValueOf(character))} · неделя ${character.acquiredWeek ?? '—'}`}>
                      Рынок {formatMoney(marketValueOf(character))} · нед. {character.acquiredWeek ?? '—'}
                      {character.pleasureStats && ` · доход ${formatMoney(character.pleasureStats.totalEarnings)}`}
                    </p>
                    {character.pleasureStats && <p className="truncate text-rose-300">ДУ · В {character.pleasureStats.vaginalCount} / А {character.pleasureStats.analCount}</p>}
                    {restPlacement && <p className="truncate text-sky-300">Отдых · {restPlacement.weeksRemaining} нед.</p>}
                    {stay && <p className="truncate text-pink-300">Больница · {getWardDefinition(stay.wardId)?.name ?? 'палата'} · {stay.weeksRemaining} нед.</p>}
                    {careSummary && <p className={`mt-1 line-clamp-2 rounded border px-1.5 py-1 ${careSummary.tone}`} title={careSummary.needs.join(' · ')}>{careSummary.status}: {careSummary.needs.join(' · ')}</p>}
                    {character.isSlave && character.gender === 'women' && character.pregnancy && (
                      <p className="mt-1 flex items-center gap-1 text-pink-300">
                        <HeartPulse aria-hidden="true" className="h-3 w-3 shrink-0" />
                        Беременность · {Math.round(character.pregnancy.daysPregnant / 7)}/{GESTATION_DAYS / 7} нед.
                      </p>
                    )}
                  </>
                )}
                actions={(
                  <div className="space-y-1.5">
                    <label className="sr-only" htmlFor={`venue-${character.id}`}>Место работы для {character.name}</label>
                    <select
                      id={`venue-${character.id}`}
                      value={character.assignedVenue || 'unassigned'}
                      onChange={event => onAssignVenue(character.id, event.target.value as NonNullable<Character['assignedVenue']>)}
                      className="min-h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-[10px] font-medium text-slate-200 focus:border-rose-400 focus:outline-2 focus:outline-rose-400"
                    >
                      {character.assignedVenue === 'trade' && <option value="trade">{VENUE_LABELS.trade}</option>}
                      <option value="beauty_salon">{VENUE_LABELS.beauty_salon}</option>
                      <option value="strip_club">{VENUE_LABELS.strip_club}</option>
                      <option value="pleasure_house">{VENUE_LABELS.pleasure_house}</option>
                      <option value="bdsm_room">{VENUE_LABELS.bdsm_room}</option>
                      <option value="auction_house">{VENUE_LABELS.auction_house}</option>
                      <option value="security">{VENUE_LABELS.security}</option>
                      <option value="unassigned">{VENUE_LABELS.unassigned}</option>
                    </select>
                    {character.isSlave && (
                      <div className="grid grid-cols-2 gap-1">
                        <button type="button" onClick={() => onBreakSlave(character.id)} className="min-h-7 rounded bg-purple-700/80 px-1 text-[9px] font-bold text-white transition hover:bg-purple-600 focus-visible:outline-2 focus-visible:outline-purple-300">Умиротворить</button>
                        <button type="button" onClick={() => onSellSlave(character)} disabled={listedAtAuction} className="min-h-7 rounded bg-rose-700/80 px-1 text-[9px] font-bold text-white transition hover:bg-rose-600 focus-visible:outline-2 focus-visible:outline-rose-300 disabled:cursor-not-allowed disabled:opacity-45">
                          {listedAtAuction ? 'На аукционе' : 'Продать'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              />
            );
          })}
        </div>
      )}

      <DependentsPanel dependents={gameState.dependents || []} />
      <span className="sr-only">
        {gameState.hospital.patients.filter(isTreatmentStay).length + gameState.hospital.patients.filter(isObservationStay).length} человек проходят лечение или наблюдение.
      </span>
    </div>
  );
}
