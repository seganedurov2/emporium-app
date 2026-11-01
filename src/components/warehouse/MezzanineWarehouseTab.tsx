import { useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Box,
  Forklift,
  Layers,
  Plus,
  Truck,
  Warehouse,
  Zap
} from 'lucide-react';
import { formatMoney } from '../../currency';
import { sound } from '../../sound';
import {
  WAREHOUSE_UPGRADES,
  WAREHOUSE_BASE_CAPACITY,
  WAREHOUSE_MAX_LEVEL,
  type WarehouseState,
  type WarehouseUpgrade,
  calculateWeeklyAutoOps,
  warehouseOccupancyPercent,
  canStore
} from '../../warehouseEngine';

interface MezzanineWarehouseTabProps {
  week: number;
  funds: number;
  warehouse: WarehouseState;
  onUpgrade: () => void;
  onStore: (amount: number) => void;
  onRetrieve: (amount: number) => void;
}

const AUTOMATION_LABELS: Record<keyof WarehouseState['automation'], string> = {
  wms: 'WMS-учёт',
  conveyor: 'Конвейер',
  lift: 'Лифтовая выдача',
  asrs: 'AS/RS кран'
};

const AUTOMATION_ICONS: Record<keyof WarehouseState['automation'], typeof Zap> = {
  wms: BarChart3,
  conveyor: Layers,
  lift: Forklift,
  asrs: Layers
};

