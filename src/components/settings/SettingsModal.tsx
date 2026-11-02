import { X, ChevronDown, ShieldAlert, Bell, Smartphone, Monitor, Lock, Cpu, Activity, Sun, Moon, Download } from 'lucide-react';
import { useState } from 'react';
import type { AppSettings } from '../../settings';
import type { OrientationLock } from '../../telegram';
import { THREATS, severityRank, protectionsForThreat } from '../../threatAnalysis';
import { readAuditTrail } from '../../dataProtection';
import { exportBackup, importBackupFile, restoreBackupBundle } from '../../backup';
import { t } from '../../i18n';

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

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-red-400 border-red-500/20 bg-red-500/5',
  high: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
  medium: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
  low: 'text-slate-400 border-slate-600/20 bg-slate-600/5'
};

function Section({ children, title, Icon, hint, open: sectionOpen, onToggle }: { children: React.ReactNode; title: string; Icon: React.ElementType; hint?: string; open: boolean; onToggle: () => void }) {
  return (
    <section className="mt-4 space-y-2 rounded-xl border bg-slate-950/60 p-3 shadow-sm transition hover:border-slate-600">
      <div
        onClick={onToggle}
        className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-slate-800/50"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-400 shrink-0" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
        </div>
        {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
        <ChevronDown className={`h-3 w-3 shrink-0 transition ${sectionOpen ? '' : '-rotate-180'}`} />
      </div>
      {sectionOpen && <div className="mt-2 space-y-2">{children}</div>}
    </section>
  );
}

export function SettingsModal({ open, settings, onChange, onClose }: SettingsModalProps) {
  const [sections, setSections] = useState<Record<string, boolean>>({
    screen: true,
    notifications: false,
    experimental: false,
    protection: false,
    threats: false,
    audit: false
  });
  const [auditTrail, setAuditTrail] = useState<Array<{ ts: number; event: string; detail?: string }>>([]);
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [backupStatus, setBackupStatus] = useState<'idle' | 'exporting' | 'importing' | 'done' | 'error'>('idle');
  const [backupError, setBackupError] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);

  if (!open) return null;

  const toggle = (id: string) => setSections(prev => ({ ...prev, [id]: !sections[id] }));

  const severityBadge = (severity: string) => {
    const color = SEVERITY_COLOR[severity] ?? SEVERITY_COLOR.low;
    return (
      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${color}`}>
        {severity}
      </span>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Настройки приложения"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
            <h2 className="text-lg font-bold text-white">Настройки</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть настройки"
            className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 transition hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[10px] text-slate-500 mb-4">Emporium 0.3.8 · складской мезонин · Telegram Mini App</p>

        <Section
          title="Экран"
          Icon={Monitor}
          hint="В Telegram Mini App блокировка работает в полноэкранном режиме. В APK экран поворачивается по датчику."
          open={sections.screen}
          onToggle={() => toggle('screen')}
        >
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
        </Section>

        <Section
          title="Уведомления"
          Icon={Bell}
          hint="Баннер в правом верхнем углу о событиях игры"
          open={sections.notifications}
          onToggle={() => toggle('notifications')}
        >
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 transition hover:border-slate-600">
            <span>
              <span className="block text-sm font-semibold text-slate-100">
                Всплывающие уведомления
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={event => onChange({ notifications: event.target.checked })}
              className="h-4 w-4 accent-amber-400"
            />
          </label>
        </Section>

        <Section
          title="Экспериментальные"
          Icon={Smartphone}
          hint="glTF-модели и просмотр через камеру в дополненной реальности. WebXR."
          open={sections.experimental}
          onToggle={() => toggle('experimental')}
        >
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
                Просмотр 3D-портретов через камеру в дополненной реальности.
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.ar_mode}
              onChange={event => onChange({ ar_mode: event.target.checked })}
              className="h-4 w-4 accent-amber-400"
            />
          </label>
        </Section>

        <Section
          title="Защита данных"
          Icon={Lock}
          hint="AES-256-GCM, TLS/WSS, журнал аудита для распределённого склада"
          open={sections.protection}
          onToggle={() => toggle('protection')}
        >
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
                ws:// автоматически обновляется до wss://.
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
                Последние 500 событий чтения/записи защищённых данных.
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.data_protection.audit_log}
              onChange={event => onChange({ data_protection: { ...settings.data_protection, audit_log: event.target.checked } })}
              className="h-4 w-4 accent-amber-400"
            />
          </label>
        </Section>

        <Section
          title="Анализ угроз склада"
          Icon={Cpu}
          hint="10 угроз (T01–T10) и способы их защиты"
          open={sections.threats}
          onToggle={() => toggle('threats')}
        >
          {THREATS
            .slice()
            .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
            .map(threat => {
              const protections = protectionsForThreat(threat.id);
              return (
                <div
                  key={threat.id}
                  className="rounded border bg-slate-950 p-2 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-200">{threat.id}</span>
                    {severityBadge(threat.severity)}
                  </div>
                  <div className="text-sm font-medium text-slate-100 mb-0.5">
                    {threat.title}
                  </div>
                  <div className="text-[10px] text-slate-400 mb-1">
                    {threat.description}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider">Защита:</span>
                    {protections.map(p => (
                      <span
                        key={p.id}
                        className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[9px] text-amber-300"
                      >
                        {p.name}
                      </span>
                    ))}
                  </div>
                  {threat.regulatory && (
                    <div className="mt-1">
                      <span className="text-[9px] text-slate-500 block">Норматив: {threat.regulatory}</span>
                    </div>
                  )}
                </div>
              );
            })}
        </Section>

        <Section
          title="Журнал аудита"
          Icon={Activity}
          hint="Последние события чтения и записи защищённых данных"
          open={sections.audit}
          onToggle={() => {
            toggle('audit');
            if (sections.audit === false) {
              setAuditTrail(readAuditTrail(50));
            }
          }}
        >
          {auditTrail.length === 0 && (
            <div className="rounded bg-slate-950 p-3 text-[10px] text-slate-500 text-center">
              Записей нет. Включите «Журнал аудита» в разделе «Защита данных» и выполните какое-либо действие с сохранениями или настройками.
            </div>
          )}
          {auditTrail.length > 0 && (
            <div className="space-y-1 max-h-[40vh] overflow-y-auto pr-1">
              {auditTrail.map((entry, i) => {
                const time = new Date(entry.ts).toLocaleString('ru-RU', {
                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                });
                return (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded bg-slate-950/50 border border-slate-800/50 p-2 text-xs"
                  >
                    <span className="shrink-0 text-[10px] text-slate-500 font-mono">
                      {time}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-200 truncate">
                        {entry.event}
                      </div>
                      {entry.detail && (
                        <div className="text-[10px] text-slate-400 truncate">
                          {entry.detail}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section
          title={t('theme.light')}
          Icon={settings.theme === 'dark' ? Moon : Sun}
          hint="Тёмный или светлый интерфейс приложения"
          open={false}
          onToggle={() => {}}
        >
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 transition hover:border-slate-600">
            <span>
              <span className="block text-sm font-semibold text-slate-100">
                {t('theme.light')}
              </span>
            </span>
            <button
              onClick={() => onChange({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
              className={`relative inline-flex w-10 h-5 shrink-0 rounded-full border border-slate-700 bg-slate-800 p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50`}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-white shadow ring-0 transition-transform ${settings.theme === 'light' ? 'translate-x-5' : 'translate-x-1'}`}
              />
            </button>
          </div>
        </Section>

        <Section
          title={t('backup.title')}
          Icon={Download}
          hint={t('backup.hint')}
          open={false}
          onToggle={() => {}}
        >
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
              <div className="mb-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">{t('backup.password.label')}</label>
                <input
                  type="password"
                  value={exportPassphrase}
                  onChange={e => setExportPassphrase(e.target.value)}
                  placeholder={t('backup.password.placeholder')}
                  className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-slate-200 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    setBackupStatus('exporting');
                    setBackupError(null);
                    try {
                      await exportBackup(exportPassphrase || undefined);
                      setBackupStatus('done');
                      setBackupError(null);
                      setTimeout(() => setBackupStatus('idle'), 2000);
                    } catch {
                      setBackupStatus('error');
                      setBackupError(t('backup.error'));
                      setTimeout(() => setBackupStatus('idle'), 2000);
                    }
                  }}
                  disabled={backupStatus === 'exporting'}
                  className="flex-1 rounded bg-amber-900/20 border border-amber-500/30 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {backupStatus === 'exporting' ? t('backup.exporting') : t('backup.export')}
                </button>
                {backupStatus === 'done' && (
                  <span className="text-[10px] text-emerald-400">Сохранено как файл</span>
                )}
                {backupStatus === 'error' && backupError && (
                  <span className="text-[10px] text-red-400">{backupError}</span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
              <div className="mb-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">{t('backup.import.file.label')}</label>
                <input
                  type="file"
                  accept=".json,.enc"
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null;
                    setImportFile(f);
                    if (f) setBackupStatus('idle');
                  }}
                  className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-slate-200 focus:border-amber-400 focus:outline-none cursor-pointer"
                />
              </div>
              <div className="mb-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">{t('backup.import.password.label')}</label>
                <input
                  type="password"
                  value={importPassphrase}
                  onChange={e => setImportPassphrase(e.target.value)}
                  placeholder={t('backup.import.password.placeholder')}
                  className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-slate-200 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (!importFile) return;
                    setBackupStatus('importing');
                    setBackupError(null);
                    try {
                      const bundle = await importBackupFile(importFile, importPassphrase || undefined);
                      if (!bundle) {
                        setBackupStatus('error');
                        setBackupError('Не удалось расшифровать или распарсить бэкап.');
                        setTimeout(() => setBackupStatus('idle'), 2000);
                        return;
                      }
                      restoreBackupBundle(bundle);
                      setBackupStatus('done');
                      setImportFile(null);
                      setTimeout(() => setBackupStatus('idle'), 2000);
                    } catch {
                      setBackupStatus('error');
                      setBackupError(t('backup.error'));
                      setTimeout(() => setBackupStatus('idle'), 2000);
                    }
                  }}
                  disabled={backupStatus === 'importing' || !importFile}
                  className="flex-1 rounded bg-slate-800 border border-slate-600 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {backupStatus === 'importing' ? t('backup.importing') : t('backup.import')}
                </button>
                {backupStatus === 'done' && (
                  <span className="text-[10px] text-emerald-400">Восстановлено из файла</span>
                )}
                {backupStatus === 'error' && backupError && (
                  <span className="text-[10px] text-red-400">{backupError}</span>
                )}
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
