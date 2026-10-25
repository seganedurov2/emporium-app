import { useEffect, useRef, useState } from 'react';
import {
  Bell, BedDouble, CheckCheck, FileText, HeartPulse, Scissors, ScrollText,
  Shield, Siren, Sparkles, Target, Truck, TriangleAlert, X
} from 'lucide-react';
import type { AppTab } from '../../appNavigation';
import {
  FEED_CATEGORY_ORDER,
  FEED_SECTION_KEYS,
  type ActivityFeed,
  type FeedCategory,
  type FeedIcon,
  type FeedItem,
  type FeedTone
} from './notificationFeed';

type FeedFilter = FeedCategory | 'all';

interface NotificationCenterProps {
  feed: ActivityFeed;
  onNavigate: (tab: AppTab) => void;
}

const FEED_ICONS: Record<FeedIcon, typeof Bell> = {
  bell: Bell,
  truck: Truck,
  target: Target,
  shield: Shield,
  file: FileText,
  bed: BedDouble,
  scissors: Scissors,
  hospital: HeartPulse,
  scroll: ScrollText,
  sparkles: Sparkles,
  siren: Siren,
  alert: TriangleAlert
};

const CATEGORY_LABELS: Record<FeedCategory, string> = {
  notification: 'Уведомления',
  task: 'Задания',
  event: 'События',
  incident: 'Происшествия'
};

const FILTER_ORDER: FeedFilter[] = ['all', ...FEED_CATEGORY_ORDER];

const TONE_BADGE: Record<FeedTone, string> = {
  neutral: 'border-slate-800 bg-slate-950 text-slate-400',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  danger: 'border-red-500/30 bg-red-500/10 text-red-300'
};

const TONE_TEXT: Record<FeedTone, string> = {
  neutral: 'text-slate-100',
  info: 'text-sky-200',
  success: 'text-emerald-200',
  warning: 'text-amber-200',
  danger: 'text-red-200'
};

export function NotificationCenter({ feed, onNavigate }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const unreadCount = feed.actionableIds.filter(id => !acknowledged.includes(id)).length;
  const acknowledgeAll = () => setAcknowledged(previous => [...new Set([...previous, ...feed.actionableIds])]);

  const openItem = (item: FeedItem) => {
    setAcknowledged(previous => (previous.includes(item.id) ? previous : [...previous, item.id]));
    if (!item.tab) return;
    onNavigate(item.tab);
    setIsOpen(false);
  };

  const renderRow = (item: FeedItem) => {
    const Icon = FEED_ICONS[item.icon];
    const isUnread = item.actionable === true && !acknowledged.includes(item.id);
    return (
      <li key={item.id}>
        <button
          type="button"
          onClick={() => openItem(item)}
          className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-slate-800/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-400"
        >
          <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${TONE_BADGE[item.tone]}`}>
            <Icon aria-hidden="true" className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block text-xs font-semibold leading-snug ${TONE_TEXT[item.tone]}`}>
              {item.title}
              {isUnread && <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" aria-label="не прочитано" />}
            </span>
            {item.detail && <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{item.detail}</span>}
            {item.meta && <span className="mt-1 block font-mono text-[10px] text-slate-600">{item.meta}</span>}
          </span>
        </button>
      </li>
    );
  };

  const renderSection = (category: FeedCategory) => {
    const items = feed[FEED_SECTION_KEYS[category]];
    return (
      <section key={category} aria-label={CATEGORY_LABELS[category]}>
        <h4 className="sticky top-0 z-10 flex items-center justify-between border-y border-slate-800 bg-slate-900/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 backdrop-blur">
          {CATEGORY_LABELS[category]}
          <span className="font-mono text-slate-600">{items.length}</span>
        </h4>
        {items.length === 0
          ? <p className="px-3 py-4 text-xs text-slate-600">Пусто.</p>
          : <ul className="divide-y divide-slate-800/70">{items.map(renderRow)}</ul>}
      </section>
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(open => !open)}
        aria-label="Центр уведомлений"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls="activity-feed-panel"
        title="Уведомления, задания, события и происшествия"
        className="relative rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-slate-200 transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
      >
        <Bell aria-hidden="true" className="h-4 w-4 text-amber-400" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 font-mono text-[9px] font-bold text-white shadow">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id="activity-feed-panel"
          role="dialog"
          aria-label="Уведомления, задания, события и происшествия"
          className="absolute right-0 top-full z-50 mt-2 flex max-h-[70vh] w-[min(30rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2.5">
            <div>
              <h3 className="text-sm font-bold text-white">Центр событий</h3>
              <p className="text-[11px] text-slate-500">Уведомления, задания, события и происшествия</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={acknowledgeAll}
                disabled={unreadCount === 0}
                title="Отметить всё прочитанным"
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                <CheckCheck aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Закрыть центр событий"
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-800 px-2 py-2">
            {FILTER_ORDER.map(option => {
              const count = option === 'all'
                ? FEED_CATEGORY_ORDER.reduce((sum, key) => sum + feed[FEED_SECTION_KEYS[key]].length, 0)
                : feed[FEED_SECTION_KEYS[option]].length;
              const label = option === 'all' ? 'Все' : CATEGORY_LABELS[option];
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  aria-pressed={filter === option}
                  className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                    filter === option
                      ? 'border-amber-400/50 bg-amber-400/15 text-amber-200'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  {label}
                  <span className="ml-1.5 font-mono text-[10px] text-slate-500">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            {filter === 'all'
              ? FEED_CATEGORY_ORDER.map(renderSection)
              : renderSection(filter)}
          </div>

          <div className="border-t border-slate-800 px-3 py-2 text-[10px] text-slate-600">
            Не прочитано: <span className="font-mono text-slate-400">{unreadCount}</span> · всего строк{' '}
            <span className="font-mono text-slate-400">{FEED_CATEGORY_ORDER.reduce((sum, key) => sum + feed[FEED_SECTION_KEYS[key]].length, 0)}</span>
          </div>
        </div>
      )}
    </div>
  );
}