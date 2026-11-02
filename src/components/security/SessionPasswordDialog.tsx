import { useState } from 'react';
import { Lock } from 'lucide-react';
import { initSessionKey } from '../../dataProtection';

interface SessionPasswordDialogProps {
  open: boolean;
  onUnlock: () => void;
  onCancel: () => void;
}

export function SessionPasswordDialog({ open, onUnlock, onCancel }: SessionPasswordDialogProps) {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  if (!open) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) {
      setError('Введите пароль сессии.');
      return;
    }
    setUnlocking(true);
    setError(null);
    try {
      await initSessionKey(passphrase.trim());
      setUnlocking(false);
      onUnlock();
    } catch {
      setUnlocking(false);
      setError('Не удалось создать ключ сессии. Попробуйте ещё раз.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Пароль сессии"
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="max-w-md w-full rounded-2xl border border-amber-500/40 bg-slate-900 p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-5 w-5 text-amber-400 shrink-0" />
          <h2 className="text-lg font-bold text-white">Пароль сессии</h2>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Шифрование сохранений включено. Введите пароль для создания ключа
          сессии (хранится только в памяти до закрытия вкладки).
        </p>
        {error && (
          <div className="mb-3 rounded border border-red-500/30 bg-red-500/5 p-2 text-[11px] text-red-300">
            {error}
          </div>
        )}
        <form onSubmit={handleUnlock} className="space-y-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-400">
              Пароль сессии
            </label>
            <input
              type="password"
              value={passphrase}
              onChange={e => setPassphrase(e.target.value)}
              disabled={unlocking}
              className="w-full bg-black/60 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-400 outline-none transition"
              placeholder="••••••••"
              autoComplete="off"
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={unlocking}
              className="text-xs text-slate-400 hover:text-slate-200 transition disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={unlocking || !passphrase.trim()}
              className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white font-semibold py-2 px-4 rounded-lg transition disabled:cursor-not-allowed"
            >
              {unlocking ? 'Создаём ключ…' : 'Разблокировать'}
            </button>
          </div>
        </form>
        <p className="mt-3 text-[10px] text-slate-500">
          Ключ не сохраняется на диск. При закрытии введите пароль снова.
        </p>
      </div>
    </div>
  );
}
