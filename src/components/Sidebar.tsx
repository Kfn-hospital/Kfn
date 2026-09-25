'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();
  const [isAdmin, setIsAdmin] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    async function checkRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile?.role === 'admin') setIsAdmin(true);
    }
    async function loadLogo() {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'logo_url').maybeSingle();
      if (data?.value) setLogoUrl(data.value as string);
    }
    checkRole();
    loadLogo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const links = [
    { href: '/dashboard', label: t('navDashboard') },
    { href: '/requests', label: t('navRequests') },
    { href: '/checklists', label: t('navChecklists') },
    { href: '/files', label: t('navFiles') },
    { href: '/reports', label: t('navReports') },
    ...(isAdmin
      ? [
          { href: '/admin/rooms', label: t('navRoomsAdmin') },
          { href: '/admin/users', label: t('navUsers') },
        ]
      : []),
    { href: '/appearance', label: `🎨 ${t('appearanceTitle')}` },
    ...(isAdmin
      ? [
          { href: '/admin/settings', label: `⚙️ ${t('settingsTitle')}` },
          { href: '/admin', label: `📊 ${t('adminPanelTitle')}` },
        ]
      : []),
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-64 shrink-0 bg-[var(--c-teal-900)] text-white h-screen sticky top-0 overflow-y-auto p-4 flex flex-col">
      <div className="mb-8 flex items-center justify-center gap-2">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="logo" className="h-10 w-10 object-contain rounded-lg bg-[var(--c-surface)]/10 p-1" />
        ) : null}
        <h2 className="font-extrabold">{t('appName')}</h2>
      </div>

      <nav className="flex-1 space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`block px-3 py-2.5 rounded-xl text-sm font-bold transition ${
              pathname === link.href
                ? 'bg-[var(--c-surface)] text-[var(--c-teal-900)]'
                : 'text-[var(--c-teal-100)] hover:bg-[var(--c-sidebar-hover)]'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        className="mt-2 shrink-0 text-sm font-bold text-[var(--c-teal-300)] hover:text-white text-start px-3 py-2 border-t border-[var(--c-teal-800)] pt-4"
      >
        🚪 {t('logout')}
      </button>
    </aside>
  );
}
