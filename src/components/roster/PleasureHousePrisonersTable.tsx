import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, HeartPulse, MessageSquare, Send, UserRound } from 'lucide-react';
import { getTerm, type Platform } from '../../terminology';
import { calculateAttractiveness, type Character } from '../../gameEngine';
import type { ManagedCampaignState } from '../../saveState';
import type { PleasureHouseUpgradeId } from '../../pleasureHouseEngine';
import { PLEASURE_HOUSE_UPGRADES, PLEASURE_HOUSE_UPGRADE_IDS } from '../../pleasureHouseEngine';
import { GESTATION_DAYS, getWardDefinition, isObservationStay, isTreatmentStay } from '../../hospitalEngine';
import { isOnCaptureOp } from '../../captureOpsEngine';
import { marketValueOf } from '../../slaveContractsEngine';
import {
  buildMarketEntryStory,
  prisonerTraits,
  respondToPrisonerMessage,
  slaveOriginLabel,
  traitNamesText,
  type PrisonerChatMessage
} from '../../prisonerNarrativeEngine';
import { DependentsPanel } from './DependentsPanel';
import { PersonnelCard } from './PersonnelCard';
import { VenueBanner, VenueToolbar, VENUE_APPEARANCES } from '../venue';
import { formatMoney } from '../../currency';
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

interface PleasureHousePrisonersTableProps {
  gameState: ManagedCampaignState;
  platform: Platform;
  /**
   * Площадка, работники которой скрыты из этого списка (взаимное
   * исключение со стрип-клубом): назначенные туда пленники не отображаются.
   */
  excludeVenue?: NonNullable<Character['assignedVenue']>;
  onUpgrade: (trackId: PleasureHouseUpgradeId) => void;
  onAssignVenue: (charId: string, venue: NonNullable<Character['assignedVenue']>) => void;
  onBreakSlave: (charId: string) => void;
  onSellSlave: (character: Character) => void;
  onPreviewImage?: (imageUrl: string) => void;
  roleLabel: (role: string) => string;
  getCareSummary: (character: Character) => CareSummary;
}

type AssignmentFilter = 'all' | 'assigned' | 'unassigned';

const CONTROL_CLASS = 'min-h-8 rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 focus:border-slate-500 focus:outline-2 focus:outline-offset-1 focus:outline-amber-400';

