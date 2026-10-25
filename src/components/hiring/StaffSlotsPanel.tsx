import { Briefcase, UserPlus, Wallet } from 'lucide-react';
import {
  BASE_EMPLOYEE_SLOTS,
  HIRING_SLOT_COST_GROWTH,
  HIRING_SLOT_UPKEEP,
  hiringSlotUpkeep,
  quoteHiringSlot
} from '../../employeesEngine';
import { formatMoney } from '../../currency';

interface StaffSlotsPanelProps {
  /** Staff positions the company can fill right now. */
  hiringSlots: number;
  /** Employees already on the payroll. */
  employeeCount: number;
  funds: number;
  onBuySlot: () => void;
  /** `card` for the hiring page section, `plain` for the staff department header. */
  variant?: 'card' | 'plain';
}

/** Staff positions available, what the next one costs and what it adds per week. */
export function StaffSlotsPanel({
  hiringSlots, employeeCount, funds, onBuySlot, variant = 'card'
}: StaffSlotsPanelProps) {
  const quote = quoteHiringSlot(hiringSlots, funds);
  const boughtSlots = Math.max(0, hiringSlots - BASE_EMPLOYEE_SLOTS);
  const atCapacity = employeeCount >= hiringSlots;
  const upkeep = hiringSlotUpkeep(hiringSlots);

  if (variant === 'plain') {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
        <span className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-slate-300">
          <Briefcase aria-hidden="true" className="h-4 w-4 text-amber-300" />
          {employeeCount}/{hiringSlots}
        </span>
        <button
          type="button"
          onClick={onBuySlot}
          disabled={!quote.affordable}
          title={quote.affordable ? undefined : `Не хватает средств: нужно ${formatMoney(quote.cost)}.`}
          className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 px-3 py-2 font-bold text-amber-200 transition hover:border-amber-400 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
        >
          <UserPlus aria-hidden="true" className="h-4 w-4" />
          Место · {formatMoney(quote.cost)}
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby="staff-slots-title" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Briefcase className="mt-0.5 h-4 w-4 text-amber-300" aria-hidden="true" />
          <h3 id="staff-slots-title" className="text-sm font-semibold text-slate-100">Места в штате</h3>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
            atCapacity
              ? 'border-amber-500/40 text-amber-200'
              : 'border-emerald-500/40 text-emerald-200'
          }`}
        >
          {employeeCount}/{hiringSlots}
        </span>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        {BASE_EMPLOYEE_SLOTS} мест сотрудников бесплатны. Остальные покупаются по одному без верхнего
        ограничения: каждое следующее дороже предыдущего на {Math.round(HIRING_SLOT_COST_GROWTH * 100)}%
        и добавляет {formatMoney(HIRING_SLOT_UPKEEP)}/нед. к содержанию, даже пока место пустое.
      </p>

      {boughtSlots > 0 && (
        <p className="mt-1 text-[11px] text-slate-500">
          Куплено дополнительных мест: {boughtSlots} · содержание {formatMoney(upkeep)}/нед.
        </p>
      )}

      {atCapacity && (
        <p className="mt-1 text-[11px] font-semibold text-amber-300">
          Штат заполнен: ещё один сотрудник потребует купленного места.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBuySlot}
          disabled={!quote.affordable}
          title={quote.affordable ? undefined : `Не хватает средств: нужно ${formatMoney(quote.cost)}.`}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Купить место · {quote.slotsAfter} мест · {formatMoney(quote.cost)}
        </button>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-300">
          <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
          {formatMoney(funds)} в казне
        </span>
      </div>
    </section>
  );
}