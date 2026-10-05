'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import FormField from '@/components/ui/FormField';

export default function ChangePasswordPage() {
  const { t } = useLanguage();
  const supabase = createClient();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAlert(null);

    if (next.length < 6) {
      setAlert({ type: 'error', message: t('passwordTooShort') });
      return;
    }
    if (next !== confirm) {
      setAlert({ type: 'error', message: t('passwordMismatch') });
      return;
    }
    if (next === current) {
      setAlert({ type: 'error', message: t('passwordSameAsOld') });
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      setSaving(false);
      setAlert({ type: 'error', message: t('loginError') });
      return;
    }

    // نتأكد من كلمة المرور الحالية أولًا
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (verifyError) {
      setSaving(false);
      setAlert({ type: 'error', message: t('currentPasswordWrong') });
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    setSaving(false);
    if (updateError) {
      setAlert({ type: 'error', message: updateError.message });
      return;
    }

    setCurrent('');
    setNext('');
    setConfirm('');
    setAlert({ type: 'success', message: t('passwordChangedOk') });
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--c-teal-900)]">🔑 {t('navChangePassword')}</h1>
        <p className="text-[var(--c-text-muted)]">{t('changePasswordSubtitle')}</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label={t('currentPasswordLabel')}
            type="password"
            name="current-password"
            autoComplete="current-password"
            value={current}
            onChange={setCurrent}
            required
          />
          <FormField
            label={t('newPasswordLabel')}
            type="password"
            name="new-password"
            autoComplete="new-password"
            value={next}
            onChange={setNext}
            required
          />
          <FormField
            label={t('confirmNewPasswordLabel')}
            type="password"
            name="confirm-new-password"
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
            required
          />
          {alert && <Alert type={alert.type} message={alert.message} />}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[var(--c-teal-700)] text-white rounded-xl py-3 font-bold disabled:opacity-50"
          >
            {saving ? t('saving') : t('changePasswordBtn')}
          </button>
        </form>
      </Card>
    </div>
  );
}
