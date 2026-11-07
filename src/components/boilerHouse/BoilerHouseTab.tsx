/**
 * Котельная — вкладка теплового контура синдиката.
 *
 * Показывает котлы, запас топлива, температуру контура и прогноз на неделю.
 * Игрок закупает топливо, запускает и останавливает котлы, меняет топливо,
 * строит новые котлы и ремонтирует аварийные. Всё, что меняет кампанию,
 * уходит наверх через колбэки — вкладка сама состояние не хранит.
 */

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Flame,
  Fuel,
  Gauge,
  Hammer,
  Snowflake,
  Thermometer,
  Wrench,
  Zap
} from 'lucide-react';
import { formatMoney } from '../../currency';
import { sound } from '../../sound';
import {
  BOILER_DEFINITIONS,
  BOILER_DEFINITION_BY_ID,
  BOILER_FUELS,
  BOILER_FUEL_BY_ID,
  AUTO_BUDGET_MAX,
  AUTO_BUDGET_MIN,
  AUTO_RESERVE_WEEKS_MAX,
  AUTO_RESERVE_WEEKS_MIN,
  COMFORT_TEMPERATURE,
  FREEZING_TEMPERATURE,
  FUEL_STORAGE_CAP,
  HEATED_VENUES,
  boilerFuelDemand,
  boilerHeatDemand,
  boilerHeatOutput,
  boilerRepairCost,
  fuelPurchaseCost,
  fuelWeeksRemaining,
  heatExhaustionBump,
  heatRevenueMultiplier,
  planBoilerAutomation,
  type BoilerAutomation,
  type BoilerFuelId,
  type BoilerHouseState,
  type BoilerId
} from '../../boilerHouseEngine';

interface BoilerHouseTabProps {
  week: number;
  funds: number;
  state: BoilerHouseState;
  /** Сколько площадок сейчас работает — от этого зависит потребность в тепле. */
  activeVenues: number;
  onBuyFuel: (fuelId: BoilerFuelId, units: number) => void;
  onSetBoiler: (id: BoilerId, patch: { status?: 'running' | 'idle'; fuel?: BoilerFuelId; hoursPerWeek?: number }) => void;
  onBuildBoiler: (id: BoilerId) => void;
  onRepairBoiler: (id: BoilerId) => void;
  /** Включает/выключает автоматику и меняет её настройки. */
  onSetAutomation: (patch: Partial<BoilerAutomation>) => void;
}

const FUEL_ICONS: Record<BoilerFuelId, string> = {
  coal: '🪨',
  gas: '🔥',
  bio: '🌿'
};

const STATUS_LABELS: Record<string, string> = {
  running: 'Работает',
  idle: 'В резерве',
  broken: 'Авария'
};

const STATUS_STYLES: Record<string, string> = {
  running: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  idle: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
  broken: 'bg-red-500/15 text-red-300 border-red-500/30'
};

