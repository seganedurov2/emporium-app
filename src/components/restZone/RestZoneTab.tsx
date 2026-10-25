import { BedDouble, Building2, CalendarClock, HeartPulse, Scissors, Sparkles, Undo2, UserCheck, Wallet } from 'lucide-react';
import type { Character } from '../../gameEngine';
import type { Employee } from '../../expansionTypes';
import type { CareSeverity, RestZoneState } from '../../restZoneEngine';
import type { RequestVenueId, VenueAdministratorRequest } from '../../administratorEngine';
import { VenueAdministratorPanel } from '../venue/VenueAdministratorPanel';
import {
  REST_PROGRAM,
  REST_SEAT_COST_GROWTH,
  REST_SEAT_UPKEEP,
  REST_ZONE_TIERS,
  SEATS_PER_ATTENDANT,
  assessCareNeeds,
  attendantSubmissionGain,
  freeRestSlots,
  quoteRestSeat,
  recommendedAttendantCount,
  recommendedSalonTreatmentId,
  restEligibility,
  restProgramCost,
  restZoneCapacity,
  restZoneName,
  restZoneWeeklyUpkeep
} from '../../restZoneEngine';
import { formatMoney } from '../../currency';

const SEVERITY_TONES: Record<CareSeverity, string> = {
  critical: 'border-red-500/30 bg-red-500/10 text-red-200',
  attention: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  stable: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
};

const EXHAUSTION_TONES: Record<Character['exhaustionLevel'], string> = {
  Rested: 'text-emerald-300',
  Tired: 'text-amber-300',
  Exhausted: 'text-orange-300',
  'Burned Out': 'text-red-300'
};

const SKIN_LABELS: Record<Character['skinCondition'], string> = {
  Flawless: 'идеальная',
  Clear: 'чистая',
  Dry: 'сухая',
  Blemished: 'воспаления',
  Irritated: 'раздражение'
};

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

const ATTENDANT_ROLE = 'Смотритель зоны отдыха';

const VENUE_LABELS: Record<NonNullable<Character['assignedVenue']>, string> = {
  beauty_salon: 'Салон красоты',
  strip_club: 'Стрип-клуб',
  pleasure_house: 'Дом удовольствия',
  trade: 'Торговая сеть',
  security: 'Служба безопасности',
  auction_house: 'Аукционный дом',
  bdsm_room: 'БДСМ-комната',
  unassigned: 'Без работы'
};

export interface RestZoneTabProps {
  week: number;
  funds: number;
  roster: Character[];
  restZone: RestZoneState;
  hospitalPatientIds: string[];
  busyCharacterIds: string[];
  employees: Employee[];
  /** Активный запрос администратора зоны отдыха. */
  administratorRequest: VenueAdministratorRequest | null;
  onAcceptRequest: (venue: RequestVenueId) => void;
  onSendToRest: (characterId: string) => void;
  onRecall: (characterId: string) => void;
  onSendToSalon: (characterId: string) => void;
  onBuySeat: () => void;
  onToggleAttendant: (employeeId: string) => void;
}

