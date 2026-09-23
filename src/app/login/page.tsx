'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';

type LoginMode = 'email' | 'phone';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t, toggleLang } = useLanguage();

  const [mode, setMode] = useState<LoginMode>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    let loginEmail = email;

    if (mode === 'phone') {
      try {
        const res = await fetch('/api/auth/resolve-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        });
        const json = await res.json();
        if (!json.ok) {
          setError(json.error || t('loginError'));
          setLoading(false);
          return;
        }
        loginEmail = json.email;
      } catch {
        setError(t('loginError'));
        setLoading(false);
        return;
      }
    }

    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });

    setLoading(false);
    if (error) {
      setError(t('loginError'));
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  function switchMode(next: LoginMode) {
    setMode(next);
    setError('');
    setEmail('');
    setPhone('');
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative">
      <button
        onClick={toggleLang}
        className="absolute top-4 left-4 text-sm font-bold text-teal-700 border border-teal-700 rounded-xl px-3 py-1.5"
      >
        🌐 {t('langToggle')}
      </button>

      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-extrabold text-teal-900 mb-1 text-center">
          {t('loginTitle')}
        </h1>
        <p className="text-sm text-slate-500 mb-4 text-center">
          {t('loginSubtitle')}
        </p>

        <div className="flex justify-center gap-2 mb-5">
          <button
            type="button"
            onClick={() => switchMode('email')}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
              mode === 'email' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t('loginWithEmail')}
          </button>
          <button
            type="button"
            onClick={() => switchMode('phone')}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
              mode === 'phone' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t('loginWithPhone')}
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          {mode === 'email' ? (
            <input
              type="email"
              required
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5"
              dir="ltr"
            />
          ) : (
            <input
              type="tel"
              required
              placeholder={t('phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5"
              dir="ltr"
            />
          )}
          <input
            type="password"
            required
            placeholder={t('passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-xl px-3 py-2.5"
          />

          {error && (
            <p className="text-sm font-bold text-red-600 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-700 text-white rounded-xl py-3 font-bold disabled:opacity-50"
          >
            {loading ? t('loggingIn') : t('loginBtn')}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-5">
          {t('noAccountPrompt')}{' '}
          <Link href="/signup" className="text-teal-700 font-bold">
            {t('signupSubmit')}
          </Link>
        </p>
      </div>
    </main>
  );
}
