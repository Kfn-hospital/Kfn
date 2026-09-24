'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';

export default function NewUserPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee' });
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const submit = async () => {
    if (!form.name || !form.email || !form.password) {
      setAlert({ type: 'error', message: t('errorOccurred') });
      return;
    }

    setSaving(true);
    setAlert(null);
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();

      if (json.ok) {
        setAlert({ type: 'success', message: t('userCreated') });
        setTimeout(() => router.push('/admin/users'), 1200);
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
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-extrabold text-teal-900">➕ {t('addUser')}</h1>

      {alert && <Alert type={alert.type} message={alert.message} />}

      <Card>
        <FormField
          label={t('name')}
          type="text"
          value={form.name}
          onChange={(v: string) => setForm((f) => ({ ...f, name: v }))}
        />
        <div className="mt-3">
          <FormField
            label={t('userEmail')}
            type="text"
            value={form.email}
            onChange={(v: string) => setForm((f) => ({ ...f, email: v }))}
          />
        </div>
        <div className="mt-3">
          <FormField
            label={t('userPassword')}
            type="password"
            value={form.password}
            onChange={(v: string) => setForm((f) => ({ ...f, password: v }))}
          />
        </div>
        <div className="mt-3">
          <label className="block text-sm font-bold text-slate-600 mb-1">{t('newUserRole')}</label>
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className="w-full border rounded-xl p-3 text-sm"
          >
            <option value="employee">{t('roleEmployee')}</option>
            <option value="room_manager">{t('roleRoomManager')}</option>
            <option value="coordinator">{t('roleCoordinator')}</option>
            <option value="coordination_admin">{t('roleCoordinationAdmin')}</option>
            <option value="admin">{t('roleAdmin')}</option>
          </select>
        </div>
      </Card>

      <button
        onClick={submit}
        disabled={saving}
        className="bg-teal-700 text-white font-bold rounded-xl px-6 py-3 disabled:opacity-50"
      >
        {saving ? t('loading') : t('save')}
      </button>
    </div>
  );
}
