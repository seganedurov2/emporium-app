import { useMemo, useState } from 'react';
import { formatMoney } from '../../currency';
import {
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  Clock3,
  ListFilter,
  MapPin,
  Maximize2,
  Package,
  RotateCcw,
  Scale,
  Search,
  ShoppingCart,
  TrendingUp,
  WalletCards
} from 'lucide-react';
import { getTerm, type Platform } from '../../terminology';
import type { CaptiveLotOffer } from '../../slaveContractsEngine';
import { demandTier } from '../../slaveContractsEngine';

interface CaptiveLotsMarketPanelProps {
  lots: CaptiveLotOffer[];
  funds: number;
  reservedLotIds: string[];
  onBuyLot: (lot: CaptiveLotOffer) => void;
  onToggleReservation: (lotId: string) => void;
  onPreviewImage?: (image: string) => void;
  platform: Platform;
}

const previewImage = 'https://images.unsplash.com/photo-1666577624653-b6f0043fed0e?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&fit=crop&w=1100';

const QUALITY_LABELS: Record<CaptiveLotOffer['quality'], string> = {
  low: 'низкое',
  medium: 'среднее',
  high: 'высокое',
  legendary: 'легендарное'
};

const QUALITY_TONES: Record<CaptiveLotOffer['quality'], string> = {
  low: 'text-slate-300 border-slate-700 bg-slate-800/70',
  medium: 'text-amber-200 border-amber-500/30 bg-amber-500/10',
  high: 'text-emerald-200 border-emerald-500/30 bg-emerald-500/10',
  legendary: 'text-yellow-200 border-yellow-500/30 bg-yellow-500/10'
};

const QUALITY_ACCENTS: Record<CaptiveLotOffer['quality'], string> = {
  low: 'text-slate-300',
  medium: 'text-amber-300',
  high: 'text-emerald-300',
  legendary: 'text-yellow-300'
};

const DEMAND_LABELS: Record<'low' | 'medium' | 'high', string> = {
  low: 'низкий',
  medium: 'средний',
  high: 'высокий'
};

const DEMAND_TONES: Record<'low' | 'medium' | 'high', string> = {
  low: 'text-slate-300',
  medium: 'text-amber-300',
  high: 'text-emerald-300'
};

type SortKey = 'price-asc' | 'price-desc' | 'quantity-desc' | 'margin-desc';
type QualityFilter = 'all' | CaptiveLotOffer['quality'];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'price-asc', label: 'Цена: сначала дешёвые' },
  { value: 'price-desc', label: 'Цена: сначала дорогие' },
  { value: 'quantity-desc', label: 'Размер: по убыванию' },
  { value: 'margin-desc', label: 'Выгода: по прогнозной марже' }
];

const QUALITY_FILTER_OPTIONS: { value: QualityFilter; label: string }[] = [
  { value: 'all', label: 'Любое' },
  { value: 'low', label: 'Низкое' },
  { value: 'medium', label: 'Среднее' },
  { value: 'high', label: 'Высокое' },
  { value: 'legendary', label: 'Легендарное' }
];

const SELECT_CLASS = 'min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-200 transition focus:border-amber-400/60 focus:outline-none';

interface DealAssessment {
  value: number;
  margin: number;
  label: string;
  tone: string;
}

function qualityLabel(quality: CaptiveLotOffer['quality']): string {
  return QUALITY_LABELS[quality] ?? quality;
}

function memberWord(quantity: number, platform: Platform): string {
  if (platform === 'tiktok') return 'специалиста';
  const mod10 = quantity % 10;
  const mod100 = quantity % 100;
  if (mod10 === 1 && mod100 !== 11) return 'человек';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'человека';
  return 'человек';
}

