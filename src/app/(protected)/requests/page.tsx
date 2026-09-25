'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import DataTable from '@/components/ui/DataTable';
import type { CoordinationRequest, RequestCategory, Profile } from '@/types/database';

const ASSIGNABLE_ROLES = ['admin', 'coordinator', 'coordination_admin'];
const STATUS_KEYS = ['pending', 'in_progress', 'completed', 'rejected'] as const;

interface AssigneeRow {
  request_id: string;
  user_id: string;
  status: string;
  note: string | null;
  profiles: Profile | null;
}

type AssigneeItem = { user_id: string; status: string; note: string; profile: Profile };

function AssignedToCombobox({
  value,
  onChange,
  users,
  placeholder,
  noneLabel,
}: {
  value: string;
  onChange: (id: string) => void;
  users: Profile[];
  placeholder: string;
  noneLabel: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = users.find((u) => u.id === value) || null;
  const q = query.trim().toLowerCase();
  const results = q ? users.filter((u) => (u.name || '').toLowerCase().includes(q)) : users;

  return (
    <div className="relative">
      <input
        type="text"
        value={open ? query : selected?.name || ''}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          setQuery('');
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full border rounded-xl px-3 py-2.5"
      />
      {open && (
        <div className="absolute z-20 w-full border rounded-xl mt-1 bg-[var(--c-surface)] shadow-lg max-h-48 overflow-auto">
          <button
            type="button"
            onMouseDown={() => {
              onChange('');
              setQuery('');
              setOpen(false);
            }}
            className="block w-full text-right px-3 py-2 text-sm hover:bg-[var(--c-teal-50)] text-[var(--c-text-muted)]"
          >
            {noneLabel}
          </button>
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={() => {
                onChange(u.id);
                setQuery('');
                setOpen(false);
              }}
              className="block w-full text-right px-3 py-2 text-sm hover:bg-[var(--c-teal-50)]"
            >
              {u.name}
            </button>
          ))}
          {!results.length && <div className="px-3 py-2 text-xs text-[var(--c-text-muted)]">-</div>}
        </div>
      )}
    </div>
  );
}

