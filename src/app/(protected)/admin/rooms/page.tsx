'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Room } from '@/types/database';

export default function AdminRoomsPage() {
  const supabase = createClient();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function loadRooms() {
    const { data } = await supabase.from('rooms').select('*').order('name');
    setRooms((data as Room[]) || []);
  }

  useEffect(() => {
    loadRooms();
  }, []);

  async function handleAddRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setMessage('');

    const { error } = await supabase.from('rooms').insert({
      name: name.trim(),
      location: location.trim() || null,
      capacity: capacity ? parseInt(capacity) : 0,
      status: 'active',
    });

    setLoading(false);
    if (error) {
      setMessage('حدث خطأ: ' + error.message);
      return;
    }
    setName('');
    setLocation('');
    setCapacity('');
    loadRooms();
  }

  async function handleDelete(id: string) {
    if (!confirm('حذف القاعة دي؟')) return;
    await supabase.from('rooms').delete().eq('id', id);
    loadRooms();
  }

  return (
    <main className="p-6 max-w-2xl">
      <h1 className="text-2xl font-extrabold text-teal-900 mb-6">
        🏢 إدارة القاعات
      </h1>

      <form
        onSubmit={handleAddRoom}
        className="bg-white rounded-2xl p-5 shadow mb-6 space-y-3"
      >
        <h2 className="font-bold text-teal-900">إضافة قاعة جديدة</h2>
        <input
          type="text"
          placeholder="اسم القاعة"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full border rounded-xl px-3 py-2.5"
        />
        <input
          type="text"
          placeholder="الموقع (اختياري)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full border rounded-xl px-3 py-2.5"
        />
        <input
          type="number"
          placeholder="السعة"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          className="w-full border rounded-xl px-3 py-2.5"
        />
        {message && (
          <p className="text-sm font-bold text-red-600">{message}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="bg-teal-700 text-white rounded-xl px-5 py-2.5 font-bold disabled:opacity-50"
        >
          {loading ? 'جارِ الإضافة...' : '+ إضافة القاعة'}
        </button>
      </form>

      <div className="space-y-2">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="bg-white rounded-xl p-4 shadow flex items-center justify-between"
          >
            <div>
              <p className="font-bold">{room.name}</p>
              <p className="text-sm text-slate-500">
                {room.location} — السعة {room.capacity}
              </p>
            </div>
            <button
              onClick={() => handleDelete(room.id)}
              className="text-red-500 text-sm font-bold hover:underline"
            >
              🗑️ حذف
            </button>
          </div>
        ))}
        {!rooms.length && (
          <p className="text-slate-400 text-center py-6">مفيش قاعات لسه</p>
        )}
      </div>
    </main>
  );
}
