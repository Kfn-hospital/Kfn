'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t, toggleLang } = useLanguage();

  const links = [
    { href: '/dashboard', label: t('navDashboard') },
    { href: '/requests', label: t('navRequests') },
    { href: '/checklists', label: t('navChecklists') },
    { href: '/files', label: t('navFiles') },
    { href: '/admin/rooms', label: t('navRoomsAdmin') },
    { href: '/admin/users', label: t('navUsers') },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-64 bg-teal-900 text-white min-h-screen p-4 flex flex-col">
      <div className="mb-8 text-center">
        <h2 className="font-extrabold">{t('appName')}</h2>
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
        onClick={toggleLang}
        className="mb-2 border border-teal-600 rounded-xl px-3 py-2 text-sm font-bold text-teal-100 hover:bg-teal-800"
      >
        🌐 {t('langToggle')}
      </button>

      <button
        onClick={handleLogout}
        className="text-sm font-bold text-teal-300 hover:text-white text-start px-3 py-2"
      >
        {t('logout')}
      </button>
    </aside>
  );
}
