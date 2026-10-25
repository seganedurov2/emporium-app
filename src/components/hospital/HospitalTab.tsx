import {
  ArrowRight,
  Baby,
  BedDouble,
  Brain,
  HeartPulse,
  PackagePlus,
  ShieldAlert,
  Stethoscope,
  Wallet,
  UserRound
} from 'lucide-react';
import type { EmployeeSpecialty } from '../../expansionTypes';
import type { Character } from '../../gameEngine';
import type { Psychologist } from '../../psychologistEngine';
import {
  PSYCHOLOGIST_CASES_PER_WEEK,
  PSYCHOLOGIST_FIRE_LOYALTY,
  PSYCHOLOGIST_REST_EXHAUSTION,
  PSYCHOLOGIST_WARD_HEALTH,
  weeklyCaseCapacity
} from '../../psychologistEngine';
import type { HospitalEquipmentId, HospitalLedgerTone, HospitalState, HospitalWardId } from '../../hospitalEngine';
import type { ChiefDoctorReport } from '../../chiefDoctorEngine';
import { ChiefDoctorPanel } from './ChiefDoctorPanel';
import { StaffingCalculator } from './StaffingCalculator';
import {
  GESTATION_DAYS,
  HOSPITAL_EQUIPMENT,
  HOSPITAL_WARDS,
  PREGNANCY_RISK_ADMIT,
  PURCHASE_INTERCEPTION_CHANCE,
  TREATMENT_HEALTH_THRESHOLD,
  assessPregnancyRisk,
  bedsInUse,
  bedsInWard,
  equipmentStock,
  isObservationStay,
  isTreatmentStay,
  quoteEquipment,
  quoteWards,
  totalBeds,
  wardCount,
  weeklyUpkeep
} from '../../hospitalEngine';
import { formatMoney } from '../../currency';

const GESTATION_WEEKS = GESTATION_DAYS / 7;

const LEDGER_TONES: Record<HospitalLedgerTone, string> = {
  admission: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  birth: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  loss: 'border-red-500/30 bg-red-500/10 text-red-100',
  purchase: 'border-purple-500/30 bg-purple-500/10 text-purple-100',
  shortage: 'border-orange-500/30 bg-orange-500/10 text-orange-100',
  discharge: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
  staffing: 'border-orange-500/30 bg-orange-500/10 text-orange-100'
};

interface QuantityStepperProps {
  id: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}

function QuantityStepper({ id, value, max, onChange }: QuantityStepperProps) {
  const clamp = (next: number) => onChange(Math.max(1, Math.min(max, next)));
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => clamp(value - 1)}
        aria-label="Уменьшить количество"
        className="h-8 w-8 cursor-pointer rounded-lg border border-slate-700 bg-slate-950 text-sm font-bold text-slate-300 transition hover:border-amber-400 hover:text-amber-300"
      >
        −
      </button>
      <input
        id={id}
        type="number"
        min={1}
        max={max}
        value={value}
        onChange={event => clamp(Number(event.target.value) || 1)}
        className="h-8 w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 text-center font-mono text-sm text-white focus:border-amber-400 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => clamp(value + 1)}
        aria-label="Увеличить количество"
        className="h-8 w-8 cursor-pointer rounded-lg border border-slate-700 bg-slate-950 text-sm font-bold text-slate-300 transition hover:border-amber-400 hover:text-amber-300"
      >
        +
      </button>
    </div>
  );
}

