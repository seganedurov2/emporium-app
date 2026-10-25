import { Suspense, useMemo, useState } from 'react';
import { formatMoney } from '../../currency';
import {
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  Globe2,
  HeartPulse,
  ListFilter,
  MapPin,
  Maximize2,
  PiggyBank,
  RotateCcw,
  Scale,
  Search,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  UserRound,
  WalletCards,
  X
} from 'lucide-react';
import { getTerm, type Platform } from '../../terminology';
import type { Character } from '../../gameEngine';
import { calculateAttractiveness } from '../../gameEngine';
import { LazyPortrait3DCanvas } from '../Portrait3D';
import { currentPortraitRenderMode } from '../../portrait3dSupport';
import { usePortrait3dEnabled } from '../../portrait3dFlag';
import { demandTier, marketValueOf, slaveQualityOf } from '../../slaveContractsEngine';
import {
  MARKET_IMPROVEMENT_IDS,
  MARKET_IMPROVEMENT_TRACKS,
  MARKET_FINANCIER,
  MARKET_ADMINISTRATOR_NAME,
  nextMarketImprovementCost,
  type MarketImprovementAuthor,
  type MarketImprovementId,
  type MarketImprovementRequest
} from '../../marketImprovementsEngine';

interface GlobalMarketTabProps {
  candidates: Character[];
  funds: number;
  reservedCharacterIds: string[];
  onBuySlave: (character: Character) => void;
  onToggleReservation: (characterId: string) => void;
  onPreviewImage?: (image: string) => void;
  platform: Platform;
  /** Текущие уровни треков улучшений глобального рынка. */
  marketImprovements?: Partial<Record<MarketImprovementId, number>>;
  /** Активное предложение администратора или финансиста. */
  marketRequest?: MarketImprovementRequest | null;
  onAcceptMarketRequest?: () => void;
  onDeclineMarketRequest?: () => void;
}

const portraitFallback = 'https://images.unsplash.com/photo-1666577624653-b6f0043fed0e?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&fit=crop&w=1100';

const HEALTH_LABELS: Record<Character['healthLevel'], string> = {
  Pristine: 'превосходное',
  Good: 'хорошее',
  Fair: 'среднее',
  Poor: 'плохое',
  Critical: 'критическое'
};

const EXHAUSTION_LABELS: Record<Character['exhaustionLevel'], string> = {
  Rested: 'отдохнувший',
  Tired: 'уставший',
  Exhausted: 'измотанный',
  'Burned Out': 'выгоревший'
};

const SKIN_CONDITION_LABELS: Record<Character['skinCondition'], string> = {
  Flawless: 'идеальная',
  Clear: 'чистая',
  Dry: 'сухая',
  Blemished: 'воспаления',
  Irritated: 'раздражение'
};

const HAIR_STYLE_LABELS: Record<string, string> = {
  'Straight Layered': 'Прямые слоистые',
  'Short Practical': 'Короткие практичные',
  'Designer Cut': 'Дизайнерская стрижка'
};

type CandidateQuality = 'low' | 'medium' | 'high' | 'legendary';
type SortKey = 'price-asc' | 'price-desc' | 'skill-desc' | 'attractiveness-desc' | 'margin-desc';
type GenderFilter = 'all' | Character['gender'];
type QualityFilter = 'all' | CandidateQuality;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'price-asc', label: 'Цена: сначала дешёвые' },
  { value: 'price-desc', label: 'Цена: сначала дорогие' },
  { value: 'skill-desc', label: 'Навык: по убыванию' },
  { value: 'attractiveness-desc', label: 'Привлекательность: по убыванию' },
  { value: 'margin-desc', label: 'Выгода: по прогнозной марже' }
];

const QUALITY_LABELS: Record<CandidateQuality, string> = {
  low: 'низкое',
  medium: 'среднее',
  high: 'высокое',
  legendary: 'легендарное'
};

const QUALITY_TONES: Record<CandidateQuality, string> = {
  low: 'text-slate-300 border-slate-700 bg-slate-800/70',
  medium: 'text-amber-200 border-amber-500/30 bg-amber-500/10',
  high: 'text-emerald-200 border-emerald-500/30 bg-emerald-500/10',
  legendary: 'text-yellow-200 border-yellow-500/30 bg-yellow-500/10'
};