export default function RequestsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { t, lang } = useLanguage();

  const [requests, setRequests] = useState<CoordinationRequest[]>([]);
  const [categories, setCategories] = useState<RequestCategory[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [assigneesByRequest, setAssigneesByRequest] = useState<Record<string, AssigneeItem[]>>({});
  const [creatorsById, setCreatorsById] = useState<Record<string, Profile>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

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
    const requestRows = (data as CoordinationRequest[]) || [];
    setRequests(requestRows);

    const creatorIds = Array.from(new Set(requestRows.map((r) => r.created_by).filter(Boolean)));
    if (creatorIds.length) {
      const { data: creatorRows } = await supabase.from('profiles').select('*').in('id', creatorIds);
      const map: Record<string, Profile> = {};
      ((creatorRows as Profile[]) || []).forEach((p) => {
        map[p.id] = p;
      });
      setCreatorsById(map);
    } else {
      setCreatorsById({});
    }

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
      .select('request_id, user_id, status, note, profiles(*)');
    const grouped: Record<string, AssigneeItem[]> = {};
    ((assigneeRows as unknown as AssigneeRow[]) ?? []).forEach((row) => {
      if (!row.profiles) return;
      if (!grouped[row.request_id]) grouped[row.request_id] = [];
      grouped[row.request_id].push({
        user_id: row.user_id,
        status: row.status,
        note: row.note || '',
        profile: row.profiles,
      });
    });
    setAssigneesByRequest(grouped);
  }

  useEffect(() => {
    loadData();
  }, []);

  const preStatusFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
    return requests.filter((r) => {
      if (q && !r.title.toLowerCase().includes(q)) return false;
      if (categoryFilter && r.category_id !== categoryFilter) return false;
      const created = new Date(r.created_at);
      if (from && created < from) return false;
      if (to && created > to) return false;
      return true;
    });
  }, [requests, search, categoryFilter, dateFrom, dateTo]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, in_progress: 0, completed: 0, rejected: 0 };
    preStatusFiltered.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
  }, [preStatusFiltered]);

  const filteredRequests = useMemo(() => {
    if (!statusFilter) return preStatusFiltered;
    return preStatusFiltered.filter((r) => r.status === statusFilter);
  }, [preStatusFiltered, statusFilter]);

  const hasActiveFilters = !!(search || dateFrom || dateTo || statusFilter || categoryFilter);

  function clearFilters() {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('');
    setCategoryFilter('');
  }

  function assigneeSummary(id: string): string {
    const list = assigneesByRequest[id] || [];
    if (!list.length) return '-';
    const names = list.map((a) => a.profile.name);
    if (names.length <= 2) return names.join('، ');
    return `${names.slice(0, 2).join('، ')} +${names.length - 2}`;
  }

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

    if (inserted?.id) {
      fetch('/api/requests/notify-created', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: inserted.id }),
      }).catch(() => {});
    }

    setModalOpen(false);
    setForm({ title: '', description: '', category_id: '', assigned_to: '' });
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
  const statusChipColor: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-[var(--c-teal-900)]">{t('requestsTitle')}</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-[var(--c-teal-700)] text-white rounded-xl px-5 py-2.5 font-bold"
        >
          {t('newRequest')}
        </button>
      </div>

      <Card className="mb-4">
        <h2 className="text-sm font-extrabold text-[var(--c-teal-800)] mb-3">🔍 {t('filtersTitle')}</h2>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
              statusFilter === ''
                ? 'bg-[var(--c-teal-700)] text-white border-[var(--c-teal-700)]'
                : 'bg-[var(--c-surface)] text-[var(--c-text)] border-[var(--c-teal-100)]'
            }`}
          >
            {t('filterAllStatuses')} ({preStatusFiltered.length})
          </button>
          {STATUS_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                statusFilter === key ? statusColor[key] + ' border-transparent' : statusChipColor[key]
              }`}
            >
              {statusLabel[key]} ({statusCounts[key] || 0})
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="lg:col-span-2">
            <label className="text-sm font-bold text-[var(--c-text)] mb-1 block">{t('requestTitle')}</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('filterSearchPlaceholder')}
              className="w-full border rounded-xl px-3 py-2.5"
            />
          </div>
          <FormField label={t('filterDateFrom')} type="date" value={dateFrom} onChange={setDateFrom} />
          <FormField label={t('filterDateTo')} type="date" value={dateTo} onChange={setDateTo} />
          <div>
            <label className="text-sm font-bold text-[var(--c-text)] mb-1 block">{t('requestCategory')}</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5"
            >
              <option value="">{t('filterAllCategories')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex justify-end mt-3">
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-bold text-[var(--c-teal-700)] hover:underline"
            >
              ✕ {t('clearFilters')}
            </button>
          </div>
        )}
      </Card>

      <Card>
        <DataTable
          emptyMessage={hasActiveFilters ? t('noFilteredResults') : t('noData')}
          rows={filteredRequests}
          onRowClick={(r) => router.push(`/requests/${r.id}`)}
          columns={[
            { header: t('requestTitle'), render: (r) => <span className="font-bold">{r.title}</span> },
            {
              header: t('requestDate'),
              render: (r) => new Date(r.created_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US'),
            },
            {
              header: t('requestCreatedBy'),
              render: (r) => creatorsById[r.created_by]?.name || creatorsById[r.created_by]?.email || '-',
            },
            { header: t('requestCategory'), render: (r) => r.request_categories?.name || '-' },
            {
              header: t('requestAssignedTo'),
              render: (r) => <span className="text-sm">{assigneeSummary(r.id)}</span>,
            },
            {
              header: t('status'),
              render: (r) => (
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColor[r.status]}`}>
                  {statusLabel[r.status]}
                </span>
              ),
            },
            {
              header: '',
              render: () => <span className="text-[var(--c-teal-400)]">{lang === 'ar' ? '‹' : '›'}</span>,
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
            <label className="text-sm font-bold text-[var(--c-text)] mb-1 block">
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
            <label className="text-sm font-bold text-[var(--c-text)] mb-1 block">
              {t('requestAssignedTo')}
            </label>
            <AssignedToCombobox
              value={form.assigned_to}
              onChange={(id) => setForm({ ...form, assigned_to: id })}
              users={users}
              placeholder={t('searchToAssign')}
              noneLabel={t('unassignedOption')}
            />
          </div>
          <Alert type="error" message={error} />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--c-teal-700)] text-white rounded-xl py-3 font-bold disabled:opacity-50"
          >
            {loading ? t('saving') : t('save')}
          </button>
        </form>
      </Modal>
    </main>
  );
}
