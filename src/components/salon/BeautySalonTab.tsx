import { useMemo, useState } from 'react';
import { ArrowUpDown, Scissors, Sparkles } from 'lucide-react';
import { calculateAttractiveness, type Character } from '../../gameEngine';
import { calculateVenueSynergies } from '../../synergyEngine';
import type { BeautySalonState, ScheduledTreatment } from '../../beautySalonEngine';
import { EXHAUSTION_UPGRADES } from '../../exhaustionEngine';
import { MANAGER_TRAITS, SALON_LEVELS, TREATMENTS } from '../../beautySalonEngine';
import type { ManagedCampaignState } from '../../saveState';
import type { RequestVenueId, VenueAdministratorRequest } from '../../administratorEngine';
import { marketValueOf } from '../../slaveContractsEngine';
import { PersonnelCard } from '../roster/PersonnelCard';
import { VenueAdministratorPanel } from '../venue/VenueAdministratorPanel';
import { VenueBanner, VenueToolbar, VENUE_APPEARANCES } from '../venue';
import { formatMoney } from '../../currency';
import {
  ROSTER_SORT_OPTIONS,
  rosterSortValue,
  sortRoster,
  type RosterSortId
} from '../../rosterSort';

interface BeautySalonTabProps {
  salon: BeautySalonState;
  funds: number;
  roster: Character[];
  exhaustionUpgrades: ManagedCampaignState['exhaustionUpgrades'];
  platform: Platform;
  /** Активный запрос администратора салона красоты. */
  administratorRequest: VenueAdministratorRequest | null;
  onAcceptRequest: (venue: RequestVenueId) => void;
  bookingCharacterId: string;
  bookingTreatmentId: string;
  bookingIsAuto: boolean;
  bookingInterval: number;
  onBookingCharacterChange: (value: string) => void;
  onBookingTreatmentChange: (value: string) => void;
  onBookingAutoChange: (value: boolean) => void;
  onBookingIntervalChange: (value: number) => void;
  onUpgradeSalon: () => void;
  onAssignManager: (traitId: string) => void;
  onUpgradeExhaustion: (venue: 'pleasure_house' | 'strip_club' | 'beauty_salon') => void;
  onScheduleTreatment: () => void;
  onAssignVenue: (charId: string, venue: NonNullable<Character['assignedVenue']>) => void;
  onBreakSlave: (charId: string) => void;
  onPreviewImage?: (imageUrl: string) => void;
}

const FIELD_CLASS = 'min-h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 focus:border-amber-400 focus:outline-2 focus:outline-amber-400';
const CONTROL_CLASS = 'min-h-8 rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 focus:border-rose-400 focus:outline-2 focus:outline-offset-1 focus:outline-rose-400';

const STATUS_LABELS: Record<ScheduledTreatment['status'], string> = {
  queued: 'В очереди',
  in_progress: 'В работе',
  completed: 'Завершена'
};

const STATUS_BADGE_CLASS: Record<ScheduledTreatment['status'], string> = {
  queued: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  in_progress: 'border-pink-500/30 bg-pink-500/10 text-pink-200',
  completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
};

const STATUS_ORDER: Record<ScheduledTreatment['status'], number> = {
  queued: 0,
  in_progress: 1,
  completed: 2
};

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

type StaffSortId = RosterSortId;
type StaffFilter = 'all' | 'on_floor' | 'unassigned' | 'other';

const STAFF_SORT_OPTIONS: { id: StaffSortId; label: string; descending: boolean }[] = ROSTER_SORT_OPTIONS;

const staffSortById = (id: StaffSortId) => STAFF_SORT_OPTIONS.find(option => option.id === id) ?? STAFF_SORT_OPTIONS[0];

const staffSortValue = (character: Character, mode: StaffSortId): number => rosterSortValue(character, mode);

const sortStaff = (roster: Character[], mode: StaffSortId, descending: boolean): Character[] =>
  sortRoster(roster, mode, descending, staffSortValue);

type QueueSortId = 'none' | 'week' | 'name' | 'treatment' | 'status';

const QUEUE_SORT_OPTIONS: { id: QueueSortId; label: string; descending: boolean }[] = [
  { id: 'none', label: 'Без сортировки', descending: false },
  { id: 'week', label: 'Неделя проведения', descending: false },
  { id: 'name', label: 'Имя оперативника', descending: false },
  { id: 'treatment', label: 'Процедура', descending: false },
  { id: 'status', label: 'Статус', descending: false }
];

