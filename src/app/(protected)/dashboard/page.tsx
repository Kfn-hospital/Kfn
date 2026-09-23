'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import DataTable from '@/components/ui/DataTable';
import type { Room, Booking } from '@/types/database';

export default function DashboardPage() {
  const supabase = createClient();
  const { t, lang } = useLanguage();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    room_id: '',
    title: '',
    booking_date: '',
    start_time: '',
    end_time: '',
    notes: '',
  });

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

  useEffect(() => {
    loadData();
  }, []);

  async function handleAddBooking(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.from('bookings').insert({
      room_id: form.room_id,
      title: form.title,
      booking_date: form.booking_date,
      start_time: form.start_time,
      end_time: form.end_time,
      notes: form.notes || null,
      booked_by: userId,
      status: 'pending',
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setModalOpen(false);
    setForm({ room_id: '', title: '', booking_date: '', start_time: '', end_time: '', notes: '' });
    loadData();
  }

  async function updateStatus(id: string, status: 'approved' | 'rejected' | 'cancelled') {
    await supabase.from('bookings').update({ status }).eq('id', id);
    loadData();
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

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-teal-900">
          {t('roomsAndBookings')}
        </h1>
        <button
          onClick={() => setModalOpen(true)}
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
            { header: t('bookingDate'), render: (b) => b.booking_date },
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
              render: (b) =>
                canManage && b.status === 'pending' ? (
                  <div className="flex gap-2">
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
                  </div>
                ) : b.booked_by === userId && b.status === 'pending' ? (
                  <button
                    onClick={() => updateStatus(b.id, 'cancelled')}
                    className="text-slate-500 text-xs font-bold hover:underline"
                  >
                    {t('cancel')}
                  </button>
                ) : null,
            },
          ]}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('newBooking')}>
        <form onSubmit={handleAddBooking} className="space-y-3">
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
