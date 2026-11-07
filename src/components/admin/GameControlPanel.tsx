// Игровая панель управления: одно место для всех "форм", которые правят
// состояние игры. Пишет напрямую в мутабельные модели (cityBuilder / cityPlanState),
// поэтому результат сразу виден и на 2D/3D-плане города, и в сохранении.
//
// Держится в стороне от gameEngine: панель не должна менять правила кампании,
// только ввод и сохранение. Общие правила — в одном списке GameFieldSpec на форму.
import { useCallback, useMemo, useState } from 'react';
import { FileText, Hammer, RotateCcw, Trash2 } from 'lucide-react';
import {
  BLOCK_STYLES,
  addressOf,
  cityStats,
  demolish,
  generateCity,
  listBuildings,
  listStreets,
  placeBuilding,
  streetAt,
  tick,
  type BuildingKind,
  type CityState,
} from '../../cityBuilder';
import type { WarehouseState } from '../../warehouseEngine';
import {
  CITY_PLAN_SCHEMA_VERSION,
  MAX_CITY_PLAN_OFFLINE_MS,
  normalizeCityPlanSave,
  restoreCityPlan,
  serializeCityPlan,
  type CityPlanSave,
} from '../../cityPlanState';

export type GameFieldKind = 'text' | 'number' | 'checkbox' | 'select' | 'textarea';

