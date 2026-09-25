'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { applyMode, getStoredMode, type ThemeMode } from '@/lib/theme/colorUtils';

export default function Header() {
  const pathname = usePathname();
  const { t, toggleLang } = useLanguage();
  const supabase = createClient();
  const [logoUrl, setLogoUrl] = useState('');
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'logo_url').maybeSingle();
      if (data?.value) setLogoUrl(data.value as string);
    })();
    setMode(getStoredMode());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleToggleMode() {
    const next: ThemeMode = mode === 'light' ? 'dark' : 'light';
    setMode(next);
    applyMode(next);
  }

  let pageTitle = t('appName');
  if (pathname.startsWith('/admin/settings')) pageTitle = t('settingsTitle');
  else if (pathname.startsWith('/admin/users')) pageTitle = t('navUsers');
  else if (pathname.startsWith('/admin/rooms')) pageTitle = t('navRoomsAdmin');
  else if (pathname.startsWith('/admin')) pageTitle = t('adminPanelTitle');
  else if (pathname.startsWith('/requests')) pageTitle = t('navRequests');
  else if (pathname.startsWith('/checklists')) pageTitle = t('navChecklists');
  else if (pathname.startsWith('/files')) pageTitle = t('navFiles');
  else if (pathname.startsWith('/reports')) pageTitle = t('navReports');
  else if (pathname.startsWith('/appearance')) pageTitle = t('appearanceTitle');
  else if (pathname.startsWith('/dashboard')) pageTitle = t('navDashboard');

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="logo" className="h-9 w-9 object-contain rounded-lg" />
        ) : (
          <span className="h-9 w-9 flex items-center justify-center rounded-lg bg-[var(--c-teal-700)] text-white font-extrabold text-sm shrink-0">
            {(t('appName') || 'K').charAt(0)}
          </span>
        )}
        <h1 className="font-extrabold text-[var(--c-text)] truncate">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Link
          href="/appearance"
          title={t('appearanceTitle')}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--c-surface-muted)] text-lg"
        >
          🎨
        </Link>
        <button
          onClick={toggleLang}
          title={t('langToggle')}
          type="button"
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--c-surface-muted)] text-lg"
        >
          🌐
        </button>
        <button
          onClick={handleToggleMode}
          title={mode === 'light' ? t('darkMode') : t('lightMode')}
          type="button"
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--c-surface-muted)] text-lg"
        >
          {mode === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </header>
  );
}