const QUALITY_ACCENTS: Record<CandidateQuality, string> = {
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

const GENDER_FILTER_OPTIONS: { value: GenderFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'women', label: 'Женщины' },
  { value: 'men', label: 'Мужчины' },
  { value: 'trans', label: 'Трансгендерные' }
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

function hairStyleLabel(style: string): string {
  return HAIR_STYLE_LABELS[style] ?? style;
}

function displayGender(gender: Character['gender']): string {
  if (gender === 'women') return 'Женщина';
  if (gender === 'men') return 'Мужчина';
  return 'Трансгендер';
}

function buyWord(gender: Character['gender'], platform: Platform): string {
  if (platform === 'tiktok') return 'специалиста';
  return gender === 'women' ? 'рабыню' : 'раба';
}

function assessDeal(character: Character): DealAssessment {
  const value = marketValueOf(character);
  const margin = value - character.price;
  const ratio = character.price > 0 ? margin / character.price : 0;
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

const AUTHOR_BADGES: Record<MarketImprovementAuthor, { label: string; tone: string }> = {
  administrator: { label: 'Администратор', tone: 'text-sky-200 border-sky-500/30 bg-sky-500/10' },
  financier: { label: 'Финансист', tone: 'text-violet-200 border-violet-500/30 bg-violet-500/10' }
};

const PRIORITY_TONES: Record<'Low' | 'Medium' | 'High', string> = {
  Low: 'text-slate-300 border-slate-700 bg-slate-800/70',
  Medium: 'text-amber-200 border-amber-500/30 bg-amber-500/10',
  High: 'text-emerald-200 border-emerald-500/30 bg-emerald-500/10'
};

const PRIORITY_LABELS: Record<'Low' | 'Medium' | 'High', string> = {
  Low: 'Низкий приоритет',
  Medium: 'Средний приоритет',
  High: 'Высокий приоритет'
};

function LevelPips({ level, maxLevel }: { level: number; maxLevel: number }) {
  return (
    <span className="flex items-center gap-1" aria-label={`Уровень ${level} из ${maxLevel}`}>
      {Array.from({ length: maxLevel }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`h-1.5 w-4 rounded-full ${index < level ? 'bg-amber-400' : 'bg-slate-700'}`}
        />
      ))}
    </span>
  );
}

/**
 * Панель улучшений глобального рынка: уровни треков и
 * актуальное предложение администратора аукционного дома
 * или финансиста рынка.
 */