export function PleasureHousePrisonersTable({
  gameState,
  platform,
  excludeVenue,
  onUpgrade,
  onAssignVenue,
  onBreakSlave,
  onSellSlave,
  onPreviewImage,
  roleLabel,
  getCareSummary
}: PleasureHousePrisonersTableProps) {
  const [query, setQuery] = useState('');
  const [selectedBio, setSelectedBio] = useState<Character | null>(null);
  const [bioTab, setBioTab] = useState<'biography' | 'chat'>('biography');
  const [chatHistory, setChatHistory] = useState<Record<string, PrisonerChatMessage[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [aiTyping, setAiTyping] = useState(false);
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all');
  const [sortId, setSortId] = useState<RosterSortId>('none');
  const [sortFlipped, setSortFlipped] = useState<Partial<Record<RosterSortId, boolean>>>({});

  const roster = gameState.roster;
  const prisoners = useMemo(
    () => roster.filter(char => char.isSlave && char.assignedVenue !== excludeVenue),
    [excludeVenue, roster]
  );
  const descending = sortFlipped[sortId] ?? rosterSortById(sortId).descending;
  const visiblePrisoners = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru');
    const filtered = prisoners.filter(char => {
      const unassigned = !char.assignedVenue || char.assignedVenue === 'unassigned';
      if (assignmentFilter === 'unassigned' && !unassigned) return false;
      if (assignmentFilter === 'assigned' && unassigned) return false;
      if (!needle) return true;
      return [char.name, char.role, char.country, char.regionName]
        .some(value => value?.toLocaleLowerCase('ru').includes(needle));
    });
    return sortRoster(filtered, sortId, descending, rosterSortValue);
  }, [assignmentFilter, descending, prisoners, query, sortId]);

  const idleCount = prisoners.filter(char => !char.assignedVenue || char.assignedVenue === 'unassigned').length;
  const assignedCount = prisoners.length - idleCount;
  const totalEarnings = prisoners.reduce((sum, char) => sum + (char.pleasureStats?.totalEarnings ?? 0), 0);
  const totalMarketValue = prisoners.reduce((sum, char) => sum + marketValueOf(char), 0);
  const hasActiveFilters = query.trim() !== '' || assignmentFilter !== 'all' || sortId !== 'none';

  const resetControls = () => {
    setQuery('');
    setAssignmentFilter('all');
    setSortId('none');
    setSortFlipped({});
  };

  const openPrisonerStory = (char: Character) => {
    setSelectedBio(char);
    setBioTab('biography');
  };

  const activeChat = selectedBio ? (chatHistory[selectedBio.id] ?? []) : [];

  useEffect(() => {
    chatLogRef.current?.scrollTo({ top: chatLogRef.current.scrollHeight });
  }, [activeChat.length, bioTab, aiTyping]);

  const sendChatMessage = (rawText: string) => {
    const clean = rawText.trim();
    if (!clean || !selectedBio) return;
    const charId = selectedBio.id;
    setChatHistory(prev => ({
      ...prev,
      [charId]: [...(prev[charId] ?? []), { id: `${charId}-p-${Date.now()}`, from: 'player', text: clean }]
    }));
    setChatInput('');
    setAiTyping(true);
    const reply = respondToPrisonerMessage(selectedBio, clean, gameState.dependents);
    setTimeout(() => {
      setChatHistory(prev => ({
        ...prev,
        [charId]: [...(prev[charId] ?? []), { id: `${charId}-ai-${Date.now()}`, from: 'ai', text: reply }]
      }));
      setAiTyping(false);
    }, 450);
  };

  const CHAT_SUGGESTIONS = [
    'Откуда ты?',
    'Как ты попал на рынок?',
    'У тебя есть семья?',
    'Какое у тебя настроение?',
    'Какой у тебя характер?',
    'Что ты чувствуешь?'
  ];

  return (
    <div className="space-y-3">
      {selectedBio && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`История попадания на рынке — ${selectedBio.name}`}
        >
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
             <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
               <div className="min-w-0">
                 <h3 className="text-base font-bold text-white">{getTerm('market_entry_story', platform)}</h3>
                 <p className="truncate text-[10px] italic text-slate-400">
                   {selectedBio.name} · {GENDER_LABELS[selectedBio.gender]} · {selectedBio.country || selectedBio.regionName}
                 </p>
                 <div className="mt-1 flex flex-wrap gap-1">
                   {prisonerTraits(selectedBio).map(trait => (
                     <span
                       key={trait.id}
                       title={trait.description}
                       className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-200"
                     >
                       {trait.name}
                     </span>
                   ))}
                 </div>
               </div>
              <button
                type="button"
                onClick={() => setSelectedBio(null)}
                aria-label="Закрыть"
                className="shrink-0 text-slate-400 transition hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex border-b border-slate-800" role="tablist" aria-label="Режимы просмотра истории">
              <button
                type="button"
                role="tab"
                aria-selected={bioTab === 'biography'}
                onClick={() => setBioTab('biography')}
                className={`flex-1 min-h-9 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-amber-400 ${bioTab === 'biography' ? 'border-b-2 border-rose-400 bg-rose-500/10 text-rose-200' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Биография ИИ
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={bioTab === 'chat'}
                onClick={() => setBioTab('chat')}
                className={`flex-1 min-h-9 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-amber-400 ${bioTab === 'chat' ? 'border-b-2 border-rose-400 bg-rose-500/10 text-rose-200' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Чат ИИ
              </button>
            </div>

            {bioTab === 'biography' ? (
              <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm leading-relaxed text-slate-300">
                <div className="flex items-start gap-3">
                  <img
                    src={selectedBio.image}
                    alt={`Портрет: ${selectedBio.name}`}
                    className="h-24 w-16 shrink-0 rounded-md border border-slate-700 object-cover"
                  />
                 <p className="italic text-slate-500">
                   Сгенерировано ИИ на основе данных о {getTerm('prisoner', platform).toLowerCase()}: регион, страна, навыки и источник захвата.
                 </p>
                </div>
                {selectedBio.biography && <p>{selectedBio.biography}</p>}
                {buildMarketEntryStory(selectedBio, gameState.dependents).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
                <p className="text-xs font-semibold text-rose-400">
                  Источник захвата: {slaveOriginLabel(selectedBio.slaveOrigin)}
                </p>
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-1 flex-col">
                <div ref={chatLogRef} className="flex-1 space-y-2 overflow-y-auto p-4">
                   {activeChat.length === 0 && !aiTyping ? (
                     <p className="py-6 text-center text-xs italic text-slate-500">
                       {selectedBio.name} молчит. Задайте вопрос — ИИ ответит от лица {getTerm('prisoner', platform).toLowerCase()}.
                     </p>
                   ) : (
                    activeChat.map(message => (
                      <div
                        key={message.id}
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${message.from === 'player' ? 'ml-auto bg-rose-700/80 text-white' : 'mr-auto bg-slate-800 text-slate-200'}`}
                      >
                        {message.text}
                      </div>
                    ))
                  )}
                  {aiTyping && (
                    <div className="mr-auto rounded-lg bg-slate-800 px-3 py-2 text-xs italic text-slate-400">
                      {selectedBio.name} печатает…
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 border-t border-slate-800 p-2">
                  {CHAT_SUGGESTIONS.map(suggestion => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => sendChatMessage(suggestion)}
                      className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] text-slate-300 transition hover:border-rose-400/60 hover:text-rose-200 focus-visible:outline-2 focus-visible:outline-rose-400"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <form
                  className="flex gap-2 border-t border-slate-800 p-3"
                  onSubmit={event => {
                    event.preventDefault();
                    sendChatMessage(chatInput);
                  }}
                >
                  <label className="sr-only" htmlFor={`prisoner-chat-${selectedBio.id}`}>
                    Сообщение для {selectedBio.name}
                  </label>
                   <input
                     id={`prisoner-chat-${selectedBio.id}`}
                     value={chatInput}
                     onChange={event => setChatInput(event.target.value)}
                     placeholder={`Спросите ${getTerm('prisoner', platform).toLowerCase()} о прошлом…`}
                     className="min-h-9 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-rose-400 focus:outline-2 focus:outline-rose-400"
                   />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    aria-label="Отправить сообщение"
                    className="min-h-9 rounded-md bg-rose-700 px-3 text-white transition hover:bg-rose-600 focus-visible:outline-2 focus-visible:outline-rose-300 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Send aria-hidden="true" className="h-4 w-4" />
                  </button>
                </form>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2">
              <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <MessageSquare aria-hidden="true" className="h-3 w-3" />
                Локальный ИИ: ответы строятся по данным пленника
              </span>
              <button
                type="button"
                onClick={() => setSelectedBio(null)}
                className="rounded-md bg-rose-700 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-rose-600 focus-visible:outline-2 focus-visible:outline-rose-300"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
       <VenueBanner
         title={`${getTerm('prisoners', platform)} Дома удовольствия`}
         description="Состояние команды, назначения и показатели пленников заведения — с быстрым доступом к портретам и действиям."
         imageSrc={VENUE_APPEARANCES.pleasureHouse.imageSrc}
         imageAlt={VENUE_APPEARANCES.pleasureHouse.imageAlt}
         accentClassName="text-rose-300"
         summary={(
           <>
             <span className="inline-flex items-center gap-1.5">{getTerm('prisoners', platform)} <strong className="font-mono text-slate-100">{prisoners.length}</strong></span>
             <span>Без назначения <strong className="font-mono text-amber-300">{idleCount}</strong></span>
             <span>Назначены <strong className="font-mono text-slate-100">{assignedCount}</strong></span>
             <span>Заработок ДУ <strong className="font-mono text-emerald-300">{formatMoney(totalEarnings)}</strong></span>
             <span>Общая оценка <strong className="font-mono text-emerald-300">{formatMoney(totalMarketValue)}</strong></span>
           </>
         )}
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
         searchLabel={`Поиск по ${getTerm('prisoners', platform).toLowerCase()} Дома удовольствия`}
         placeholder="Поиск по имени, роли, стране или региону…"
         summary={<span>Показано <strong className="font-mono text-slate-200">{visiblePrisoners.length}/{prisoners.length}</strong></span>}
         onReset={resetControls}
         hasActiveFilters={hasActiveFilters}
       >
        <div role="group" aria-label="Фильтр назначения" className="flex items-center gap-1">
          {([
            ['all', 'Все'],
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
        <label className="sr-only" htmlFor="pleasure-house-prisoners-sort">Сортировка пленников</label>
         <select
           id="pleasure-house-prisoners-sort"
           value={sortId}
           onChange={event => setSortId(event.target.value as RosterSortId)}
           className={CONTROL_CLASS}
         >
           {ROSTER_SORT_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
         </select>
         <button
           type="button"
           onClick={() => setSortFlipped(previous => ({ ...previous, [sortId]: !descending }))}
           disabled={sortId === 'none'}
           aria-label={`Сменить направление сортировки ${getTerm('prisoners', platform).toLowerCase()}`}
           className={`${CONTROL_CLASS} inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40`}
         >
           <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-rose-300" />
           {descending ? 'По убыванию' : 'По возрастанию'}
         </button>
      </VenueToolbar>

       {visiblePrisoners.length === 0 ? (
         <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/70 px-4 py-10 text-center text-sm text-slate-400">
           <UserRound aria-hidden="true" className="mx-auto mb-3 h-9 w-9 text-slate-600" />
           {prisoners.length === 0 ? `${getTerm('prisoners', platform).charAt(0).toUpperCase() + getTerm('prisoners', platform).slice(1)} в доме удовольствия пока нет.` : 'Нет результатов по выбранному поиску или фильтрам.'}
         </div>
       ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {visiblePrisoners.map(char => {
            const isCEO = char.role.includes('Chief Executive');
            const restPlacement = gameState.restZone.placements.find(item => item.characterId === char.id);
            const stay = gameState.hospital.patients.find(patient => patient.characterId === char.id);
            const listedAtAuction = gameState.auctionHouse.pendingLots.some(lot => 'characterId' in lot && lot.characterId === char.id);
            const careSummary = char.isSlave && char.gender === 'women' ? getCareSummary(char) : null;
            const metrics = [
              { label: 'Навык', value: char.skill },
              { label: 'Привл.', value: `${calculateAttractiveness(char)}/100`, valueClassName: 'text-amber-300' },
              { label: 'Покор.', value: `${char.submission || 50}%`, valueClassName: 'text-purple-300' },
              { label: 'Здоровье', value: isCEO ? `${char.exactHealth}%` : HEALTH_LABELS[char.healthLevel], valueClassName: 'text-emerald-300' },
              { label: 'Усталость', value: isCEO ? `${char.exactExhaustion}%` : EXHAUSTION_LABELS[char.exhaustionLevel], valueClassName: 'text-amber-300' },
              { label: 'Возраст', value: char.age },
              ...(char.height ? [{ label: 'Рост', value: `${char.height} см` }] : []),
              ...(char.bodyWeight ? [{ label: 'Вес', value: `${char.bodyWeight} кг` }] : []),
              ...(char.breastSize != null && char.gender !== 'men' ? [{ label: 'Грудь', value: ['AA','A','B','C','D','DD','E'][char.breastSize] ?? char.breastSize }] : []),
              ...(char.hairColor ? [{ label: 'Волосы', value: char.hairColor }] : []),
              ...(char.eyeColor ? [{ label: 'Глаза', value: char.eyeColor }] : []),
            ];
            return (
               <PersonnelCard
                 key={char.id}
                 character={char}
                 platform={platform}
                 accentClassName="border-l-2 border-l-rose-500/70"
                 onPreviewImage={onPreviewImage}
                 badges={(
                   <div className="flex shrink-0 flex-col items-end gap-0.5">
                     {isCEO && <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-[8px] font-bold text-amber-200">CEO</span>}
                     {char.isSlave && <span className="rounded border border-rose-500/30 bg-rose-500/10 px-1 py-0.5 text-[8px] font-bold text-rose-200">{getTerm('prisoner', platform).toUpperCase()}</span>}
                     {isOnCaptureOp(char) && <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-[8px] font-bold text-amber-200">В ПОЛЕ</span>}
                   </div>
                )}
                metrics={metrics}
                details={(
                  <>
                    <p className="truncate" title={`${roleLabel(char.role)} · ${GENDER_LABELS[char.gender]} · ${char.country || char.regionName}`}>
                      {roleLabel(char.role)} · {GENDER_LABELS[char.gender]} · {char.country || char.regionName}
                    </p>
                    <p className="truncate font-mono text-slate-500" title={`Рынок ${formatMoney(marketValueOf(char))} · неделя ${char.acquiredWeek ?? '—'}`}>
                      Рынок {formatMoney(marketValueOf(char))} · нед. {char.acquiredWeek ?? '—'}
                      {char.pleasureStats && ` · доход ${formatMoney(char.pleasureStats.totalEarnings)}`}
                    </p>
                    {char.pleasureStats && <p className="truncate text-rose-300">ДУ · В {char.pleasureStats.vaginalCount} / А {char.pleasureStats.analCount}</p>}
                    <p
                      className="truncate text-purple-300"
                      title={prisonerTraits(char).map(trait => `${trait.name}: ${trait.description}`).join(' · ')}
                    >
                      Характер: {traitNamesText(char)}
                    </p>
                    {restPlacement && <p className="truncate text-sky-300">Отдых · {restPlacement.weeksRemaining} нед.</p>}
                    {stay && <p className="truncate text-pink-300">Больница · {getWardDefinition(stay.wardId)?.name ?? 'палата'} · {stay.weeksRemaining} нед.</p>}
                    {careSummary && <p className={`mt-1 line-clamp-2 rounded border px-1.5 py-1 ${careSummary.tone}`} title={careSummary.needs.join(' · ')}>{careSummary.status}: {careSummary.needs.join(' · ')}</p>}
                    {char.isSlave && char.gender === 'women' && char.pregnancy && (
                      <p className="mt-1 flex items-center gap-1 text-pink-300">
                        <HeartPulse aria-hidden="true" className="h-3 w-3 shrink-0" />
                        Беременность · {Math.round(char.pregnancy.daysPregnant / 7)}/{GESTATION_DAYS / 7} нед.
                      </p>
                    )}
                  </>
                )}
                actions={(
                  <div className="space-y-1.5">
                    <label className="sr-only" htmlFor={`prisoner-venue-${char.id}`}>Место работы для {char.name}</label>
                    <select
                      id={`prisoner-venue-${char.id}`}
                      value={char.assignedVenue || 'unassigned'}
                      onChange={event => onAssignVenue(char.id, event.target.value as NonNullable<Character['assignedVenue']>)}
                      className="min-h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-[10px] font-medium text-slate-200 focus:border-rose-400 focus:outline-2 focus:outline-rose-400"
                    >
                      {char.assignedVenue === 'trade' && <option value="trade">{VENUE_LABELS.trade}</option>}
                      <option value="beauty_salon">{VENUE_LABELS.beauty_salon}</option>
                      <option value="strip_club">{VENUE_LABELS.strip_club}</option>
                      <option value="pleasure_house">{VENUE_LABELS.pleasure_house}</option>
                      <option value="auction_house">{VENUE_LABELS.auction_house}</option>
                      <option value="unassigned">{VENUE_LABELS.unassigned}</option>
                    </select>
                    {char.isSlave && (
                      <div className="grid grid-cols-2 gap-1">
                        <button type="button" onClick={() => onBreakSlave(char.id)} className="min-h-7 rounded bg-purple-700/80 px-1 text-[9px] font-bold text-white transition hover:bg-purple-600 focus-visible:outline-2 focus-visible:outline-purple-300">Умиротворить</button>
                        <button type="button" onClick={() => onSellSlave(char)} disabled={listedAtAuction} className="min-h-7 rounded bg-rose-700/80 px-1 text-[9px] font-bold text-white transition hover:bg-rose-600 focus-visible:outline-2 focus-visible:outline-rose-300 disabled:cursor-not-allowed disabled:opacity-45">
                          {listedAtAuction ? 'На аукционе' : 'Продать'}
                        </button>
                      </div>
                    )}
                     <button type="button" onClick={() => openPrisonerStory(char)} title={getTerm('market_entry_story', platform)} className="min-h-7 rounded bg-slate-700/80 px-1 text-[9px] font-bold text-slate-200 transition hover:bg-slate-600 focus-visible:outline-2 focus-visible:outline-slate-300">{getTerm('market_entry_story', platform)}</button>
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
