'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import Alert from '@/components/ui/Alert';

type BookingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
type Tab = 'pending' | 'calendar' | 'log' | 'audit';

interface BookingRow {
  id: string;
  title: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  notes: string | null;
  rooms: { name: string; name_en: string | null } | null;
  profiles: { name: string } | null;
}

interface AuditRow {
  id: string;
  action: string;
  details: string | null;
  created_at: string;
  profiles: { name: string } | null;
}

const STATUS_DOT: Record<BookingStatus, string> = {
  pending: 'bg-amber-400',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  cancelled: 'bg-slate-400',
};

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AdminControlPanelPage() {
  const { t, lang } = useLanguage();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>('pending');
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [auditLog, setAuditLog] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select(
        'id, title, booking_date, start_time, end_time, status, notes, rooms(name, name_en), profiles(name)'
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

  useEffect(() => {
    setLoading(true);
    Promise.all([loadBookings(), loadAuditLog()]).finally(() => setLoading(false));
  }, [loadBookings, loadAuditLog]);

  const handleDecision = async (booking: BookingRow, decision: 'approved' | 'rejected') => {
    setActingId(booking.id);
    setAlert(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: decision })
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

    setAlert({
      type: 'success',
      message: decision === 'approved' ? t('approveSuccess') : t('rejectSuccess'),
    });

    await Promise.all([loadBookings(), loadAuditLog()]);
    setActingId(null);
  };

  const pendingBookings = bookings.filter((b) => b.status === 'pending');

  const statusLabel = (status: BookingStatus) =>
    status === 'pending'
      ? t('bookingPending')
      : status === 'approved'
      ? t('bookingApproved')
      : status === 'rejected'
      ? t('bookingRejected')
      : t('bookingCancelled');

  const statusBadgeClass = (status: BookingStatus) =>
    status === 'pending'
      ? 'bg-amber-100 text-amber-700'
      : status === 'approved'
      ? 'bg-green-100 text-green-700'
      : status === 'rejected'
      ? 'bg-red-100 text-red-700'
      : 'bg-slate-100 text-slate-500';

  const roomName = (b: BookingRow) => (lang === 'ar' ? b.rooms?.name : b.rooms?.name_en || b.rooms?.name);

  // ---- Calendar data ----
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    bookings.forEach((b) => {
      const list = map.get(b.booking_date) ?? [];
      list.push(b);
      map.set(b.booking_date, list);
    });
    return map;
  }, [bookings]);

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
    return <p className="text-slate-400">{t('loading')}</p>;
  }

  return (
    <main className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-teal-900">⚙️ {t('adminPanelTitle')}</h1>
        <p className="text-slate-500">{t('adminPanelSubtitle')}</p>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} />}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 rounded-xl text-sm font-bold ${
            tab === 'pending' ? 'bg-teal-700 text-white' : 'bg-white text-slate-600'
          }`}
        >
          {t('tabPendingBookings')} {pendingBookings.length > 0 && `(${pendingBookings.length})`}
        </button>
        <button
          onClick={() => setTab('calendar')}
          className={`px-4 py-2 rounded-xl text-sm font-bold ${
            tab === 'calendar' ? 'bg-teal-700 text-white' : 'bg-white text-slate-600'
          }`}
        >
          📅 {t('tabCalendar')}
        </button>
        <button
          onClick={() => setTab('log')}
          className={`px-4 py-2 rounded-xl text-sm font-bold ${
            tab === 'log' ? 'bg-teal-700 text-white' : 'bg-white text-slate-600'
          }`}
        >
          {t('tabFullBookingLog')}
        </button>
        <button
          onClick={() => setTab('audit')}
          className={`px-4 py-2 rounded-xl text-sm font-bold ${
            tab === 'audit' ? 'bg-teal-700 text-white' : 'bg-white text-slate-600'
          }`}
        >
          {t('tabAuditLog')}
        </button>
        <Link href="/requests" className="px-4 py-2 rounded-xl text-sm font-bold bg-white text-slate-600">
          {t('requestsTitle')} ↗
        </Link>
        <Link href="/admin/rooms" className="px-4 py-2 rounded-xl text-sm font-bold bg-white text-slate-600">
          {t('roomsManagement')} ↗
        </Link>
        <Link href="/admin/users" className="px-4 py-2 rounded-xl text-sm font-bold bg-white text-slate-600">
          {t('usersTitle')} ↗
        </Link>
        <Link href="/admin/settings" className="px-4 py-2 rounded-xl text-sm font-bold bg-white text-slate-600">
          🛠️ {t('settingsTitle')} ↗
        </Link>
        <Link href="/reports" className="px-4 py-2 rounded-xl text-sm font-bold bg-white text-slate-600">
          📊 {t('reportsTitle')} ↗
        </Link>
      </div>

      {tab === 'pending' ? (
        pendingBookings.length === 0 ? (
          <Card>
            <p className="text-slate-400 text-center py-10">{t('noPendingBookings')}</p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {pendingBookings.map((b) => (
              <Card key={b.id}>
                <span className={`inline-block text-xs font-bold px-2 py-1 rounded-lg mb-2 ${statusBadgeClass(b.status)}`}>
                  {statusLabel(b.status)}
                </span>
                <h3 className="font-extrabold text-teal-900 mb-1">{roomName(b)}</h3>
                <p className="text-sm text-slate-500 mb-1">👤 {b.profiles?.name ?? '—'}</p>
                <p className="text-sm text-slate-500 mb-1">
                  📅 {b.booking_date} · {b.start_time} - {b.end_time}
                </p>
                {b.notes && <p className="text-sm text-slate-600 mb-3">📝 {b.notes}</p>}
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
                    className="flex-1 bg-teal-700 text-white font-bold rounded-xl py-2 disabled:opacity-50"
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
              className="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 font-bold"
            >
              {lang === 'ar' ? '▶' : '◀'}
            </button>
            <h3 className="font-extrabold text-teal-900">{monthLabel}</h3>
            <button
              onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 font-bold"
            >
              {lang === 'ar' ? '◀' : '▶'}
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 mb-2">
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
                    selectedDay === key ? 'border-teal-600 bg-teal-50' : 'border-slate-200'
                  } ${isToday ? 'ring-2 ring-teal-400' : ''}`}
                >
                  <span className="font-bold text-slate-600">{date.getDate()}</span>
                  <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                    {dayBookings.slice(0, 4).map((b) => (
                      <span key={b.id} className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[b.status]}`} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedDay && (
            <div className="mt-5 border-t pt-4">
              <h4 className="font-bold text-teal-900 mb-2">{selectedDay}</h4>
              {selectedDayBookings.length === 0 ? (
                <p className="text-slate-400 text-sm">{t('noData')}</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayBookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-2">
                      <div>
                        <p className="font-bold text-sm text-slate-700">{roomName(b)}</p>
                        <p className="text-xs text-slate-500">
                          {b.start_time}-{b.end_time} · {b.profiles?.name ?? '—'}
                        </p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${statusBadgeClass(b.status)}`}>
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
            rows={bookings}
            columns={[
              { header: t('bookingRoom'), render: roomName },
              { header: t('bookedBy'), render: (b) => b.profiles?.name ?? '—' },
              { header: t('bookingDate'), render: (b) => `${b.booking_date} · ${b.start_time}-${b.end_time}` },
              {
                header: t('status'),
                render: (b) => (
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${statusBadgeClass(b.status)}`}>
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
    </main>
  );
}
