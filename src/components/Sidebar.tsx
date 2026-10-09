'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface NavLink {
  href: string;
  label: string;
}

export default function Sidebar({
  open = false,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t, lang } = useLanguage();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRoomManager, setIsRoomManager] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [siteName, setSiteName] = useState('');

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
      const { data: rm } = await supabase.from('room_managers').select('room_id').eq('user_id', user.id).limit(1);
      if ((rm ?? []).length > 0) setIsRoomManager(true);
    }
    async function loadBranding() {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['logo_url', 'site_name_ar', 'site_name_en']);
      (data as { key: string; value: string | null }[] | null)?.forEach((row) => {
        if (row.key === 'logo_url' && row.value) setLogoUrl(row.value);
        if (row.key === 'site_name_ar' && row.value && lang === 'ar') setSiteName(row.value);
        if (row.key === 'site_name_en' && row.value && lang === 'en') setSiteName(row.value);
      });
    }
    checkRole();
    loadBranding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // ---- الروابط الأساسية: نفس الروابط اللي كانت موجودة، بدون أي حذف أو تغيير صلاحيات ----
  const primaryLinks: NavLink[] = [
    { href: '/requests', label: t('navRequests') },
    { href: '/dashboard', label: t('navDashboard') },
    { href: '/checklists', label: t('navChecklists') },
    { href: '/files', label: t('navFiles') },
    { href: '/reports', label: t('navReports') },
    { href: '/appearance', label: `🎨 ${t('appearanceTitle')}` },
    { href: '/password', label: `🔑 ${t('navChangePassword')}` },
  ];

  // ---- مجموعة الإدارة والإعدادات: نفس شرط الظهور القديم بالظبط، بس مجمّعة تحت عنوان واحد ----
  const adminLinks: NavLink[] = [
    ...(isAdmin || isRoomManager ? [{ href: '/admin', label: `📊 ${t('adminPanelTitle')}` }] : []),
    ...(isAdmin || isRoomManager ? [{ href: '/bookings', label: `📋 ${t('navAllBookings')}` }] : []),
    ...(isAdmin
      ? [
          { href: '/admin/rooms', label: t('navRoomsAdmin') },
          { href: '/admin/users', label: t('navUsers') },
        ]
      : []),
    ...(isAdmin || isRoomManager ? [{ href: '/admin/settings', label: `⚙️ ${t('settingsTitle')}` }] : []),
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function renderLink(link: NavLink) {
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={onClose}
        className={`block px-3 py-2.5 rounded-xl text-sm font-bold transition ${
          pathname === link.href
            ? 'bg-[var(--c-surface)] text-[var(--c-teal-900)]'
            : 'text-[var(--c-teal-100)] hover:bg-[var(--c-sidebar-hover)]'
        }`}
      >
        {link.label}
      </Link>
    );
  }

  return (
    <>
      {/* الخلفية الغامقة خلف القائمة على الموبايل بس */}
      {open && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={onClose} />}

      <aside
        className={`bg-[var(--c-teal-900)] text-white flex flex-col p-4 overflow-y-auto w-64 h-screen shrink-0 fixed md:relative inset-y-0 start-0 z-40 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="md:hidden self-end text-white/70 hover:text-white text-xl leading-none mb-2"
        >
          ×
        </button>

        <div className="mb-6 flex items-center justify-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="logo" className="h-10 w-10 object-contain rounded-lg bg-[var(--c-surface)]/10 p-1" />
          ) : null}
          <h2 className="font-extrabold">{siteName || t('appName')}</h2>
        </div>

        <nav className="flex-1 space-y-1">
          {primaryLinks.map(renderLink)}

          {adminLinks.length > 0 && (
            <>
              <p className="px-3 pt-4 mt-2 mb-1 border-t border-white/10 text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                {t('navGroupAdmin')}
              </p>
              {adminLinks.map(renderLink)}
            </>
          )}
        </nav>

        <button
          onClick={handleLogout}
          className="mt-2 shrink-0 text-sm font-bold text-[var(--c-teal-300)] hover:text-white text-start px-3 py-2 border-t border-[var(--c-teal-800)] pt-4"
        >
          🚪 {t('logout')}
        </button>
      </aside>
    </>
  );
}
