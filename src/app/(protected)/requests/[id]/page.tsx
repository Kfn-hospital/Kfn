'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import type { CoordinationRequest, Profile } from '@/types/database';

const CAN_MANAGE_ROLES = ['admin', 'coordinator', 'coordination_admin'];
const ASSIGNABLE_ROLES = ['admin', 'coordinator', 'coordination_admin'];

interface AssigneeRow {
  request_id: string;
  user_id: string;
  status: string;
  note: string | null;
  profiles: Profile | null;
}

type AssigneeItem = { user_id: string; status: string; note: string; profile: Profile };

function NoteInput({
  requestId,
  userId,
  defaultValue,
  onCommit,
  placeholder,
}: {
  requestId: string;
  userId: string;
  defaultValue: string;
  onCommit: (requestId: string, userId: string, note: string) => void;
  placeholder: string;
}) {
  return (
    <input
      key={`${requestId}-${userId}`}
      type="text"
      defaultValue={defaultValue}
      onBlur={(e) => onCommit(requestId, userId, e.target.value)}
      placeholder={placeholder}
      className="w-full bg-transparent text-xs text-[var(--c-text-muted)] border-0 border-t border-[var(--c-teal-100)] focus:ring-0 px-0 pt-1 placeholder:text-[var(--c-teal-300)]"
    />
  );
}

