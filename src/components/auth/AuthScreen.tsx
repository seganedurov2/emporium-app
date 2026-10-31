import { useState, useEffect } from 'react';

import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

const STORAGE_KEY = 'emporium_auth_user';

interface StoredUser {
  login: string;
  password: string;
  createdAt: string;
}

export function AuthScreen({
  onAuthenticated
}: {
  onAuthenticated: (user: { login: string }) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: StoredUser = JSON.parse(stored);
        onAuthenticated({ login: parsed.login });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [onAuthenticated]);

  const handleLogin = (credentials: { login: string; password: string }) => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setMode('register');
      return;
    }
    try {
      const parsed: StoredUser = JSON.parse(stored);
      if (parsed.login === credentials.login && parsed.password === credentials.password) {
        onAuthenticated({ login: parsed.login });
      }
    } catch {
      // ignore
    }
  };

  const handleRegister = (credentials: { login: string; password: string }) => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: StoredUser = JSON.parse(stored);
        if (parsed.login === credentials.login) {
          return;
        }
      } catch {
        // ignore
      }
    }
    const newUser: StoredUser = {
      login: credentials.login,
      password: credentials.password,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    onAuthenticated({ login: credentials.login });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {mode === 'login' ? (
          <LoginForm
            onAuth={handleLogin}
            onSwitchToRegister={() => setMode('register')}
          />
        ) : (
          <RegisterForm
            onAuth={handleRegister}
            onSwitchToLogin={() => setMode('login')}
          />
        )}
      </div>
    </div>
  );
}