export function RestZoneTab({
  week,
  funds,
  roster,
  restZone,
  hospitalPatientIds,
  busyCharacterIds,
  employees,
  administratorRequest,
  onAcceptRequest,
  onSendToRest,
  onRecall,
  onSendToSalon,
  onBuySeat,
  onToggleAttendant
}: RestZoneTabProps) {
  const programCost = restProgramCost();
  const programAffordable = funds >= programCost;
  const capacity = restZoneCapacity(restZone);
  const upkeep = restZoneWeeklyUpkeep(restZone);
  const seatQuote = quoteRestSeat(restZone, funds);
  const freeSlots = freeRestSlots(restZone);

  const attendants = employees.filter(employee => restZone.attendantIds.includes(employee.id));
  const recruitables = employees.filter(employee =>
    employee.status === 'active'
    && employee.specialty === 'attendant'
    && !restZone.attendantIds.includes(employee.id));
  const recommendedAttendants = recommendedAttendantCount(capacity);
  const submissionGain = attendantSubmissionGain(attendants);

  const restingIds = new Set(restZone.placements.map(placement => placement.characterId));
  const careCandidates = roster.filter(character => assessCareNeeds(character).severity !== 'stable');

  return (
    <div className="space-y-6">
      <section aria-labelledby="rest-zone-title" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-left shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="rest-zone-title" className="mb-1 text-lg font-bold text-white">Зона отдыха</h2>
            <p className="text-sm text-slate-400">
              Персонал, которому нужен уход, отправляется сюда на несколько недель: за это время снимается
              усталость и восстанавливается здоровье, а косметические процедуры можно закрыть в салоне красоты.
              Мест хватает столько, сколько выделено под зону.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-right font-mono">
            <div className="text-[10px] font-semibold uppercase text-slate-400">Мест</div>
            <div className="text-base font-bold text-sky-300">
              {restZone.placements.length}/{capacity}
            </div>
            <div className="mt-1 text-[10px] uppercase text-slate-500">свободно: {freeSlots}</div>
          </div>
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
            <dt className="text-[10px] uppercase text-slate-500">На отдыхе</dt>
            <dd className="font-mono text-sm text-white">{restZone.placements.length} чел.</dd>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
            <dt className="text-[10px] uppercase text-slate-500">Недель отдыха проведено</dt>
            <dd className="font-mono text-sm text-white">{restZone.totalWeeksHosted}</dd>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
            <dt className="text-[10px] uppercase text-slate-500">Потрачено на отдых</dt>
            <dd className="font-mono text-sm text-white">{formatMoney(restZone.totalSpent)}</dd>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
            <dt className="text-[10px] uppercase text-slate-500">Содержание зоны</dt>
            <dd className="font-mono text-sm text-white">{upkeep > 0 ? `${formatMoney(upkeep)}/нед.` : 'бесплатно'}</dd>
          </div>
        </dl>
      </section>

      <VenueAdministratorPanel
        venue="rest_zone"
        request={administratorRequest}
        funds={funds}
        onAccept={onAcceptRequest}
      />

      <section aria-labelledby="rest-program-title" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-left shadow-xl">
        <h3 id="rest-program-title" className="flex items-center gap-2 text-base font-bold text-white">
          <CalendarClock className="h-5 w-5 text-sky-300" aria-hidden="true" /> Программа отдыха
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Курс один и применяется ко всем, кого отправляют в зону. Полная стоимость списывается сразу при отправке.
        </p>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span className="text-sm font-bold text-white">{REST_PROGRAM.name}</span>
            <span className="shrink-0 rounded-full border border-sky-400/40 bg-sky-500/15 px-2 py-0.5 font-mono text-[11px] text-sky-200">
              {REST_PROGRAM.weeks} нед.
            </span>
          </div>
          <p className="text-xs text-slate-300">{REST_PROGRAM.description}</p>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-slate-400">
              <dt>усталость</dt>
              <dd className="font-bold text-emerald-300">-{REST_PROGRAM.exhaustionRecovery}/нед.</dd>
            </div>
            <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-slate-400">
              <dt>здоровье</dt>
              <dd className="font-bold text-emerald-300">+{REST_PROGRAM.healthRecovery}/нед.</dd>
            </div>
            <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-slate-400">
              <dt>лояльность</dt>
              <dd className="font-bold text-purple-300">+{REST_PROGRAM.loyaltyRecovery}/нед.</dd>
            </div>
            <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-slate-400">
              <dt>кожа</dt>
              <dd className={REST_PROGRAM.skinRecovery ? 'font-bold text-emerald-300' : 'font-bold text-slate-500'}>
                {REST_PROGRAM.skinRecovery ? 'восстанавливается' : 'без изменений'}
              </dd>
            </div>
          </dl>
          <span className="flex items-center gap-1.5 font-mono text-sm font-bold text-amber-300">
            <Wallet className="h-4 w-4" aria-hidden="true" /> {formatMoney(programCost)} · {formatMoney(REST_PROGRAM.weeklyCost)}/нед.
          </span>
        </div>
      </section>

      <section aria-labelledby="rest-seats-title" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-left shadow-xl">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="rest-seats-title" className="flex items-center gap-2 text-base font-bold text-white">
            <Building2 className="h-5 w-5 text-amber-300" aria-hidden="true" /> Места и расширение
          </h3>
          <p className="text-xs text-slate-500">
            Текущий размер: <strong className="text-amber-300">{restZoneName(capacity)}</strong> · {capacity} мест
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {REST_ZONE_TIERS.map(tier => {
            const isCurrent = restZoneName(capacity) === tier.name;
            const reached = capacity >= tier.seats;
            const tone = isCurrent
              ? 'border-amber-500/50 bg-amber-500/10'
              : reached
                ? 'border-emerald-500/25 bg-emerald-500/5'
                : 'border-slate-800 bg-slate-950';
            return (
              <li key={tier.seats} className={`flex flex-col gap-2 rounded-xl border p-3 ${tone}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white">{tier.name}</span>
                  <span className="font-mono text-[11px] text-slate-400">от {tier.seats}</span>
                </div>
                <div className="font-mono text-lg font-bold text-sky-300">от {tier.seats} мест</div>
                <p className="text-[11px] leading-snug text-slate-400">{tier.description}</p>
                <div className="mt-auto font-mono text-[11px] text-slate-400">
                  содержание {formatMoney((tier.seats * 150))}/нед.
                </div>
                <div className="font-mono text-[11px] font-bold text-amber-300">
                  {isCurrent ? 'текущий размер' : reached ? 'пройден' : 'ещё не достигнут'}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBuySeat}
            disabled={!seatQuote.affordable}
            title={seatQuote.affordable ? undefined : `Не хватает средств: нужно ${formatMoney(seatQuote.cost)}.`}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            <BedDouble className="h-4 w-4" aria-hidden="true" />
            Купить место · {seatQuote.seatsAfter} мест · {formatMoney(seatQuote.cost)}
          </button>
          <p className="text-[11px] text-slate-400">
            Места покупаются по одному без верхнего ограничения; каждое следующее дороже предыдущего
          на {Math.round(REST_SEAT_COST_GROWTH * 100)}% и добавляет {formatMoney(REST_SEAT_UPKEEP)}/нед. к содержанию.
          </p>
        </div>
      </section>

      <section aria-labelledby="rest-attendants-title" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-left shadow-xl">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="rest-attendants-title" className="flex items-center gap-2 text-base font-bold text-white">
            <UserCheck className="h-5 w-5 text-purple-300" aria-hidden="true" /> Смотрители зоны
          </h3>
          <p className="text-xs text-slate-500">
            Рекомендуется: <strong className="text-purple-300">{recommendedAttendants}</strong>
            {' '}· нанято: {attendants.length} · по одному смотрителю на {SEATS_PER_ATTENDANT} места
          </p>
        </div>

        <p className="mb-4 text-xs text-slate-400">
          Пока персонал лежит в зоне, смотритель повышает его покорность на{' '}
          <strong className="text-purple-300">+{submissionGain}/нед.</strong> — опытный смотритель работает жёстче.
          Без смотрителей покорность растёт только на базовые {REST_PROGRAM.submissionRecovery}/нед.
        </p>

        {recruitables.length === 0 && attendants.length === 0 ? (
          <p className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-6 text-center text-sm text-slate-500">
            Нет нанятых смотрителей. Наймите сотрудника со специальностью «{ATTENDANT_ROLE}» во вкладке найма.
          </p>
        ) : (
          <ul className="space-y-2">
            {[...attendants, ...recruitables].map(employee => {
              const posted = restZone.attendantIds.includes(employee.id);
              return (
                <li
                  key={employee.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${
                    posted ? 'border-purple-500/40 bg-purple-500/10' : 'border-slate-800 bg-slate-950'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{employee.name}</div>
                    <div className="font-mono text-[11px] text-slate-400">
                      {ATTENDANT_ROLE} · Навык {employee.skill} · {formatMoney(employee.weeklyWage)}/нед.
                      {posted ? ' · на посту' : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleAttendant(employee.id)}
                    className={`min-h-9 cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                      posted
                        ? 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-red-400 hover:text-red-300'
                        : 'bg-purple-600 text-white hover:bg-purple-500'
                    }`}
                  >
                    {posted ? 'Снять с поста' : 'Назначить в зону'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="rest-needs-title" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-left shadow-xl">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="rest-needs-title" className="flex items-center gap-2 text-base font-bold text-white">
            <HeartPulse className="h-5 w-5 text-amber-300" aria-hidden="true" /> Нужен уход
          </h3>
          <p className="text-xs text-slate-500">
            Программа: <strong className="text-sky-300">{REST_PROGRAM.name}</strong> · {REST_PROGRAM.weeks} нед. · {formatMoney(programCost)} · свободно мест: {freeSlots}
          </p>
        </div>

        {careCandidates.length === 0 ? (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-6 text-center text-sm text-emerald-200">
            Весь персонал в рабочем состоянии — никто не нуждается в уходе.
          </p>
        ) : (
          <ul className="space-y-3">
            {careCandidates.map(character => {
              const assessment = assessCareNeeds(character);
              const eligibility = restEligibility(character, restZone, { hospitalPatientIds, busyCharacterIds });
              const placement = restZone.placements.find(item => item.characterId === character.id);
              const recommended = recommendedSalonTreatmentId(assessment);
              return (
                <li
                  key={character.id}
                  className={`flex flex-wrap items-start justify-between gap-4 rounded-xl border p-4 ${SEVERITY_TONES[assessment.severity]}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-white">{character.name}</span>
                      <span className="rounded-full border border-current/30 px-2 py-0.5 font-mono text-[11px]">{assessment.status}</span>
                      <span className="text-[11px] text-slate-300">{character.role}</span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-slate-300">
                      Здоровье: <strong className="text-emerald-300">{HEALTH_LABELS[character.healthLevel] ?? character.healthLevel}</strong> · Усталость:{' '}
                      <strong className={EXHAUSTION_TONES[character.exhaustionLevel]}>{EXHAUSTION_LABELS[character.exhaustionLevel] ?? character.exhaustionLevel}</strong> · Кожа:{' '}
                      <strong className="text-pink-300">{SKIN_LABELS[character.skinCondition]}</strong>
                    </div>
                    <ul className="mt-1.5 list-disc pl-4 text-xs text-slate-200">
                      {assessment.needs.map(need => <li key={need.kind + need.label}>{need.label}</li>)}
                    </ul>
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      Рекомендовано: {assessment.recommendedRoute === 'rest_zone' ? 'зона отдыха' : 'салон красоты'}
                      {recommended ? ` (процедура «${getSalonTreatmentLabel(recommended)}»)` : ''}
                    </p>
                    {placement && (
                      <p className="mt-1 font-mono text-[11px] text-sky-200">
                        Сейчас на отдыхе: {placement.programName}, осталось {placement.weeksRemaining} из {placement.weeksTotal} нед.
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => onSendToRest(character.id)}
                      disabled={!eligibility.eligible || !programAffordable}
                      title={!eligibility.eligible ? eligibility.reason : undefined}
                      className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                    >
                      <BedDouble className="h-4 w-4" aria-hidden="true" />
                      Отправить на отдых · {formatMoney(programCost)}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSendToSalon(character.id)}
                      disabled={restingIds.has(character.id)}
                      title={restingIds.has(character.id) ? 'Сначала верните персонал с отдыха' : undefined}
                      className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-pink-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                    >
                      <Scissors className="h-4 w-4" aria-hidden="true" />
                      В салон красоты
                    </button>
                    {!eligibility.eligible && (
                      <p className="max-w-56 text-[11px] leading-snug text-slate-300">{eligibility.reason}</p>
                    )}
                    {eligibility.eligible && !programAffordable && (
                      <p className="max-w-56 text-[11px] leading-snug text-orange-200">
                        Не хватает средств: нужно {formatMoney(programCost)}.
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="rest-active-title" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-left shadow-xl">
        <h3 id="rest-active-title" className="mb-4 flex items-center gap-2 text-base font-bold text-white">
          <Sparkles className="h-5 w-5 text-emerald-300" aria-hidden="true" /> Сейчас на отдыхе
        </h3>

        {restZone.placements.length === 0 ? (
          <p className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-6 text-center text-sm text-slate-500">
            Зона отдыха пуста — весь персонал работает.
          </p>
        ) : (
          <ul className="space-y-3">
            {restZone.placements.map(placement => {
              const elapsed = placement.weeksTotal - placement.weeksRemaining;
              const percent = Math.round((elapsed / placement.weeksTotal) * 100);
              return (
                <li key={placement.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white">{placement.characterName}</div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        Программа: <strong className="text-sky-300">{placement.programName}</strong> · с недели {placement.admittedWeek}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                        осталось {placement.weeksRemaining} из {placement.weeksTotal} нед.
                        {` · усталость -${REST_PROGRAM.exhaustionRecovery}/нед.`}
                        {placement.returnVenue ? ` · вернётся в: ${VENUE_LABELS[placement.returnVenue]}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRecall(placement.characterId)}
                      className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-bold text-slate-200 transition hover:border-amber-400 hover:text-amber-300"
                    >
                      <Undo2 className="h-4 w-4" aria-hidden="true" />
                      Вернуть досрочно
                    </button>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label={`Прогресс отдыха: ${placement.characterName}`} aria-valuemin={0} aria-valuemax={placement.weeksTotal} aria-valuenow={elapsed}>
                    <div className="h-full rounded-full bg-sky-400 transition-[width]" style={{ width: `${percent}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 text-xs text-slate-500">
          Неделя {week}: восстановление идёт автоматически, персонал на отдыхе не работает и не приносит дохода,
          а по окончании программы возвращается на прежнее место службы.
        </p>
      </section>
    </div>
  );
}

const SALON_TREATMENT_LABELS: Record<string, string> = {
  t_hair_color: 'окрашивание волос',
  t_hair_length: 'наращивание волос',
  t_hairstyle: 'стрижка и укладка',
  t_facial_hair: 'уход за бородой',
  t_body_hair: 'эпиляция',
  t_tanning: 'загар',
  t_skin_condition: 'уход за кожей'
};

function getSalonTreatmentLabel(treatmentId: string): string {
  return SALON_TREATMENT_LABELS[treatmentId] ?? 'процедура';
}