export interface GameFieldSpec<T> {
  key: keyof T & string;
  label: string;
  kind: GameFieldKind;
  /** Валидация и нормализация одного поля. Возвращает текст ошибки или нормализованное значение. */
  validate: (raw: unknown) => { ok: true; value: T[keyof T & string] } | { ok: false; error: string };
  options?: { value: string; label: string }[];
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface GameControlPanelProps {
  /** Начальный/текущий город (обычно результат restoreCityPlan). */
  city: CityState;
  /** Сохранение, которое нужно показать/экспортировать. */
  save: CityPlanSave | null;
  /** Импорт сырых данных (например, из localStorage или файла). */
  onImportSave: (raw: unknown) => boolean;
  /** Сохранение после каждого применения формы. */
  onSaveChange: (save: CityPlanSave) => void;
  /** Текущий склад кампании; панель только читает его для начальных значений. */
  warehouse?: WarehouseState | null;
  /** Применение формы склада. Без него форма работает в режиме предпросмотра. */
  onWarehouseChange?: (patch: Pick<WarehouseState, 'level' | 'automation'>) => void;
  className?: string;
}

/* ---------------------------------------------------------------- *
 *  Схемы полей — единственное место, где описаны все игровые формы. *
 * ---------------------------------------------------------------- */

/** Поля "проекта города": seed и параметры новой застройки. */
export interface CityPlanForm {
  seed: string;
  size: string;
  pitch: string;
}

/** Поля "одного участка": адрес и тип здания. */
export interface LotForm {
  x: string;
  y: string;
  kind: BuildingKind;
}

const PLAN_FIELDS: GameFieldSpec<CityPlanForm>[] = [
  {
    key: 'seed',
    label: 'Seed карты',
    kind: 'number',
    hint: 'Целое число 1..999999. Тот же seed = тот же город.',
    validate: raw => {
      const n = Number(raw);
      return Number.isSafeInteger(n) && n >= 1 && n <= 999_999
        ? { ok: true, value: String(n) }
        : { ok: false, error: 'Seed должен быть целым от 1 до 999 999.' };
    },
  },
  {
    key: 'size',
    label: 'Размер сетки',
    kind: 'number',
    hint: 'Клеток по стороне, 20..80. По умолчанию 40.',
    validate: raw => {
      const n = Number(raw);
      return Number.isSafeInteger(n) && n >= 20 && n <= 80
        ? { ok: true, value: String(n) }
        : { ok: false, error: 'Размер должен быть целым от 20 до 80.' };
    },
  },
  {
    key: 'pitch',
    label: 'Шаг улиц',
    kind: 'number',
    hint: 'Клеток между дорогами, 3..10. По умолчанию 4.',
    validate: raw => {
      const n = Number(raw);
      return Number.isSafeInteger(n) && n >= 3 && n <= 10
        ? { ok: true, value: String(n) }
        : { ok: false, error: 'Шаг должен быть целым от 3 до 10.' };
    },
  },
];

const LOT_FIELDS: GameFieldSpec<LotForm>[] = [
  {
    key: 'x',
    label: 'Координата X',
    kind: 'number',
    hint: 'Клетка по горизонтали, 0..(размер − 1).',
    validate: raw => {
      const n = Number(raw);
      return Number.isSafeInteger(n) && n >= 0
        ? { ok: true, value: String(n) }
        : { ok: false, error: 'X — целое число ≥ 0.' };
    },
  },
  {
    key: 'y',
    label: 'Координата Y',
    kind: 'number',
    hint: 'Клетка по вертикали, 0..(размер − 1).',
    validate: raw => {
      const n = Number(raw);
      return Number.isSafeInteger(n) && n >= 0
        ? { ok: true, value: String(n) }
        : { ok: false, error: 'Y — целое число ≥ 0.' };
    },
  },
  {
    key: 'kind',
    label: 'Тип здания',
    kind: 'select',
    options: (Object.keys(BLOCK_STYLES) as BuildingKind[]).map(k => ({
      value: k,
      label: `${BLOCK_STYLES[k].label} (${BLOCK_STYLES[k].buildSeconds} с)`,
    })),
    validate: raw =>
      typeof raw === 'string' && raw in BLOCK_STYLES
        ? { ok: true, value: raw as BuildingKind }
        : { ok: false, error: 'Выберите тип из списка.' },
  },
];

export interface WarehouseForm {
  level: string;
  conveyor: boolean;
  lift: boolean;
  asrs: boolean;
}

const WAREHOUSE_FIELDS: GameFieldSpec<WarehouseForm>[] = [
  {
    key: 'level',
    label: 'Уровень склада',
    kind: 'number',
    hint: '0..5, каждое улучшение открывает автоматизацию.',
    validate: raw => {
      const n = Number(raw);
      return Number.isSafeInteger(n) && n >= 0 && n <= 5
        ? { ok: true, value: String(n) }
        : { ok: false, error: 'Уровень — целое от 0 до 5.' };
    },
  },
  { key: 'conveyor', label: 'Конвейер', kind: 'checkbox', validate: raw => ({ ok: true, value: raw === true }) },
  { key: 'lift', label: 'Лифтовая выдача', kind: 'checkbox', validate: raw => ({ ok: true, value: raw === true }) },
  { key: 'asrs', label: 'AS/RS кран', kind: 'checkbox', validate: raw => ({ ok: true, value: raw === true }) },
];

/** Один вопрос "проверка перед применением": так не нужно дублировать логику в UI. */
export function validateForm<T>(fields: GameFieldSpec<T>[], values: T): { ok: true; data: T } | { ok: false; errors: Partial<Record<keyof T & string, string>> } {
  const errors: Partial<Record<keyof T & string, string>> = {};
  const data = { ...values };
  for (const f of fields) {
    const r = f.validate((values as Record<string, unknown>)[f.key]);
    if (!r.ok) errors[f.key] = r.error;
    else (data as Record<string, unknown>)[f.key] = r.value;
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, data };
}

/* ---------------------------------------------------------------- *
 *  Компоненты полей: одна реализация на все формы.                 *
 * ---------------------------------------------------------------- */

function Field<T>({
  spec,
  value,
  error,
  onChange,
}: {
  spec: GameFieldSpec<T>;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}) {
  const base =
    'w-full bg-slate-800 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none transition ' +
    (error ? 'border-red-500/60 focus:border-red-400' : 'border-slate-600 focus:border-amber-500');

  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{spec.label}</label>
      {spec.kind === 'checkbox' ? (
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input type="checkbox" checked={value === true} onChange={e => onChange(e.target.checked)} />
          {spec.label}
        </label>
      ) : spec.kind === 'select' ? (
        <select className={base} value={String(value)} onChange={e => onChange(e.target.value)}>
          {spec.options?.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : spec.kind === 'textarea' ? (
        <textarea className={base + ' min-h-20 font-mono text-xs'} value={String(value)} onChange={e => onChange(e.target.value)} />
      ) : (
        <input
          className={base}
          type={spec.kind === 'number' ? 'number' : 'text'}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={String(value)}
          onChange={e => onChange(spec.kind === 'number' ? e.target.value.replace(/[^\d-]/g, '') : e.target.value)}
        />
      )}
      {error ? (
        <div className="text-[11px] text-red-400">{error}</div>
      ) : spec.hint ? (
        <div className="text-[11px] text-slate-500">{spec.hint}</div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- *
 *  Панель                                                            *
 * ---------------------------------------------------------------- */

export function GameControlPanel({
  city,
  save,
  onImportSave,
  onSaveChange,
  warehouse: warehouseState = null,
  onWarehouseChange,
  className = '',
}: GameControlPanelProps) {
  const [plan, setPlan] = useState<CityPlanForm>(() => ({
    seed: '1101',
    size: String(city.size),
    pitch: '8',
  }));
  const [lot, setLot] = useState<LotForm>({ x: '0', y: '0', kind: 'house' });
  const [warehouse, setWarehouse] = useState<WarehouseForm>(() => ({
    level: String(warehouseState?.level ?? 0),
    conveyor: warehouseState?.automation.conveyor ?? false,
    lift: warehouseState?.automation.lift ?? false,
    asrs: warehouseState?.automation.asrs ?? false,
  }));
  const [importText, setImportText] = useState('');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [speed, setSpeed] = useState(1);

  // Живой город: панель применяет изменения мутацией, как CityBuilderView.
  // Состояние хранит сам объект, поэтому React видит новую ссылку после каждого
  // применения формы, а мутации внутри placeBuilding/demolish остаются в силе.
  const [liveCity, setLiveCity] = useState<CityState>(city);
  const [syncedCity, setSyncedCity] = useState<CityState>(city);
  if (city !== syncedCity) {
    // Проп пришёл снаружи (импорт/загрузка) — подхватываем его без эффекта.
    setSyncedCity(city);
    setLiveCity(city);
  }
  // Seed, с которым сохранён текущий город: нужен для serializeCityPlan.
  const [citySeed, setCitySeed] = useState(plan.seed);

  const notify = useCallback((tone: 'ok' | 'err', text: string) => {
    setMessage({ tone, text });
    window.setTimeout(() => setMessage(m => (m?.text === text ? null : m)), 3500);
  }, []);

  const commit = useCallback(
    (next: CityState, seed: string = citySeed) => {
      setLiveCity(next);
      const snapshot = serializeCityPlan(next, seed, { savedAt: Date.now(), wasOpenAtSave: true });
      if (snapshot) onSaveChange(snapshot);
    },
    [onSaveChange, citySeed],
  );

  const stats = useMemo(() => cityStats(liveCity), [liveCity]);
  const streets = useMemo(() => listStreets(liveCity), [liveCity]);
  const buildings = useMemo(() => listBuildings(liveCity), [liveCity]);

  /** Форма 1: новый проект города. */
  const submitPlan = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateForm(PLAN_FIELDS, plan);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    const seed = Number(result.data.seed);
    const size = Number(result.data.size);
    const pitch = Number(result.data.pitch);
    if (pitch >= size) {
      setErrors({ pitch: 'Шаг должен быть меньше размера сетки.' });
      return;
    }
    const next = generateCity(seed, size, pitch);
    setCitySeed(String(seed));
    commit(next, String(seed));
    notify('ok', `Новый проект: seed ${seed}, сетка ${size}×${size}, кварталов ${next.blocks.length}.`);
  };

  /** Форма 2: поставить или снести здание на участке. */
  const submitLot = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateForm(LOT_FIELDS, lot);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    const x = Number(result.data.x);
    const y = Number(result.data.y);
    const next = liveCity;
    if (x >= next.size || y >= next.size) {
      setErrors({ x: `Координаты должны быть в пределах 0..${next.size - 1}.` });
      return;
    }
    const placed = placeBuilding(next, x, y, result.data.kind);
    if (!placed.ok) {
      notify('err', placed.error ?? 'Нельзя строить на этой клетке.');
      return;
    }
    notify('ok', `${BLOCK_STYLES[result.data.kind].label} — ${addressOf(next, x, y)}: стройка начата.`);
    commit(next);
  };

  const demolishAt = () => {
    const x = Number(lot.x);
    const y = Number(lot.y);
    const next = liveCity;
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x >= next.size || y >= next.size) {
      setErrors({ x: `Координаты должны быть в пределах 0..${next.size - 1}.` });
      return;
    }
    const ok = demolish(next, x, y);
    notify(ok ? 'ok' : 'err', ok ? `Снесено: ${streetAt(next, x, y)}` : 'На этой клетке нечего сносить.');
    if (ok) commit(next);
  };

  /** Форма 3: склад. Применяется к сохранению кампании, не к городскому плану. */
  const submitWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateForm(WAREHOUSE_FIELDS, warehouse);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    const level = Number(result.data.level) as WarehouseState['level'];
    onWarehouseChange?.({
      level,
      automation: {
        // WMS is unlocked from level 1 on; the panel does not toggle it.
        wms: warehouseState?.automation.wms ?? level >= 1,
        conveyor: result.data.conveyor,
        lift: result.data.lift,
        asrs: result.data.asrs,
      },
    });
    notify(
      'ok',
      onWarehouseChange
        ? `Склад: уровень ${level}, конвейер ${result.data.conveyor ? 'вкл' : 'выкл'}.`
        : 'Склад: форма валидна (обработчик не подключён).',
    );
  };

  /** Форма 4: импорт сохранения из текста (вставка из консоли/файла). */
  const importSave = () => {
    if (!importText.trim()) {
      notify('err', 'Вставьте JSON сохранения.');
      return;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(importText);
    } catch {
      notify('err', 'Невалидный JSON.');
      return;
    }
    const normalized = normalizeCityPlanSave(raw);
    if (!normalized) {
      notify('err', 'Сохранение не прошло валидацию схемы.');
      return;
    }
    setBusy(true);
    const restored = restoreCityPlan(normalized, normalized.seed);
    setLiveCity(restored.city);
    setCitySeed(String(normalized.seed));
    setBusy(false);
    setErrors({});
    notify('ok', `Импортировано: ${restored.city.blocks.length} кварталов, оффлайн ${(restored.appliedOfflineMs / 1000).toFixed(0)} с.`);
    onImportSave(normalized);
    if (restored.save) onSaveChange(restored.save);
  };

  const tickSimulation = () => {
    const next = liveCity;
    tick(next, 1, speed);
    commit(next);
  };

  const exportSave = () => {
    const snapshot = save ?? serializeCityPlan(liveCity, citySeed, { savedAt: Date.now(), wasOpenAtSave: true });
    if (!snapshot) {
      notify('err', 'Некуда сохранять: в городе нет зданий.');
      return;
    }
    setImportText(JSON.stringify(snapshot, null, 2));
    notify('ok', `Экспортировано ${snapshot.buildings.length} зданий (schema v${CITY_PLAN_SCHEMA_VERSION}).`);
  };

  return (
    <div className={`flex h-full min-h-[640px] w-full flex-col overflow-hidden bg-slate-950 text-white ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Hammer className="h-4 w-4 text-amber-400" /> Панель управления игрой
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Формы валидируются одной схемой на поле и пишут сразу в модель города и в сохранение.
          </p>
        </div>
        <div className="font-mono text-[11px] text-emerald-300">
          {stats.population} жит. · {stats.built} домов · {stats.building} стройка · улиц {streets.length}
        </div>
      </header>

      {message && (
        <div
          role="status"
          className={`border-b px-4 py-2 text-xs ${message.tone === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
            }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-2">
        {/* Форма 1: проект города */}
        <form onSubmit={submitPlan} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-sm font-bold text-amber-300">Новый проект города</div>
          {PLAN_FIELDS.map(spec => (
            <Field key={spec.key} spec={spec} value={plan[spec.key]} error={errors[spec.key]} onChange={v => setPlan(p => ({ ...p, [spec.key]: v }))} />
          ))}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:bg-amber-500/50">
              Сгенерировать
            </button>
            <button type="button" onClick={exportSave} className="flex-1 rounded-lg border border-slate-700 py-2 text-sm text-slate-200 transition hover:border-amber-400">
              <FileText className="mr-1 inline h-4 w-4" /> Экспорт
            </button>
          </div>
        </form>

        {/* Форма 2: участок */}
        <form onSubmit={submitLot} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-sm font-bold text-amber-300">Участок</div>
          <div className="grid grid-cols-2 gap-3">
            {LOT_FIELDS.filter(f => f.kind === 'number').map(spec => (
              <Field key={spec.key} spec={spec} value={lot[spec.key]} error={errors[spec.key]} onChange={v => setLot(l => ({ ...l, [spec.key]: v }))} />
            ))}
          </div>
          {LOT_FIELDS.filter(f => f.kind === 'select').map(spec => (
            <Field key={spec.key} spec={spec} value={lot[spec.key]} error={errors[spec.key]} onChange={v => setLot(l => ({ ...l, [spec.key]: v }))} />
          ))}
          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white transition hover:bg-emerald-500">
              Построить
            </button>
            <button type="button" onClick={demolishAt} className="flex-1 rounded-lg border border-red-500/40 py-2 text-sm text-red-300 transition hover:bg-red-500/10">
              <Trash2 className="mr-1 inline h-4 w-4" /> Снести
            </button>
          </div>
        </form>

        {/* Форма 3: склад */}
        <form onSubmit={submitWarehouse} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-sm font-bold text-amber-300">Складской мезонин</div>
          {WAREHOUSE_FIELDS.map(spec => (
            <Field key={spec.key} spec={spec} value={warehouse[spec.key]} error={errors[spec.key]} onChange={v => setWarehouse(w => ({ ...w, [spec.key]: v }))} />
          ))}
          <button type="submit" className="w-full rounded-lg bg-amber-500 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-400">
            Применить
          </button>
        </form>

        {/* Форма 4: сохранение / импорт */}
        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-sm font-bold text-amber-300">Сохранение</div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <RotateCcw className="h-3.5 w-3.5" />
            Оффлайн-догон ограничен {(MAX_CITY_PLAN_OFFLINE_MS / 3600000).toFixed(0)} ч, как в restoreCityPlan.
          </div>
          <Field
            spec={{ key: 'json', label: 'JSON сохранения', kind: 'textarea', validate: raw => ({ ok: true, value: String(raw) }) }}
            value={importText}
            onChange={v => setImportText(String(v))}
          />
          <div className="flex items-center gap-2">
            {[0, 1, 2, 4].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={`flex-1 rounded border px-2 py-1 text-[11px] ${speed === s ? 'border-emerald-400 bg-emerald-600 font-bold' : 'border-slate-700 bg-slate-900/70'}`}
              >
                {s === 0 ? 'Пауза' : `${s}×`}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={tickSimulation} className="flex-1 rounded-lg bg-blue-600/80 py-2 text-sm transition hover:bg-blue-600">
              Тик 1 с
            </button>
            <button type="button" onClick={importSave} disabled={busy} className="flex-1 rounded-lg bg-slate-700 py-2 text-sm transition hover:bg-slate-600 disabled:opacity-50">
              Импортировать
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto rounded border border-slate-800 bg-black/40 p-2 font-mono text-[10px] text-slate-400">
            {buildings.length === 0 ? (
              <div>Зданий нет — сгенерируйте город.</div>
            ) : (
              buildings.slice(0, 20).map(({ x, y, building }) => (
                <div key={building.id}>
                  #{building.id} {BLOCK_STYLES[building.kind].label} · {building.street}, {building.number} · (
                  {x},{y}) · {Math.round(building.progress * 100)}%
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