function AssigneesEditor({
  requestId,
  assigned,
  allUsers,
  onAdd,
  onRemove,
  onStatusChange,
  onNoteChange,
}: {
  requestId: string;
  assigned: AssigneeItem[];
  allUsers: Profile[];
  onAdd: (requestId: string, userId: string) => void;
  onRemove: (requestId: string, userId: string) => void;
  onStatusChange: (requestId: string, userId: string, status: string) => void;
  onNoteChange: (requestId: string, userId: string, note: string) => void;
}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const assignedIds = new Set(assigned.map((a) => a.user_id));
  const q = query.trim().toLowerCase();
  const results = allUsers.filter(
    (u) => !assignedIds.has(u.id) && (!q || (u.name || '').toLowerCase().includes(q))
  );

  const statusLabel: Record<string, string> = {
    pending: t('assigneeStatusPending'),
    in_progress: t('assigneeStatusInProgress'),
    completed: t('assigneeStatusCompleted'),
  };
  const statusColorClass: Record<string, string> = {
    pending: 'text-amber-600',
    in_progress: 'text-blue-600',
    completed: 'text-green-600',
  };

  return (
    <div>
      <div className="flex flex-col gap-2 mb-2">
        {assigned.map((a) => (
          <div
            key={a.user_id}
            className="flex flex-col gap-1 bg-[var(--c-teal-50)] text-[var(--c-teal-700)] text-sm font-bold px-3 py-2 rounded-xl"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{a.profile.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={a.status}
                  onChange={(e) => onStatusChange(requestId, a.user_id, e.target.value)}
                  className={`bg-transparent text-xs font-bold border-0 focus:ring-0 p-0 ${statusColorClass[a.status] || ''}`}
                >
                  <option value="pending">{statusLabel.pending}</option>
                  <option value="in_progress">{statusLabel.in_progress}</option>
                  <option value="completed">{statusLabel.completed}</option>
                </select>
                <button
                  type="button"
                  onClick={() => onRemove(requestId, a.user_id)}
                  className="text-[var(--c-teal-400)] hover:text-red-500 text-base leading-none"
                >
                  ×
                </button>
              </div>
            </div>
            <NoteInput
              requestId={requestId}
              userId={a.user_id}
              defaultValue={a.note}
              onCommit={onNoteChange}
              placeholder={t('assigneeNotePlaceholder')}
            />
          </div>
        ))}
        {!assigned.length && <span className="text-sm text-[var(--c-text-muted)]">-</span>}
      </div>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={t('searchToAssign')}
          className="w-full border rounded-xl px-3 py-2 text-sm"
        />
        {open && (
          <div className="absolute z-20 w-full border rounded-xl mt-1 bg-[var(--c-surface)] shadow-lg max-h-40 overflow-auto">
            {results.map((u) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={() => {
                  onAdd(requestId, u.id);
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
    </div>
  );
}

export default function RequestDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const requestId = params?.id as string;
  const { t, lang } = useLanguage();

  const [request, setRequest] = useState<CoordinationRequest | null>(null);
  const [creator, setCreator] = useState<Profile | null>(null);
  const [assignees, setAssignees] = useState<AssigneeItem[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function loadData() {
    const { data: req } = await supabase
      .from('requests')
      .select('*, request_categories(*)')
      .eq('id', requestId)
      .maybeSingle();

    if (!req) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setRequest(req as CoordinationRequest);

    if (req.created_by) {
      const { data: creatorRow } = await supabase.from('profiles').select('*').eq('id', req.created_by).maybeSingle();
      setCreator((creatorRow as Profile) || null);
    }

    const { data: assigneeRows } = await supabase
      .from('request_assignees')
      .select('request_id, user_id, status, note, profiles(*)')
      .eq('request_id', requestId);
    const list: AssigneeItem[] = ((assigneeRows as unknown as AssigneeRow[]) ?? [])
      .filter((row) => row.profiles)
      .map((row) => ({ user_id: row.user_id, status: row.status, note: row.note || '', profile: row.profiles as Profile }));
    setAssignees(list);

    const { data: profs } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'active')
      .in('role', ASSIGNABLE_ROLES);
    setAllUsers((profs as Profile[]) || []);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setMyRole(profile?.role ?? null);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (requestId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const canManageRequests = !!myRole && CAN_MANAGE_ROLES.includes(myRole);

  async function addAssignee(reqId: string, userId: string) {
    await supabase.from('request_assignees').insert({ request_id: reqId, user_id: userId });
    loadData();
  }

  async function removeAssignee(reqId: string, userId: string) {
    await supabase.from('request_assignees').delete().eq('request_id', reqId).eq('user_id', userId);
    loadData();
  }

  async function updateAssigneeStatus(reqId: string, targetUserId: string, status: string) {
    await supabase.from('request_assignees').update({ status }).eq('request_id', reqId).eq('user_id', targetUserId);
    loadData();
  }

  async function updateAssigneeNote(reqId: string, targetUserId: string, note: string) {
    setAssignees((prev) => prev.map((a) => (a.user_id === targetUserId ? { ...a, note } : a)));
    await supabase.from('request_assignees').update({ note: note || null }).eq('request_id', reqId).eq('user_id', targetUserId);
  }

  async function updateStatus(status: string) {
    if (!canManageRequests || !request) return;
    await supabase.from('requests').update({ status }).eq('id', request.id);
    setRequest({ ...request, status: status as CoordinationRequest['status'] });

    if (status === 'completed') {
      fetch('/api/requests/notify-completed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: request.id }),
      }).catch(() => {});
    }
  }

  async function deleteRequest() {
    if (myRole !== 'admin' || !request) return;
    if (!window.confirm(t('confirmDeleteRequest'))) return;
    setDeleting(true);
    await supabase.from('request_assignees').delete().eq('request_id', request.id);
    const { error: delError } = await supabase.from('requests').delete().eq('id', request.id);
    setDeleting(false);
    if (delError) {
      setError(delError.message);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from('audit_log').insert({
      action: 'request_deleted',
      details: `تم حذف طلب: ${request.title}`,
      performed_by: user?.id ?? null,
    });
    router.push('/requests');
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

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-[var(--c-text-muted)]">{t('loading')}</p>
      </main>
    );
  }

  if (notFound || !request) {
    return (
      <main className="p-6 space-y-4">
        <Link href="/requests" className="text-[var(--c-teal-600)] text-sm font-bold hover:underline">
          ← {t('requestsTitle')}
        </Link>
        <Alert type="error" message={t('noData')} />
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl space-y-4">
      <Link href="/requests" className="text-[var(--c-teal-600)] text-sm font-bold hover:underline">
        ← {t('requestsTitle')}
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-extrabold text-[var(--c-teal-900)]">{request.title}</h1>
        {myRole === 'admin' && (
          <button
            type="button"
            onClick={deleteRequest}
            disabled={deleting}
            className="text-red-500 text-sm font-bold hover:underline disabled:opacity-50 whitespace-nowrap"
          >
            🗑️ {t('delete')}
          </button>
        )}
      </div>

      {error && <Alert type="error" message={error} />}

      <Card className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="block text-[var(--c-text-muted)] font-bold mb-1">{t('requestDate')}</span>
            <span className="font-bold">{new Date(request.created_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}</span>
          </div>
          <div>
            <span className="block text-[var(--c-text-muted)] font-bold mb-1">{t('requestCreatedBy')}</span>
            <span className="font-bold">{creator?.name || creator?.email || '-'}</span>
          </div>
          <div>
            <span className="block text-[var(--c-text-muted)] font-bold mb-1">{t('requestCategory')}</span>
            <span className="font-bold">{request.request_categories?.name || '-'}</span>
          </div>
          <div>
            <span className="block text-[var(--c-text-muted)] font-bold mb-1">{t('status')}</span>
            <div className="flex items-center gap-2 flex-wrap">
              {canManageRequests ? (
                <select
                  value={request.status}
                  onChange={(e) => updateStatus(e.target.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border-0 ${statusColor[request.status]}`}
                >
                  {Object.entries(statusLabel).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${statusColor[request.status]}`}>
                  {statusLabel[request.status]}
                </span>
              )}
              {canManageRequests && request.status !== 'completed' && (
                <button
                  type="button"
                  onClick={() => updateStatus('completed')}
                  className="text-green-600 text-xs font-bold hover:underline whitespace-nowrap"
                >
                  ✓ {t('markFullyCompleted')}
                </button>
              )}
            </div>
          </div>
        </div>

        {request.description && (
          <div>
            <span className="block text-[var(--c-text-muted)] font-bold mb-1 text-sm">{t('requestDescription')}</span>
            <p className="text-sm whitespace-pre-wrap">{request.description}</p>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-extrabold text-[var(--c-teal-800)] mb-3">👥 {t('requestAssignedTo')}</h2>
        {canManageRequests ? (
          <AssigneesEditor
            requestId={request.id}
            assigned={assignees}
            allUsers={allUsers}
            onAdd={addAssignee}
            onRemove={removeAssignee}
            onStatusChange={updateAssigneeStatus}
            onNoteChange={updateAssigneeNote}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {assignees.map((a) => (
              <div key={a.user_id} className="text-sm text-[var(--c-text)]">
                <span className="font-bold">{a.profile.name}</span>
                {a.note && <span className="block text-xs text-[var(--c-text-muted)]">{a.note}</span>}
              </div>
            ))}
            {!assignees.length && <span className="text-sm text-[var(--c-text-muted)]">-</span>}
          </div>
        )}
      </Card>
    </main>
  );
}