const sortQueue = (treatments: ScheduledTreatment[], mode: QueueSortId, descending: boolean): ScheduledTreatment[] => {
  if (mode === 'none') return treatments;
  const direction = descending ? -1 : 1;
  const byCharacter = (first: ScheduledTreatment, second: ScheduledTreatment) => first.characterName.localeCompare(second.characterName, 'ru');
  switch (mode) {
    case 'week':
      return [...treatments].sort((first, second) => direction * (first.nextRunWeek - second.nextRunWeek) || byCharacter(first, second));
    case 'name':
      return [...treatments].sort((first, second) => direction * byCharacter(first, second));
    case 'treatment':
      return [...treatments].sort((first, second) => direction * first.treatmentName.localeCompare(second.treatmentName, 'ru') || byCharacter(first, second));
    case 'status':
      return [...treatments].sort((first, second) => direction * (STATUS_ORDER[first.status] - STATUS_ORDER[second.status]) || byCharacter(first, second));
    default:
      return treatments;
  }
};

export function BeautySalonTab({
  salon,
  funds,
  roster,
  exhaustionUpgrades,
  platform,
  administratorRequest,
  onAcceptRequest,
  bookingCharacterId,
  bookingTreatmentId,
  bookingIsAuto,
  bookingInterval,
  onBookingCharacterChange,
  onBookingTreatmentChange,
  onBookingAutoChange,
  onBookingIntervalChange,
  onUpgradeSalon,
  onAssignManager,
  onUpgradeExhaustion,
  onScheduleTreatment,
  onAssignVenue,
  onBreakSlave,
  onPreviewImage
}: BeautySalonTabProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ScheduledTreatment['status']>('all');
  const [sortId, setSortId] = useState<QueueSortId>('none');
  const [sortFlipped, setSortFlipped] = useState<Partial<Record<QueueSortId, boolean>>>({});
  const currentLevel = SALON_LEVELS.find(level => level.level === salon.level);
  const nextSalonLevel = SALON_LEVELS.find(level => level.level === salon.level + 1);
  const needle = query.trim().toLocaleLowerCase('ru');
  const descending = sortFlipped[sortId] ?? QUEUE_SORT_OPTIONS.find(option => option.id === sortId)?.descending ?? false;

  const visibleTreatments = useMemo(() => {
    const filtered = salon.scheduledTreatments.filter(treatment => {
      if (statusFilter !== 'all' && treatment.status !== statusFilter) return false;
      if (!needle) return true;
      return [treatment.characterName, treatment.treatmentName]
        .some(value => value.toLocaleLowerCase('ru').includes(needle));
    });
    return sortQueue(filtered, sortId, descending);
  }, [needle, salon.scheduledTreatments, statusFilter, sortId, descending]);

  const resetFilters = () => {
    setQuery('');
    setStatusFilter('all');
  };
  const filtersActive = query.trim() !== '' || statusFilter !== 'all';
  const toggleDirection = () => setSortFlipped(previous => ({ ...previous, [sortId]: !descending }));

  // Состав салона: пленники, которых можно назначить на площадку.
  // Дом удовольствия и стрип-клуб — взаимоисключающие площадки, их
  // работники в списке салона не отображаются.
  const stylists = useMemo(
    () => roster.filter(character => character.isSlave && character.assignedVenue !== 'pleasure_house' && character.assignedVenue !== 'strip_club'),
    [roster]
  );
  const [staffQuery, setStaffQuery] = useState('');
  const [staffFilter, setStaffFilter] = useState<StaffFilter>('all');
  const [staffSortId, setStaffSortId] = useState<StaffSortId>('none');
  const [staffSortFlipped, setStaffSortFlipped] = useState<Partial<Record<StaffSortId, boolean>>>({});
  const staffDescending = staffSortFlipped[staffSortId] ?? staffSortById(staffSortId).descending;
  const sortedStylists = useMemo(() => sortStaff(stylists, staffSortId, staffDescending), [stylists, staffDescending, staffSortId]);
  const staffNeedle = staffQuery.trim().toLocaleLowerCase('ru');
  const visibleStylists = sortedStylists.filter(character => {
    const unassigned = !character.assignedVenue || character.assignedVenue === 'unassigned';
    if (staffFilter === 'on_floor' && character.assignedVenue !== 'beauty_salon') return false;
    if (staffFilter === 'unassigned' && !unassigned) return false;
    if (staffFilter === 'other' && (unassigned || character.assignedVenue === 'beauty_salon')) return false;
    if (!staffNeedle) return true;
    return [character.name, character.role, character.country, character.regionName]
      .some(value => value?.toLocaleLowerCase('ru').includes(staffNeedle));
  });

  const venueSynergies = useMemo(() => calculateVenueSynergies(roster.filter(c => c.assignedVenue === 'beauty_salon')), [roster]);
  const idleStylistCount = stylists.filter(character => !character.assignedVenue || character.assignedVenue === 'unassigned').length;
  const onFloorCount = stylists.filter(character => character.assignedVenue === 'beauty_salon').length;
  const staffFiltersActive = staffQuery.trim() !== '' || staffFilter !== 'all' || staffSortId !== 'none';
  const resetStaffControls = () => {
    setStaffQuery('');
    setStaffFilter('all');
    setStaffSortId('none');
    setStaffSortFlipped({});
  };
  const toggleStaffDirection = () => setStaffSortFlipped(previous => ({ ...previous, [staffSortId]: !staffDescending }));

  return (
    <div className="space-y-3">
       <VenueBanner
         title={getTerm('beauty_salon', platform)}
         description="Состав мастеров, назначения пленников, уход и расписание процедур — работники салона приносят выручку каждую неделю."
         imageSrc={VENUE_APPEARANCES.beautySalon.imageSrc}
         imageAlt={VENUE_APPEARANCES.beautySalon.imageAlt}
         accentClassName="text-rose-300"
         summary={(
           <>
             <span>Уровень <strong className="font-mono text-amber-300">{salon.level}</strong>{currentLevel ? ` · ${currentLevel.name}` : ''}</span>
             <span>Мастеров <strong className="font-mono text-slate-100">{stylists.length}</strong></span>
             <span>В салоне <strong className="font-mono text-rose-300">{onFloorCount}</strong></span>
             <span>Без работы <strong className="font-mono text-amber-300">{idleStylistCount}</strong></span>
             <span>Расходники <strong className="font-mono text-pink-300">{salon.supplies}</strong></span>
             <span>Места <strong className="font-mono text-slate-100">{currentLevel?.workstations ?? 0}</strong></span>
             <span>Выручка <strong className="font-mono text-emerald-300">{formatMoney(salon.totalRevenue)}</strong></span>
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
        venue="beauty_salon"
        request={administratorRequest}
        funds={funds}
        onAccept={onAcceptRequest}
      />

      <details className="group rounded-lg border border-slate-800 bg-slate-900/80">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-slate-300 focus-visible:outline-2 focus-visible:outline-rose-400">
          <span>Управление и улучшения салона</span>
          <span className="text-[10px] font-normal text-slate-500">Открыть / свернуть</span>
        </summary>
        <div className="grid grid-cols-1 gap-2 border-t border-slate-800 p-2 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-md border border-slate-800 bg-slate-950 p-3">
            <h2 className="text-xs font-semibold text-white">Управление заведением</h2>
            <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500" title={currentLevel?.name}>{currentLevel?.name ?? '—'}</p>
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-400">
              <span>Уровень <strong className="font-mono text-amber-300">{salon.level}/{SALON_LEVELS.length}</strong></span>
              <span className="truncate">{currentLevel?.workstations ?? 0} мест · запасы {currentLevel?.supplyCapacity ?? 0}</span>
            </div>
            <div className="mt-1 flex gap-1" aria-label={`Уровень салона: ${salon.level} из ${SALON_LEVELS.length}`}>
              {Array.from({ length: SALON_LEVELS.length }, (_, index) => (
                <span key={index} className={`h-1 flex-1 rounded-full ${index < salon.level ? 'bg-rose-500' : 'bg-slate-800'}`} />
              ))}
            </div>
            <button
              type="button"
              onClick={onUpgradeSalon}
              disabled={!nextSalonLevel || funds < nextSalonLevel.upgradeCost}
              className="mt-2 min-h-8 w-full rounded-md bg-rose-700 px-2 text-[11px] font-bold text-white transition hover:bg-rose-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {nextSalonLevel ? `Улучшить · ${formatMoney(nextSalonLevel.upgradeCost)}` : 'Максимальный уровень'}
            </button>
            <label htmlFor="salon-manager" className="mt-3 block text-[10px] font-semibold uppercase text-slate-400">Управляющий салоном</label>
            <select id="salon-manager" value={salon.managerTraitId || ''} onChange={event => onAssignManager(event.target.value)} className={`${FIELD_CLASS} mt-1 min-h-8 text-xs`}>
              <option value="">Без управляющего</option>
              {MANAGER_TRAITS.map(trait => <option key={trait.id} value={trait.id}>{trait.name} — {trait.effectDescription}</option>)}
            </select>
          </article>

          {(['pleasure_house', 'strip_club', 'beauty_salon'] as const).map(venue => {
            const upgrade = EXHAUSTION_UPGRADES[venue];
            const level = exhaustionUpgrades[venue];
            const nextLevel = level + 1;
            const canUpgrade = nextLevel <= upgrade.maxLevel;
            const nextCost = canUpgrade ? upgrade.costs[nextLevel] : 0;
            const segments = Math.min(upgrade.maxLevel, 12);
            return (
              <article key={venue} className="rounded-md border border-slate-800 bg-slate-950 p-3">
                <h2 className="text-xs font-semibold text-white">Оздоровление · {upgrade.venueName}</h2>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500">Восстановление усталости персонала</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                  <span>Уровень <strong className="font-mono text-amber-300">{level}/{upgrade.maxLevel}</strong></span>
                  <span className="truncate">{upgrade.effectDescriptions[level]}</span>
                </div>
                <div className="mt-1 flex gap-1" aria-label={`Оздоровление «${upgrade.venueName}»: уровень ${level} из ${upgrade.maxLevel}`}>
                  {Array.from({ length: segments }, (_, index) => (
                    <span key={index} className={`h-1 flex-1 rounded-full ${index < level ? 'bg-rose-500' : 'bg-slate-800'}`} />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => onUpgradeExhaustion(venue)}
                  disabled={!canUpgrade || funds < nextCost}
                  className="mt-2 min-h-8 w-full rounded-md bg-rose-700 px-2 text-[11px] font-bold text-white transition hover:bg-rose-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {canUpgrade ? `Улучшить · ${formatMoney(nextCost)}` : 'Максимальный уровень'}
                </button>
              </article>
            );
          })}
        </div>
      </details>

      <section aria-label="Состав салона" className="space-y-2">
        <VenueToolbar
          query={staffQuery}
          onQueryChange={setStaffQuery}
          searchLabel="Поиск по мастерам салона"
          placeholder="Поиск по имени, роли, стране или региону…"
          summary={<span>Показано <strong className="font-mono text-slate-200">{visibleStylists.length}/{stylists.length}</strong> мастеров</span>}
          onReset={resetStaffControls}
          hasActiveFilters={staffFiltersActive}
        >
          <label className="sr-only" htmlFor="salon-staff-filter">Фильтр по назначению</label>
          <select id="salon-staff-filter" value={staffFilter} onChange={event => setStaffFilter(event.target.value as StaffFilter)} className={CONTROL_CLASS}>
            <option value="all">Все назначения</option>
            <option value="on_floor">В салоне</option>
            <option value="unassigned">Без работы</option>
            <option value="other">Другие площадки</option>
          </select>
          <label className="sr-only" htmlFor="salon-staff-sort">Сортировка мастеров</label>
          <select id="salon-staff-sort" value={staffSortId} onChange={event => setStaffSortId(event.target.value as StaffSortId)} className={CONTROL_CLASS}>
            {STAFF_SORT_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <button
            type="button"
            onClick={toggleStaffDirection}
            disabled={staffSortId === 'none'}
            aria-label="Сменить направление сортировки"
            className={`${CONTROL_CLASS} inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-rose-300" />
            {staffDescending ? 'По убыванию' : 'По возрастанию'}
          </button>
        </VenueToolbar>

          {visibleStylists.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/70 px-4 py-10 text-center text-sm text-slate-400">
              {stylists.length === 0 ? `Мастеров в салоне пока нет. Назначьте ${getTerm('prisoner', platform).toLowerCase()} на площадку «${getTerm('beauty_salon', platform)}».` : 'Нет результатов по выбранному поиску или фильтрам.'}
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
            {visibleStylists.map(character => {
              const assigned = character.assignedVenue === 'beauty_salon';
              return (
                 <PersonnelCard
                   key={character.id}
                   character={character}
                   platform={platform}
                   accentClassName={assigned ? 'border-l-2 border-l-rose-500/80' : 'border-l-2 border-l-amber-500/60'}
                   onPreviewImage={onPreviewImage}
                   badges={(
                    <span className={`rounded border px-1 py-0.5 text-[8px] font-bold ${assigned ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
                      {assigned ? 'В САЛОНЕ' : 'БЕЗ РАБОТЫ'}
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
                      <label className="sr-only" htmlFor={`salon-venue-${character.id}`}>Место работы для {character.name}</label>
                      <select
                        id={`salon-venue-${character.id}`}
                        value={character.assignedVenue || 'unassigned'}
                        onChange={event => onAssignVenue(character.id, event.target.value as NonNullable<Character['assignedVenue']>)}
                        className="min-h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-[10px] font-medium text-slate-200 focus:border-rose-400 focus:outline-2 focus:outline-rose-400"
                      >
                        {character.assignedVenue === 'trade' && <option value="trade">{VENUE_LABELS.trade}</option>}
                        <option value="beauty_salon">{VENUE_LABELS.beauty_salon}</option>
                        <option value="strip_club">{VENUE_LABELS.strip_club}</option>
                        <option value="pleasure_house">{VENUE_LABELS.pleasure_house}</option>
                        <option value="auction_house">{VENUE_LABELS.auction_house}</option>
                        <option value="security">{VENUE_LABELS.security}</option>
                        <option value="unassigned">{VENUE_LABELS.unassigned}</option>
                      </select>
                      <button type="button" onClick={() => onBreakSlave(character.id)} className="min-h-7 w-full rounded bg-purple-700/80 px-2 text-[10px] font-bold text-white transition hover:bg-purple-600 focus-visible:outline-2 focus-visible:outline-purple-300">Умиртонить</button>
                    </div>
                  )}
                />
              );
            })}
          </div>
        )}

         <p className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-[10px] leading-relaxed text-slate-500">
           ${getTerm('prisoner', platform).charAt(0).toUpperCase() + getTerm('prisoner', platform).slice(1)}, назначенные в дом удовольствия или стрип-клуб, в списке салона не отображаются. Мастера салона работают каждую неделю и приносят выручку; усталость и здоровье меняются по общим правилам смены.
         </p>
      </section>

      <form className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-3 text-left" onSubmit={event => { event.preventDefault(); onScheduleTreatment(); }}>
        <div>
          <h2 className="text-sm font-bold text-white">Запись на процедуру</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">Выберите участника ростера и процедуру; стоимость и списание остаются в игровой логике.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="salon-character" className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Целевой оперативник</label>
            <select id="salon-character" value={bookingCharacterId} onChange={event => onBookingCharacterChange(event.target.value)} className={FIELD_CLASS}>
              {roster.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="salon-treatment" className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Тип процедуры</label>
            <select id="salon-treatment" value={bookingTreatmentId} onChange={event => onBookingTreatmentChange(event.target.value)} className={FIELD_CLASS}>
              {TREATMENTS.map(treatment => <option key={treatment.id} value={treatment.id}>{treatment.name} · {formatMoney(treatment.baseCost)}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-h-10 items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" id="salon-auto-repeat" checked={bookingIsAuto} onChange={event => onBookingAutoChange(event.target.checked)} className="h-4 w-4 rounded border-slate-600 bg-slate-950 accent-pink-500 focus-visible:outline-2 focus-visible:outline-pink-400" />
            Автоматическое повторение по расписанию
          </label>
          {bookingIsAuto && (
            <div>
              <label htmlFor="salon-interval" className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Интервал (недели)</label>
              <input type="number" min={1} id="salon-interval" value={bookingInterval} onChange={event => onBookingIntervalChange(Number(event.target.value))} className={`${FIELD_CLASS} w-28 font-mono`} />
            </div>
          )}
          <button type="submit" disabled={roster.length === 0} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-pink-700 px-3 text-xs font-bold text-white transition hover:bg-pink-600 focus-visible:outline-2 focus-visible:outline-pink-300 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none">
            <Scissors aria-hidden="true" className="h-4 w-4" /> Запланировать процедуру
          </button>
        </div>
      </form>

      <VenueToolbar
        query={query}
        onQueryChange={setQuery}
        searchLabel="Поиск по расписанию процедур"
        placeholder="Поиск по имени или процедуре…"
        summary={<span>Показано <strong className="font-mono text-slate-200">{visibleTreatments.length}/{salon.scheduledTreatments.length}</strong> процедур</span>}
        hasActiveFilters={filtersActive}
        onReset={resetFilters}
      >
        <label className="sr-only" htmlFor="salon-status-filter">Фильтр по статусу</label>
        <select id="salon-status-filter" value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | ScheduledTreatment['status'])} className={CONTROL_CLASS}>
          <option value="all">Все статусы</option>
          <option value="queued">В очереди</option>
          <option value="in_progress">В работе</option>
          <option value="completed">Завершена</option>
        </select>
        <label className="sr-only" htmlFor="salon-queue-sort">Сортировка очереди</label>
        <select id="salon-queue-sort" value={sortId} onChange={event => setSortId(event.target.value as QueueSortId)} className={CONTROL_CLASS}>
          {QUEUE_SORT_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <button
          type="button"
          onClick={toggleDirection}
          disabled={sortId === 'none'}
          aria-label="Сменить направление сортировки"
          className={`${CONTROL_CLASS} inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-rose-300" />
          {descending ? 'По убыванию' : 'По возрастанию'}
        </button>
      </VenueToolbar>

      {visibleTreatments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/70 px-4 py-10 text-center text-sm text-slate-400">
          {salon.scheduledTreatments.length === 0 ? 'В очереди салона пока нет запланированных процедур.' : 'Нет результатов по выбранному поиску или фильтрам.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {visibleTreatments.map(treatment => {
            const treatmentType = TREATMENTS.find(type => type.id === treatment.treatmentId);
            return (
              <article key={treatment.id} className="flex min-w-0 gap-2 rounded-lg border border-slate-700 bg-slate-950 p-2 text-left transition hover:border-slate-500">
                <div className="relative flex h-32 w-20 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900 sm:h-36 sm:w-24">
                  <Scissors aria-hidden="true" className="h-6 w-6 text-amber-300" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex min-w-0 items-start justify-between gap-1">
                    <div className="min-w-0">
                      <h3 className="truncate text-xs font-semibold text-slate-100" title={treatment.treatmentName}>{treatment.treatmentName}</h3>
                      <p className="truncate text-[10px] italic text-slate-400" title={treatment.characterName}>Оперативник: {treatment.characterName}</p>
                    </div>
                    <span className={`shrink-0 rounded border px-1 py-0.5 text-[8px] font-bold ${STATUS_BADGE_CLASS[treatment.status]}`}>{STATUS_LABELS[treatment.status]}</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-x-1.5 gap-y-1 border-y border-slate-800 py-1.5">
                    <div className="min-w-0 text-center">
                      <dt className="truncate text-[9px] leading-3 text-slate-500">Стоимость</dt>
                      <dd className="truncate font-mono text-[11px] leading-4 text-slate-200">{treatmentType?.baseCost != null ? formatMoney(treatmentType.baseCost) : '—'}</dd>
                    </div>
                    <div className="min-w-0 text-center">
                      <dt className="truncate text-[9px] leading-3 text-slate-500">Время</dt>
                      <dd className="truncate font-mono text-[11px] leading-4 text-slate-200">{treatmentType?.timeHours ?? '—'} ч</dd>
                    </div>
                    <div className="min-w-0 text-center">
                      <dt className="truncate text-[9px] leading-3 text-slate-500">Расходники</dt>
                      <dd className="truncate font-mono text-[11px] leading-4 text-slate-200">{treatmentType?.suppliesConsumed ?? '—'}</dd>
                    </div>
                  </dl>
                  <p className="mt-1.5 truncate text-[10px] leading-relaxed text-slate-400" title={`Неделя ${treatment.nextRunWeek}${treatment.isAutomatic ? ` · повтор каждые ${treatment.intervalWeeks} нед.` : ' · разовая запись'}`}>
                    Неделя {treatment.nextRunWeek}{treatment.isAutomatic ? ` · повтор каждые ${treatment.intervalWeeks} нед.` : ' · разовая запись'}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
