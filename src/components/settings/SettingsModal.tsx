import { X } from 'lucide-react';
import type { AppSettings } from '../../settings';
import type { OrientationLock } from '../../telegram';

interface SettingsModalProps {
  open: boolean;
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  onClose: () => void;
}

const ORIENTATION_OPTIONS: { value: OrientationLock; label: string; hint: string }[] = [
  { value: 'auto', label: 'Авто', hint: 'Поворот по датчику устройства' },
  { value: 'portrait', label: 'Портретный', hint: 'Вертикальный режим экрана' },
  { value: 'landscape', label: 'Альбомный', hint: 'Горизонтальный режим экрана' }
];

export function SettingsModal({ open, settings, onChange, onClose }: SettingsModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Настройки приложения"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Настройки</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть настройки"
            className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 transition hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Экран
          </h3>
          <div className="space-y-2">
            {ORIENTATION_OPTIONS.map(option => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
                  settings.orientation === option.value
                    ? 'border-amber-400/60 bg-amber-400/10'
                    : 'border-slate-700 bg-slate-950 hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="orientation"
                  value={option.value}
                  checked={settings.orientation === option.value}
                  onChange={() => onChange({ orientation: option.value })}
                  className="mt-1 accent-amber-400"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-100">
                    {option.label}
                  </span>
                  <span className="block text-xs text-slate-400">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed text-slate-500">
            В Telegram Mini App блокировка работает в полноэкранном режиме. В APK экран
            поворачивается по датчику — оба режима доступны.
          </p>
        </section>

        <section className="mt-5 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Уведомления
          </h3>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 transition hover:border-slate-600">
            <span>
              <span className="block text-sm font-semibold text-slate-100">
                Всплывающие уведомления
              </span>
              <span className="block text-xs text-slate-400">
                Баннер в правом верхнем углу о событиях игры
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={event => onChange({ notifications: event.target.checked })}
              className="h-4 w-4 accent-amber-400"
            />
          </label>
        </section>

        <section className="mt-5 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Экспериментальные
          </h3>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 transition hover:border-slate-600">
            <span>
              <span className="block text-sm font-semibold text-slate-100">
                3D-портреты
              </span>
              <span className="block text-xs text-slate-400">
                glTF-модели вместо картинок, где они есть. Нужен WebGL2;
                на слабых устройствах автоматически включается 2D
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.emporium_3d}
              onChange={event => onChange({ emporium_3d: event.target.checked })}
              className="h-4 w-4 accent-amber-400"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 transition hover:border-slate-600">
            <span>
              <span className="block text-sm font-semibold text-slate-100">
                AR-режим
              </span>
              <span className="block text-xs text-slate-400">
                Просмотр 3D-портретов через камеру в дополненной реальности. WebXR.
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.ar_mode}
              onChange={event => onChange({ ar_mode: event.target.checked })}
              className="h-4 w-4 accent-amber-400"
            />
          </label>
        </section>

        <section className="mt-5 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Защита данных
          </h3>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 transition hover:border-slate-600">
            <span>
              <span className="block text-sm font-semibold text-slate-100">
                Шифрование при хранении
              </span>
              <span className="block text-xs text-slate-400">
                AES-256-GCM для сохранений и настроек в локальном хранилище.
                Требует пароля сессии при запуске.
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.data_protection.encryption_at_rest}
              onChange={event => onChange({ data_protection: { ...settings.data_protection, encryption_at_rest: event.target.checked } })}
              className="h-4 w-4 accent-amber-400"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 transition hover:border-slate-600">
            <span>
              <span className="block text-sm font-semibold text-slate-100">
                WSS для мультиплеера
              </span>
              <span className="block text-xs text-slate-400">
                Требовать TLS (wss://) для WebSocket-соединения распределённого
                склада. ws:// будет автоматически обновлён до wss://.
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.data_protection.tls_wss}
              onChange={event => onChange({ data_protection: { ...settings.data_protection, tls_wss: event.target.checked } })}
              className="h-4 w-4 accent-amber-400"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 transition hover:border-slate-600">
            <span>
              <span className="block text-sm font-semibold text-slate-100">
                Журнал аудита доступа к данным
              </span>
              <span className="block text-xs text-slate-400">
                Фиксирует чтение/запись защищённых данных в локальный след
                аудита (последние 500 событий).
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.data_protection.audit_log}
              onChange={event => onChange({ data_protection: { ...settings.data_protection, audit_log: event.target.checked } })}
              className="h-4 w-4 accent-amber-400"
            />
          </label>
        </section>
      </div>
    </div>
  );
}