export function BoilerHouseTab({
  week,
  funds,
  state,
  activeVenues,
  onBuyFuel,
  onSetBoiler,
  onBuildBoiler,
  onRepairBoiler,
  onSetAutomation
}: BoilerHouseTabProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'info' | 'success' | 'error'>('info');
  const [buyAmount, setBuyAmount] = useState<Record<BoilerFuelId, number>>({ coal: 200, gas: 100, bio: 50 });

  const notify = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    setMessage(text);
    setMessageType(type);
    sound.play(type === 'error' ? 'error' : type === 'success' ? 'success' : 'click');
    setTimeout(() => setMessage(null), 3500);
  };

  const heatDemand = boilerHeatDemand(activeVenues);
  const heatProduced = state.boilers.reduce((sum, boiler) => sum + boilerHeatOutput(boiler), 0);
  const coverage = heatDemand > 0 ? Math.min(1, heatProduced / heatDemand) : 1;
  const revenueMultiplier = heatRevenueMultiplier(coverage);
  const exhaustionBump = heatExhaustionBump(coverage);
  const weeksLeft = useMemo(() => fuelWeeksRemaining(state), [state]);
  // План автоматики на ближайшую неделю — та же функция, что считает неделю.
  const autoPlan = useMemo(
    () => planBoilerAutomation({ state, week, activeVenues, funds }),
    [state, week, activeVenues, funds]
  );
  const automation = state.automation;
  const brokenCount = state.boilers.filter(boiler => boiler.status === 'broken').length;
  const runningCount = state.boilers.filter(boiler => boiler.status === 'running').length;
  const cold = state.temperature < FREEZING_TEMPERATURE;

  const temperaturePercent = Math.max(0, Math.min(100, ((state.temperature + 10) / 40) * 100));

  const handleBuy = (fuelId: BoilerFuelId) => {
    const units = buyAmount[fuelId];
    const cost = fuelPurchaseCost(fuelId, units);
    if (units <= 0) {
      notify('Укажите количество топлива.', 'error');
      return;
    }
    if (funds < cost) {
      notify(`Недостаточно средств: нужно ${formatMoney(cost)}.`, 'error');
      return;
    }
    onBuyFuel(fuelId, units);
    notify(`Закуплено ${units} ед. «${BOILER_FUEL_BY_ID[fuelId].name}» за ${formatMoney(cost)}.`, 'success');
  };

  const handleBuild = (id: BoilerId) => {
    const definition = BOILER_DEFINITION_BY_ID[id];
    if (funds < definition.buildCost) {
      notify(`Недостаточно средств: нужно ${formatMoney(definition.buildCost)}.`, 'error');
      return;
    }
    onBuildBoiler(id);
    notify(`«${definition.name}» построен и готов к запуску.`, 'success');
  };

  const handleRepair = (id: BoilerId) => {
    const boiler = state.boilers.find(item => item.id === id);
    if (!boiler) return;
    const cost = Math.max(BOILER_DEFINITION_BY_ID[id].upkeep, boilerRepairCost(boiler));
    if (funds < cost) {
      notify(`Недостаточно средств на ремонт: нужно ${formatMoney(cost)}.`, 'error');
      return;
    }
    onRepairBoiler(id);
    notify(`«${BOILER_DEFINITION_BY_ID[id].name}» отремонтирован за ${formatMoney(cost)}.`, 'success');
  };

  const unbuilt = BOILER_DEFINITIONS.filter(definition => !state.boilers.some(boiler => boiler.id === definition.id));

  return (
    <div className="space-y-6">
      {/* Заголовок и сводка */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
        <div className="flex items-center gap-3 mb-2">
          <Flame className="w-6 h-6 text-orange-500" />
          <h2 className="text-lg font-bold text-white">Котельная — тепловой контур синдиката</h2>
        </div>
        <p className="text-slate-400 text-sm mb-4">
          Котельная отапливает площадки синдиката. Тёплые залы приносят больше выручки,
          а холодные — ускоряют усталость персонала. Следите за топливом и износом котлов:
          авария зимой обходится дороже, чем профилактика летом.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Thermometer className="w-4 h-4 text-orange-400" />
              <span>Температура контура</span>
            </div>
            <div className={`font-mono text-lg font-bold ${cold ? 'text-sky-400' : 'text-orange-300'}`}>
              {state.temperature}°C
            </div>
            <div className="text-[10px] text-slate-500">комфорт {COMFORT_TEMPERATURE}°C · минимум {FREEZING_TEMPERATURE}°C</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Gauge className="w-4 h-4 text-amber-400" />
              <span>Покрытие теплом</span>
            </div>
            <div className="font-mono text-lg font-bold text-amber-300">{Math.round(coverage * 100)}%</div>
            <div className="text-[10px] text-slate-500">{heatProduced} / {heatDemand} тепла</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Бонус к выручке</span>
            </div>
            <div className={`font-mono text-lg font-bold ${revenueMultiplier >= 1 ? 'text-emerald-300' : 'text-red-300'}`}>
              {revenueMultiplier >= 1 ? '+' : ''}{Math.round((revenueMultiplier - 1) * 100)}%
            </div>
            <div className="text-[10px] text-slate-500">усталость +{exhaustionBump}/нед.</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Flame className="w-4 h-4 text-red-400" />
              <span>Котлы</span>
            </div>
            <div className="font-mono text-lg font-bold text-slate-200">{runningCount} / {state.boilers.length}</div>
            <div className="text-[10px] text-slate-500">
              {brokenCount > 0 ? `${brokenCount} в аварии` : 'все исправны'} · неделя {week}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${cold ? 'bg-sky-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`}
              style={{ width: `${temperaturePercent}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>-10°C</span>
            <span>18°C</span>
            <span>30°C</span>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-3 text-sm ${messageType === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
              : messageType === 'error'
                ? 'border-red-500/30 bg-red-500/5 text-red-300'
                : 'border-slate-700/30 bg-slate-800/50 text-slate-300'
            }`}
        >
          {message}
        </div>
      )}

      {cold && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 flex items-start gap-3">
          <Snowflake className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs text-sky-200">
            <div className="font-bold text-sky-300 mb-1">Площадки мёрзнут</div>
            Температура контура ниже {FREEZING_TEMPERATURE}°C: выручка площадок падает,
            персонал устаёт быстрее. Запустите котлы или закупите топливо.
          </div>
        </div>
      )}

      {/* Автоматика */}
      <div
        className={`rounded-xl border p-4 shadow-lg ${
          automation.enabled ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700 bg-slate-900/50'
        }`}
      >
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Bot className={`w-5 h-5 ${automation.enabled ? 'text-emerald-400' : 'text-slate-500'}`} />
          <h4 className="font-bold text-white text-sm">Автоматика котельной</h4>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              automation.enabled
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-700/40 text-slate-300 border-slate-600/40'
            }`}
          >
            {automation.enabled ? 'Включена' : 'Выключена'}
          </span>
          <button
            onClick={() => {
              onSetAutomation({ enabled: !automation.enabled });
              notify(
                automation.enabled ? 'Автоматика котельной выключена.' : 'Автоматика котельной включена.',
                'success'
              );
            }}
            className={`ml-auto rounded px-3 py-1.5 text-xs font-medium border transition ${
              automation.enabled
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30'
            }`}
          >
            {automation.enabled ? 'Выключить' : 'Включить'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Автоматика сама закупает топливо с запасом на несколько недель, запускает резервные
          котлы при нехватке тепла, останавливает лишние и чинит аварии — в пределах недельного
          бюджета. Расходы списываются в начале недели.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>Запас топлива</span>
                <span className="font-mono text-slate-200">{automation.reserveWeeks} нед.</span>
              </div>
              <input
                type="range"
                min={AUTO_RESERVE_WEEKS_MIN}
                max={AUTO_RESERVE_WEEKS_MAX}
                step={1}
                value={automation.reserveWeeks}
                onChange={event => onSetAutomation({ reserveWeeks: Number(event.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>Недельный бюджет</span>
                <span className="font-mono text-slate-200">{formatMoney(automation.weeklyBudget)}</span>
              </div>
              <input
                type="range"
                min={AUTO_BUDGET_MIN}
                max={AUTO_BUDGET_MAX}
                step={5000}
                value={automation.weeklyBudget}
                onChange={event => onSetAutomation({ weeklyBudget: Number(event.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-slate-400 w-24 shrink-0">Топливо</label>
              <select
                value={automation.preferredFuel}
                onChange={event => onSetAutomation({ preferredFuel: event.target.value as BoilerFuelId })}
                className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
              >
                {BOILER_FUELS.map(fuel => (
                  <option key={fuel.id} value={fuel.id}>
                    {FUEL_ICONS[fuel.id]} {fuel.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ['autoRepair', 'Чинить аварии'],
                ['autoStart', 'Запускать котлы'],
                ['autoStop', 'Гасить лишние']
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => onSetAutomation({ [key]: !automation[key] })}
                  className={`rounded border px-2 py-1 text-[11px] transition ${
                    automation[key]
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {automation[key] ? '✓ ' : ''}{label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-2">
              План на неделю {week + 1}
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Закупить топлива</span>
                <span className="font-mono text-slate-200">
                  {autoPlan.fuelCost > 0 ? `${autoPlan.fuelCost > 0 ? Object.entries(autoPlan.buy).filter(([, qty]) => qty > 0).map(([id, qty]) => `${qty} ${BOILER_FUEL_BY_ID[id as BoilerFuelId].name.toLowerCase()}`).join(', ') : '—'} · ${formatMoney(autoPlan.fuelCost)}` : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Ремонт</span>
                <span className="font-mono text-slate-200">
                  {autoPlan.repair.length > 0
                    ? `${autoPlan.repair.map(id => BOILER_DEFINITION_BY_ID[id].name).join(', ')} · ${formatMoney(autoPlan.repairCost)}`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Запуск / остановка</span>
                <span className="font-mono text-slate-200">
                  {autoPlan.start.length + autoPlan.stop.length > 0
                    ? `${autoPlan.start.length} / ${autoPlan.stop.length}`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-2 border-t border-slate-800 pt-1.5">
                <span className="text-slate-400">Итого расход</span>
                <span className={`font-mono ${autoPlan.totalCost > 0 ? 'text-rose-300' : 'text-slate-200'}`}>
                  {formatMoney(autoPlan.totalCost)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Покрытие после</span>
                <span className={`font-mono ${autoPlan.coverageAfter >= 1 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {Math.round(autoPlan.coverageAfter * 100)}%
                </span>
              </div>
            </div>
            {autoPlan.notes.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-slate-800 pt-2">
                {autoPlan.notes.map((note, index) => (
                  <li key={index} className="text-[10px] text-slate-500">• {note}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Котлы */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {state.boilers.map(boiler => {
          const definition = BOILER_DEFINITION_BY_ID[boiler.id];
          const demand = boilerFuelDemand(boiler);
          const output = boilerHeatOutput(boiler);
          const repairCost = Math.max(definition.upkeep, boilerRepairCost(boiler));
          return (
            <div
              key={boiler.id}
              className={`rounded-xl border p-4 shadow-lg ${boiler.status === 'broken'
                  ? 'border-red-500/40 bg-red-500/5'
                  : boiler.status === 'running'
                    ? 'border-orange-500/30 bg-slate-900/60'
                    : 'border-slate-700/40 bg-slate-900/40'
                }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Flame className={`w-5 h-5 shrink-0 ${boiler.status === 'running' ? 'text-orange-400' : 'text-slate-500'}`} />
                  <h4 className="font-bold text-white text-sm truncate">{definition.name}</h4>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${STATUS_STYLES[boiler.status]}`}>
                  {STATUS_LABELS[boiler.status]}
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3">{definition.description}</p>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Мощность</span>
                  <span className="text-slate-200 font-mono">{definition.power}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Тепло</span>
                  <span className="text-orange-300 font-mono">{output}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Топливо</span>
                  <span className="text-slate-200 font-mono">{demand} ед./нед.</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Обслуживание</span>
                  <span className="text-slate-200 font-mono">{formatMoney(definition.upkeep)}</span>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Износ</span>
                  <span className={boiler.wear > 70 ? 'text-red-400' : boiler.wear > 40 ? 'text-amber-400' : 'text-emerald-400'}>
                    {Math.round(boiler.wear)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full ${boiler.wear > 70 ? 'bg-red-500' : boiler.wear > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${boiler.wear}%` }}
                  />
                </div>
              </div>

              {boiler.status === 'broken' ? (
                <button
                  onClick={() => handleRepair(boiler.id)}
                  className="w-full rounded py-2 text-xs font-medium bg-red-600 hover:bg-red-500 text-white border border-red-500/30 transition flex items-center justify-center gap-2"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  Отремонтировать — {formatMoney(repairCost)}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-slate-400 w-16 shrink-0">Топливо</label>
                    <select
                      value={boiler.fuel}
                      onChange={event => onSetBoiler(boiler.id, { fuel: event.target.value as BoilerFuelId })}
                      className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                    >
                      {BOILER_FUELS.map(item => (
                        <option key={item.id} value={item.id}>
                          {FUEL_ICONS[item.id]} {item.name} · {item.unitCost} за ед.
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-slate-400 w-16 shrink-0">Часы/нед.</label>
                    <input
                      type="range"
                      min={0}
                      max={168}
                      step={12}
                      value={boiler.hoursPerWeek}
                      onChange={event => onSetBoiler(boiler.id, { hoursPerWeek: Number(event.target.value) })}
                      className="flex-1 accent-orange-500"
                    />
                    <span className="text-xs font-mono text-slate-300 w-10 text-right">{boiler.hoursPerWeek}</span>
                  </div>
                  <button
                    onClick={() => onSetBoiler(boiler.id, { status: boiler.status === 'running' ? 'idle' : 'running' })}
                    className={`w-full rounded py-2 text-xs font-medium transition border ${boiler.status === 'running'
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        : 'bg-orange-600 hover:bg-orange-500 text-white border-orange-500/30'
                      }`}
                  >
                    {boiler.status === 'running' ? 'Остановить котёл' : 'Запустить котёл'}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {unbuilt.map(definition => (
          <div key={definition.id} className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Hammer className="w-5 h-5 text-slate-500" />
              <h4 className="font-bold text-slate-300 text-sm">{definition.name}</h4>
            </div>
            <p className="text-xs text-slate-500 mb-3">{definition.description}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Мощность</span>
                <span className="text-slate-300 font-mono">{definition.power}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Обслуживание</span>
                <span className="text-slate-300 font-mono">{formatMoney(definition.upkeep)}</span>
              </div>
            </div>
            <button
              onClick={() => handleBuild(definition.id)}
              disabled={funds < definition.buildCost}
              className={`w-full rounded py-2 text-xs font-medium transition border ${funds >= definition.buildCost
                  ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500/30'
                  : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                }`}
            >
              Построить — {formatMoney(definition.buildCost)}
            </button>
          </div>
        ))}
      </div>

      {/* Топливо */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          <Fuel className="w-4 h-4 text-amber-400" />
          <h4 className="font-bold text-white text-sm">Топливный склад</h4>
          <span className="text-[10px] text-slate-500 ml-auto">вместимость {FUEL_STORAGE_CAP} ед. на вид</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {BOILER_FUELS.map(fuel => {
            const stock = state.fuelStock[fuel.id];
            const left = weeksLeft[fuel.id];
            const cost = fuelPurchaseCost(fuel.id, buyAmount[fuel.id]);
            return (
              <div key={fuel.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-slate-200">
                    {FUEL_ICONS[fuel.id]} {fuel.name}
                  </span>
                  <span className="text-xs font-mono text-amber-300">{stock} ед.</span>
                </div>
                <p className="text-[10px] text-slate-500 mb-2">{fuel.description}</p>
                <div className="flex justify-between text-[10px] text-slate-400 mb-2">
                  <span>Тепло ×{fuel.heatMultiplier}</span>
                  <span>Риск аварии {Math.round(fuel.breakdownRisk * 100)}%</span>
                </div>
                <div className="text-[10px] text-slate-500 mb-2">
                  {Number.isFinite(left) ? `Хватит на ${left} нед.` : 'Котлы на этом топливе не работают'}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={FUEL_STORAGE_CAP}
                    step={10}
                    value={buyAmount[fuel.id]}
                    onChange={event => setBuyAmount(prev => ({ ...prev, [fuel.id]: Math.max(0, Number(event.target.value) || 0) }))}
                    className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 font-mono"
                  />
                  <button
                    onClick={() => handleBuy(fuel.id)}
                    disabled={funds < cost || cost <= 0}
                    className={`flex-1 rounded py-1.5 text-xs font-medium transition border ${funds >= cost && cost > 0
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30'
                        : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                      }`}
                  >
                    Купить — {formatMoney(cost)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Прогноз и статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h4 className="font-bold text-white text-sm">Прогноз на неделю</h4>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Отапливаемых площадок</span>
              <span className="text-slate-200 font-mono">{activeVenues} из {HEATED_VENUES.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Потребность в тепле</span>
              <span className="text-slate-200 font-mono">{heatDemand}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Котлы дадут</span>
              <span className={`font-mono ${heatProduced >= heatDemand ? 'text-emerald-300' : 'text-red-300'}`}>{heatProduced}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Множитель выручки площадок</span>
              <span className={`font-mono ${revenueMultiplier >= 1 ? 'text-emerald-300' : 'text-red-300'}`}>×{revenueMultiplier}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Прибавка к усталости</span>
              <span className={`font-mono ${exhaustionBump > 0 ? 'text-red-300' : 'text-emerald-300'}`}>+{exhaustionBump}</span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-2">
              <span className="text-slate-400">Расходы на топливо и ремонт</span>
              <span className="text-rose-300 font-mono">
                {formatMoney(
                  state.boilers.reduce((sum, boiler) => sum + boilerFuelDemand(boiler) * BOILER_FUEL_BY_ID[boiler.fuel].unitCost, 0)
                  + state.boilers.reduce((sum, boiler) => sum + BOILER_DEFINITION_BY_ID[boiler.id].upkeep, 0)
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Snowflake className="w-4 h-4 text-sky-400" />
            <h4 className="font-bold text-white text-sm">Журнал котельной</h4>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Холодных недель</span>
              <span className={`font-mono ${state.coldWeeks > 0 ? 'text-sky-300' : 'text-slate-200'}`}>{state.coldWeeks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Аварий котлов</span>
              <span className={`font-mono ${state.breakdowns > 0 ? 'text-red-300' : 'text-slate-200'}`}>{state.breakdowns}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Последний расчёт</span>
              <span className="text-slate-200 font-mono">
                {state.lastCalculatedWeek > 0 ? `неделя ${state.lastCalculatedWeek}` : 'ещё не было'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800">
              Котлы изнашиваются от работы: чем больше часов в неделю, тем быстрее растёт износ.
              Ремонт сбрасывает износ и снимает аварию, но стоит денег.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
