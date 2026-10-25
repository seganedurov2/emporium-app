import { ClipboardList, TrendingUp, UserRound, Wallet, Wrench } from 'lucide-react';
import type { RequestVenueId, VenueAdministratorRequest } from '../../administratorEngine';
import { VENUE_ADMINISTRATORS } from '../../administratorEngine';
import { formatMoney } from '../../currency';

const TYPE_LABELS: Record<VenueAdministratorRequest['type'], string> = {
  hire: 'НАЙМ',
  upgrade: 'УЛУЧШЕНИЕ',
  expansion: 'РАСШИРЕНИЕ'
};

const TYPE_ICONS: Record<VenueAdministratorRequest['type'], typeof Wrench> = {
  hire: UserRound,
  upgrade: Wrench,
  expansion: TrendingUp
};

const PRIORITY_STYLES: Record<VenueAdministratorRequest['priority'], string> = {
  High: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  Medium: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  Low: 'border-slate-600/60 bg-slate-700/20 text-slate-400'
};

const PRIORITY_LABELS: Record<VenueAdministratorRequest['priority'], string> = {
  High: 'Высокий приоритет',
  Medium: 'Средний приоритет',
  Low: 'Низкий приоритет'
};

export interface VenueAdministratorPanelProps {
  venue: RequestVenueId;
  request: VenueAdministratorRequest | null;
  funds: number;
  onAccept: (venue: RequestVenueId) => void;
}

/**
 * Панель администратора площадки: кто управляет зоной,
 * какой запрос или предложение он вынес и кнопку выполнения.
 */
export function VenueAdministratorPanel({
  venue,
  request,
  funds,
  onAccept
}: VenueAdministratorPanelProps) {
  const admin = VENUE_ADMINISTRATORS[venue];
  if (!admin) return null;
  const affordable = request ? funds >= request.cost : false;
  const TypeIcon = request ? TYPE_ICONS[request.type] : ClipboardList;

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/80" aria-label={`Администратор: ${admin.workplace}`}>
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2">
        <UserRound aria-hidden="true" className="h-4 w-4 text-violet-300" />
        <div className="min-w-0">
          <h2 className="text-xs font-semibold text-white">
            {admin.name} <span className="font-normal text-slate-400">— {admin.role}</span>
          </h2>
          <p className="text-[10px] text-slate-500">
            Рабочее место: {admin.workplace} · {admin.workplaceRoles.join(' / ')}
          </p>
        </div>
        <span className="ml-auto hidden text-[10px] text-slate-500 sm:block">{admin.blurb}</span>
      </header>

      {request ? (
        <div className="space-y-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold text-violet-200">
              <TypeIcon aria-hidden="true" className="h-3 w-3" />
              {TYPE_LABELS[request.type]}
            </span>
            <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${PRIORITY_STYLES[request.priority]}`}>
              {PRIORITY_LABELS[request.priority]}
            </span>
            <span className="ml-auto font-mono text-[10px] text-slate-400">
              нед. {request.requestId.split('_').pop()}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-300">{request.description}</p>
          <p className="text-[10px] leading-relaxed text-slate-500">
            <ClipboardList aria-hidden="true" className="mr-1 inline h-3 w-3" />
            Ожидаемая выгода: {request.benefit}
          </p>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-mono text-xs text-emerald-300">
              <Wallet aria-hidden="true" className="h-3.5 w-3.5" />
              {request.cost > 0 ? `${formatMoney(request.cost)}` : 'бесплатно'}
            </span>
            <button
              type="button"
              onClick={() => onAccept(venue)}
              disabled={!affordable}
              className="ml-auto min-h-8 rounded-md bg-violet-700 px-3 text-[11px] font-bold text-white transition hover:bg-violet-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {affordable ? 'Принять запрос' : `Нужно ${formatMoney(request.cost)}`}
            </button>
          </div>
        </div>
      ) : (
        <p className="px-3 py-2 text-[11px] text-slate-500">
          {admin.name} пока не выдвигает запросов — зона работает штатно.
        </p>
      )}
    </section>
  );
}
