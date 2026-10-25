import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  Brain,
  Building2,
  HeartPulse,
  PackagePlus,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  UserRound,
  Wallet
} from 'lucide-react';
import { formatMoney as formatBtc } from '../../currency';
import type { EmployeeSpecialty } from '../../expansionTypes';
import type { HospitalEquipmentId, HospitalWardId } from '../../hospitalEngine';
import type {
  ChiefDoctorPriority,
  ChiefDoctorProposal,
  ChiefDoctorReport,
  ChiefDoctorRequest,
  ChiefDoctorRequestKind
} from '../../chiefDoctorEngine';
import {
  PRIORITY_LABELS,
  proposalKindLabel,
  requestKindLabel
} from '../../chiefDoctorEngine';

const PRIORITY_STYLES: Record<ChiefDoctorPriority, string> = {
  critical: 'border-red-500/40 bg-red-500/10 text-red-200',
  high: 'border-orange-500/40 bg-orange-500/10 text-orange-200',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  low: 'border-slate-500/40 bg-slate-500/10 text-slate-300'
};

const REQUEST_KIND_ICONS: Record<ChiefDoctorRequestKind, typeof Wallet> = {
  building: Building2,
  staff: UserRound,
  equipment: PackagePlus,
  ward: BedDouble,
  budget: Wallet
};

function RequestIcon({ kind }: { kind: ChiefDoctorRequestKind }) {
  const Icon = REQUEST_KIND_ICONS[kind];
  return <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />;
}