export interface HospitalTabProps {
  week: number;
  funds: number;
  hospital: HospitalState;
  hospitalLevel: number;
  nurses: number;
  midwives: number;
  nurseBonus: number;
  midwifeBonus: number;
  /** Psychologists posted at the hospital, each working one case a week. */
  psychologists: Psychologist[];
  /** Full roster for staffing calculator. */
  roster: Character[];
  wardQuantities: Record<string, number>;
  equipmentQuantities: Record<string, number>;
  onWardQuantityChange: (wardId: HospitalWardId, value: number) => void;
  onEquipmentQuantityChange: (itemId: HospitalEquipmentId, value: number) => void;
  onBuyWard: (wardId: HospitalWardId, quantity?: number) => void;
  onBuyEquipment: (itemId: HospitalEquipmentId, quantity?: number) => void;
  onOpenHiring: () => void;
  /** Chief doctor's requests and proposals, computed from the finance report. */
  chiefDoctor: ChiefDoctorReport;
  onHireSpecialty: (specialty: EmployeeSpecialty) => void;
  onBuyHiringSlot: () => void;
  onUpgradeHospital: () => void;
  /** Mothers who reached term but have no bed yet. */
  waitingForBed: Character[];
  /** Roster members in bad health who still wait for a ward. */
  waitingForTreatment: Character[];
  /** Pregnancies the staff want a bed for, but every ward is taken. */
  waitingForObservation: { character: Character; risk: ReturnType<typeof assessPregnancyRisk> }[];
}