export function MezzanineWarehouseTab({
  week,
  funds,
  warehouse,
  onUpgrade,
  onStore,
  onRetrieve
}: MezzanineWarehouseTabProps) {
  const [message, setMessage] = useState<string | null>(null);
  const { ops, state: updatedWarehouse } = calculateWeeklyAutoOps(warehouse, week);
  const nextLevel = warehouse.level + 1;
  const nextUpgrade: WarehouseUpgrade | undefined = WAREHOUSE_UPGRADES.find(u => u.level === nextLevel);
  const canUpgrade = Boolean(nextUpgrade) && funds >= nextUpgrade.cost;
  const occupancyPct = warehouseOccupancyPercent(updatedWarehouse);

  const handleUpgrade = () => {
    if (!canUpgrade || !nextUpgrade) return;
    onUpgrade();
    sound.play('upgrade');
    setMessage(`Улучшение «${nextUpgrade.name}» применено.`);
    setTimeout(() => setMessage(null), 3500);
  };

  const handleStore = () => {
    const amount = 100;
    if (!canStore(updatedWarehouse, amount)) {
      setMessage('Недостаточно свободного места на мезонине.');
      sound.play('error');
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    onStore(amount);
    sound.play('purchase');
    setMessage(`Принято на склад: ${amount} ед.`);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleRetrieve = () => {
    const amount = 50;
    if (updatedWarehouse.occupancy < amount) {
      setMessage('Недостаточно груза на складе.');
      sound.play('error');
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    onRetrieve(amount);
    sound.play('click');
    setMessage(`Выдано со склада: ${amount} ед.`);
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-amber-400" /> Складской автоматический мезонин
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Многоуровневая стеллажная платформа внутри склада. Автоматизированная
              приёмка, перемещение и выдача грузов через WMS/WCS без ручного подъёма.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-300">
          <span>Уровень {warehouse.level} / {WAREHOUSE_MAX_LEVEL}</span>
        </div>
      </header>

      {/* Ключевые показатели */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="text-slate-400 text-xs uppercase mb-1 font-semibold">Вместимость</div>
          <div className="text-2xl font-bold font-mono text-white">
            {updatedWarehouse.capacity} <span className="text-xs font-normal text-slate-400">ед.</span>
          </div>
          <div className="mt-1 text-xs text-slate-400 font-mono">
            базовая {WAREHOUSE_BASE_CAPACITY} + бонус уровня
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="text-slate-400 text-xs uppercase mb-1 font-semibold">Занято</div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {updatedWarehouse.occupancy} <span className="text-xs font-normal text-slate-400">/{updatedWarehouse.capacity}</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {occupancyPct}% заполнено
          </div>
          <div className="w-full bg-slate-800/50 h-2 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r from-amber-500 to-amber-300`}
              style={{ width: `${Math.min(100, occupancyPct)}%` }}
            />
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="text-slate-400 text-xs uppercase mb-1 font-semibold">Автоопераций/нед.</div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{ops}</div>
          <div className="mt-1 text-xs text-slate-400 font-mono">WMS + конвейер + лифт + AS/RS</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="text-slate-400 text-xs uppercase mb-1 font-semibold">Казна</div>
          <div className="text-2xl font-bold font-mono text-white">{formatMoney(funds)}</div>
          <div className="mt-1 text-xs text-slate-400 font-mono">доступно на улучшение</div>
        </div>
      </div>

      {/* Автоматизация */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white">Автоматизация уровней</h3>
          <span className="text-xs font-mono text-slate-400">
            {Object.values(updatedWarehouse.automation).filter(Boolean).length}/4 системы
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(updatedWarehouse.automation).map(([key, active]) => {
            const Icon = AUTOMATION_ICONS[key as keyof WarehouseState['automation']];
            return (
              <div
                key={key}
                className={`flex items-center gap-3 p-3 rounded-lg border transition ${active ? 'bg-amber-900/20 border-amber-500/50' : 'bg-slate-950 border-slate-800'}`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-amber-400' : 'text-slate-600'}`} />
                <div>
                  <div className="text-sm font-medium text-white">{AUTOMATION_LABELS[key as keyof WarehouseState['automation']]}</div>
                  <div className="text-xs text-slate-400">{active ? 'Активно' : 'Заблокировано'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Улучшение */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white">Уровень мезонина</h3>
          {warehouse.level >= WAREHOUSE_MAX_LEVEL ? (
            <span className="text-emerald-400 text-xs font-semibold">Максимальный уровень</span>
          ) : (
            <span className="text-xs font-mono text-slate-400">Следующий уровень</span>
          )}
        </div>
        {warehouse.level < WAREHOUSE_MAX_LEVEL && nextUpgrade && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-slate-950 p-4 rounded-lg border border-slate-800">
              <div>
                <div className="font-bold text-white">{nextUpgrade.name}</div>
                <div className="text-xs text-slate-400">{nextUpgrade.description}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-white">{formatMoney(nextUpgrade.cost)}</div>
                <div className="text-[10px] text-slate-400 font-mono">вместимость +{nextUpgrade.capacityBonus}</div>
              </div>
            </div>
            <button
              onClick={handleUpgrade}
              disabled={!canUpgrade || warehouse.level >= WAREHOUSE_MAX_LEVEL}
              className={`w-full py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${!canUpgrade || warehouse.level >= WAREHOUSE_MAX_LEVEL
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-amber-600 hover:bg-amber-500 text-white border border-amber-500/50'}`}
            >
              <Plus className="w-4 h-4" />
              {warehouse.level >= WAREHOUSE_MAX_LEVEL ? 'Максимум достигнут' : `Улучшить до уровня ${nextLevel}`}
            </button>
            {!canUpgrade && funds < nextUpgrade.cost && (
              <div className="text-xs text-red-400/80 font-mono">
                Недостаточно средств: нужно {formatMoney(nextUpgrade.cost - funds)} ещё.
              </div>
            )}
          </div>
        )}
        {warehouse.level >= WAREHOUSE_MAX_LEVEL && (
          <div className="text-center py-4 text-sm text-emerald-400">
            Складской мезонин полностью автоматизирован. Все системы активны.
          </div>
        )}
      </div>

      {/* Ручное управление грузом */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white">Приём и выдача</h3>
          <span className="text-xs font-mono text-slate-400">Ручные операции</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={handleStore}
            disabled={!canStore(updatedWarehouse, 100)}
            className="bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Box className="w-4 h-4" /> Принять 100 ед.
          </button>
          <button
            onClick={handleRetrieve}
            disabled={updatedWarehouse.occupancy < 50}
            className="bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Truck className="w-4 h-4" /> Выдать 50 ед.
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-amber-900/20 border border-amber-500/50 rounded-lg p-4 text-amber-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {message}
        </div>
      )}
    </div>
  );
}
