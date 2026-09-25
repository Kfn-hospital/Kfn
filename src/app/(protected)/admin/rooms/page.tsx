'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import DataTable from '@/components/ui/DataTable';
import type { Room, Profile } from '@/types/database';

function RoomManagersEditor({
  roomId,
  allUsers,
  assigned,
  onAdd,
  onRemove,
}: {
  roomId: string;
  allUsers: Profile[];
  assigned: Profile[];
  onAdd: (roomId: string, userId: string) => void;
  onRemove: (roomId: string, userId: string) => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const assignedIds = new Set(assigned.map((u) => u.id));
  const matches = allUsers.filter(
    (u) => !assignedIds.has(u.id) && u.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="min-w-[200px]">
      <div className="flex flex-wrap gap-1 mb-2">
        {assigned.length === 0 ? (
          <span className="text-xs text-slate-400">{t('noManagersAssigned')}</span>
        ) : (
          assigned.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1 bg-[var(--c-teal-50)] text-[var(--c-teal-700)] text-xs font-bold px-2 py-1 rounded-full"
            >
              {u.name}
              <button onClick={() => onRemove(roomId, u.id)} className="text-[var(--c-teal-500)] hover:text-red-500">
                ×
              </button>
            </span>
          ))
        )}
      </div>

      {open ? (
        <div className="border rounded-lg p-2 bg-white shadow-sm">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchUsersPlaceholder')}
            className="w-full border rounded-lg px-2 py-1 text-xs mb-2"
          />
          <div className="max-h-32 overflow-y-auto space-y-1">
            {matches.length === 0 ? (
              <p className="text-xs text-slate-400">{t('noData')}</p>
            ) : (
              matches.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    onAdd(roomId, u.id);
                    setSearch('');
                  }}
                  className="block w-full text-right text-xs px-2 py-1 rounded hover:bg-[var(--c-teal-50)]"
                >
                  {u.name}
                </button>
              ))
            )}
          </div>
          <button onClick={() => setOpen(false)} className="text-xs text-slate-400 mt-2">
            {t('cancel')}
          </button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="text-xs font-bold text-[var(--c-teal-700)] hover:underline">
          + {t('addManager')}
        </button>
      )}
    </div>
  );
}

export default function AdminRoomsPage() {
  const supabase = createClient();
  const { t, lang } = useLanguage();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [managersByRoom, setManagersByRoom] = useState<Record<string, Profile[]>>({});
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

    const { data: users } = await supabase.from('profiles').select('*').eq('status', 'active').order('name');
    setAllUsers((users as Profile[]) || []);

    const { data: rm } = await supabase.from('room_managers').select('room_id, profiles(*)');
    const map: Record<string, Profile[]> = {};
    (rm as unknown as { room_id: string; profiles: Profile | null }[] | null)?.forEach((row) => {
      if (!row.profiles) return;
      if (!map[row.room_id]) map[row.room_id] = [];
      map[row.room_id].push(row.profiles);
    });
    setManagersByRoom(map);
  }

  useEffect(() => {
    loadRooms();
  }, []);

  async function addManager(roomId: string, userId: string) {
    await supabase.from('room_managers').insert({ room_id: roomId, user_id: userId });
    loadRooms();
  }

  async function removeManager(roomId: string, userId: string) {
    await supabase.from('room_managers').delete().eq('room_id', roomId).eq('user_id', userId);
    loadRooms();
  }

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
    <main className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-[var(--c-teal-900)]">{t('roomsManagement')}</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-[var(--c-teal-700)] text-white rounded-xl px-5 py-2.5 font-bold"
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
              header: t('roomManagers'),
              render: (r) => (
                <RoomManagersEditor
                  roomId={r.id}
                  allUsers={allUsers}
                  assigned={managersByRoom[r.id] ?? []}
                  onAdd={addManager}
                  onRemove={removeManager}
                />
              ),
            },
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
            className="w-full bg-[var(--c-teal-700)] text-white rounded-xl py-3 font-bold disabled:opacity-50"
          >
            {loading ? t('saving') : t('save')}
          </button>
        </form>
      </Modal>
    </main>
  );
}