function RequestRow({ request }: { request: ChiefDoctorRequest }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5">
      <RequestIcon kind={request.kind} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-100">{request.title}</p>
          <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${PRIORITY_STYLES[request.priority]}`}>
            {PRIORITY_LABELS[request.priority]}
          </span>
          <span className="rounded-full border border-slate-700 px-2 py-0.5 font-mono text-[10px] text-slate-400">
            {requestKindLabel(request.kind)}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">{request.detail}</p>
      </div>
    </li>
  );
}

interface ChiefDoctorPanelProps {
  report: ChiefDoctorReport;
  onHireSpecialty: (specialty: EmployeeSpecialty) => void;
  onBuyHiringSlot: () => void;
  onBuyWard: (wardId: HospitalWardId, quantity: number) => void;
  onBuyEquipment: (itemId: HospitalEquipmentId, quantity: number) => void;
  onUpgradeHospital: () => void;
}

export function ChiefDoctorPanel({
  report,
  onHireSpecialty,
  onBuyHiringSlot,
  onBuyWard,
  onBuyEquipment,
  onUpgradeHospital
}: ChiefDoctorPanelProps) {
  const { assessment } = report;

  const accept = (proposal: ChiefDoctorProposal) => {
    switch (proposal.kind) {
      case 'hire':
        if (proposal.specialty) onHireSpecialty(proposal.specialty);
        break;
      case 'buy_slot':
        onBuyHiringSlot();
        break;
      case 'buy_ward':
        if (proposal.wardId) onBuyWard(proposal.wardId, proposal.quantity ?? 1);
        break;
      case 'buy_equipment':
        if (proposal.equipmentId) onBuyEquipment(proposal.equipmentId, proposal.quantity ?? 1);
        break;
      case 'upgrade_hospital':
        onUpgradeHospital();
        break;
    }
  };

  const formatMoney = (value: number) => formatBtc(Math.abs(value));

  return (
    <section aria-labelledby="chief-doctor-title" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-left shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2">
            <Stethoscope className="h-6 w-6 text-amber-300" aria-hidden="true" />
          </div>
          <div>
            <h2 id="chief-doctor-title" className="text-lg font-bold text-white">Главврач</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Нанимает медперсонал и даёт запросы и предложения по больнице с учётом доходов и расходов.
            </p>
          </div>
        </div>
        <span className="font-mono text-xs text-slate-500">неделя {report.week}</span>
      </div>

      {/* FINANCES */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase text-emerald-300/80">
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" /> Доходы
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-emerald-200">
            +{formatMoney(assessment.income)}
            <span className="text-[11px] font-normal text-emerald-300/70">/нед</span>
          </p>
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase text-rose-300/80">
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" /> Расходы
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-rose-200">
            −{formatMoney(assessment.expenses)}
            <span className="text-[11px] font-normal text-rose-300/70">/нед</span>
          </p>
        </div>
        <div className={`rounded-xl border p-3 ${assessment.netIncome < 0 ? 'border-rose-500/30 bg-rose-500/5' : 'border-sky-500/30 bg-sky-500/5'}`}>
          <div className={`flex items-center gap-1.5 text-[11px] uppercase ${assessment.netIncome < 0 ? 'text-rose-300/80' : 'text-sky-300/80'}`}>
            <HeartPulse className="h-3.5 w-3.5" aria-hidden="true" /> Баланс
          </div>
          <p className={`mt-1 font-mono text-lg font-bold ${assessment.netIncome < 0 ? 'text-rose-200' : 'text-sky-200'}`}>
            {assessment.netIncome < 0 ? '−' : '+'}{formatMoney(assessment.netIncome)}
            <span className="text-[11px] font-normal opacity-70">/нед</span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase text-slate-400">
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" /> Казна
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-slate-100">{formatMoney(assessment.funds)}</p>
        </div>
        <div className={`rounded-xl border p-3 ${assessment.runwayWeeks !== null && assessment.runwayWeeks < 8 ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-700 bg-slate-950/60'}`}>
          <div className="flex items-center gap-1.5 text-[11px] uppercase text-slate-400">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Запас
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-slate-100">
            {assessment.runwayWeeks === null ? '∞' : `${assessment.runwayWeeks} нед.`}
          </p>
        </div>
      </div>

      <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
        <span className="font-semibold text-amber-200">Заключение главврача: </span>
        {assessment.verdict}
        {' '}
        <span className="text-slate-500">
          (больница стоит {formatMoney(assessment.hospitalExpenses)}/нед.: палаты + медперсонал)
        </span>
      </p>

      {/* REQUESTS */}
      <div className="mt-5">
        <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-white">
          <AlertTriangle className="h-4 w-4 text-orange-300" aria-hidden="true" />
          Запросы больницы
          <span className="rounded-full border border-slate-700 px-2 py-0.5 font-mono text-[11px] text-slate-400">
            {report.requests.length}
          </span>
        </h3>
        {report.requests.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg border border-dashed border-slate-800 bg-slate-950/60 px-4 py-4 text-sm text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            Жалоб нет: больница обеспечена персоналом, палатами и расходниками.
          </p>
        ) : (
          <ul className="space-y-2">
            {report.requests.map(request => (
              <RequestRow key={request.id} request={request} />
            ))}
          </ul>
        )}
      </div>

      {/* PROPOSALS */}
      <div className="mt-5">
        <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-white">
          <UserPlus className="h-4 w-4 text-amber-300" aria-hidden="true" />
          Предложения главврача
          <span className="rounded-full border border-slate-700 px-2 py-0.5 font-mono text-[11px] text-slate-400">
            {report.proposals.length}
          </span>
        </h3>
        {report.proposals.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 px-4 py-4 text-sm text-slate-500">
            Нечего предлагать: все потребности больницы закрыты.
          </p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {report.proposals.map(proposal => (
              <li key={proposal.id} className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-white">{proposal.title}</p>
                  <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${PRIORITY_STYLES[proposal.priority]}`}>
                    {PRIORITY_LABELS[proposal.priority]}
                  </span>
                  <span className="rounded-full border border-slate-700 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                    {proposalKindLabel(proposal.kind)}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{proposal.detail}</p>
                <p className="text-xs text-emerald-200/90">
                  <Brain className="mr-1 inline h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                  {proposal.benefit}
                </p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2">
                  <div className="font-mono text-[11px] text-slate-400">
                    {proposal.cost > 0 && (
                      <span className="mr-3">разово <strong className="text-slate-200">{formatMoney(proposal.cost)}</strong></span>
                    )}
                    {proposal.weeklyCost > 0 && (
                      <span>еженедельно <strong className="text-rose-300">{formatMoney(proposal.weeklyCost)}</strong></span>
                    )}
                    {proposal.cost === 0 && proposal.weeklyCost === 0 && (
                      <span>бесплатно</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {proposal.strainsBudget && (
                      <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-200" title="Еженедельные расходы превышают текущий профицит">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" /> утяжеляет бюджет
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => accept(proposal)}
                      disabled={!proposal.affordable}
                      className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                    >
                      {proposal.affordable ? 'Принять' : proposal.blockReason}
                      {proposal.affordable && <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
