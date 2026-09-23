'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import DataTable from '@/components/ui/DataTable';
import type { Room } from '@/types/database';

export default function AdminRoomsPage() {
  const supabase = createClient();
  const { t, lang } = useLanguage();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    name_en: '',
    location: '',
    location_en: '',
    capacity: '',
  });

  async function loadRooms() {
    const { data } = await supabase.from('rooms').select('*').order('name');
    setRooms((data as Room[]) || []);
  }

  useEffect(() => {
    loadRooms();
  }, []);

  async function handleAddRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    setError('');

    const { error } = await supabase.from('rooms').insert({
      name: form.name.trim(),
      name_en: form.name_en.trim() || null,
      location: form.location.trim() || null,
      location_en: form.location_en.trim() || null,
      capacity: form.capacity ? parseInt(form.capacity) : 0,
      status: 'active',
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ name: '', name_en: '', location: '', location_en: '', capacity: '' });
    setModalOpen(false);
    loadRooms();
  }

  async function handleDelete(id: string) {
    if (!confirm(t('deleteConfirm'))) return;
    await supabase.from('rooms').delete().eq('id', id);
    loadRooms();
  }

  return (
    <main className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-teal-900">{t('roomsManagement')}</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-teal-700 text-white rounded-xl px-5 py-2.5 font-bold"
        >
          {t('addRoom')}
        </button>
      </div>

      <Card>
        <DataTable
          emptyMessage={t('noData')}
          rows={rooms}
          columns={[
            {
              header: t('roomName'),
              render: (r) => (lang === 'en' && r.name_en ? r.name_en : r.name),
            },
            {
              header: t('roomLocation'),
              render: (r) => (lang === 'en' && r.location_en ? r.location_en : r.location) || '-',
            },
            { header: t('roomCapacity'), render: (r) => r.capacity },
            {
              header: t('actions'),
              render: (r) => (
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-red-500 text-xs font-bold hover:underline"
                >
                  🗑️ {t('delete')}
                </button>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('addRoom')}>
        <form onSubmit={handleAddRoom} className="space-y-3">
          <FormField
            label={`${t('roomName')} (عربي)`}
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            required
          />
          <FormField
            label={`${t('roomName')} (English)`}
            value={form.name_en}
            onChange={(v) => setForm({ ...form, name_en: v })}
          />
          <FormField
            label={`${t('roomLocation')} (عربي)`}
            value={form.location}
            onChange={(v) => setForm({ ...form, location: v })}
          />
          <FormField
            label={`${t('roomLocation')} (English)`}
            value={form.location_en}
            onChange={(v) => setForm({ ...form, location_en: v })}
          />
          <FormField
            label={t('roomCapacity')}
            type="number"
            value={form.capacity}
            onChange={(v) => setForm({ ...form, capacity: v })}
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
