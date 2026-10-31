import { useState } from 'react';

interface RegisterFormProps {
  onAuth: (user: { login: string; password: string }) => void;
  onSwitchToLogin: () => void;
}

export function RegisterForm({ onAuth, onSwitchToLogin }: RegisterFormProps) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!login || !password) {
      setError('Заполните все поля');
      return;
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    setSubmitting(true);
    onAuth({ login, password });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl w-full max-w-md">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Регистрация</h2>
        <p className="text-slate-400 text-sm">Создайте аккаунт Эмпориума</p>
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
            placeholder="Придумайте логин"
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
            placeholder="Придумайте пароль"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 transition"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
            Повторите пароль
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Подтвердите пароль"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 transition"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-slate-950 font-bold py-3 rounded-lg transition disabled:cursor-not-allowed"
        >
          {submitting ? 'Создание...' : 'Зарегистрироваться'}
        </button>
      </form>

      <div className="mt-6 text-center text-slate-400 text-sm">
        Уже есть аккаунт?{' '}
        <button
          onClick={onSwitchToLogin}
          className="text-amber-400 hover:underline font-medium"
        >
          Войти
        </button>
      </div>
    </div>
  );
}
