'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useConfirm } from '@/lib/confirm/ConfirmContext';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import FormField from '@/components/ui/FormField';
import DataTable from '@/components/ui/DataTable';
import type { Booking } from '@/types/database';
import { statusBadgeStyle, statusDotStyle } from '@/lib/theme/colorUtils';

const STATUS_KEYS = ['pending', 'approved', 'rejected', 'cancelled'] as const;
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
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        r = profile?.role ?? null;
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
    const counts: Record<string, number> = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
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

  if (!ready) return <p className="text-[var(--c-text-muted)] p-6">{t('loading')}</p>;
  if (!canManage) return <p className="text-[var(--c-text-muted)] p-6">{t('bookingsAccessDenied')}</p>;

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
          columns={[
            { header: t('bookingTitle'), render: (b: Booking) => <span className="font-bold">{b.title}</span> },
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
              render: (b: Booking) =>
                b.status === 'cancelled' ? (
                  <button
                    type="button"
                    onClick={() => deleteBookings([b.id], t('confirmDeleteCancelledBooking'))}
                    className="text-red-600 text-xs font-bold hover:underline"
                  >
                    🗑️ {t('delete')}
                  </button>
                ) : null,
            },
          ]}
        />
      </Card>
    </main>
  );
}
