'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import type { UserRole } from '@/types/database';

export default function EditUserPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string;
  const supabase = createClient();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    role: 'employee' as UserRole,
    password: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (data) {
        setForm({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          department: data.department || '',
          role: data.role,
          password: '',
        });
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const submit = async () => {
    setSaving(true);
    setAlert(null);
    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...form }),
      });
      const json = await res.json();
      if (json.ok) {
        setAlert({ type: 'success', message: t('userUpdated') });
        setTimeout(() => router.push('/admin/users'), 1000);
      } else {
        setAlert({ type: 'error', message: json.error ?? t('errorOccurred') });
      }
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-[var(--c-text-muted)]">{t('loading')}</p>;

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/admin/users" className="text-[var(--c-teal-600)] text-sm font-bold hover:underline">
          ← {t('usersTitle')}
        </Link>
      </div>
      <h1 className="text-2xl font-extrabold text-[var(--c-teal-900)]">✏️ {t('editUserTitle')}</h1>

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
            label={t('signupPhone')}
            type="text"
            value={form.phone}
            onChange={(v: string) => setForm((f) => ({ ...f, phone: v }))}
          />
        </div>
        <div className="mt-3">
          <FormField
            label={t('userDepartment')}
            type="text"
            value={form.department}
            onChange={(v: string) => setForm((f) => ({ ...f, department: v }))}
          />
        </div>
        <div className="mt-3">
          <FormField
            label={t('newPasswordOptional')}
            type="password"
            value={form.password}
            onChange={(v: string) => setForm((f) => ({ ...f, password: v }))}
          />
        </div>
        <div className="mt-3">
          <label className="block text-sm font-bold text-[var(--c-text)] mb-1">{t('newUserRole')}</label>
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
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
        className="bg-[var(--c-teal-700)] text-white font-bold rounded-xl px-6 py-3 disabled:opacity-50"
      >
        {saving ? t('loading') : t('save')}
      </button>
    </div>
  );
}
