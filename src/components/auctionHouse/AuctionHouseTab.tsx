import { useMemo, useState } from 'react';
import { formatMoney } from '../../currency';
import { ArrowRight, ArrowUpDown, Package, PackageCheck, SearchCheck, Trash2, Truck, User, Users } from 'lucide-react';
import type { AuctionLot, AuctionSale, AuctionCharacterLot, LotInspection, SaleConsentRequest } from '../../auctionHouseEngine';
import { AUCTION_INSPECTION_BALANCE, DEFAULT_AUCTIONEER_PERSONA, countCounterfeitLots, getLotNpcInterest, NPC_AUCTION_BIDDERS, quoteAuctionLot } from '../../auctionHouseEngine';
import type { Character } from '../../gameEngine';
import { calculateAttractiveness } from '../../gameEngine';
import type { Employee } from '../../expansionTypes';
import type { RequestVenueId, VenueAdministratorRequest } from '../../administratorEngine';
import { marketValueOf } from '../../slaveContractsEngine';
import { isOnCaptureOp } from '../../captureOpsEngine';
import { PersonnelCard } from '../roster/PersonnelCard';
import { Portrait3D } from '../Portrait3D';
import { VenueAdministratorPanel } from '../venue/VenueAdministratorPanel';
import { VenueBanner, VenueToolbar, VENUE_APPEARANCES } from '../venue';

const inspectionBadge = (inspection?: LotInspection) => {
  if (!inspection) return null;
  const styles: Record<string, string> = {
    counterfeit: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
    suspicious: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    genuine: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    unknown: 'border-slate-600 bg-slate-800/60 text-slate-300'
  };
  const labels: Record<string, string> = { counterfeit: 'ПОДДЕЛКА', suspicious: 'ПОДОЗРИТЕЛЬНО', genuine: 'ПОДЛИННИК', unknown: 'НЕТ ДАННЫХ' };
  return <span className={`rounded border px-1 py-0.5 text-[8px] font-bold ${styles[inspection.verdict]}`}>{labels[inspection.verdict]}</span>;
};

export type AuctionLotSortField = 'productName' | 'category' | 'gender' | 'source' | 'arrivalWeek' | 'appraisedValue' | 'auctioneerBonusPercent' | 'npcInterest' | 'saleProceeds';

interface AuctionHouseTabProps {
  week: number;
  funds: number;
  pendingLots: AuctionLot[];
  recentSales: AuctionSale[];
  inspections?: LotInspection[];
  auctioneer: Employee | null;
  appraiser: Employee | null;
  auctioneerSaleBonus: number;
  /** Активный запрос администратора аукционного дома. */
  administratorRequest: VenueAdministratorRequest | null;
  inspectWeek?: number;
  inspectChargesUsed?: number;
  onAcceptRequest: (venue: RequestVenueId) => void;
  onSellLot: (lotId: string) => void;
  /** Запросы администратора на продажу персонала, ожидающие согласия игрока. */
  saleConsents: SaleConsentRequest[];
  onConfirmSale: (lotId: string) => void;
  onCancelSaleConsent: (lotId: string) => void;
  onInspectLot?: (lotId: string) => void;
  onSellJunkyard?: () => void;
  onOpenCaravans: () => void;
  pleasureHouseCharacters: Character[];
  onAddCharacterLot: (char: Character) => void;
  onPreviewImage?: (imageUrl: string) => void;
}

const money = (value: number) => formatMoney(value);

const isCharacterLot = (lot: AuctionLot): lot is AuctionCharacterLot => 'characterId' in lot;

const npcInterestFor = (lot: AuctionLot): number => getLotNpcInterest(lot).length;

const lotSourceLabel = (lot: AuctionLot): string => (isCharacterLot(lot) ? 'Дом удовольствия' : lot.caravanName);