function MarketImprovementsPanel({
  marketImprovements,
  marketRequest,
  funds,
  onAcceptMarketRequest,
  onDeclineMarketRequest
}: {
  marketImprovements: Partial<Record<MarketImprovementId, number>>;
  marketRequest: MarketImprovementRequest | null;
  funds: number;
  onAcceptMarketRequest?: () => void;
  onDeclineMarketRequest?: () => void;
}) {
  return (
    <section aria-labelledby="market-improvements-title" className="border-b border-slate-800 bg-slate-900/40 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="market-improvements-title" className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <PiggyBank aria-hidden="true" className="h-4 w-4 text-amber-400" />
          Улучшения глобального рынка
        </h2>
        <p className="text-[11px] text-slate-500">
          Инвестиции предлагают {MARKET_ADMINISTRATOR_NAME} (администратор) и {MARKET_FINANCIER.name} (финансист)
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {MARKET_IMPROVEMENT_IDS.map(trackId => {
          const track = MARKET_IMPROVEMENT_TRACKS[trackId];
          const level = Math.max(0, Math.min(track.maxLevel, Math.floor(marketImprovements[trackId] ?? 0)));
          const nextCost = nextMarketImprovementCost(trackId, level);
          const badge = AUTHOR_BADGES[track.author];
          return (
            <div key={trackId} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xs font-semibold text-slate-200">{track.name}</h3>
                <span className={`inline-flex shrink-0 items-center rounded border px-1.5 py-px text-[10px] font-semibold ${badge.tone}`}>
                  {badge.label}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{track.tagline}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <LevelPips level={level} maxLevel={track.maxLevel} />
                <span className="font-mono text-[10px] text-slate-500">{level}/{track.maxLevel}</span>
              </div>
              <p className="mt-2 text-[10px] leading-snug text-slate-400">{track.effectDescriptions[level]}</p>
              {nextCost !== null && (
                <p className="mt-1 font-mono text-[10px] text-amber-400/80">Следующий уровень: {formatMoney(nextCost)}</p>
              )}
            </div>
          );
        })}
      </div>

      {marketRequest ? (
        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded border px-1.5 py-px text-[10px] font-semibold ${AUTHOR_BADGES[marketRequest.author].tone}`}>
                  {AUTHOR_BADGES[marketRequest.author].label}
                </span>
                <span className="text-[10px] text-slate-500">{marketRequest.authorName}</span>
                <span className={`inline-flex items-center rounded border px-1.5 py-px text-[10px] font-semibold ${PRIORITY_TONES[marketRequest.priority]}`}>
                  {PRIORITY_LABELS[marketRequest.priority]}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-medium text-slate-100">{marketRequest.description}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{marketRequest.benefit}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="font-mono text-sm font-bold text-amber-300">{formatMoney(marketRequest.cost)}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onAcceptMarketRequest}
                  disabled={funds < marketRequest.cost}
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-amber-400 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                >
                  <TrendingUp aria-hidden="true" className="h-3.5 w-3.5" />
                  {funds < marketRequest.cost ? 'Недостаточно средств' : 'Инвестировать'}
                </button>
                <button
                  type="button"
                  onClick={onDeclineMarketRequest}
                  aria-label="Отклонить предложение"
                  className="inline-flex min-h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-slate-400 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-slate-800 px-3 py-2.5 text-center text-[11px] text-slate-500">
          На этой неделе {MARKET_ADMINISTRATOR_NAME} и {MARKET_FINANCIER.name} не выносят предложений — все треки улучшений прокачаны.
        </p>
      )}
    </section>
  );
}

export function GlobalMarketTab({
  candidates,
  funds,
  reservedCharacterIds,
  onBuySlave,
  onToggleReservation,
  onPreviewImage,
  platform,
  marketImprovements = {},
  marketRequest = null,
  onAcceptMarketRequest,
  onDeclineMarketRequest
}: GlobalMarketTabProps) {
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(candidates[0]?.id ?? null);
  const [failedPortraitCharacterId, setFailedPortraitCharacterId] = useState<string | null>(null);
  // 3D load failures are tracked per candidate id; the state
  // resets during render when the selection changes (the
  // React-endorsed "adjust state during render" pattern).
  const [portrait3d, setPortrait3d] = useState<{ id: string | null; failed: boolean }>(() => ({
    id: candidates[0]?.id ?? null,
    failed: false
  }));
  const portraits3d = usePortrait3dEnabled();
  const portraitMode = currentPortraitRenderMode(portraits3d);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('price-asc');
  const [regionFilter, setRegionFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all');

  const selectedCandidate = candidates.find(candidate => candidate.id === selectedCharacterId) ?? candidates[0] ?? null;
  // A failed 3D load is per-candidate: switching candidates retries the model.
  if (selectedCandidate?.id !== portrait3d.id) {
    setPortrait3d({ id: selectedCandidate?.id ?? null, failed: false });
  }
  const portraitSource = selectedCandidate
    ? failedPortraitCharacterId === selectedCandidate.id ? portraitFallback : selectedCandidate.image || portraitFallback
    : portraitFallback;
  const isReserved = selectedCandidate ? reservedCharacterIds.includes(selectedCandidate.id) : false;
  const canPurchase = Boolean(selectedCandidate && funds >= selectedCandidate.price);
  const attractiveness = selectedCandidate ? calculateAttractiveness(selectedCandidate) : 0;
  const selectedQuality = selectedCandidate ? slaveQualityOf(selectedCandidate) : 'low';
  const selectedDeal = selectedCandidate ? assessDeal(selectedCandidate) : null;
  const selectedDemand = selectedCandidate ? demandTier(selectedCandidate.region) : 'low';

  const regionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    candidates.forEach(candidate => {
      if (!seen.has(candidate.region)) seen.set(candidate.region, candidate.regionName);
    });
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ru'));
  }, [candidates]);

  const visibleCandidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const attractivenessById = new Map<string, number>();
    const marginById = new Map<string, number>();
    const filtered = candidates.filter(candidate => {
      if (regionFilter !== 'all' && candidate.region !== regionFilter) return false;
      if (genderFilter !== 'all' && candidate.gender !== genderFilter) return false;
      if (qualityFilter !== 'all' && slaveQualityOf(candidate) !== qualityFilter) return false;
      if (q && !candidate.name.toLowerCase().includes(q) && !(candidate.country ?? '').toLowerCase().includes(q) && !(candidate.city ?? '').toLowerCase().includes(q)) return false;
      attractivenessById.set(candidate.id, calculateAttractiveness(candidate));
      marginById.set(candidate.id, marketValueOf(candidate) - candidate.price);
      return true;
    });
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        case 'skill-desc':
          return b.skill - a.skill;
        case 'attractiveness-desc':
          return (attractivenessById.get(b.id) ?? 0) - (attractivenessById.get(a.id) ?? 0);
        case 'margin-desc':
          return (marginById.get(b.id) ?? 0) - (marginById.get(a.id) ?? 0);
      }
    });
  }, [candidates, query, regionFilter, genderFilter, qualityFilter, sortKey]);

  const filtersActive = query.trim() !== '' || regionFilter !== 'all' || genderFilter !== 'all' || qualityFilter !== 'all';

  function resetFilters() {
    setQuery('');
    setSortKey('price-asc');
    setRegionFilter('all');
    setGenderFilter('all');
    setQualityFilter('all');
  }

  return (
    <section aria-labelledby="global-market-title" className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 text-left shadow-xl">
      <header className="flex flex-col gap-3 border-b border-slate-800 bg-slate-900/95 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-5">
          <h1 id="global-market-title" className="text-lg font-semibold text-white">Глобальный рынок</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5 text-slate-400"><WalletCards aria-hidden="true" className="h-4 w-4 text-amber-400" /> Казна <strong className="font-mono text-slate-100">{formatMoney(funds)}</strong></span>
            <span className="hidden h-4 border-l border-slate-700 sm:block" aria-hidden="true" />
            <span className="text-slate-400">Цена выбранного <strong className="ml-1 font-mono text-amber-300">{selectedCandidate ? formatMoney(selectedCandidate.price) : '—'}</strong></span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => selectedCandidate && onToggleReservation(selectedCandidate.id)}
            disabled={!selectedCandidate}
            aria-pressed={isReserved}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-40 ${isReserved ? 'border-amber-400/50 bg-amber-400/10 text-amber-200 hover:bg-amber-400/15' : 'border-slate-600 bg-slate-950 text-slate-200 hover:border-slate-400 hover:bg-slate-800'}`}
          >
            {isReserved ? <BookmarkCheck aria-hidden="true" className="h-4 w-4" /> : <Bookmark aria-hidden="true" className="h-4 w-4" />}
            {isReserved ? 'Зарезервировано на следующую неделю' : 'Зарезервировать'}
          </button>
           <button
             type="button"
             onClick={() => selectedCandidate && onBuySlave(selectedCandidate)}
             disabled={!canPurchase}
             className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-400 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
           >
             <ShoppingCart aria-hidden="true" className="h-4 w-4" />
             {selectedCandidate && funds < selectedCandidate.price
               ? 'Недостаточно средств'
               : selectedCandidate
                 ? `Купить ${buyWord(selectedCandidate.gender, platform)}`
                 : 'Купить'}
           </button>

        </div>
      </header>

      <div className="flex flex-col gap-2 border-b border-slate-800 bg-slate-900/50 px-4 py-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Поиск по имени или стране</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Поиск по имени или стране…"
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
          <label className="sr-only">Пол</label>
          <select value={genderFilter} onChange={event => setGenderFilter(event.target.value as GenderFilter)} className={SELECT_CLASS}>
            {GENDER_FILTER_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
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

      <MarketImprovementsPanel
        marketImprovements={marketImprovements}
        marketRequest={marketRequest}
        funds={funds}
        onAcceptMarketRequest={onAcceptMarketRequest}
        onDeclineMarketRequest={onDeclineMarketRequest}
      />

      <div className="grid min-h-[34rem] grid-cols-1 lg:grid-cols-[12.5rem_minmax(0,1fr)_minmax(16rem,0.82fr)]">
         <aside aria-label={getTerm('slaves', platform)} className="flex min-h-0 flex-col border-b border-slate-800 bg-slate-950/70 lg:max-h-[min(72vh,48rem)] lg:min-h-[38rem] lg:border-b-0 lg:border-r">
           <div className="flex items-center justify-between px-4 py-3">
             <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{getTerm('slaves', platform)}</h2>
             <span className="rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-500">
               {filtersActive ? `${visibleCandidates.length} из ${candidates.length}` : candidates.length}
             </span>
           </div>
           <div className="flex gap-2 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:overflow-y-auto lg:px-2">
             {candidates.length === 0 ? (
               <p className="w-full rounded-lg border border-dashed border-slate-800 px-3 py-5 text-center text-xs leading-relaxed text-slate-500">
                 Нет {getTerm('slaves', platform)} в продаже. Сдвиньте неделю, чтобы получить новые предложения.
               </p>
             ) : visibleCandidates.length === 0 ? (

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
            ) : visibleCandidates.map((candidate, index) => {
              const active = selectedCandidate?.id === candidate.id;
              const reserved = reservedCharacterIds.includes(candidate.id);
              const quality = slaveQualityOf(candidate);
              const deal = assessDeal(candidate);
              return (
                <button
                  type="button"
                  key={candidate.id}
                  onClick={() => setSelectedCharacterId(candidate.id)}
                  aria-pressed={active}
                  className={`min-w-[14rem] w-full flex-1 border-l-2 px-3 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-400 lg:block lg:w-full lg:min-w-0 lg:flex-none ${active ? 'border-amber-400 bg-slate-800/90 text-slate-100' : 'border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="line-clamp-1 text-sm font-semibold">{candidate.name}</span>
                    {reserved && <BookmarkCheck aria-label="Зарезервировано" className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-slate-500">{candidate.role}</span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-slate-500">{candidate.regionName}</span>
                    <span className="shrink-0 font-mono text-amber-300">{formatMoney(candidate.price)}</span>
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center rounded border px-1.5 py-px text-[10px] font-semibold ${QUALITY_TONES[quality]}`}>{QUALITY_LABELS[quality]} качество</span>
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
          {selectedCandidate ? (
            <div className="space-y-5 p-4 sm:p-5">
              <div className="border-b border-slate-700 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Выбранный кандидат</p>
                    <h2 className="break-words text-xl font-semibold leading-tight text-white sm:text-2xl">{selectedCandidate.name}</h2>
                    <p className="mt-1 text-sm font-medium text-amber-300">{selectedCandidate.role}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-xs text-slate-300">
                    <Globe2 aria-hidden="true" className="h-3.5 w-3.5 text-slate-500" /> {selectedCandidate.regionName}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-slate-800 border-b border-slate-800 pb-3 sm:grid-cols-5">
                <MetricTile label="Навык" value={`${selectedCandidate.skill}/100`} accent="text-emerald-300" />
                <MetricTile label="Привлекательность" value={`${attractiveness}/100`} accent="text-amber-300" />
                <MetricTile label="Лояльность" value={`${selectedCandidate.loyalty}%`} accent="text-slate-100" />
                <MetricTile label="Возраст" value={selectedCandidate.age} accent="text-slate-100" />
                <MetricTile label="Качество" value={QUALITY_LABELS[selectedQuality]} accent={QUALITY_ACCENTS[selectedQuality]} />
              </div>

              <section aria-labelledby="identity-heading">
                <h3 id="identity-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <UserRound aria-hidden="true" className="h-4 w-4 text-slate-500" /> Личность и происхождение
                </h3>
                <dl className="divide-y divide-slate-800 border-y border-slate-800">
                  <AttributeRow label="Страна" value={selectedCandidate.country || selectedCandidate.regionName} />
                  <AttributeRow label="Город" value={selectedCandidate.city || selectedCandidate.regionName} />
                  <AttributeRow label="Регион" value={selectedCandidate.regionName} />
                  <AttributeRow label="Пол" value={displayGender(selectedCandidate.gender)} />
                  <AttributeRow label="Возраст" value={`${selectedCandidate.age} г.`} />
                  <AttributeRow
                    label="Спрос в регионе происхождения"
                    value={DEMAND_LABELS[selectedDemand]}
                    valueClassName={DEMAND_TONES[selectedDemand]}
                  />
                </dl>
              </section>

              <section aria-labelledby="condition-heading">
                <h3 id="condition-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <HeartPulse aria-hidden="true" className="h-4 w-4 text-slate-500" /> Состояние
                </h3>
                <dl className="divide-y divide-slate-800 border-y border-slate-800">
                  <AttributeRow label="Здоровье" value={HEALTH_LABELS[selectedCandidate.healthLevel] ?? selectedCandidate.healthLevel} valueClassName="text-emerald-300" />
                  <AttributeRow label="Усталость" value={EXHAUSTION_LABELS[selectedCandidate.exhaustionLevel] ?? selectedCandidate.exhaustionLevel} />
                  <AttributeRow label="Кожа" value={SKIN_CONDITION_LABELS[selectedCandidate.skinCondition] ?? selectedCandidate.skinCondition} />
                  <AttributeRow label="Волосы" value={`${hairStyleLabel(selectedCandidate.headHairStyle)} · ${selectedCandidate.headHairLength} см`} />
                </dl>
              </section>

              <section aria-labelledby="deal-heading" className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5">
                <h3 id="deal-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300">
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
                    <dd className="font-mono text-slate-200">{formatMoney(selectedCandidate.price)}</dd>
                  </div>
                  {selectedDeal && (
                    <>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Оценочная стоимость на премиальном рынке</dt>
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
                <p className="mt-2 text-[10px] leading-relaxed text-slate-600">Оценка учитывает подчинение и навык кандидата; реальные предложения покупателей могут отличаться.</p>
              </section>

               <div className="flex items-start gap-2 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
                 <BriefcaseBusiness aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
                 {selectedCandidate.gender === 'women' ? `Эта ${getTerm('slave_fem', platform)}` : `Этот ${getTerm('slave_masc', platform)}`} продаётся за {formatMoney(selectedCandidate.price)}.
               </div>

            </div>
          ) : (
             <div className="flex min-h-[18rem] items-center justify-center p-8 text-center lg:min-h-full">
               <div>
                 <Sparkles aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-slate-700" />
                 <h2 className="text-base font-semibold text-slate-300">Нет доступных {getTerm('slaves', platform)}</h2>
                 <p className="mt-1 max-w-xs text-sm text-slate-500">Сдвиньте неделю, чтобы обновить списки рынка.</p>
               </div>
             </div>

          )}
        </div>

         <div className="relative min-h-[25rem] bg-slate-950 sm:min-h-[32rem] lg:min-h-0">
           {selectedCandidate ? (
             <>
               <div className="absolute inset-0 overflow-hidden">
                 {selectedCandidate.model3d && portraitMode === '3d' && !portrait3d.failed ? (
                   <Suspense
                     fallback={
                       <img
                         src={portraitSource}
                         alt={`Портрет: ${selectedCandidate.name}`}
                         width={1200}
                         height={1600}
                         loading="lazy"
                         className="h-full w-full object-cover object-center opacity-85"
                         style={{ width: '100%', height: '100%' }}
                       />
                     }
                   >
                     <div className="absolute inset-0 opacity-85">
                       <LazyPortrait3DCanvas
                         model={selectedCandidate.model3d}
                         onError={() => setPortrait3d(prev => ({ ...prev, failed: true }))}
                       />
                     </div>
                   </Suspense>
                 ) : (
                   <img
                     src={portraitSource}
                     alt={failedPortraitCharacterId === selectedCandidate.id ? 'Иллюстративный портрет полностью одетой женщины, фотограф Лукас Кепнер, Unsplash' : `Портрет: ${selectedCandidate.name}`}
                     width={1200}
                     height={1600}
                     loading="lazy"
                     onError={() => setFailedPortraitCharacterId(selectedCandidate.id)}
                     className="h-full w-full object-cover object-center opacity-85"
                     style={{ width: '100%', height: '100%' }}
                   />
                 )}
                 <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-slate-950/20" />
               </div>
               <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
                 <span className="rounded border border-white/10 bg-slate-950/75 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-200">Портрет кандидата</span>
                 <span className="rounded border border-white/10 bg-slate-950/75 px-2 py-1 text-[10px] text-slate-300">Превью</span>
               </div>
               <button
                 type="button"
                 onClick={() => onPreviewImage?.(portraitSource)}
                 aria-label={`Открыть портрет ${selectedCandidate.name} в полном размере`}
                 className="absolute inset-0 flex items-center justify-center bg-transparent opacity-0 transition hover:bg-black/10 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-amber-400"
               >
                 <Maximize2 aria-hidden="true" className="h-8 w-8 text-white drop-shadow" />
               </button>
               <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                 <p className="text-sm font-semibold text-white">{selectedCandidate.name}</p>
                 <p className="mt-1 text-[11px] leading-relaxed text-slate-300/80">{failedPortraitCharacterId === selectedCandidate.id ? 'Изображение профиля недоступно; показан иллюстративный портрет.' : 'Портрет из профиля выбранного кандидата.'}</p>
                 <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-400/80"><MapPin aria-hidden="true" className="h-3 w-3" /> {failedPortraitCharacterId === selectedCandidate.id ? 'Фото: Лукас Кепнер / Unsplash' : selectedCandidate.regionName}</p>
               </div>
             </>
           ) : (
             <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-xs text-slate-600">
               Выберите {getTerm('slave_fem', platform)}, чтобы посмотреть профиль.
             </div>
           )}
         </div>

      </div>
    </section>
  );
}
