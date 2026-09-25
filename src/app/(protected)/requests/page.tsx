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

const CAN_MANAGE_ROLES = ['admin', 'coordinator', 'coordination_admin'];
const ASSIGNABLE_ROLES = ['coordinator', 'coordination_admin'];

interface AssigneeRow {
  request_id: string;
  profiles: Profile | null;
}

function AssigneesEditor({
  requestId,
  assigned,
  allUsers,
  onAdd,
  onRemove,
}: {
  requestId: string;
  assigned: Profile[];
  allUsers: Profile[];
  onAdd: (requestId: string, userId: string) => void;
  onRemove: (requestId: string, userId: string) => void;
}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const assignedIds = new Set(assigned.map((u) => u.id));
  const results = query.trim()
    ? allUsers.filter(
        (u) => !assignedIds.has(u.id) && (u.name || '').toLowerCase().includes(query.trim().toLowerCase())
      )
    : [];

  return (
    <div className="min-w-[200px]">
      <div className="flex flex-wrap gap-1 mb-1">
        {assigned.map((u) => (
          <span
            key={u.id}
            className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 text-xs font-bold px-2 py-1 rounded-full"
          >
            {u.name}
            <button
              type="button"
              onClick={() => onRemove(requestId, u.id)}
              className="text-teal-400 hover:text-red-500"
            >
              ×
            </button>
          </span>
        ))}
        {!assigned.length && <span className="text-xs text-slate-400">-</span>}
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('searchToAssign')}
        className="w-full border rounded-lg px-2 py-1 text-xs"
      />
      {results.length > 0 && (
        <div className="border rounded-lg mt-1 bg-white shadow-sm max-h-32 overflow-auto z-10 relative">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onAdd(requestId, u.id);
                setQuery('');
              }}
              className="block w-full text-right px-2 py-1 text-xs hover:bg-teal-50"
            >
              {u.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RequestsPage() {
  const supabase = createClient();
  const { t } = useLanguage();

  const [requests, setRequests] = useState<CoordinationRequest[]>([]);
  const [categories, setCategories] = useState<RequestCategory[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [assigneesByRequest, setAssigneesByRequest] = useState<Record<string, Profile[]>>({});
  const [myRole, setMyRole] = useState<string | null>(null);
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

    const { data: profs } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'active')
      .in('role', ASSIGNABLE_ROLES);
    setUsers((profs as Profile[]) || []);

    const { data: assigneeRows } = await supabase
      .from('request_assignees')
      .select('request_id, profiles(*)');
    const grouped: Record<string, Profile[]> = {};
    ((assigneeRows as unknown as AssigneeRow[]) ?? []).forEach((row) => {
      if (!row.profiles) return;
      if (!grouped[row.request_id]) grouped[row.request_id] = [];
      grouped[row.request_id].push(row.profiles);
    });
    setAssigneesByRequest(grouped);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setMyRole(profile?.role ?? null);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const canManageRequests = !!myRole && CAN_MANAGE_ROLES.includes(myRole);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: inserted, error } = await supabase
      .from('requests')
      .insert({
        title: form.title,
        description: form.description || null,
        category_id: form.category_id || null,
        assigned_to: form.assigned_to || null,
        created_by: user?.id,
        status: 'pending',
      })
      .select()
      .single();

    if (!error && inserted && form.assigned_to) {
      await supabase.from('request_assignees').insert({ request_id: inserted.id, user_id: form.assigned_to });
    }

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setModalOpen(false);
    setForm({ title: '', description: '', category_id: '', assigned_to: '' });
    loadData();
  }

  async function addAssignee(requestId: string, userId: string) {
    await supabase.from('request_assignees').insert({ request_id: requestId, user_id: userId });
    loadData();
  }

  async function removeAssignee(requestId: string, userId: string) {
    await supabase.from('request_assignees').delete().eq('request_id', requestId).eq('user_id', userId);
    loadData();
  }

  async function updateStatus(id: string, status: string) {
    if (!canManageRequests) return;
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
            {
              header: t('requestAssignedTo'),
              render: (r) =>
                canManageRequests ? (
                  <AssigneesEditor
                    requestId={r.id}
                    assigned={assigneesByRequest[r.id] || []}
                    allUsers={users}
                    onAdd={addAssignee}
                    onRemove={removeAssignee}
                  />
                ) : (
                  <span className="text-xs text-slate-600">
                    {(assigneesByRequest[r.id] || []).map((u) => u.name).join('، ') || '-'}
                  </span>
                ),
            },
            {
              header: t('status'),
              render: (r) =>
                canManageRequests ? (
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
                ) : (
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColor[r.status]}`}>
                    {statusLabel[r.status]}
                  </span>
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