const GENDER_LABELS: Record<AuctionCharacterLot['gender'], string> = {
  women: 'Женщина',
  men: 'Мужчина',
  trans: 'Трансгендер'
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

const GENDER_SORT_ORDER: AuctionCharacterLot['gender'][] = ['women', 'men', 'trans'];

const genderSortRank = (lot: AuctionLot): number =>
  isCharacterLot(lot) ? GENDER_SORT_ORDER.indexOf(lot.gender) : GENDER_SORT_ORDER.length;

const sortLotValue = (lot: AuctionLot, auctioneer: Employee | null, auctioneerSaleBonus: number, field: AuctionLotSortField): number | string => {
  const quote = quoteAuctionLot(lot, auctioneer, auctioneerSaleBonus);
  switch (field) {
    case 'productName': return lot.productName;
    case 'category': return lot.category;
    case 'gender': return genderSortRank(lot);
    case 'source': return lotSourceLabel(lot);
    case 'arrivalWeek': return 'arrivalWeek' in lot ? lot.arrivalWeek : 0;
    case 'appraisedValue': return quote.appraisedValue;
    case 'auctioneerBonusPercent': return quote.auctioneerBonusPercent;
    case 'npcInterest': return npcInterestFor(lot);
    case 'saleProceeds': return quote.saleProceeds;
    default: return 0;
  }
};

function sortAuctionLots(
  lots: AuctionLot[],
  field: AuctionLotSortField,
  descending: boolean,
  auctioneer: Employee | null = null,
  auctioneerSaleBonus = 0
): AuctionLot[] {
  const direction = descending ? -1 : 1;
  return [...lots].sort((a, b) => {
    const va = sortLotValue(a, auctioneer, auctioneerSaleBonus, field);
    const vb = sortLotValue(b, auctioneer, auctioneerSaleBonus, field);
    if (typeof va === 'string' && typeof vb === 'string') {
      return direction * va.localeCompare(vb, 'ru');
    }
    return direction * ((va as number) - (vb as number)) || direction * a.productName.localeCompare(b.productName, 'ru');
  });
}

const SORT_FIELD_LABELS: Record<AuctionLotSortField, string> = {
  productName: 'Лот',
  category: 'Категория',
  gender: 'Пол',
  source: 'Источник',
  arrivalWeek: 'Неделя поступления',
  appraisedValue: 'Оценка',
  auctioneerBonusPercent: 'Бонус аукциониста',
  npcInterest: 'Покупатели',
  saleProceeds: 'Выручка'
};

export type StaffSortField = 'name' | 'category' | 'gender' | 'price';

const STAFF_GENDER_SORT_ORDER: Character['gender'][] = ['women', 'men', 'trans'];

const staffGenderSortRank = (gender: Character['gender']): number => {
  const index = STAFF_GENDER_SORT_ORDER.indexOf(gender);
  return index === -1 ? STAFF_GENDER_SORT_ORDER.length : index;
};

const sortStaffValue = (char: Character, field: StaffSortField): number | string => {
  switch (field) {
    case 'name': return char.name;
    case 'category': return char.isSlave ? 'Раб' : 'Сотрудник';
    case 'gender': return staffGenderSortRank(char.gender);
    case 'price': return char.price;
    default: return 0;
  }
};

function sortStaffCharacters(
  characters: Character[],
  field: StaffSortField,
  descending: boolean
): Character[] {
  const direction = descending ? -1 : 1;
  return [...characters].sort((a, b) => {
    const va = sortStaffValue(a, field);
    const vb = sortStaffValue(b, field);
    if (typeof va === 'string' && typeof vb === 'string') {
      const cmp = va.localeCompare(vb, 'ru');
      if (cmp !== 0) return direction * cmp;
      return direction * a.name.localeCompare(b.name, 'ru');
    }
    return direction * ((va as number) - (vb as number)) || direction * a.name.localeCompare(b.name, 'ru');
  });
}

const STAFF_SORT_FIELD_LABELS: Record<StaffSortField, string> = {
  name: 'Имя',
  category: 'Категория',
  gender: 'Пол',
  price: 'Оценка рынком'
};

type LotTypeFilter = 'all' | 'goods' | 'characters';

const LOT_TYPE_FILTER_LABELS: Record<LotTypeFilter, string> = {
  all: 'Все лоты',
  goods: 'Товарные',
  characters: 'Персонал'
};

const CONTROL_CLASS = 'min-h-8 rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 focus:border-amber-400 focus:outline-2 focus:outline-offset-1 focus:outline-amber-400';

const AUCTIONEER_BONUS_SEGMENTS = 3;

const auctioneerBonusSegments = (bonus: number): number => Math.min(AUCTIONEER_BONUS_SEGMENTS, Math.max(0, Math.floor(bonus / 5)));

const goodsBidderCount = NPC_AUCTION_BIDDERS.filter(bidder => bidder.interest === 'goods' || bidder.interest === 'all').length;
const characterBidderCount = NPC_AUCTION_BIDDERS.filter(bidder => bidder.interest === 'characters' || bidder.interest === 'all').length;

export function AuctionHouseTab({
  week,
  funds,
  pendingLots,
  recentSales,
  inspections = [],
  auctioneer,
  appraiser,
  auctioneerSaleBonus,
  administratorRequest,
  inspectWeek = 1,
  inspectChargesUsed = 0,
  onAcceptRequest,
  onSellLot,
  saleConsents,
  onConfirmSale,
  onCancelSaleConsent,
  onInspectLot,
  onSellJunkyard,
  onOpenCaravans,
  pleasureHouseCharacters,
  onAddCharacterLot,
  onPreviewImage
}: AuctionHouseTabProps) {
  const totalAppraisal = pendingLots.reduce((sum, lot) => sum + lot.appraisedValue, 0);
  const totalExpected = pendingLots.reduce(
    (sum, lot) => sum + quoteAuctionLot(lot, auctioneer, auctioneerSaleBonus).saleProceeds,
    0
  );
  const totalNpcInterest = new Set(pendingLots.flatMap(lot => getLotNpcInterest(lot))).size;
  void totalNpcInterest;
  const persona = DEFAULT_AUCTIONEER_PERSONA;
  const freeInspectLeft = appraiser
    ? '∞'
    : Math.max(0, AUCTION_INSPECTION_BALANCE.freeChargesPerWeek - (inspectWeek === week ? inspectChargesUsed : 0));
  const counterfeitCount = countCounterfeitLots({ pendingLots, recentSales, pendingSaleConsents: saleConsents, inspections, inspectWeek, inspectChargesUsed });
  const inspectionByLot = useMemo(() => new Map(inspections.map(entry => [entry.lotId, entry])), [inspections]);

  const characterById = useMemo(
    () => new Map(pleasureHouseCharacters.map(char => [char.id, char])),
    [pleasureHouseCharacters]
  );

  const [query, setQuery] = useState('');
  const [lotTypeFilter, setLotTypeFilter] = useState<LotTypeFilter>('all');
  const [sortField, setSortField] = useState<AuctionLotSortField>('saleProceeds');
  const [sortDescending, setSortDescending] = useState(true);

  const sortedLots = sortAuctionLots(pendingLots, sortField, sortDescending, auctioneer, auctioneerSaleBonus);

  const needle = query.trim().toLocaleLowerCase('ru');
  const visibleLots = sortedLots.filter(lot => {
    if (lotTypeFilter === 'goods' && isCharacterLot(lot)) return false;
    if (lotTypeFilter === 'characters' && !isCharacterLot(lot)) return false;
    if (!needle) return true;
    return [lot.productName, lot.category, lotSourceLabel(lot), lot.appraisedBy]
      .some(value => value?.toLocaleLowerCase('ru').includes(needle));
  });

  const filtersActive = query.trim() !== '' || lotTypeFilter !== 'all';
  const resetFilters = () => {
    setQuery('');
    setLotTypeFilter('all');
  };

  const [staffQuery, setStaffQuery] = useState('');
  const [staffSortField, setStaffSortField] = useState<StaffSortField>('gender');
  const [staffSortDescending, setStaffSortDescending] = useState(false);
  const sortedStaff = sortStaffCharacters(pleasureHouseCharacters, staffSortField, staffSortDescending);

  const staffNeedle = staffQuery.trim().toLocaleLowerCase('ru');
  const visibleStaff = sortedStaff.filter(char => {
    if (!staffNeedle) return true;
    return [char.name, char.role, char.country, char.regionName]
      .some(value => value?.toLocaleLowerCase('ru').includes(staffNeedle));
  });

  const staffFiltersActive = staffQuery.trim() !== '';
  const resetStaffFilters = () => setStaffQuery('');

  return (
    <div className="space-y-3">
      <VenueBanner
        title="Аукционный дом"
        description={`Торговая площадка синдиката. Ведущая: ${persona.name}, ${persona.tagline} Осмотр: ${String(freeInspectLeft)} ${appraiser ? '' : `бесплатн. (лимит ${AUCTION_INSPECTION_BALANCE.freeChargesPerWeek}/нед.)`}`}
        imageSrc={VENUE_APPEARANCES.auctionHouse.imageSrc}
        imageAlt={VENUE_APPEARANCES.auctionHouse.imageAlt}
        accentClassName="text-amber-300"
        summary={(
          <>
            <span>Лотов <strong className="font-mono text-slate-100">{pendingLots.length}</strong></span>
            <span>Оценка <strong className="font-mono text-amber-300">{money(totalAppraisal)}</strong></span>
            <span>Выручка <strong className="font-mono text-emerald-300">{money(totalExpected)}</strong></span>
            <span>
              {persona.name}{' '}
              <strong className={auctioneer ? 'text-slate-100' : 'text-slate-400'}>
                {auctioneer ? `${auctioneer.name} · +${auctioneerSaleBonus}%` : 'без бонуса'}
              </strong>
            </span>
            <span>Осмотр <strong className="font-mono text-cyan-300">{String(freeInspectLeft)}</strong></span>
            <span className="font-mono text-slate-500">Неделя {week}</span>
          </>
        )}
      />

      {counterfeitCount >= AUCTION_INSPECTION_BALANCE.junkyardUnlockCount && onSellJunkyard && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
          <p className="text-xs text-rose-100"><Trash2 className="mr-1 inline h-4 w-4" />Свалка доступна: найдено {counterfeitCount} подозрительных/поддельных лотов. Оптовая продажа — ~{Math.round(AUCTION_INSPECTION_BALANCE.junkyardBulkRate * 100)}% от оценки, без скандала.</p>
          <button type="button" onClick={onSellJunkyard} className="min-h-8 rounded-md border border-rose-400/60 bg-slate-950 px-3 text-xs font-bold text-rose-100 hover:bg-rose-500/20">Продать оптом на свалке</button>
        </div>
      )}

      <VenueAdministratorPanel
        venue="auction_house"
        request={administratorRequest}
        funds={funds}
        onAccept={onAcceptRequest}
      />

      <details className="group rounded-lg border border-slate-800 bg-slate-900/80">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-slate-300 focus-visible:outline-2 focus-visible:outline-amber-400">
          <span>Персонал и условия аукционного дома</span>
          <span className="text-[10px] font-normal text-slate-500">Открыть / свернуть</span>
        </summary>
        <div className="grid grid-cols-1 gap-2 border-t border-slate-800 p-2 sm:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-md border border-slate-800 bg-slate-950 p-3">
            <h2 className="text-xs font-semibold text-white">{auctioneer ? auctioneer.name : 'Аукционист не назначен'}</h2>
            <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500" title="Повышает выручку каждого лота на торгах">Повышает выручку каждого лота на торгах</p>
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-400">
              <span>Бонус <strong className="font-mono text-amber-300">+{auctioneerSaleBonus}%</strong></span>
              <span className="truncate">{auctioneer ? `Навык ${auctioneer.skill} · ${formatMoney(auctioneer.weeklyWage)}/нед.` : 'Пост в «Отделе кадров»'}</span>
            </div>
            <div className="mt-1 flex gap-1" aria-label={`Бонус аукциониста: ${auctioneerBonusSegments(auctioneerSaleBonus)} из ${AUCTIONEER_BONUS_SEGMENTS}`}>
              {Array.from({ length: AUCTIONEER_BONUS_SEGMENTS }, (_, index) => (
                <span key={index} className={`h-1 flex-1 rounded-full ${index < auctioneerBonusSegments(auctioneerSaleBonus) ? 'bg-amber-500' : 'bg-slate-800'}`} />
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              {auctioneer ? 'Аукционист активен и работает на каждой продаже.' : 'Назначьте аукциониста, чтобы поднять выручку лотов до +15%.'}
            </p>
          </article>

          <article className="rounded-md border border-slate-800 bg-slate-950 p-3">
            <h2 className="text-xs font-semibold text-white">{appraiser ? appraiser.name : 'Автоматическая система оценки'}</h2>
            <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500" title="Фиксирует оценку каждого лота при поступлении">Фиксирует оценку каждого лота при поступлении</p>
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-400">
              <span>Статус <strong className={appraiser ? 'text-emerald-300' : 'text-slate-400'}>{appraiser ? 'Активен' : 'Автомат'}</strong></span>
              <span className="truncate">{appraiser ? `Навык ${appraiser.skill} · ${formatMoney(appraiser.weeklyWage)}/нед.` : 'Оценка при прибытии каравана'}</span>
            </div>
            <div className="mt-1 flex gap-1" aria-label={`Оценщик назначен: ${appraiser ? 'да' : 'нет'}`}>
              {Array.from({ length: 1 }, (_, index) => (
                <span key={index} className={`h-1 flex-1 rounded-full ${appraiser ? 'bg-amber-500' : 'bg-slate-800'}`} />
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              Оценка задаётся при поступлении лота и не пересчитывается до продажи.
            </p>
          </article>

          <article className="rounded-md border border-slate-800 bg-slate-950 p-3">
            <h2 className="text-xs font-semibold text-white">NPC-покупатели</h2>
            <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500" title="Торговые дома и коллекционеры перебивают цену на торгах">Торговые дома и коллекционеры перебивают цену</p>
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-400">
              <span>В деле <strong className="font-mono text-cyan-300">{totalNpcInterest}</strong></span>
              <span className="truncate">Товары {goodsBidderCount} · Персонал {characterBidderCount}</span>
            </div>
            <div className="mt-1 flex gap-1" aria-label={`Покупателей в деле: ${totalNpcInterest} из ${NPC_AUCTION_BIDDERS.length}`}>
              {Array.from({ length: NPC_AUCTION_BIDDERS.length }, (_, index) => (
                <span key={index} className={`h-1 flex-1 rounded-full ${index < totalNpcInterest ? 'bg-cyan-500' : 'bg-slate-800'}`} />
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              Участие покупателей зависит от уровня здания и репутации синдиката.
            </p>
          </article>
        </div>
      </details>

      <VenueToolbar
        query={query}
        onQueryChange={setQuery}
        searchLabel="Поиск по лотам"
        placeholder="Поиск по лоту, категории или каравану…"
        summary={<span>Показано <strong className="font-mono text-slate-200">{visibleLots.length}/{pendingLots.length}</strong> лотов</span>}
        hasActiveFilters={filtersActive}
        onReset={resetFilters}
      >
        <label className="sr-only" htmlFor="auction-type-filter">Фильтр по типу лота</label>
        <select id="auction-type-filter" value={lotTypeFilter} onChange={event => setLotTypeFilter(event.target.value as LotTypeFilter)} className={CONTROL_CLASS}>
          {Object.entries(LOT_TYPE_FILTER_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label className="sr-only" htmlFor="auction-sort">Сортировка лотов</label>
        <select id="auction-sort" value={sortField} onChange={event => setSortField(event.target.value as AuctionLotSortField)} className={CONTROL_CLASS}>
          {Object.entries(SORT_FIELD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setSortDescending(prev => !prev)}
          aria-label="Сменить направление сортировки"
          className={`${CONTROL_CLASS} inline-flex items-center gap-1.5`}
        >
          <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />
          {sortDescending ? 'По убыванию' : 'По возрастанию'}
        </button>
      </VenueToolbar>

      {visibleLots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/70 px-4 py-10 text-center text-sm text-slate-400">
          {pendingLots.length === 0 ? (
            <>
              <p className="mb-3">Товаров и персонала для продажи нет. Товары поступят после прибытия каравана, а персонал можно выставить из дома удовольствия. NPC-покупатели могут перегнать цену выше оценки.</p>
              <button
                type="button"
                onClick={onOpenCaravans}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:border-amber-400 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <Truck aria-hidden="true" className="h-4 w-4" /> Торговые караваны <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </>
          ) : 'Нет результатов по выбранному поиску или фильтрам.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {visibleLots.map(lot => {
            const quote = quoteAuctionLot(lot, auctioneer, auctioneerSaleBonus);
            const characterLot = isCharacterLot(lot);
            const character = characterLot ? characterById.get(lot.characterId) : undefined;
            const portrait = character?.image;
            const consent = characterLot ? saleConsents.find(request => request.lotId === lot.id) : undefined;
            const inspection = inspectionByLot.get(lot.id);
            return (
              <article key={lot.id} className="flex min-w-0 gap-2 rounded-lg border border-slate-700 bg-slate-950 p-2 text-left transition hover:border-slate-500 border-l-2 border-l-amber-500/60">
                <div className="relative h-32 w-20 shrink-0 overflow-hidden rounded-md border border-slate-700 bg-slate-900 sm:h-36 sm:w-24">
                  {portrait ? (
                    <Portrait3D
                      model={character?.model3d}
                      poster={portrait}
                      alt={`Портрет: ${lot.productName}`}
                      className="h-full w-full object-cover"
                      onPreviewImage={onPreviewImage}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      {characterLot
                        ? <User aria-hidden="true" className="h-6 w-6 text-amber-300" />
                        : <Package aria-hidden="true" className="h-6 w-6 text-amber-300" />}
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex min-w-0 items-start justify-between gap-1">
                    <div className="min-w-0">
                      <h3 className="truncate text-xs font-semibold text-slate-100" title={lot.productName}>{lot.productName}</h3>
                      <p className="truncate text-[10px] italic text-slate-400" title={lot.category}>
                        {lot.category}{characterLot ? ` · ${GENDER_LABELS[lot.gender]}` : ` · ${lot.quantity} ед.`}
                      </p>
                    </div>
                    <span className="shrink-0 rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-[8px] font-bold text-amber-200">
                      {characterLot ? 'ПЕРСОНАЛ' : 'ТОВАР'}
                    </span>
                    {inspectionBadge(inspection)}
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-x-1.5 gap-y-1 border-y border-slate-800 py-1.5">
                    <div className="min-w-0 text-center">
                      <dt className="truncate text-[9px] leading-3 text-slate-500">Оценка</dt>
                      <dd className="truncate font-mono text-[11px] leading-4 text-amber-200" title={money(quote.appraisedValue)}>{money(quote.appraisedValue)}</dd>
                    </div>
                    <div className="min-w-0 text-center">
                      <dt className="truncate text-[9px] leading-3 text-slate-500">Аукционист</dt>
                      <dd className="truncate font-mono text-[11px] leading-4 text-slate-200">{quote.auctioneerBonusPercent ? `+${quote.auctioneerBonusPercent}%` : '—'}</dd>
                    </div>
                    <div className="min-w-0 text-center">
                      <dt className="truncate text-[9px] leading-3 text-slate-500">Выручка</dt>
                      <dd className="truncate font-mono text-[11px] leading-4 text-emerald-300" title={money(quote.saleProceeds)}>{money(quote.saleProceeds)}</dd>
                    </div>
                  </dl>
                  <div className="mt-1.5 min-w-0 text-[10px] leading-relaxed text-slate-400">
                    <p className="truncate">{characterLot ? 'Дом удовольствия' : `${lot.caravanName} · нед. ${lot.arrivalWeek}`}</p>
                    <p className="truncate font-mono text-slate-500">{lot.appraisedBy}</p>
                    <p className="mt-0.5 flex items-center gap-1 truncate">
                      <Users aria-hidden="true" className="h-3 w-3 shrink-0 text-cyan-400" />
                      {npcInterestFor(lot)} покупателей заинтересованы
                    </p>
                  </div>
                  <div className="mt-auto pt-2">
                    {consent ? (
                      <div className="space-y-1.5 rounded-md border border-violet-500/40 bg-violet-500/10 p-2">
                        <p className="text-[10px] leading-relaxed text-violet-200">
                          {consent.administratorName}, администратор аукционного дома, запрашивает согласие на продажу {consent.isSlave ? 'раба' : 'сотрудника'} «{consent.lotName}» за {money(quote.saleProceeds)}.
                        </p>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => onConfirmSale(lot.id)}
                            aria-label={`Подтвердить продажу ${lot.productName} за ${money(quote.saleProceeds)}`}
                            className="min-h-8 flex-1 rounded-md bg-amber-500 px-2 text-[11px] font-bold text-slate-950 transition hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                          >
                            Подтвердить · {money(quote.saleProceeds)}
                          </button>
                          <button
                            type="button"
                            onClick={() => onCancelSaleConsent(lot.id)}
                            aria-label={`Отклонить продажу ${lot.productName}`}
                            className="min-h-8 flex-1 rounded-md border border-slate-600 bg-slate-900 px-2 text-[11px] font-bold text-slate-300 transition hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
                          >
                            Отклонить
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {onInspectLot && (
                          <button
                            type="button"
                            onClick={() => onInspectLot(lot.id)}
                            aria-label={`Осмотреть ${lot.productName}`}
                            className="min-h-8 w-full rounded-md border border-slate-600 bg-slate-900 px-2 text-[11px] font-bold text-slate-200 transition hover:border-cyan-400/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                          >
                            <SearchCheck aria-hidden="true" className="mr-1 inline h-3.5 w-3.5 text-cyan-300" />Осмотреть{inspection ? ` · ${inspection.confidence}%` : ''}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onSellLot(lot.id)}
                          aria-label={`Продать ${lot.productName} за ${money(quote.saleProceeds)}`}
                          className="min-h-8 w-full rounded-md bg-amber-500 px-2 text-[11px] font-bold text-slate-950 transition hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                        >
                          {characterLot ? `Запросить продажу · ${money(quote.saleProceeds)}` : `Продать · ${money(quote.saleProceeds)}`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {pleasureHouseCharacters.length > 0 && (
        <section aria-labelledby="auction-stock-heading" className="space-y-2 border-t border-slate-800 pt-4">
          <div className="flex items-center gap-2">
            <User aria-hidden="true" className="h-4 w-4 text-amber-300" />
            <h3 id="auction-stock-heading" className="text-sm font-bold text-white">Персонал, доступный для выставления на аукцион</h3>
          </div>
          <VenueToolbar
            query={staffQuery}
            onQueryChange={setStaffQuery}
            searchLabel="Поиск по персоналу"
            placeholder="Поиск по имени, роли, стране или региону…"
            summary={<span>Показано <strong className="font-mono text-slate-200">{visibleStaff.length}/{pleasureHouseCharacters.length}</strong></span>}
            hasActiveFilters={staffFiltersActive}
            onReset={resetStaffFilters}
          >
            <label className="sr-only" htmlFor="auction-staff-sort">Сортировка персонала</label>
            <select id="auction-staff-sort" value={staffSortField} onChange={event => setStaffSortField(event.target.value as StaffSortField)} className={CONTROL_CLASS}>
              {Object.entries(STAFF_SORT_FIELD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setStaffSortDescending(prev => !prev)}
              aria-label="Сменить направление сортировки"
              className={`${CONTROL_CLASS} inline-flex items-center gap-1.5`}
            >
              <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />
              {staffSortDescending ? 'По убыванию' : 'По возрастанию'}
            </button>
          </VenueToolbar>
          {visibleStaff.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/70 px-4 py-10 text-center text-sm text-slate-400">
              Нет результатов по выбранному поиску.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              {visibleStaff.map(char => (
                <PersonnelCard
                  key={char.id}
                  character={char}
                  platform={'original'}
                  accentClassName="border-l-2 border-l-amber-500/60"
                  onPreviewImage={onPreviewImage}
                  badges={(
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      {char.isSlave && <span className="rounded border border-rose-500/30 bg-rose-500/10 px-1 py-0.5 text-[8px] font-bold text-rose-200">ПЛЕННИК</span>}
                      {isOnCaptureOp(char) && <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-[8px] font-bold text-amber-200">В ПОЛЕ</span>}
                    </div>
                  )}
                  metrics={[
                    { label: 'Навык', value: char.skill },
                    { label: 'Привл.', value: `${calculateAttractiveness(char)}/100`, valueClassName: 'text-amber-300' },
                    { label: 'Покор.', value: `${char.submission || 50}%`, valueClassName: 'text-purple-300' },
                    { label: 'Здоровье', value: HEALTH_LABELS[char.healthLevel], valueClassName: 'text-emerald-300' },
                    { label: 'Усталость', value: EXHAUSTION_LABELS[char.exhaustionLevel], valueClassName: 'text-amber-300' },
                    { label: 'Возраст', value: char.age }
                  ]}
                  details={(
                    <>
                      <p className="truncate" title={`${char.role} · ${GENDER_LABELS[char.gender]} · ${char.country || char.regionName}`}>
                        {char.role} · {GENDER_LABELS[char.gender]} · {char.country || char.regionName}
                      </p>
                      <p className="truncate font-mono text-slate-500" title={`Рынок ${formatMoney(marketValueOf(char))} · неделя ${char.acquiredWeek ?? '—'}`}>
                        Рынок {formatMoney(marketValueOf(char))} · нед. {char.acquiredWeek ?? '—'}
                      </p>
                    </>
                  )}
                  actions={(
                    <button
                      type="button"
                      onClick={() => onAddCharacterLot(char)}
                      className="min-h-8 w-full rounded-md bg-pink-700 px-2 text-[11px] font-bold text-white transition hover:bg-pink-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-300"
                    >
                      Выставить на аукцион
                    </button>
                  )}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="auction-sales-heading" className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-left shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="auction-sales-heading" className="flex items-center gap-2 text-base font-bold text-white">
              <PackageCheck aria-hidden="true" className="h-5 w-5 text-amber-300" /> Недавние продажи
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Итоги последних торгов: победитель, неделя и выручка по каждому лоту.
            </p>
          </div>
          <span className="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1 font-mono text-xs text-slate-400">{recentSales.length}</span>
        </div>
        {recentSales.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-center text-sm text-slate-500">Проданных лотов пока нет.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-800 border-y border-slate-800">
            {recentSales.map(sale => {
              const isChar = 'characterId' in sale;
              const hasNpc = Boolean(sale.winningNpcBidder);
              return (
                <li key={`${sale.id}:${sale.soldWeek}`} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-500">
                      {isChar
                        ? <User aria-hidden="true" className="h-5 w-5" />
                        : <Package aria-hidden="true" className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">{sale.productName}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {isChar ? sale.category : sale.caravanName} · Неделя {sale.soldWeek}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex max-w-sm items-start gap-2 rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
                    <Users aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
                    {hasNpc
                      ? <>{sale.winningNpcBidder} · ставка <strong className="font-mono text-cyan-300">{money(sale.npcWinningBid ?? sale.saleProceeds)}</strong></>
                      : 'Без внешних ставок'}
                    {' '}— выручка <strong className="font-mono text-emerald-300">{money(sale.saleProceeds)}</strong>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-[10px] leading-relaxed text-slate-500">
        Оценка лота фиксируется при поступлении и не меняется до продажи. NPC-покупатели могут перебить цену выше оценки — победитель определяется на торгах. Персонал (рабы и сотрудники) не продаётся автоматически: администратор аукционного дома выставляет запрос, который игрок должен подтвердить или отклонить.
      </p>
    </div>
  );
}
