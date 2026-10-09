'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import Alert from '@/components/ui/Alert';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import EmptyState from '@/components/ui/EmptyState';
import { statusDotStyle, statusBadgeStyle } from '@/lib/theme/colorUtils';

type BookingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'needs_edit';
type Tab = 'pending' | 'calendar' | 'log' | 'audit';

interface BookingRow {
  id: string;
  room_id: string;
  title: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  notes: string | null;
  rooms: { name: string; name_en: string | null } | null;
  profiles: { name: string; email: string } | null;
}

interface AuditRow {
  id: string;
  action: string;
  details: string | null;
  created_at: string;
  profiles: { name: string } | null;
}

function bookerLabel(p?: { name?: string | null; email?: string | null } | null) {
  if (!p) return '—';
  if (p.name && p.email) return `${p.name} — ${p.email}`;
  return p.name || p.email || '—';
}

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AdminControlPanelPage() {
  const { t, lang } = useLanguage();
  const supabase = createClient();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('pending');
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [auditLog, setAuditLog] = useState<AuditRow[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [myRoomIds, setMyRoomIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<BookingRow | null>(null);
  const [approveModal, setApproveModal] = useState<BookingRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadBookings = useCallback(async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select(
        'id, room_id, title, booking_date, start_time, end_time, status, notes, rooms(name, name_en), profiles(name, email)'
      )
      .order('booking_date', { ascending: false });

    if (!error && data) setBookings(data as unknown as BookingRow[]);
  }, [supabase]);

  const loadAuditLog = useCallback(async () => {
    const { data, error } = await supabase
      .from('audit_log')
      .select('id, action, details, created_at, profiles(name)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!error && data) setAuditLog(data as unknown as AuditRow[]);
  }, [supabase]);

  const loadMyAccess = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const { data: rm } = await supabase.from('room_managers').select('room_id').eq('user_id', user.id);
    const roomIds = ((rm as { room_id: string }[] | null) ?? []).map((r) => r.room_id);

    if (profile?.role !== 'admin' && profile?.role !== 'room_manager' && roomIds.length === 0) {
      router.push('/dashboard');
      return;
    }

    setMyRole(profile?.role ?? null);
    setMyRoomIds(roomIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadBookings(), loadAuditLog(), loadMyAccess()]).finally(() => setLoading(false));
  }, [loadBookings, loadAuditLog, loadMyAccess]);

  const canSeeRoom = useCallback(
    (roomId: string) => myRole === 'admin' || myRole === 'room_manager' || myRoomIds.includes(roomId),
    [myRole, myRoomIds]
  );

  const visibleBookings = useMemo(() => bookings.filter((b) => canSeeRoom(b.room_id)), [bookings, canSeeRoom]);

  const performDecision = async (booking: BookingRow, decision: 'approved' | 'rejected', reason?: string) => {
    setActingId(booking.id);
    setAlert(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: decision, decision_reason: reason || null })
      .eq('id', booking.id);

    if (updateError) {
      setAlert({ type: 'error', message: updateError.message });
      setActingId(null);
      return;
    }

    await supabase.from('audit_log').insert({
      action: decision === 'approved' ? 'booking_approved' : 'booking_rejected',
      details: `${booking.title} — ${booking.rooms?.name ?? ''} — ${booking.booking_date}`,
      performed_by: user?.id ?? null,
    });

    fetch('/api/bookings/notify-decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: booking.id, decision, reason }),
    }).catch(() => {});

    setAlert({
      type: 'success',
      message: decision === 'approved' ? t('approveSuccess') : t('rejectSuccess'),
    });

    await Promise.all([loadBookings(), loadAuditLog()]);
    setActingId(null);
  };

  const handleDecision = (booking: BookingRow, decision: 'approved' | 'rejected') => {
    if (decision === 'rejected') {
      setRejectReason('');
      setRejectModal(booking);
      return;
    }
    setRejectReason('');
    setApproveModal(booking);
  };

  const confirmApproveModal = () => {
    if (!approveModal) return;
    performDecision(approveModal, 'approved', rejectReason.trim());
    setApproveModal(null);
    setRejectReason('');
  };

  const confirmRejectModal = () => {
    if (!rejectModal) return;
    performDecision(rejectModal, 'rejected', rejectReason.trim());
    setRejectModal(null);
    setRejectReason('');
  };

  const pendingBookings = visibleBookings.filter((b) => b.status === 'pending');

  const statusLabel = (status: BookingStatus) =>
    status === 'pending'
      ? t('bookingPending')
      : status === 'approved'
      ? t('bookingApproved')
      : status === 'rejected'
      ? t('bookingRejected')
      : status === 'needs_edit'
      ? t('bookingNeedsEdit')
      : t('bookingCancelled');

  const roomName = (b: BookingRow) => (lang === 'ar' ? b.rooms?.name : b.rooms?.name_en || b.rooms?.name);

  // ---- Calendar data ----
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    visibleBookings.forEach((b) => {
      const list = map.get(b.booking_date) ?? [];
      list.push(b);
      map.set(b.booking_date, list);
    });
    return map;
  }, [visibleBookings]);

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [calendarMonth]);

  const monthLabel = calendarMonth.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });

  const selectedDayBookings = selectedDay ? bookingsByDate.get(selectedDay) ?? [] : [];

  if (loading) {
    return <p className="text-[var(--c-text-muted)]">{t('loading')}</p>;
  }

  return (
    <main className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--c-teal-900)]">⚙️ {t('adminPanelTitle')}</h1>
        <p className="text-[var(--c-text-muted)]">{t('adminPanelSubtitle')}</p>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} />}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 rounded-xl text-sm font-bold ${
            tab === 'pending' ? 'bg-[var(--c-teal-700)] text-white' : 'bg-[var(--c-surface)] text-[var(--c-text)]'
          }`}
        >
          {t('tabPendingBookings')} {pendingBookings.length > 0 && `(${pendingBookings.length})`}
        </button>
        <button
          onClick={() => setTab('calendar')}
          className={`px-4 py-2 rounded-xl text-sm font-bold ${
            tab === 'calendar' ? 'bg-[var(--c-teal-700)] text-white' : 'bg-[var(--c-surface)] text-[var(--c-text)]'
          }`}
        >
          📅 {t('tabCalendar')}
        </button>
        <button
          onClick={() => setTab('log')}
          className={`px-4 py-2 rounded-xl text-sm font-bold ${
            tab === 'log' ? 'bg-[var(--c-teal-700)] text-white' : 'bg-[var(--c-surface)] text-[var(--c-text)]'
          }`}
        >
          {t('tabFullBookingLog')}
        </button>
        <button
          onClick={() => setTab('audit')}
          className={`px-4 py-2 rounded-xl text-sm font-bold ${
            tab === 'audit' ? 'bg-[var(--c-teal-700)] text-white' : 'bg-[var(--c-surface)] text-[var(--c-text)]'
          }`}
        >
          {t('tabAuditLog')}
        </button>
      </div>

      {/* روابط سريعة لصفحات تانية — متفصلة بصريًا عن التابات فوق عشان محدش يلخبط بينهم */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-xs">
        <span className="font-bold text-[var(--c-text-muted)]">{t('quickLinksLabel')}</span>
        <Link href="/requests" className="font-bold text-[var(--c-teal-700)] hover:underline">
          {t('requestsTitle')} ↗
        </Link>
        {myRole === 'admin' && (
          <>
            <Link href="/admin/rooms" className="font-bold text-[var(--c-teal-700)] hover:underline">
              {t('roomsManagement')} ↗
            </Link>
            <Link href="/admin/users" className="font-bold text-[var(--c-teal-700)] hover:underline">
              {t('usersTitle')} ↗
            </Link>
            <Link href="/reports" className="font-bold text-[var(--c-teal-700)] hover:underline">
              📊 {t('reportsTitle')} ↗
            </Link>
          </>
        )}
        <Link href="/admin/settings" className="font-bold text-[var(--c-teal-700)] hover:underline">
          🛠️ {t('settingsTitle')} ↗
        </Link>
      </div>

      {tab === 'pending' ? (
        pendingBookings.length === 0 ? (
          <Card>
            <EmptyState icon="🗓️" message={t('noPendingBookings')} />
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {pendingBookings.map((b) => (
              <Card key={b.id}>
                <span className="inline-block text-xs font-bold px-2 py-1 rounded-lg mb-2" style={statusBadgeStyle(b.status)}>
                  {statusLabel(b.status)}
                </span>
                <h3 className="font-extrabold text-[var(--c-teal-900)] mb-1">{roomName(b)}</h3>
                <p className="text-sm text-[var(--c-text-muted)] mb-1">👤 {bookerLabel(b.profiles)}</p>
                <p className="text-sm text-[var(--c-text-muted)] mb-1">
                  📅 {b.booking_date} · {b.start_time} - {b.end_time}
                </p>
                {b.notes && <p className="text-sm text-[var(--c-text)] mb-3">📝 {b.notes}</p>}
                <div className="flex gap-2 mt-3">
                  <button
                    disabled={actingId === b.id}
                    onClick={() => handleDecision(b, 'rejected')}
                    className="flex-1 bg-red-50 text-red-600 font-bold rounded-xl py-2 disabled:opacity-50"
                  >
                    ✕ {t('reject')}
                  </button>
                  <button
                    disabled={actingId === b.id}
                    onClick={() => handleDecision(b, 'approved')}
                    className="flex-1 bg-[var(--c-teal-700)] text-white font-bold rounded-xl py-2 disabled:opacity-50"
                  >
                    ✓ {t('approve')}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : tab === 'calendar' ? (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="px-3 py-1 rounded-lg bg-[var(--c-surface-muted)] text-[var(--c-text)] font-bold"
            >
              {lang === 'ar' ? '▶' : '◀'}
            </button>
            <h3 className="font-extrabold text-[var(--c-teal-900)]">{monthLabel}</h3>
            <button
              onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="px-3 py-1 rounded-lg bg-[var(--c-surface-muted)] text-[var(--c-text)] font-bold"
            >
              {lang === 'ar' ? '◀' : '▶'}
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-[var(--c-text-muted)] mb-2">
            {(lang === 'ar'
              ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
              : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            ).map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarCells.map((date, i) => {
              if (!date) return <div key={i} />;
              const key = toDateKey(date);
              const dayBookings = bookingsByDate.get(key) ?? [];
              const isToday = key === toDateKey(new Date());
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(key)}
                  className={`aspect-square rounded-xl border p-1 flex flex-col items-center justify-start text-xs ${
                    selectedDay === key ? 'border-[var(--c-teal-600)] bg-[var(--c-teal-50)]' : 'border-[var(--c-border)]'
                  } ${isToday ? 'ring-2 ring-[var(--c-teal-400)]' : ''}`}
                >
                  <span className="font-bold text-[var(--c-text)]">{date.getDate()}</span>
                  <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                    {dayBookings.slice(0, 4).map((b) => (
                      <span key={b.id} className="w-1.5 h-1.5 rounded-full" style={statusDotStyle(b.status)} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedDay && (
            <div className="mt-5 border-t pt-4">
              <h4 className="font-bold text-[var(--c-teal-900)] mb-2">{selectedDay}</h4>
              {selectedDayBookings.length === 0 ? (
                <p className="text-[var(--c-text-muted)] text-sm">{t('noData')}</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayBookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between bg-[var(--c-bg)] rounded-lg p-2">
                      <div>
                        <p className="font-bold text-sm text-[var(--c-text)]">{roomName(b)}</p>
                        <p className="text-xs text-[var(--c-text-muted)]">
                          {b.start_time}-{b.end_time} · {bookerLabel(b.profiles)}
                        </p>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 rounded-lg" style={statusBadgeStyle(b.status)}>
                        {statusLabel(b.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      ) : tab === 'log' ? (
        <Card>
          <DataTable
            emptyMessage={t('noData')}
            rows={visibleBookings}
            columns={[
              { header: t('bookingRoom'), render: roomName },
              { header: t('bookedBy'), render: (b) => bookerLabel(b.profiles) },
              { header: t('bookingDate'), render: (b) => `${b.booking_date} · ${b.start_time}-${b.end_time}` },
              {
                header: t('status'),
                render: (b) => (
                  <span className="text-xs font-bold px-2 py-1 rounded-lg" style={statusBadgeStyle(b.status)}>
                    {statusLabel(b.status)}
                  </span>
                ),
              },
            ]}
          />
        </Card>
      ) : (
        <Card>
          <DataTable
            emptyMessage={t('noData')}
            rows={auditLog}
            columns={[
              { header: t('auditAction'), render: (a) => a.action },
              { header: t('auditBy'), render: (a) => a.profiles?.name ?? '—' },
              { header: t('auditDetails'), render: (a) => a.details ?? '—' },
              {
                header: t('auditDate'),
                render: (a) => new Date(a.created_at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US'),
              },
            ]}
          />
        </Card>
      )}

      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)} title={t('bookingReasonModalTitleReject')}>
        <div className="space-y-3">
          <FormField
            label=""
            type="textarea"
            value={rejectReason}
            onChange={setRejectReason}
            placeholder={t('bookingReasonPlaceholder')}
          />
          <button
            onClick={confirmRejectModal}
            className="w-full bg-[var(--c-teal-700)] text-white rounded-xl py-3 font-bold"
          >
            {t('bookingReasonConfirm')}
          </button>
        </div>
      </Modal>

      <Modal open={!!approveModal} onClose={() => setApproveModal(null)} title={t('bookingReasonModalTitleApprove')}>
        <div className="space-y-3">
          <FormField
            label=""
            type="textarea"
            value={rejectReason}
            onChange={setRejectReason}
            placeholder={t('bookingApprovePlaceholder')}
          />
          <button
            onClick={confirmApproveModal}
            className="w-full bg-[var(--c-teal-700)] text-white rounded-xl py-3 font-bold"
          >
            {t('bookingReasonConfirm')}
          </button>
        </div>
      </Modal>
    </main>
  );
}
