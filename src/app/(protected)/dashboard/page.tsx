'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import DataTable from '@/components/ui/DataTable';
import type { Room, Booking } from '@/types/database';

const STATUS_DOT: Record<string, string> = {
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

function dateOnly(value: string) {
  return value.slice(0, 10);
}

const EMPTY_FORM = {
  room_id: '',
  title: '',
  booking_date: '',
  start_time: '',
  end_time: '',
  notes: '',
};

export default function DashboardPage() {
  const supabase = createClient();
  const { t, lang } = useLanguage();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({ ...EMPTY_FORM });

  // ---- Calendar state ----
  const [calendarBookings, setCalendarBookings] = useState<Booking[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // ---- AI assistant state ----
  const [aiMessage, setAiMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReply, setAiReply] = useState('');

  async function loadData() {
    const { data: roomsData } = await supabase
      .from('rooms')
      .select('*')
      .eq('status', 'active')
      .order('name');
    setRooms((roomsData as Room[]) || []);

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('*, rooms(*), profiles(*)')
      .order('booking_date', { ascending: false })
      .limit(50);
    setBookings((bookingsData as Booking[]) || []);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile) setUserRole(profile.role);
    }
  }

  async function loadCalendarBookings() {
    const { data } = await supabase
      .from('bookings')
      .select('*, rooms(*), profiles(*)')
      .order('booking_date', { ascending: false })
      .limit(500);
    setCalendarBookings((data as Booking[]) || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadCalendarBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarMonth]);

  function openNewBooking(dateKey?: string) {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, booking_date: dateKey || '' });
    setError('');
    setModalOpen(true);
  }

  function openEditBooking(b: Booking) {
    setEditingId(b.id);
    setForm({
      room_id: b.room_id,
      title: b.title,
      booking_date: dateOnly(b.booking_date),
      start_time: b.start_time,
      end_time: b.end_time,
      notes: b.notes || '',
    });
    setError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  async function handleSubmitBooking(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      room_id: form.room_id,
      title: form.title,
      booking_date: form.booking_date,
      start_time: form.start_time,
      end_time: form.end_time,
      notes: form.notes || null,
    };

    const { error } = editingId
      ? await supabase.from('bookings').update(payload).eq('id', editingId)
      : await supabase.from('bookings').insert({ ...payload, booked_by: userId, status: 'pending' });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setModalOpen(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    loadData();
    loadCalendarBookings();
  }

  async function updateStatus(id: string, status: 'approved' | 'rejected' | 'cancelled') {
    await supabase.from('bookings').update({ status }).eq('id', id);
    loadData();
    loadCalendarBookings();
  }

  async function handleAiSubmit() {
    if (!aiMessage.trim() || !userId) return;
    setAiLoading(true);
    setAiReply('');
    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: aiMessage, userId }),
      });
      const json = await res.json();
      setAiReply(json.message || json.error || t('errorOccurred'));
      if (json.ok) {
        setAiMessage('');
        loadData();
        loadCalendarBookings();
      }
    } catch (err) {
      setAiReply(err instanceof Error ? err.message : String(err));
    } finally {
      setAiLoading(false);
    }
  }

  const statusLabel: Record<string, string> = {
    pending: t('bookingPending'),
    approved: t('bookingApproved'),
    rejected: t('bookingRejected'),
    cancelled: t('bookingCancelled'),
  };
  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    cancelled: 'bg-slate-100 text-slate-500',
  };

  const canManage = userRole === 'admin' || userRole === 'room_manager';

  // ---- Calendar derived data ----
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    calendarBookings.forEach((b) => {
      const key = dateOnly(b.booking_date);
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    });
    return map;
  }, [calendarBookings]);

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
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

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-teal-900">
          {t('roomsAndBookings')}
        </h1>
        <button
          onClick={() => openNewBooking()}
          className="bg-teal-700 text-white rounded-xl px-5 py-2.5 font-bold"
        >
          {t('newBooking')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {rooms.map((room) => (
          <Card key={room.id}>
            <h3 className="font-bold">
              {lang === 'en' && room.name_en ? room.name_en : room.name}
            </h3>
            <p className="text-sm text-slate-500">
              {lang === 'en' && room.location_en ? room.location_en : room.location} —{' '}
              {room.capacity}
            </p>
          </Card>
        ))}
        {!rooms.length && (
          <p className="text-slate-400 col-span-full text-center py-6">{t('noData')}</p>
        )}
      </div>

      {/* ---- AI Assistant ---- */}
      <Card className="mb-6">
        <h3 className="font-extrabold text-teal-900 mb-2">🤖 {t('aiAssistantTitle')}</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={aiMessage}
            onChange={(e) => setAiMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAiSubmit()}
            placeholder={t('aiAssistantPlaceholder')}
            className="flex-1 border rounded-xl px-3 py-2.5"
          />
          <button
            onClick={handleAiSubmit}
            disabled={aiLoading || !aiMessage.trim()}
            className="bg-teal-700 text-white rounded-xl px-5 py-2.5 font-bold disabled:opacity-50"
          >
            {aiLoading ? t('loading') : t('aiAssistantSend')}
          </button>
        </div>
        {aiReply && (
          <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 mt-3">{aiReply}</p>
        )}
      </Card>

      {/* ---- Calendar ---- */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 font-bold"
          >
            {lang === 'ar' ? '▶' : '◀'}
          </button>
          <h3 className="font-extrabold text-teal-900">📅 {t('tabCalendar')} — {monthLabel}</h3>
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
              <div key={key} className="flex flex-col items-stretch">
                <button
                  onClick={() => setSelectedDay(key)}
                  onDoubleClick={() => openNewBooking(key)}
                  className={`aspect-square rounded-xl border p-1 flex flex-col items-center justify-start text-xs ${
                    selectedDay === key ? 'border-teal-600 bg-teal-50' : 'border-slate-200'
                  } ${isToday ? 'ring-2 ring-teal-400' : ''}`}
                >
                  <span className="font-bold text-slate-600">{date.getDate()}</span>
                  <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                    {dayBookings.slice(0, 4).map((b) => (
                      <span
                        key={b.id}
                        title={`${b.title} — ${b.profiles?.name || b.profiles?.email || ''} — ${b.start_time}-${b.end_time}`}
                        className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[b.status]}`}
                      />
                    ))}
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {selectedDay && (
          <div className="mt-5 border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-teal-900">{selectedDay}</h4>
              <button
                onClick={() => openNewBooking(selectedDay)}
                className="text-sm font-bold text-teal-700 hover:underline"
              >
                + {t('newBooking')}
              </button>
            </div>
            {selectedDayBookings.length === 0 ? (
              <p className="text-slate-400 text-sm">{t('noData')}</p>
            ) : (
              <div className="space-y-2">
                {selectedDayBookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-2">
                    <div>
                      <p className="font-bold text-sm text-slate-700">{b.title}</p>
                      <p className="text-xs text-slate-500">
                        {(lang === 'en' && b.rooms?.name_en ? b.rooms.name_en : b.rooms?.name) || '-'} · {b.start_time}-{b.end_time} · {b.profiles?.name || b.profiles?.email || '—'}
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusColor[b.status]}`}>
                      {statusLabel[b.status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <DataTable
          emptyMessage={t('noData')}
          rows={bookings}
          columns={[
            { header: t('bookingTitle'), render: (b) => b.title },
            {
              header: t('bookingRoom'),
              render: (b) => (lang === 'en' && b.rooms?.name_en ? b.rooms.name_en : b.rooms?.name) || '-',
            },
            { header: t('bookingDate'), render: (b) => dateOnly(b.booking_date) },
            {
              header: t('status'),
              render: (b) => (
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColor[b.status]}`}>
                  {statusLabel[b.status]}
                </span>
              ),
            },
            {
              header: t('actions'),
              render: (b) => {
                const isFinal = b.status === 'rejected' || b.status === 'cancelled';
                if (isFinal) return null;
                const isOwnerOrManager = canManage || b.booked_by === userId;
                return (
                  <div className="flex gap-2 flex-wrap">
                    {canManage && b.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateStatus(b.id, 'approved')}
                          className="text-green-600 text-xs font-bold hover:underline"
                        >
                          {t('approve')}
                        </button>
                        <button
                          onClick={() => updateStatus(b.id, 'rejected')}
                          className="text-red-600 text-xs font-bold hover:underline"
                        >
                          {t('reject')}
                        </button>
                      </>
                    )}
                    {isOwnerOrManager && (
                      <>
                        <button
                          onClick={() => openEditBooking(b)}
                          className="text-teal-600 text-xs font-bold hover:underline"
                        >
                          {t('edit')}
                        </button>
                        <button
                          onClick={() => updateStatus(b.id, 'cancelled')}
                          className="text-slate-500 text-xs font-bold hover:underline"
                        >
                          {t('cancel')}
                        </button>
                      </>
                    )}
                  </div>
                );
              },
            },
          ]}
        />
      </Card>

      <Modal open={modalOpen} onClose={closeModal} title={editingId ? t('editBooking') : t('newBooking')}>
        <form onSubmit={handleSubmitBooking} className="space-y-3">
          <div>
            <label className="text-sm font-bold text-slate-600 mb-1 block">
              {t('bookingRoom')}
            </label>
            <select
              required
              value={form.room_id}
              onChange={(e) => setForm({ ...form, room_id: e.target.value })}
              className="w-full border rounded-xl px-3 py-2.5"
            >
              <option value="">—</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {lang === 'en' && r.name_en ? r.name_en : r.name}
                </option>
              ))}
            </select>
          </div>
          <FormField
            label={t('bookingTitle')}
            value={form.title}
            onChange={(v) => setForm({ ...form, title: v })}
            required
          />
          <FormField
            label={t('bookingDate')}
            type="date"
            value={form.booking_date}
            onChange={(v) => setForm({ ...form, booking_date: v })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label={t('bookingStart')}
              type="time"
              value={form.start_time}
              onChange={(v) => setForm({ ...form, start_time: v })}
              required
            />
            <FormField
              label={t('bookingEnd')}
              type="time"
              value={form.end_time}
              onChange={(v) => setForm({ ...form, end_time: v })}
              required
            />
          </div>
          <FormField
            label={t('bookingNotes')}
            type="textarea"
            value={form.notes}
            onChange={(v) => setForm({ ...form, notes: v })}
          />
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
