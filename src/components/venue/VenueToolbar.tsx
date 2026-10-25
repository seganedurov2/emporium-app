import type { ReactNode } from 'react';
import { RotateCcw, Search } from 'lucide-react';

interface VenueToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  searchLabel: string;
  placeholder: string;
  summary?: ReactNode;
  children?: ReactNode;
  onReset?: () => void;
  hasActiveFilters?: boolean;
}

export function VenueToolbar({
  query,
  onQueryChange,
  searchLabel,
  placeholder,
  summary,
  children,
  onReset,
  hasActiveFilters = false
}: VenueToolbarProps) {
  return (
    <section aria-label={searchLabel} className="space-y-2 border-b border-slate-800 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-xs text-slate-400">{summary}</div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {children}
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              disabled={!hasActiveFilters}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              Сбросить
            </button>
          )}
        </div>
      </div>
      <label className="relative block">
        <span className="sr-only">{searchLabel}</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-8 w-full rounded-md border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-slate-500 focus:outline-2 focus:outline-offset-1 focus:outline-amber-400"
        />
      </label>
    </section>
  );
}
