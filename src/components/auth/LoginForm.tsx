import { useState } from 'react';

interface LoginFormProps {
  onAuth: (user: { login: string; password: string }) => void;
  onSwitchToRegister: () => void;
}

export function LoginForm({ onAuth, onSwitchToRegister }: LoginFormProps) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!login || !password) {
      setError('Заполните все поля');
      return;
    }
    setSubmitting(true);
    onAuth({ login, password });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl w-full max-w-md">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Вход в аккаунт</h2>
        <p className="text-slate-400 text-sm">Добро пожаловать в Эмпориум</p>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg p-3 mb-6 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
            Логин
          </label>
          <input
            type="text"
            value={login}
            onChange={e => setLogin(e.target.value)}
            placeholder="Введите логин"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 transition"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
            Пароль
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Введите пароль"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 transition"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-slate-950 font-bold py-3 rounded-lg transition disabled:cursor-not-allowed"
        >
          {submitting ? 'Вход...' : 'Войти'}
        </button>
      </form>

      <div className="mt-6 text-center text-slate-400 text-sm">
        Нет аккаунта?{' '}
        <button
          onClick={onSwitchToRegister}
          className="text-amber-400 hover:underline font-medium"
        >
          Зарегистрироваться
        </button>
      </div>
    </div>
  );
}
