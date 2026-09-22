// مثال حي يوضح النمط العام: صفحة "سيرفر" بتجيب بيانات القاعات مباشرة
// من قاعدة البيانات — بدون أي google.script.run ولا انتظار

import { createClient } from '@/lib/supabase/server';
import type { Room } from '@/types/database';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .eq('status', 'active')
    .order('name');

  return (
    <main className="p-6">
      <h1 className="text-2xl font-extrabold text-teal-900 mb-6">
        📅 القاعات والحجوزات
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(rooms as Room[] | null)?.map((room) => (
          <div key={room.id} className="bg-white rounded-2xl p-4 shadow">
            <h3 className="font-bold">{room.name}</h3>
            <p className="text-sm text-slate-500">
              {room.location} — السعة {room.capacity} أشخاص
            </p>
          </div>
        ))}
        {!rooms?.length && (
          <p className="text-slate-400 col-span-full text-center py-10">
            مفيش قاعات مضافة لسه — أضيفيها من قاعدة البيانات أو لوحة الأدمن
          </p>
        )}
      </div>
    </main>
  );
}
