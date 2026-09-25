'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t, toggleLang } = useLanguage();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const trimmed = identifier.trim();
    let loginEmail = trimmed;

    if (!trimmed.includes('@')) {
      try {
        const res = await fetch('/api/auth/resolve-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: trimmed }),
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

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative">
      <button
        onClick={toggleLang}
        className="absolute top-4 left-4 text-sm font-bold text-[var(--c-teal-700)] border border-[var(--c-teal-700)] rounded-xl px-3 py-1.5"
      >
        🌐 {t('langToggle')}
      </button>

      <div className="bg-[var(--c-surface)] rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-extrabold text-[var(--c-teal-900)] mb-1 text-center">
          {t('loginTitle')}
        </h1>
        <p className="text-sm text-[var(--c-text-muted)] mb-4 text-center">
          {t('loginSubtitle')}
        </p>

        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="text"
            required
            placeholder={t('emailOrPhonePlaceholder')}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full border rounded-xl px-3 py-2.5"
            dir="ltr"
          />
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
            className="w-full bg-[var(--c-teal-700)] text-white rounded-xl py-3 font-bold disabled:opacity-50"
          >
            {loading ? t('loggingIn') : t('loginBtn')}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--c-text-muted)] mt-5">
          {t('noAccountPrompt')}{' '}
          <Link href="/signup" className="text-[var(--c-teal-700)] font-bold">
            {t('signupSubmit')}
          </Link>
        </p>
      </div>
    </main>
  );
}