function assessLot(lot: CaptiveLotOffer): DealAssessment {
  const value = Math.round(lot.pricePerHead * 2.1) * lot.quantity;
  const margin = value - lot.cost;
  const ratio = lot.cost > 0 ? margin / lot.cost : 0;
  if (ratio >= 0.12) {
    return { value, margin, label: 'Выгодно', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' };
  }
  if (ratio <= -0.12) {
    return { value, margin, label: 'Переоценка', tone: 'text-rose-300 border-rose-500/30 bg-rose-500/10' };
  }
  return { value, margin, label: 'Рыночная цена', tone: 'text-slate-300 border-slate-700 bg-slate-800/70' };
}

function AttributeRow({ label, value, valueClassName = 'text-slate-200' }: { label: string; value: string | number; valueClassName?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 py-2.5 last:border-0">
      <dt className="min-w-0 text-sm text-slate-500">{label}</dt>
      <dd className={`max-w-[60%] truncate text-right text-sm font-medium ${valueClassName}`} title={String(value)}>{value}</dd>
    </div>
  );
}

function MetricTile({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="min-w-0 px-2 py-2 text-center">
      <div className="truncate text-[11px] font-medium text-slate-500">{label}</div>
      <div className={`mt-0.5 truncate text-lg font-semibold tracking-tight ${accent}`}>{value}</div>
    </div>
  );
}

export function CaptiveLotsMarketPanel({
  lots,
  funds,
  reservedLotIds,
  onBuyLot,
  onToggleReservation,
  onPreviewImage,
  platform
}: CaptiveLotsMarketPanelProps) {
  const [selectedLotId, setSelectedLotId] = useState<string | null>(lots[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('price-asc');
  const [regionFilter, setRegionFilter] = useState('all');
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all');

  const selectedLot = lots.find(lot => lot.id === selectedLotId) ?? lots[0] ?? null;
  const isReserved = selectedLot ? reservedLotIds.includes(selectedLot.id) : false;
  const canPurchase = Boolean(selectedLot && funds >= selectedLot.cost);
  const currentDemand = selectedLot ? demandTier(selectedLot.regionId) : 'low';
  const selectedDeal = selectedLot ? assessLot(selectedLot) : null;

  const regionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    lots.forEach(lot => {
      if (!seen.has(lot.regionId)) seen.set(lot.regionId, lot.regionName);
    });
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ru'));
  }, [lots]);

  const visibleLots = useMemo(() => {
    const q = query.trim().toLowerCase();
    const marginById = new Map<string, number>();
    const filtered = lots.filter(lot => {
      if (regionFilter !== 'all' && lot.regionId !== regionFilter) return false;
      if (qualityFilter !== 'all' && lot.quality !== qualityFilter) return false;
      if (q && !lot.regionName.toLowerCase().includes(q)) return false;
      marginById.set(lot.id, assessLot(lot).margin);
      return true;
    });
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'price-asc':
          return a.cost - b.cost;
        case 'price-desc':
          return b.cost - a.cost;
        case 'quantity-desc':
          return b.quantity - a.quantity;
        case 'margin-desc':
          return (marginById.get(b.id) ?? 0) - (marginById.get(a.id) ?? 0);
      }
    });
  }, [lots, query, regionFilter, qualityFilter, sortKey]);

  const filtersActive = query.trim() !== '' || regionFilter !== 'all' || qualityFilter !== 'all';

  function resetFilters() {
    setQuery('');
    setSortKey('price-asc');
    setRegionFilter('all');
    setQualityFilter('all');
  }

  return (
    <section aria-labelledby="captive-lots-heading" className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 text-left shadow-xl">
      <header className="flex flex-col gap-3 border-b border-slate-800 bg-slate-900/95 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-5">
          <h1 id="captive-lots-heading" className="text-lg font-semibold text-white">{getTerm('captive_lots', platform)}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5 text-slate-400"><WalletCards aria-hidden="true" className="h-4 w-4 text-amber-400" /> Казна <strong className="font-mono text-slate-100">{formatMoney(funds)}</strong></span>
            <span className="hidden h-4 border-l border-slate-700 sm:block" aria-hidden="true" />
            <span className="text-slate-400">Цена выбранного <strong className="ml-1 font-mono text-amber-300">{selectedLot ? formatMoney(selectedLot.cost) : '—'}</strong></span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => selectedLot && onToggleReservation(selectedLot.id)}
            disabled={!selectedLot}
            aria-pressed={isReserved}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-40 ${isReserved ? 'border-amber-400/50 bg-amber-400/10 text-amber-200 hover:bg-amber-400/15' : 'border-slate-600 bg-slate-950 text-slate-200 hover:border-slate-400 hover:bg-slate-800'}`}
          >
            {isReserved ? <BookmarkCheck aria-hidden="true" className="h-4 w-4" /> : <Bookmark aria-hidden="true" className="h-4 w-4" />}
            {isReserved ? 'Зарезервировано на следующую неделю' : 'Зарезервировать'}
          </button>
           <button
             type="button"
             onClick={() => selectedLot && onBuyLot(selectedLot)}
             disabled={!canPurchase}
             className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-400 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
           >
             <ShoppingCart aria-hidden="true" className="h-4 w-4" />
             {selectedLot && funds < selectedLot.cost ? 'Недостаточно средств' : `Купить ${getTerm('lot', platform)}`}
           </button>

        </div>
      </header>

      <div className="flex flex-col gap-2 border-b border-slate-800 bg-slate-900/50 px-4 py-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Поиск по региону</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Поиск по региону…"
            className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-400/60 focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <ListFilter aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
          <label className="sr-only">Сортировка</label>
          <select value={sortKey} onChange={event => setSortKey(event.target.value as SortKey)} className={SELECT_CLASS}>
            {SORT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <label className="sr-only">Регион</label>
          <select value={regionFilter} onChange={event => setRegionFilter(event.target.value)} className={SELECT_CLASS}>
            <option value="all">Все регионы</option>
            {regionOptions.map(([regionId, regionName]) => (
              <option key={regionId} value={regionId}>{regionName}</option>
            ))}
          </select>
          <label className="sr-only">Качество</label>
          <select value={qualityFilter} onChange={event => setQualityFilter(event.target.value as QualityFilter)} className={SELECT_CLASS}>
            {QUALITY_FILTER_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {filtersActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-300 transition hover:border-slate-400 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              Сбросить
            </button>
          )}
        </div>
      </div>

      <div className="grid min-h-[34rem] grid-cols-1 lg:grid-cols-[12.5rem_minmax(0,1fr)_minmax(16rem,0.82fr)]">
         <aside aria-label={getTerm('lots', platform)} className="flex min-h-0 flex-col border-b border-slate-800 bg-slate-950/70 lg:max-h-[min(72vh,48rem)] lg:min-h-[38rem] lg:border-b-0 lg:border-r">
           <div className="flex items-center justify-between px-4 py-3">
             <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{getTerm('lots', platform)}</h2>
             <span className="rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-500">
               {filtersActive ? `${visibleLots.length} из ${lots.length}` : lots.length}
             </span>
           </div>
           <div className="flex gap-2 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:overflow-y-auto lg:px-2">
             {lots.length === 0 ? (
               <p className="w-full rounded-lg border border-dashed border-slate-800 px-3 py-5 text-center text-xs leading-relaxed text-slate-500">
                 Нет {getTerm('lots', platform)} в продаже. Сдвиньте неделю, чтобы получить новые предложения.
               </p>
             ) : visibleLots.length === 0 ? (

              <div className="w-full space-y-3 rounded-lg border border-dashed border-slate-800 px-3 py-5 text-center">
                <p className="text-xs leading-relaxed text-slate-500">Ничего не найдено по текущим фильтрам.</p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-400 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                  Сбросить фильтры
                </button>
              </div>
            ) : visibleLots.map((lot, index) => {
              const active = selectedLot?.id === lot.id;
              const reserved = reservedLotIds.includes(lot.id);
              const deal = assessLot(lot);
              return (
                <button
                  type="button"
                  key={lot.id}
                  onClick={() => setSelectedLotId(lot.id)}
                  aria-pressed={active}
                  className={`min-w-[14rem] w-full flex-1 border-l-2 px-3 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-400 lg:block lg:w-full lg:min-w-0 lg:flex-none ${active ? 'border-amber-400 bg-slate-800/90 text-slate-100' : 'border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="line-clamp-1 text-sm font-semibold">{lot.regionName}</span>
                    {reserved && <BookmarkCheck aria-label="Зарезервировано" className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
                  </span>
                       <span className="mt-1 block truncate text-[11px] text-slate-500">{getTerm('regional_purchase', platform)}</span>
                       <span className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                         <span className="truncate text-slate-500">{lot.quantity} {memberWord(lot.quantity, platform)}</span>
                         <span className="shrink-0 font-mono text-amber-300">{formatMoney(lot.cost)}</span>
                       </span>

                  <span className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center rounded border px-1.5 py-px text-[10px] font-semibold ${QUALITY_TONES[lot.quality]}`}>{QUALITY_LABELS[lot.quality]} качество</span>
                    <span className={`inline-flex items-center rounded border px-1.5 py-px text-[10px] font-semibold ${deal.tone}`}>{deal.label}</span>
                  </span>
                  <span className="mt-2 block text-[10px] uppercase tracking-wide text-slate-700">Предложение {String(index + 1).padStart(2, '0')}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto hidden border-t border-slate-800 px-4 py-3 text-[10px] leading-relaxed text-slate-600 lg:block">
            Нерезервированные предложения обновляются на ближайшем еженедельном обновлении рынка.
          </div>
        </aside>

        <div className="min-w-0 border-b border-slate-800 lg:max-h-[min(72vh,48rem)] lg:min-h-[38rem] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          {selectedLot ? (
            <div className="space-y-5 p-4 sm:p-5">
               <div className="border-b border-slate-700 pb-4">
                 <div className="flex flex-wrap items-start justify-between gap-3">
                   <div className="min-w-0">
                     <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Выбранное предложение</p>
                     <h2 className="break-words text-xl font-semibold leading-tight text-white sm:text-2xl">
                       {getTerm('lot', platform)} {selectedLot.quantity}× · качество: {qualityLabel(selectedLot.quality)}
                     </h2>
                     <p className="mt-1 text-sm font-medium text-amber-300">{getTerm('regional_purchase', platform)}</p>
                   </div>
                   <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-xs text-slate-300">
                     <MapPin aria-hidden="true" className="h-3.5 w-3.5 text-slate-500" /> {selectedLot.regionName}
                   </span>
                 </div>
               </div>


              <div className="grid grid-cols-2 divide-x divide-slate-800 border-b border-slate-800 pb-3 sm:grid-cols-5">
                 <MetricTile label="Размер партии" value={`${selectedLot.quantity} ${memberWord(selectedLot.quantity, platform)}`} accent="text-slate-100" />
                 <MetricTile label="Цена за человека" value={formatMoney(selectedLot.pricePerHead)} accent="text-emerald-300" />
                 <MetricTile label="Итого за партию" value={formatMoney(selectedLot.cost)} accent="text-amber-300" />
                 <MetricTile label="Качество" value={QUALITY_LABELS[selectedLot.quality]} accent={QUALITY_ACCENTS[selectedLot.quality]} />
                 <MetricTile label="Спрос" value={DEMAND_LABELS[currentDemand]} accent={DEMAND_TONES[currentDemand]} />
               </div>


              <section aria-labelledby="lot-identity-heading">
                <h3 id="lot-identity-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <Package aria-hidden="true" className="h-4 w-4 text-slate-500" /> Партия и регион
                </h3>
                <dl className="divide-y divide-slate-800 border-y border-slate-800">
                   <AttributeRow label="Регион поставщик" value={selectedLot.regionName} />
                   <AttributeRow label="Качество" value={qualityLabel(selectedLot.quality)} />
                   <AttributeRow label="Размер партии" value={`${selectedLot.quantity} ${memberWord(selectedLot.quantity, platform)}`} />
                   <AttributeRow label="Цена за человека" value={formatMoney(selectedLot.pricePerHead)} />
                   <AttributeRow label="Итого за партию" value={formatMoney(selectedLot.cost)} />
                   <AttributeRow
                     label="Спрос в регионе поставщика"
                     value={DEMAND_LABELS[currentDemand]}
                     valueClassName={DEMAND_TONES[currentDemand]}
                   />

                </dl>
              </section>

              <section aria-labelledby="lot-deal-heading" className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5">
                <h3 id="lot-deal-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <Scale aria-hidden="true" className="h-4 w-4 text-slate-500" /> Оценка сделки
                  {selectedDeal && (
                    <span className={`ml-auto inline-flex items-center gap-1 rounded border px-1.5 py-px text-[10px] font-semibold ${selectedDeal.tone}`}>
                      <TrendingUp aria-hidden="true" className="h-3 w-3" />
                      {selectedDeal.label}
                    </span>
                  )}
                </h3>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Цена предложения</dt>
                    <dd className="font-mono text-slate-200">{formatMoney(selectedLot.cost)}</dd>
                  </div>
                  {selectedDeal && (
                    <>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Оценочная выручка при высоком спросе</dt>
                        <dd className="font-mono text-slate-200">~{formatMoney(selectedDeal.value)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Прогнозируемая маржа при перепродаже</dt>
                        <dd className={`font-mono font-semibold ${selectedDeal.margin >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {selectedDeal.margin >= 0 ? '+' : '-'}{formatMoney(Math.abs(selectedDeal.margin))}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
                <p className="mt-2 text-[10px] leading-relaxed text-slate-600">Оценка использует текущий ориентир перепродажи при высоком спросе; фактические предложения покупателей могут отличаться.</p>
              </section>

              {isReserved && (
                <p className="flex items-start gap-2 rounded-md border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs leading-relaxed text-amber-200/80">
                  <Clock3 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Это предложение останется доступным до следующего еженедельного обновления рынка.
                </p>
              )}

               <div className="flex items-start gap-2 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
                 <BriefcaseBusiness aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
                 {getTerm('lot', platform)} из {selectedLot.quantity} {memberWord(selectedLot.quantity, platform)} обойдётся в {formatMoney(selectedLot.cost)}. Участники партии создаются при покупке предложения.
               </div>

            </div>
          ) : (
             <div className="flex min-h-[18rem] items-center justify-center p-8 text-center lg:min-h-full">
               <div>
                 <Package aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-slate-700" />
                 <h2 className="text-base font-semibold text-slate-300">Нет доступных предложений</h2>
                 <p className="mt-1 max-w-xs text-sm text-slate-500">Новые региональные {getTerm('lots', platform)} появятся после следующего еженедельного обновления рынка.</p>
               </div>
             </div>

          )}
        </div>

        <div className="relative min-h-[25rem] bg-slate-950 sm:min-h-[32rem] lg:min-h-0">
          {selectedLot ? (
            <>
              <div className="absolute inset-0 overflow-hidden">
                <img
                  src={previewImage}
                  alt="Иллюстративный портрет полностью одетой взрослой женщины в тёмной одежде, фотограф Лукас Кепнер, Unsplash"
                  width={1200}
                  height={1600}
                  loading="lazy"
                  className="h-full w-full object-cover object-center opacity-85"
                  style={{ width: '100%', height: '100%' }}
                />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-slate-950/20" />
              </div>
              <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
                <span className="rounded border border-white/10 bg-slate-950/75 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-200">Превью партии</span>
                <span className="rounded border border-white/10 bg-slate-950/75 px-2 py-1 text-[10px] text-slate-300">Иллюстрация</span>
              </div>
              <button
                type="button"
                onClick={() => onPreviewImage?.(previewImage)}
                aria-label="Открыть иллюстрацию партии в полном размере"
                className="absolute inset-0 flex items-center justify-center bg-transparent opacity-0 transition hover:bg-black/10 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-amber-400"
              >
                <Maximize2 aria-hidden="true" className="h-8 w-8 text-white drop-shadow" />
              </button>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                <p className="text-sm font-semibold text-white">{selectedLot.regionName}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-300/80">Только иллюстративный портрет. Участники партии создаются при покупке предложения.</p>
                <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-400/80"><MapPin aria-hidden="true" className="h-3 w-3" /> Регион-поставщик: {selectedLot.regionName}</p>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-xs text-slate-600">
              Выберите предложение, чтобы посмотреть подробности.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
