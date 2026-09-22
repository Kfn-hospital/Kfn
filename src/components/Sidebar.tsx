'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const links = [
  { href: '/dashboard', label: '📅 القاعات والحجوزات' },
  { href: '/requests', label: '📋 طلبات التنسيق والمتابعة' },
  { href: '/checklists', label: '✅ قوائم التحقق' },
  { href: '/files', label: '📁 ملفات ومستندات' },
  { href: '/admin/rooms', label: '🏢 إدارة القاعات' },
  { href: '/admin/users', label: '👥 المستخدمون' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-64 bg-teal-900 text-white min-h-screen p-4 flex flex-col">
      <div className="mb-8 text-center">
        <h2 className="font-extrabold">بوابة خورفكان</h2>
        <p className="text-xs text-teal-300">الإدارية</p>
      </div>

      <nav className="flex-1 space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`block px-3 py-2.5 rounded-xl text-sm font-bold transition ${
              pathname === link.href
                ? 'bg-white text-teal-900'
                : 'text-teal-100 hover:bg-teal-800'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        className="mt-4 text-sm font-bold text-teal-300 hover:text-white text-right px-3 py-2"
      >
        🚪 تسجيل الخروج
      </button>
    </aside>
  );
}
