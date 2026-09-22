'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import DataTable from '@/components/ui/DataTable';
import type { CoordinationRequest, RequestCategory, Profile } from '@/types/database';

export default function RequestsPage() {
  const supabase = createClient();
  const { t } = useLanguage();

  const [requests, setRequests] = useState<CoordinationRequest[]>([]);
  const [categories, setCategories] = useState<RequestCategory[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    category_id: '',
    assigned_to: '',
  });

  async function loadData() {
    const { data } = await supabase
      .from('requests')
      .select('*, request_categories(*), assignee:profiles!requests_assigned_to_fkey(*)')
      .order('created_at', { ascending: false });
    setRequests((data as CoordinationRequest[]) || []);

    const { data: cats } = await supabase.from('request_categories').select('*');
    setCategories((cats as RequestCategory[]) || []);

    const { data: profs } = await supabase.from('profiles').select('*').eq('status', 'active');
    setUsers((profs as Profile[]) || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from('requests').insert({
      title: form.title,
      description: form.description || null,
      category_id: form.category_id || null,
      assigned_to: form.assigned_to || null,
      created_by: user?.id,
      status: 'pending',
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setModalOpen(false);
    setForm({ title: '', description: '', category_id: '', assigned_to: '' });
    loadData();
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('requests').update({ status }).eq('id', id);
    loadData();
  }

  const statusLabel: Record<string, string> = {
    pending: t('requestPending'),
    in_progress: t('requestInProgress'),
    completed: t('requestCompleted'),
    rejected: t('requestRejected'),
  };
  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-teal-900">{t('requestsTitle')}</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-teal-700 text-white rounded-xl px-5 py-2.5 font-bold"
        >
          {t('newRequest')}
        </button>
      </div>

      <Card>
        <DataTable
          emptyMessage={t('noData')}
          rows={requests}
          columns={[
            { header: t('requestTitle'), render: (r) => r.title },
            { header: t('requestCategory'), render: (r) => r.request_categories?.name || '-' },
            { header: t('requestAssignedTo'), render: (r) => r.assignee?.name || '-' },
            {
              header: t('status'),
              render: (r) => (
                <select
                  value={r.status}
                  onChange={(e) => updateStatus(r.id, e.target.value)}
                  className={`px-2 py-1 rounded-full text-xs font-bold border-0 ${statusColor[r.status]}`}
                >
                  {Object.entries(statusLabel).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('newRequest')}>
        <form onSubmit={handleAdd} className="space-y-3">
          <FormField
            label={t('requestTitle')}
            value={form.title}
            onChange={(v) => setForm({ ...form, title: v })}
            required
          />
          <FormField
            label={t('requestDescription')}
            type="textarea"
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
          />
          <div>
            <label className="text-sm font-bold text-slate-600 mb-1 block">
              {t('requestCategory')}
            </label>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full border rounded-xl px-3 py-2.5"
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-bold text-slate-600 mb-1 block">
              {t('requestAssignedTo')}
            </label>
            <select
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              className="w-full border rounded-xl px-3 py-2.5"
            >
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <Alert type="error" message={error} />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-700 text-white rounded-xl py-3 font-bold disabled:opacity-50"
          >
            {loading ? t('saving') : t('save')}
          </button>
        </form>
      </Modal>
    </main>
  );
}
