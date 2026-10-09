'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useConfirm } from '@/lib/confirm/ConfirmContext';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import FormField from '@/components/ui/FormField';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import type { Booking } from '@/types/database';
import { statusBadgeStyle, statusDotStyle } from '@/lib/theme/colorUtils';

const STATUS_KEYS = ['pending', 'needs_edit', 'approved', 'rejected', 'cancelled'] as const;
const NO_DECIDER = '__none__';

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function bookerLabel(p?: { name?: string | null; email?: string | null } | null) {
  if (!p) return '-';
  if (p.name && p.email) return `${p.name} — ${p.email}`;
  return p.name || p.email || '-';
}

function formatTime12(time: string, amLabel: string, pmLabel: string) {
  if (!time) return '';
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return time;
  const m = (mStr || '00').padStart(2, '0');
  const isPM = h >= 12;
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${isPM ? pmLabel : amLabel}`;
}

export default function AllBookingsPage() {
  const supabase = createClient();
  const { t, lang } = useLanguage();
  const confirm = useConfirm();

  const [role, setRole] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [deciders, setDeciders] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ---- بيانات المستخدم الحالي + سبب الرفض/الإلغاء ----
  const [userId, setUserId] = useState('');
  const [myName, setMyName] = useState('');
  const [reasonModal, setReasonModal] = useState<{ booking: Booking; status: 'approved' | 'rejected' | 'cancelled' | 'needs_edit' } | null>(null);
  const [reasonText, setReasonText] = useState('');
  // كارت يظهر عند الوقوف على عنوان الحجز + نافذة تفاصيل عند الضغط على الصف
  const [hoverCard, setHoverCard] = useState<{ b: Booking; x: number; y: number } | null>(null);
  const [details, setDetails] = useState<Booking | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [deciderFilter, setDeciderFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const canManage = role === 'admin' || role === 'room_manager';
  const timeLabel = (time: string) => formatTime12(time, t('am'), t('pm'));

  async function loadBookings() {
    const { data } = await supabase
      .from('bookings')
      .select('*, rooms(*), profiles(*)')
      .order('booking_date', { ascending: false })
      .limit(2000);
    const list = (data as Booking[]) || [];
    setBookings(list);

    const ids = Array.from(new Set(list.map((b) => b.decided_by).filter((id): id is string => !!id)));
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, name, email').in('id', ids);
      const map: Record<string, string> = {};
      (profs as { id: string; name: string | null; email: string | null }[] | null)?.forEach((p) => {
        map[p.id] = p.name || p.email || '-';
      });
      setDeciders(map);
    }
  }

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let r: string | null = null;
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, name, email')
          .eq('id', user.id)
          .single();
        r = profile?.role ?? null;
        setMyName(profile?.name || profile?.email || '');
      }
      setRole(r);
      if (r === 'admin' || r === 'room_manager') await loadBookings();
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roomOptions = useMemo(() => {
    const map = new Map<string, string>();
    bookings.forEach((b) => {
      if (!map.has(b.room_id)) {
        map.set(b.room_id, (lang === 'en' && b.rooms?.name_en ? b.rooms.name_en : b.rooms?.name) || '-');
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [bookings, lang]);

  const deciderOptions = useMemo(
    () => Object.entries(deciders).map(([id, name]) => ({ id, name })),
    [deciders]
  );

  const preStatusFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (q) {
        const hay = `${b.title} ${b.profiles?.name ?? ''} ${b.profiles?.email ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (roomFilter && b.room_id !== roomFilter) return false;
      if (deciderFilter === NO_DECIDER) {
        if (b.decided_by) return false;
      } else if (deciderFilter && b.decided_by !== deciderFilter) {
        return false;
      }
      const d = dateOnly(b.booking_date);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [bookings, search, roomFilter, deciderFilter, dateFrom, dateTo]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, needs_edit: 0, approved: 0, rejected: 0, cancelled: 0 };
    preStatusFiltered.forEach((b) => {
      counts[b.status] = (counts[b.status] || 0) + 1;
    });
    return counts;
  }, [preStatusFiltered]);

  const filtered = useMemo(() => {
    const list = statusFilter ? preStatusFiltered.filter((b) => b.status === statusFilter) : preStatusFiltered;
    return [...list].sort(
      (a, b) =>
        dateOnly(b.booking_date).localeCompare(dateOnly(a.booking_date)) ||
        (b.start_time || '').localeCompare(a.start_time || '')
    );
  }, [preStatusFiltered, statusFilter]);

  const hasActiveFilters = !!(search || statusFilter || roomFilter || deciderFilter || dateFrom || dateTo);

  function clearFilters() {
    setSearch('');
    setStatusFilter('');
    setRoomFilter('');
    setDeciderFilter('');
    setDateFrom('');
    setDateTo('');
  }

  const statusLabel: Record<string, string> = {
    pending: t('bookingPending'),
    needs_edit: t('bookingNeedsEdit'),
    approved: t('legendApproved'),
    rejected: t('bookingRejected'),
    cancelled: t('bookingCancelled'),
  };

  async function deleteBookings(ids: string[], message: string) {
    if (!ids.length) return;
    if (!(await confirm({ message, danger: true, confirmLabel: t('delete') }))) return;
    setAlert(null);
    const { data, error } = await supabase
      .from('bookings')
      .delete()
      .in('id', ids)
      .eq('status', 'cancelled')
      .select('id');
    const deleted = (data as { id: string }[] | null) ?? [];
    if (error || !deleted.length) {
      setAlert({ type: 'error', message: t('bookingDeleteFailed') });
      return;
    }
    const gone = new Set(deleted.map((d) => d.id));
    setBookings((prev) => prev.filter((b) => !gone.has(b.id)));
    setAlert({ type: 'success', message: t('bookingDeleted') });
  }

  async function applyStatusChange(
    b: Booking,
    status: 'approved' | 'rejected' | 'cancelled' | 'needs_edit',
    reason?: string
  ) {
    setAlert(null);
    const decides = status === 'approved' || status === 'rejected';
    const { data, error } = await supabase
      .from('bookings')
      .update({
        status,
        decision_reason: reason || null,
        ...(decides ? { decided_by: userId } : {}),
      })
      .eq('id', b.id)
      .select('id');
    if (error || !data || !data.length) {
      setAlert({ type: 'error', message: t('bookingActionFailed') });
      return;
    }
    setBookings((prev) =>
      prev.map((x) =>
        x.id === b.id
          ? { ...x, status, decision_reason: reason || null, decided_by: decides ? userId : x.decided_by }
          : x
      )
    );
    if (decides && userId) setDeciders((prev) => ({ ...prev, [userId]: myName || '-' }));
    setAlert({ type: 'success', message: t('bookingActionDone') });
    fetch('/api/bookings/notify-decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: b.id, decision: status, reason }),
    }).catch(() => {});
  }

  function requestStatusChange(b: Booking, status: 'approved' | 'rejected' | 'cancelled' | 'needs_edit') {
    const isOwnCancel = status === 'cancelled' && b.booked_by === userId;
    if (!isOwnCancel && (status === 'approved' || status === 'rejected' || status === 'cancelled' || status === 'needs_edit')) {
      setReasonText('');
      setReasonModal({ booking: b, status });
      return;
    }
    applyStatusChange(b, status);
  }

  function confirmReasonModal() {
    if (!reasonModal) return;
    if (reasonModal.status === 'needs_edit' && !reasonText.trim()) return;
    applyStatusChange(reasonModal.booking, reasonModal.status, reasonText.trim());
    setReasonModal(null);
    setReasonText('');
  }

  if (!ready) return <p className="text-[var(--c-text-muted)] p-6">{t('loading')}</p>;
  if (!canManage) return <p className="text-[var(--c-text-muted)] p-6">{t('bookingsAccessDenied')}</p>;

  function renderActions(b: Booking) {
                if (b.status === 'rejected') return null;
                const canEdit = b.status === 'pending' || b.status === 'approved' || b.status === 'needs_edit';
                return (
                  <div className="flex gap-3 items-center">
                    {b.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => requestStatusChange(b, 'approved')}
                          className="text-green-600 text-xs font-bold hover:underline"
                        >
                          {t('approve')}
                        </button>
                        <button
                          type="button"
                          onClick={() => requestStatusChange(b, 'rejected')}
                          className="text-red-600 text-xs font-bold hover:underline"
                        >
                          {t('reject')}
                        </button>
                      </>
                    )}
                    {(b.status === 'pending' || b.status === 'approved') && (
                      <button
                        type="button"
                        onClick={() => requestStatusChange(b, 'needs_edit')}
                        className="text-orange-600 text-xs font-bold hover:underline"
                      >
                        {t('returnForEdit')}
                      </button>
                    )}
                    {canEdit && (
                      <Link
                        href={`/dashboard?edit=${b.id}`}
                        className="text-[var(--c-teal-600)] text-xs font-bold hover:underline"
                      >
                        {t('edit')}
                      </Link>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => requestStatusChange(b, 'cancelled')}
                        className="text-[var(--c-text-muted)] text-xs font-bold hover:underline"
                      >
                        {t('cancel')}
                      </button>
                    )}
                    {b.status === 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => deleteBookings([b.id], t('confirmDeleteCancelledBooking'))}
                        className="text-red-600 text-xs font-bold hover:underline"
                      >
                        🗑️ {t('delete')}
                      </button>
                    )}
                  </div>
                );
  }

  function renderInfo(b: Booking) {
    const rows: [string, React.ReactNode][] = [
      [t('bookingTitle'), <span key="t" className="font-bold break-words">{b.title}</span>],
      [t('bookingRoom'), (lang === 'en' && b.rooms?.name_en ? b.rooms.name_en : b.rooms?.name) || '-'],
      [t('bookingDate'), dateOnly(b.booking_date)],
      [t('bookingTimeLabel'), `${timeLabel(b.start_time)} - ${timeLabel(b.end_time)}`],
      [t('bookedBy'), bookerLabel(b.profiles)],
      [
        t('status'),
        <span key="s" className="px-2 py-1 rounded-full text-xs font-bold" style={statusBadgeStyle(b.status)}>
          {statusLabel[b.status] || b.status}
        </span>,
      ],
    ];
    if ((b.status === 'approved' || b.status === 'rejected') && b.decided_by) {
      rows.push([t('decidedByLabel'), deciders[b.decided_by] || '-']);
    }
    if (b.notes) rows.push([t('bookingNotes'), <span key="n" className="break-words whitespace-pre-wrap">{b.notes}</span>]);
    if (b.decision_reason) {
      rows.push([t('bookingDecisionNote'), <span key="d" className="break-words whitespace-pre-wrap">{b.decision_reason}</span>]);
    }
    return (
      <dl className="space-y-2 text-sm">
        {rows.map(([label, value], idx) => (
          <div key={idx} className="flex gap-3">
            <dt className="w-28 shrink-0 text-[var(--c-text-muted)] font-bold">{label}</dt>
            <dd className="flex-1 min-w-0">{value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  const cancelledShown = filtered.filter((b) => b.status === 'cancelled');

  return (
    <main className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--c-teal-900)]">📋 {t('navAllBookings')}</h1>
        <p className="text-[var(--c-text-muted)]">{t('allBookingsSubtitle')}</p>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} />}

      <Card>
        <h2 className="font-extrabold text-[var(--c-teal-900)] mb-3">🔎 {t('filtersTitle')}</h2>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
              statusFilter === ''
                ? 'bg-[var(--c-teal-700)] text-white border-transparent'
                : 'border-[var(--c-border)] text-[var(--c-text)]'
            }`}
          >
            {t('filterAllStatuses')} ({preStatusFiltered.length})
          </button>
          {STATUS_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
              className="px-3 py-1.5 rounded-full text-xs font-bold border border-transparent transition"
              style={
                statusFilter === key
                  ? { ...statusDotStyle(key), color: '#ffffff' }
                  : statusBadgeStyle(key)
              }
            >
              {statusLabel[key]} ({statusCounts[key] || 0})
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-sm font-bold text-[var(--c-text)] mb-1 block">{t('search')}</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('bookingsSearchPlaceholder')}
              className="w-full border rounded-xl px-3 py-2.5"
            />
          </div>
          <div>
            <label className="text-sm font-bold text-[var(--c-text)] mb-1 block">{t('bookingRoom')}</label>
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5"
            >
              <option value="">{t('filterAllRooms')}</option>
              {roomOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-bold text-[var(--c-text)] mb-1 block">{t('decidedByLabel')}</label>
            <select
              value={deciderFilter}
              onChange={(e) => setDeciderFilter(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5"
            >
              <option value="">{t('filterAllDeciders')}</option>
              <option value={NO_DECIDER}>{t('filterNoDecider')}</option>
              {deciderOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <FormField label={t('filterDateFrom')} type="date" value={dateFrom} onChange={setDateFrom} />
          <FormField label={t('filterDateTo')} type="date" value={dateTo} onChange={setDateTo} />
        </div>

        <div className="flex items-center justify-between mt-3 text-xs font-bold text-[var(--c-text-muted)]">
          <span>
            {t('bookingsCountLabel')}: {filtered.length}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="font-bold text-[var(--c-teal-700)] hover:underline"
            >
              ✕ {t('clearFilters')}
            </button>
          )}
        </div>
      </Card>

      <Card>
        {statusFilter === 'cancelled' && cancelledShown.length > 0 && (
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={() =>
                deleteBookings(
                  cancelledShown.map((b) => b.id),
                  t('confirmDeleteAllCancelled')
                )
              }
              className="text-xs font-bold text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50"
            >
              🗑️ {t('deleteAllCancelledBtn')} ({cancelledShown.length})
            </button>
          </div>
        )}
        <DataTable
          emptyMessage={hasActiveFilters ? t('noFilteredBookings') : t('noData')}
          rows={filtered}
          pageSize={20}
          nowrap
          onRowClick={(b: Booking) => {
            setHoverCard(null);
            setDetails(b);
          }}
          columns={[
            {
              header: t('bookingTitle'),
              render: (b: Booking) => (
                <span
                  className="block max-w-[200px] truncate font-bold cursor-pointer"
                  onMouseEnter={(e) => setHoverCard({ b, x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => setHoverCard({ b, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoverCard(null)}
                >
                  {b.title}
                </span>
              ),
            },
            {
              header: t('bookingRoom'),
              render: (b: Booking) => (lang === 'en' && b.rooms?.name_en ? b.rooms.name_en : b.rooms?.name) || '-',
            },
            { header: t('bookingDate'), render: (b: Booking) => dateOnly(b.booking_date) },
            {
              header: t('bookingTimeLabel'),
              render: (b: Booking) => `${timeLabel(b.start_time)} - ${timeLabel(b.end_time)}`,
            },
            { header: t('bookedBy'), render: (b: Booking) => bookerLabel(b.profiles) },
            {
              header: t('status'),
              render: (b: Booking) => (
                <span className="px-2 py-1 rounded-full text-xs font-bold" style={statusBadgeStyle(b.status)}>
                  {statusLabel[b.status] || b.status}
                </span>
              ),
            },
            {
              header: t('decidedByLabel'),
              render: (b: Booking) =>
                (b.status === 'approved' || b.status === 'rejected') && b.decided_by
                  ? deciders[b.decided_by] || '-'
                  : '-',
            },
            {
              header: t('actions'),
              render: (b: Booking) => (
                <div onClick={(e) => e.stopPropagation()}>{renderActions(b)}</div>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={!!details} onClose={() => setDetails(null)} title={t('bookingDetailsTitle')}>
        {details && (
          <div className="space-y-4">
            {renderInfo(details)}
            <div className="pt-3 border-t" onClick={() => setDetails(null)}>
              {renderActions(details)}
            </div>
          </div>
        )}
      </Modal>

      {hoverCard && !details && (
        <div
          className="fixed z-50 pointer-events-none bg-[var(--c-surface)] border border-[var(--c-border,#e2e8f0)] shadow-xl rounded-xl p-4 w-80"
          style={{
            left: Math.max(8, Math.min(hoverCard.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 336)),
            top: Math.max(8, Math.min(hoverCard.y + 14, (typeof window !== 'undefined' ? window.innerHeight : 800) - 280)),
          }}
        >
          {renderInfo(hoverCard.b)}
        </div>
      )}

      <Modal
        open={!!reasonModal}
        onClose={() => setReasonModal(null)}
        title={
          reasonModal?.status === 'approved'
            ? t('bookingReasonModalTitleApprove')
            : reasonModal?.status === 'rejected'
            ? t('bookingReasonModalTitleReject')
            : reasonModal?.status === 'needs_edit'
              ? t('bookingReasonModalTitleNeedsEdit')
              : t('bookingReasonModalTitleCancel')
        }
      >
        <div className="space-y-3">
          <FormField
            label=""
            type="textarea"
            value={reasonText}
            onChange={setReasonText}
            placeholder={
              reasonModal?.status === 'needs_edit'
                ? t('bookingNeedsEditPlaceholder')
                : reasonModal?.status === 'approved'
                  ? t('bookingApprovePlaceholder')
                  : t('bookingReasonPlaceholder')
            }
          />
          <button
            type="button"
            onClick={confirmReasonModal}
            className="w-full bg-[var(--c-teal-700)] text-white rounded-xl py-3 font-bold"
          >
            {t('bookingReasonConfirm')}
          </button>
        </div>
      </Modal>
    </main>
  );
}