export function HospitalTab({
  week,
  funds,
  hospital,
  hospitalLevel,
  nurses,
  midwives,
  nurseBonus,
  midwifeBonus,
  psychologists,
  roster,
  wardQuantities,
  equipmentQuantities,
  onWardQuantityChange,
  onEquipmentQuantityChange,
  onBuyWard,
  onBuyEquipment,
  onOpenHiring,
  chiefDoctor,
  onHireSpecialty,
  onBuyHiringSlot,
  onUpgradeHospital,
  waitingForBed,
  waitingForTreatment,
  waitingForObservation
}: HospitalTabProps) {
  const beds = totalBeds(hospital);
  const occupied = bedsInUse(hospital);
  const upkeep = weeklyUpkeep(hospital);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-left shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <HeartPulse className="mt-1 h-6 w-6 shrink-0 text-amber-300" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-bold text-white">Больница и родильный дом</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-400">
                Беременность идёт {GESTATION_WEEKS} недель. На сроке сотрудница забирается в палату, роды проходят
                в больнице. Но и раньше: каждую неделю медперсонал оценивает беременных, и если риск падает
                до {Math.round(PREGNANCY_RISK_ADMIT * 100)}% и выше (здоровье, усталость, возраст, нехватка
                оснащения) — сотрудницу забирают на наблюдение до срока, и исход зависит от палаты, персонала
                и расходников. Сотрудника со здоровьем {TREATMENT_HEALTH_THRESHOLD} и ниже также увозят в палату на лечение.
                Палаты — собственность, оснащение — расходники, всё покупается через чёрный рынок.
                Ребёнок числится отдельно и в {Math.round(16)} лет становится собственностью компании.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-mono">
            <span className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-slate-300">
              <BedDouble className="h-4 w-4 text-amber-300" aria-hidden="true" />
              {occupied}/{beds} коек
            </span>
            <span className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-slate-300">
              <Wallet className="h-4 w-4 text-emerald-300" aria-hidden="true" />
              {formatMoney(funds)}
            </span>
            <span className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-slate-300">
              <HeartPulse className="h-4 w-4 text-rose-300" aria-hidden="true" />
              {formatMoney(upkeep)}/нед.
            </span>
          </div>
        </div>

        {hospitalLevel <= 0 && (
          <p className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            Здание больницы не построено. Постройте его в разделе «Объекты и персонал»: без него нет палат и ухода.
          </p>
        )}
      </section>

      <ChiefDoctorPanel
        report={chiefDoctor}
        onHireSpecialty={onHireSpecialty}
        onBuyHiringSlot={onBuyHiringSlot}
        onBuyWard={onBuyWard}
        onBuyEquipment={onBuyEquipment}
        onUpgradeHospital={onUpgradeHospital}
      />

      <StaffingCalculator roster={roster} hospital={hospital} psychologistsOnDuty={psychologists} />

      {/* BLACK MARKET: WARDS */}
      <section aria-labelledby="hospital-wards-title" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-left shadow-xl">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="hospital-wards-title" className="flex items-center gap-2 text-base font-bold text-white">
            <BedDouble className="h-5 w-5 text-amber-300" aria-hidden="true" /> Палаты
          </h3>
          <p className="text-xs text-slate-500">
            Чёрный рынок: риск перехвата партии {Math.round(PURCHASE_INTERCEPTION_CHANCE * 100)}% за закупку.
          </p>
        </div>

        <ul className="grid gap-4 lg:grid-cols-2">
          {HOSPITAL_WARDS.map(ward => {
            const owned = wardCount(hospital, ward.id);
            const used = bedsInWard(hospital, ward.id);
            const capacity = owned * ward.beds;
            const quantity = Math.max(1, Math.floor(wardQuantities[ward.id] || 1));
            const quote = quoteWards(ward.id, quantity, funds, hospitalLevel);
            return (
              <li key={ward.id} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white">{ward.name}</h4>
                    <p className="mt-0.5 text-xs text-slate-400">{ward.description}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-slate-700 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                    качество {ward.quality}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-slate-400">
                  <span>коек в палате: <strong className="text-slate-200">{ward.beds}</strong></span>
                  <span>владеем: <strong className="text-amber-300">{owned}</strong></span>
                  <span>занято: <strong className="text-slate-200">{used}/{capacity}</strong></span>
                  <span>содержание: <strong className="text-rose-300">{formatMoney(ward.weeklyUpkeep)}/нед.</strong></span>
                  <span>цена: <strong className="text-emerald-300">{formatMoney(ward.cost)}/шт.</strong></span>
                </div>

                {quote.locked && (
                  <p className="rounded-md border border-orange-500/30 bg-orange-500/10 px-2.5 py-1.5 text-[11px] text-orange-100">
                    {quote.lockReason}
                  </p>
                )}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <label htmlFor={`ward-qty-${ward.id}`} className="text-[11px] uppercase text-slate-500">Штук</label>
                    <QuantityStepper
                      id={`ward-qty-${ward.id}`}
                      value={quantity}
                      max={20}
                      onChange={next => onWardQuantityChange(ward.id, next)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onBuyWard(ward.id)}
                    disabled={quote.locked || !quote.affordable}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                  >
                    Купить · {formatMoney(quote.total)}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* BLACK MARKET: EQUIPMENT */}
      <section aria-labelledby="hospital-equipment-title" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-left shadow-xl">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="hospital-equipment-title" className="flex items-center gap-2 text-base font-bold text-white">
            <PackagePlus className="h-5 w-5 text-amber-300" aria-hidden="true" /> Медицинское оборудование
          </h3>
          <p className="text-xs text-slate-500">Расходники: тратятся на каждый приём, покупаются поштучно.</p>
        </div>

        <ul className="grid gap-4 lg:grid-cols-2">
          {HOSPITAL_EQUIPMENT.map(item => {
            const stock = equipmentStock(hospital.equipment, item.id);
            const quantity = Math.max(1, Math.floor(equipmentQuantities[item.id] || 1));
            const quote = quoteEquipment(item.id, quantity, funds);
            const depleted = stock < item.perDelivery;
            return (
              <li key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white">{item.name}</h4>
                    <p className="mt-0.5 text-xs text-slate-400">{item.description}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[11px] ${
                    depleted ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  }`}>
                    на складе: {stock}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-slate-400">
                  <span>расход: <strong className="text-slate-200">{item.perDelivery}</strong>/приём</span>
                  <span>нужен: <strong className={item.timing === 'always' ? 'text-rose-300' : 'text-orange-300'}>{item.timing === 'always' ? 'всегда' : 'при осложнениях'}</strong></span>
                  <span>потеря исхода без него: <strong className="text-red-300">−{item.missingPenalty}</strong></span>
                  <span>цена: <strong className="text-emerald-300">{formatMoney(item.cost)}/шт.</strong></span>
                </div>

                {depleted && (
                  <p className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-100">
                    Закончился: следующий приём пройдёт без него.
                  </p>
                )}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <label htmlFor={`equip-qty-${item.id}`} className="text-[11px] uppercase text-slate-500">Штук</label>
                    <QuantityStepper
                      id={`equip-qty-${item.id}`}
                      value={quantity}
                      max={50}
                      onChange={next => onEquipmentQuantityChange(item.id, next)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onBuyEquipment(item.id)}
                    disabled={!quote.affordable}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                  >
                    Купить · {formatMoney(quote.total)}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* PATIENTS */}
      <section aria-labelledby="hospital-patients-title" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-left shadow-xl">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="hospital-patients-title" className="flex items-center gap-2 text-base font-bold text-white">
            <Baby className="h-5 w-5 text-amber-300" aria-hidden="true" /> Пациенты и роженицы
          </h3>
          <span className="font-mono text-xs text-slate-400">неделя {week}</span>
        </div>

        {hospital.patients.length === 0 && waitingForBed.length === 0 && waitingForTreatment.length === 0
          && waitingForObservation.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-center text-sm text-slate-500">
            Палаты пусты. Роженицы появятся здесь, когда сотрудница достигнет {GESTATION_WEEKS} недель, под
            наблюдение её возьмут раньше — если риск дойдёт до {Math.round(PREGNANCY_RISK_ADMIT * 100)}%, а пациенты на
            лечение — когда здоровье сотрудника опустится до {TREATMENT_HEALTH_THRESHOLD} и ниже.
          </p>
        ) : (
          <div className="space-y-4">
            {hospital.patients.length > 0 && (
              <ul className="divide-y divide-slate-800 border-y border-slate-800">
                {hospital.patients.map(patient => {
                  const ward = HOSPITAL_WARDS.find(item => item.id === patient.wardId);
                  const treatment = isTreatmentStay(patient);
                  const observation = isObservationStay(patient);
                  return (
                    <li key={`${patient.characterId}-${patient.admittedWeek}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{patient.characterName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          палата «{ward?.name ?? 'палата'}» · с недели {patient.admittedWeek}
                          {treatment
                            ? <> · лечение, +{patient.weeklyGain ?? 0} здоровья в неделю</>
                            : observation
                              ? <> · наблюдение, риск {Math.round((patient.riskScore ?? 0) * 100)}%, сохранение беременности {patient.survivalChance ?? 0}%</>
                              : patient.complicated && <span className="text-orange-300"> · осложнённые роды, нужна операционная</span>}
                        </p>
                      </div>
                      <span className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
                        treatment
                          ? 'border-sky-500/30 bg-sky-500/10 text-sky-100'
                          : observation
                            ? 'border-pink-500/30 bg-pink-500/10 text-pink-100'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                      }`}>
                        {treatment
                          ? `выписка через ${Math.max(0, patient.weeksRemaining - 1)} нед.`
                          : observation
                            ? `исход на ${Math.max(0, patient.weeksRemaining - 1) + 1} нед.`
                            : patient.delivered
                            ? `восстановление, выписка через ${Math.max(0, patient.weeksRemaining - 1)} нед.`
                            : patient.weeksRemaining > 1
                              ? `роды через ${patient.weeksRemaining - 1} нед.`
                              : 'роды на этой неделе'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {waitingForBed.length > 0 && (
              <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-orange-100">
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" /> Достигли срока, но свободных палат нет
                </h4>
                <ul className="mt-2 space-y-1 text-xs text-orange-100/90">
                  {waitingForBed.map(mother => (
                    <li key={mother.id}>• {mother.name} — ждёт места</li>
                  ))}
                </ul>
              </div>
            )}

            {waitingForObservation.length > 0 && (
              <div className="rounded-xl border border-pink-500/30 bg-pink-500/5 p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-pink-100">
                  <HeartPulse className="h-4 w-4" aria-hidden="true" /> Под риском, но свободных палат нет
                </h4>
                <ul className="mt-2 space-y-1 text-xs text-pink-100/90">
                  {waitingForObservation.map(({ character, risk }) => (
                    <li key={character.id}>
                      • {character.name} — риск {Math.round(risk.score * 100)}%{risk.reasons.length > 0 ? ` (${risk.reasons.join(', ')})` : ''}, ждёт места
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {waitingForTreatment.length > 0 && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-rose-100">
                  <HeartPulse className="h-4 w-4" aria-hidden="true" /> Плохое здоровье, но свободных палат нет
                </h4>
                <ul className="mt-2 space-y-1 text-xs text-rose-100/90">
                  {waitingForTreatment.map(patient => (
                    <li key={patient.id}>• {patient.name} — здоровье {patient.exactHealth}, ждёт места</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* STAFF */}
      <section aria-labelledby="hospital-staff-title" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-left shadow-xl">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="hospital-staff-title" className="flex items-center gap-2 text-base font-bold text-white">
            <Stethoscope className="h-5 w-5 text-amber-300" aria-hidden="true" /> Медсёстры, акушерки и психологи
          </h3>
          <button
            type="button"
            onClick={onOpenHiring}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-amber-300 underline underline-offset-4 transition hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            Нанять в отделе кадров
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <UserRound className="h-4 w-4 text-sky-300" aria-hidden="true" /> Медсёстры
            </div>
            <p className="mt-1 font-mono text-xs text-slate-400">
              в штате: <strong className="text-slate-100">{nurses}</strong> · бонус уходу: +{nurseBonus}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <UserRound className="h-4 w-4 text-pink-300" aria-hidden="true" /> Акушерки
            </div>
            <p className="mt-1 font-mono text-xs text-slate-400">
              в штате: <strong className="text-slate-100">{midwives}</strong> · бонус исходам: +{midwifeBonus}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-100">
              <Brain aria-hidden="true" className="h-4 w-4 text-violet-300" /> Психологи
            </div>
            <span className="rounded-full border border-violet-500/40 px-2 py-0.5 font-mono text-[11px] text-violet-200">
              {psychologists.length} на посте · {weeklyCaseCapacity(psychologists)} решений/нед.
            </span>
          </div>
          <p className="mt-1.5 text-xs text-violet-100/80">
            Каждый психолог разбирает {PSYCHOLOGIST_CASES_PER_WEEK} худших случаев в неделю и решает по
            одному: увольняет (лояльность {PSYCHOLOGIST_FIRE_LOYALTY} и ниже при сорванном здоровье или
            полном выгорании), кладёт в палату (здоровье {PSYCHOLOGIST_WARD_HEALTH} и ниже) или отправляет
            в зону отдыха (усталость {PSYCHOLOGIST_REST_EXHAUSTION} и выше). Навык сдвигает все пороги:
            опытный психолог ловит выгорание раньше. Без психолога никто этим не занимается.
          </p>
          {psychologists.length > 0 && (
            <ul className="mt-2 space-y-1 text-[11px] text-violet-200/80">
              {psychologists.map(psychologist => (
                <li key={psychologist.name}>• {psychologist.name} — навык {psychologist.skill}</li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Уровень больницы {hospitalLevel} задаёт базовый бонус. Медсёстры, акушерки и психологи
          нанимаются в общем разделе найма и назначаются на посты в больнице.
        </p>
      </section>

      {/* LEDGER */}
      <section aria-labelledby="hospital-ledger-title" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-left shadow-xl">
        <h3 id="hospital-ledger-title" className="mb-4 text-base font-bold text-white">Журнал больницы</h3>
        {hospital.ledger.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-center text-sm text-slate-500">
            Записей пока нет.
          </p>
        ) : (
          <ul className="space-y-2">
            {hospital.ledger.map((entry, index) => (
              <li key={`${entry.week}-${index}`} className={`rounded-lg border px-3 py-2 text-xs ${LEDGER_TONES[entry.tone]}`}>
                <span className="font-mono opacity-70">неделя {entry.week} · </span>
                {entry.message}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}