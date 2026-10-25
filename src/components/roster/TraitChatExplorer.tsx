import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, MessageSquare, Search, Send, Sparkles, Users } from 'lucide-react';
import type { Character } from '../../gameEngine';
import type { ManagedCampaignState } from '../../saveState';
import {
  buildMarketEntryStory,
  PERSONALITY_TRAITS,
  prisonerTraits,
  prisonersByTrait,
  respondToPrisonerMessage,
  slaveOriginLabel,
  traitChatGreeting,
  traitChatSuggestions,
  traitBiography,
  traitNamesText,
  type PersonalityTrait,
  type PrisonerChatMessage
} from '../../prisonerNarrativeEngine';

interface TraitChatExplorerProps {
  gameState: ManagedCampaignState;
  onPreviewImage?: (imageUrl: string) => void;
}

/**
 * Каталог чатов по чертам характера в стиле FlowGPT:
 * сетка карточек черт → список пленников с чертой → чат с ИИ-биографией.
 */
export function TraitChatExplorer({ gameState, onPreviewImage }: TraitChatExplorerProps) {
  const [query, setQuery] = useState('');
  const [activeTrait, setActiveTrait] = useState<PersonalityTrait | null>(null);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [chatHistory, setChatHistory] = useState<Record<string, PrisonerChatMessage[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [aiTyping, setAiTyping] = useState(false);
  const [showBio, setShowBio] = useState(true);
  const chatLogRef = useRef<HTMLDivElement | null>(null);

  const visibleTraits = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru');
    return PERSONALITY_TRAITS
      .map(trait => ({ trait, prisoners: prisonersByTrait(gameState.roster, trait.id) }))
      .filter(entry => {
        if (!needle) return true;
        return (
          entry.trait.name.toLocaleLowerCase('ru').includes(needle)
          || entry.trait.description.toLocaleLowerCase('ru').includes(needle)
        );
      });
  }, [gameState.roster, query]);

  const traitPrisoners = activeTrait ? prisonersByTrait(gameState.roster, activeTrait.id) : [];
  const activeChat = selectedChar ? (chatHistory[selectedChar.id] ?? []) : [];

  useEffect(() => {
    chatLogRef.current?.scrollTo({ top: chatLogRef.current.scrollHeight });
  }, [activeChat.length, aiTyping]);

  const openTrait = (trait: PersonalityTrait) => {
    setActiveTrait(trait);
    setSelectedChar(null);
  };

  const closeTrait = () => {
    setActiveTrait(null);
    setSelectedChar(null);
  };

  const openChat = (char: Character) => {
    setSelectedChar(char);
    setChatHistory(prev => {
      if (prev[char.id]?.length) return prev;
      return { ...prev, [char.id]: [{ id: `${char.id}-greet`, from: 'ai', text: traitChatGreeting(char) }] };
    });
  };

  const sendChatMessage = (rawText: string) => {
    const clean = rawText.trim();
    if (!clean || !selectedChar) return;
    const charId = selectedChar.id;
    setChatHistory(prev => ({
      ...prev,
      [charId]: [...(prev[charId] ?? []), { id: `${charId}-p-${Date.now()}`, from: 'player', text: clean }]
    }));
    setChatInput('');
    setAiTyping(true);
    const reply = respondToPrisonerMessage(selectedChar, clean, gameState.dependents);
    setTimeout(() => {
      setChatHistory(prev => ({
        ...prev,
        [charId]: [...(prev[charId] ?? []), { id: `${charId}-ai-${Date.now()}`, from: 'ai', text: reply }]
      }));
      setAiTyping(false);
    }, 450);
  };

  if (!activeTrait) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-white">
            <Sparkles aria-hidden="true" className="h-5 w-5 text-purple-300" />
            Чаты по чертам характера
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Каталог ИИ-собеседников: выбери черту характера — и заговорит пленник с таким характером. Биография каждого составлена ИИ по его чертам.
          </p>
          <div className="relative mt-3">
            <label className="sr-only" htmlFor="trait-chat-search">Поиск по чертам характера</label>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="trait-chat-search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Найди черту: стоик, бунтарь, хитрец…"
              className="min-h-10 w-full rounded-md border border-slate-700 bg-slate-950 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-purple-400 focus:outline-2 focus:outline-purple-400"
            />
          </div>
        </div>

        {visibleTraits.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/70 px-4 py-10 text-center text-sm text-slate-400">
            <MessageSquare aria-hidden="true" className="mx-auto mb-3 h-9 w-9 text-slate-600" />
            Нет черт по запросу «{query}».
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visibleTraits.map(({ trait, prisoners }) => (
              <button
                key={trait.id}
                type="button"
                onClick={() => openTrait(trait)}
                className="group flex flex-col rounded-lg border border-slate-800 bg-slate-900/80 p-4 text-left transition hover:border-purple-500/50 hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white">{trait.name}</h3>
                  <span
                    className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-200"
                    title="Пленников с этой чертой"
                  >
                    {prisoners.length}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{trait.description}</p>
                <div className="mt-3 flex min-h-6 flex-wrap items-center gap-1">
                  {prisoners.slice(0, 3).map(char => (
                    <span
                      key={char.id}
                      className="rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[10px] text-slate-300"
                    >
                      {char.name}
                    </span>
                  ))}
                  {prisoners.length === 0 && (
                    <span className="text-[10px] italic text-slate-600">пленников пока нет</span>
                  )}
                  {prisoners.length > 3 && (
                    <span className="text-[10px] text-slate-500">+{prisoners.length - 3}</span>
                  )}
                </div>
                <span className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-purple-300 opacity-0 transition group-hover:opacity-100">
                  <MessageSquare aria-hidden="true" className="h-3 w-3" />
                  Открыть чат
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const selectedInTrait = selectedChar && traitPrisoners.some(char => char.id === selectedChar.id) ? selectedChar : null;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={closeTrait}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950 px-3 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-400"
      >
        <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
        Все черты характера
      </button>

      <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
        <h2 className="text-base font-bold text-white">{activeTrait.name}</h2>
        <p className="mt-0.5 text-xs italic text-slate-400">{activeTrait.description}</p>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-purple-200">
          <Users aria-hidden="true" className="h-3.5 w-3.5" />
          Пленников с чертой: <strong className="font-mono">{traitPrisoners.length}</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-1">
          <h3 className="px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Пленники с чертой «{activeTrait.name}»
          </h3>
          {traitPrisoners.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/70 px-4 py-8 text-center text-xs text-slate-400">
              Пленников с этой чертой пока нет в реестре.
            </div>
          ) : (
            traitPrisoners.map(char => (
              <button
                key={char.id}
                type="button"
                onClick={() => openChat(char)}
                className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-amber-400 ${
                  selectedInTrait?.id === char.id
                    ? 'border-purple-500/60 bg-purple-500/10'
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'
                }`}
              >
                <img
                  src={char.image}
                  alt={`Портрет: ${char.name}`}
                  className="h-10 w-8 shrink-0 rounded border border-slate-700 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">{char.name}</p>
                  <p className="truncate text-[10px] text-slate-500">
                    {char.country || char.regionName} · {char.age} лет · навык {char.skill}
                  </p>
                </div>
                <MessageSquare
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 shrink-0 ${selectedInTrait?.id === char.id ? 'text-purple-300' : 'text-slate-600'}`}
                />
              </button>
            ))
          )}
        </div>

        <div className="flex min-h-[480px] flex-col rounded-lg border border-slate-800 bg-slate-900/80 lg:col-span-2">
          {selectedInTrait ? (
            <>
              <div className="flex items-start gap-3 border-b border-slate-800 px-4 py-3">
                <img
                  src={selectedInTrait.image}
                  alt={`Портрет: ${selectedInTrait.name}`}
                  className="h-14 w-11 shrink-0 rounded-md border border-slate-700 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-white">{selectedInTrait.name}</h3>
                  <p className="truncate text-[10px] text-slate-500">
                    {selectedInTrait.country || selectedInTrait.regionName} · {selectedInTrait.age} лет · навык {selectedInTrait.skill}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {prisonerTraits(selectedInTrait).map(trait => (
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
                {onPreviewImage && (
                  <button
                    type="button"
                    onClick={() => onPreviewImage(selectedInTrait.image)}
                    className="shrink-0 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-300 transition hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-amber-400"
                  >
                    Портрет
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowBio(prev => !prev)}
                aria-expanded={showBio}
                className="flex items-center justify-between border-b border-slate-800 px-4 py-2 text-left text-[11px] font-bold text-purple-200 transition hover:bg-purple-500/5 focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                <span>ИИ-биография по чертам характера</span>
                <span className="text-[10px] font-normal text-slate-500">{showBio ? 'Свернуть' : 'Развернуть'}</span>
              </button>

              {showBio && (
                <div className="max-h-56 space-y-2 overflow-y-auto border-b border-slate-800 px-4 py-3 text-xs leading-relaxed text-slate-300">
                  {traitBiography(selectedInTrait).map((paragraph, index) => (
                    <p key={`bio-${index}`}>{paragraph}</p>
                  ))}
                  {buildMarketEntryStory(selectedInTrait, gameState.dependents).map((paragraph, index) => (
                    <p key={`story-${index}`} className="text-slate-400">{paragraph}</p>
                  ))}
                  <p className="text-[10px] font-semibold text-rose-400">
                    Источник захвата: {slaveOriginLabel(selectedInTrait.slaveOrigin)}
                  </p>
                </div>
              )}

              <div ref={chatLogRef} className="flex-1 space-y-2 overflow-y-auto p-4">
                {activeChat.length === 0 && !aiTyping ? (
                  <p className="py-6 text-center text-xs italic text-slate-500">
                    {selectedInTrait.name} молчит. Задайте вопрос — ИИ ответит от лица пленника.
                  </p>
                ) : (
                  activeChat.map(message => (
                    <div
                      key={message.id}
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                        message.from === 'player'
                          ? 'ml-auto bg-purple-700/80 text-white'
                          : 'mr-auto bg-slate-800 text-slate-200'
                      }`}
                    >
                      {message.text}
                    </div>
                  ))
                )}
                {aiTyping && (
                  <div className="mr-auto rounded-lg bg-slate-800 px-3 py-2 text-xs italic text-slate-400">
                    {selectedInTrait.name} печатает…
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 border-t border-slate-800 p-2">
                {traitChatSuggestions(selectedInTrait).map(suggestion => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => sendChatMessage(suggestion)}
                    className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] text-slate-300 transition hover:border-purple-400/60 hover:text-purple-200 focus-visible:outline-2 focus-visible:outline-purple-400"
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
                <label className="sr-only" htmlFor={`trait-chat-${selectedInTrait.id}`}>
                  Сообщение для {selectedInTrait.name}
                </label>
                <input
                  id={`trait-chat-${selectedInTrait.id}`}
                  value={chatInput}
                  onChange={event => setChatInput(event.target.value)}
                  placeholder={`Спросите ${selectedInTrait.name} о прошлом…`}
                  className="min-h-9 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-purple-400 focus:outline-2 focus:outline-purple-400"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  aria-label="Отправить сообщение"
                  className="min-h-9 rounded-md bg-purple-700 px-3 text-white transition hover:bg-purple-600 focus-visible:outline-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Send aria-hidden="true" className="h-4 w-4" />
                </button>
              </form>

              <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2">
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <MessageSquare aria-hidden="true" className="h-3 w-3" />
                  Локальный ИИ: {traitNamesText(selectedInTrait)} — ответы строятся по чертам
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
              <Users aria-hidden="true" className="mb-3 h-9 w-9 text-slate-600" />
              <p className="text-sm text-slate-400">
                {traitPrisoners.length === 0
                  ? 'Пленников с этой чертой пока нет в реестре.'
                  : 'Выберите пленника слева, чтобы начать чат по черте характера.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
