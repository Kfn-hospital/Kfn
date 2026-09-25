'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';

export default function SignupPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const [form, setForm] = useState({ name: '', email: '', phone: '', department: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setAlert(null);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();

      if (json.ok) {
        setAlert({ type: 'success', message: t('signupSuccess') });
        setTimeout(() => router.push('/login'), 2000);
      } else {
        setAlert({ type: 'error', message: json.error ?? t('errorOccurred') });
      }
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-extrabold text-[var(--c-teal-900)] text-center">{t('signupTitle')}</h1>
        <p className="text-slate-500 text-center text-sm">{t('signupSubtitle')}</p>

        {alert && <Alert type={alert.type} message={alert.message} />}

        <Card>
          <form onSubmit={submit} className="space-y-3">
            <FormField
              label={t('name')}
              type="text"
              value={form.name}
              onChange={(v: string) => setForm((f) => ({ ...f, name: v }))}
              required
            />
            <FormField
              label={t('userEmail')}
              type="text"
              value={form.email}
              onChange={(v: string) => setForm((f) => ({ ...f, email: v }))}
              required
            />
            <FormField
              label={t('signupPhone')}
              type="text"
              value={form.phone}
              onChange={(v: string) => setForm((f) => ({ ...f, phone: v }))}
              required
            />
            <FormField
              label={t('userDepartment')}
              type="text"
              value={form.department}
              onChange={(v: string) => setForm((f) => ({ ...f, department: v }))}
              required
            />
            <FormField
              label={t('userPassword')}
              type="password"
              value={form.password}
              onChange={(v: string) => setForm((f) => ({ ...f, password: v }))}
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[var(--c-teal-700)] text-white rounded-xl py-3 font-bold disabled:opacity-50"
            >
              {saving ? t('loading') : t('signupSubmit')}
            </button>
          </form>
        </Card>

        <p className="text-center text-sm text-slate-500">
          {t('signupHasAccount')}{' '}
          <Link href="/login" className="text-[var(--c-teal-700)] font-bold">
            {t('signupLoginLink')}
          </Link>
        </p>
      </div>
    </main>
  );
}
