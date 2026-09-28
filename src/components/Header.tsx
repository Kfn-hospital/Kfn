'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { applyMode, applyTheme, DEFAULT_THEME, getStoredMode, type ThemeMode } from '@/lib/theme/colorUtils';

export default function Header({ onMenuClick }: { onMenuClick?: () => void } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang, setLang } = useLanguage();
  const supabase = createClient();
  const [logoUrl, setLogoUrl] = useState('');
  const [siteName, setSiteName] = useState('');
  const [iconVisibility, setIconVisibility] = useState({
    colors: true,
    language: true,
    darkmode: true,
    logout: true,
  });
  const [iconEmojis, setIconEmojis] = useState({
    colors: '🎨',
    language: '🌐',
    logout: '🚪',
    darkmode: '🌙',
    lightmode: '☀️',
  });
  const [iconUrls, setIconUrls] = useState({
    colors: '',
    language: '',
    logout: '',
    darkmode: '',
    lightmode: '',
  });
  const DEFAULT_ICON_ORDER = ['logout', 'colors', 'language', 'darkmode'];
  const [iconOrder, setIconOrder] = useState<string[]>(DEFAULT_ICON_ORDER);
  const [mode, setMode] = useState<ThemeMode>('light');

  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [primary, setPrimary] = useState(DEFAULT_THEME.primary);
  const [text, setText] = useState(DEFAULT_THEME.text);
  const [colorSaving, setColorSaving] = useState(false);
  const [colorSavedMsg, setColorSavedMsg] = useState('');

  const colorMenuRef = useRef<HTMLDivElement | null>(null);
  const langMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [
          'logo_url',
          'site_name_ar',
          'site_name_en',
          'icon_show_colors',
          'icon_show_language',
          'icon_show_darkmode',
          'icon_show_logout',
          'icon_emoji_colors',
          'icon_emoji_language',
          'icon_emoji_logout',
          'icon_emoji_darkmode',
          'icon_emoji_lightmode',
          'icon_url_colors',
          'icon_url_language',
          'icon_url_logout',
          'icon_url_darkmode',
          'icon_url_lightmode',
          'header_icon_order',
        ]);
      (data as { key: string; value: string | null }[] | null)?.forEach((row) => {
        if (row.key === 'logo_url' && row.value) setLogoUrl(row.value);
        if (row.key === 'icon_show_colors') setIconVisibility((v) => ({ ...v, colors: row.value !== 'false' }));
        if (row.key === 'icon_show_language') setIconVisibility((v) => ({ ...v, language: row.value !== 'false' }));
        if (row.key === 'icon_show_darkmode') setIconVisibility((v) => ({ ...v, darkmode: row.value !== 'false' }));
        if (row.key === 'icon_show_logout') setIconVisibility((v) => ({ ...v, logout: row.value !== 'false' }));
        if (row.key === 'icon_emoji_colors' && row.value) setIconEmojis((v) => ({ ...v, colors: row.value as string }));
        if (row.key === 'icon_emoji_language' && row.value) setIconEmojis((v) => ({ ...v, language: row.value as string }));
        if (row.key === 'icon_emoji_logout' && row.value) setIconEmojis((v) => ({ ...v, logout: row.value as string }));
        if (row.key === 'icon_emoji_darkmode' && row.value) setIconEmojis((v) => ({ ...v, darkmode: row.value as string }));
        if (row.key === 'icon_emoji_lightmode' && row.value) setIconEmojis((v) => ({ ...v, lightmode: row.value as string }));
        if (row.key === 'icon_url_colors') setIconUrls((v) => ({ ...v, colors: row.value || '' }));
        if (row.key === 'icon_url_language') setIconUrls((v) => ({ ...v, language: row.value || '' }));
        if (row.key === 'icon_url_logout') setIconUrls((v) => ({ ...v, logout: row.value || '' }));
        if (row.key === 'icon_url_darkmode') setIconUrls((v) => ({ ...v, darkmode: row.value || '' }));
        if (row.key === 'icon_url_lightmode') setIconUrls((v) => ({ ...v, lightmode: row.value || '' }));
        if (row.key === 'header_icon_order' && row.value) {
          const parsed = row.value.split(',').map((k) => k.trim()).filter((k) => DEFAULT_ICON_ORDER.includes(k));
          const missing = DEFAULT_ICON_ORDER.filter((k) => !parsed.includes(k));
          setIconOrder([...parsed, ...missing]);
        }
        if (row.key === 'site_name_ar' && row.value && lang === 'ar') setSiteName(row.value);
        if (row.key === 'site_name_en' && row.value && lang === 'en') setSiteName(row.value);
      });
    })();
    setMode(getStoredMode());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (colorMenuRef.current && !colorMenuRef.current.contains(e.target as Node)) setColorMenuOpen(false);
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) setLangMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadSiteDefault() {
    const base = { ...DEFAULT_THEME };
    const { data: rows } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['theme_primary', 'theme_text']);
    (rows as { key: string; value: string | null }[] | null)?.forEach((row) => {
      if (row.key === 'theme_primary' && row.value) base.primary = row.value;
      if (row.key === 'theme_text' && row.value) base.text = row.value;
    });
    return base;
  }

  async function openColorMenu() {
    setLangMenuOpen(false);
    if (!colorMenuOpen) {
      const base = await loadSiteDefault();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('theme_primary, theme_text')
          .eq('id', user.id)
          .single();
        if (profile?.theme_primary) base.primary = profile.theme_primary;
        if (profile?.theme_text) base.text = profile.theme_text;
      }
      setPrimary(base.primary);
      setText(base.text);
      setColorSavedMsg('');
    }
    setColorMenuOpen((v) => !v);
  }

  function previewColors(p: string, tC: string) {
    applyTheme(p, tC);
  }

  async function saveColors() {
    setColorSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ theme_primary: primary, theme_text: text }).eq('id', user.id);
    }
    applyTheme(primary, text);
    setColorSaving(false);
    setColorSavedMsg(t('appearanceSaved'));
  }

  async function resetColors() {
    setColorSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ theme_primary: null, theme_text: null }).eq('id', user.id);
    }
    const base = await loadSiteDefault();
    setPrimary(base.primary);
    setText(base.text);
    applyTheme(base.primary, base.text);
    setColorSaving(false);
    setColorSavedMsg(t('appearanceReset'));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function handleToggleMode() {
    const next: ThemeMode = mode === 'light' ? 'dark' : 'light';
    setMode(next);
    applyMode(next);
  }

  let pageTitle = siteName || t('appName');
  if (pathname.startsWith('/admin/settings')) pageTitle = t('settingsTitle');
  else if (pathname.startsWith('/admin/users')) pageTitle = t('navUsers');
  else if (pathname.startsWith('/admin/rooms')) pageTitle = t('navRoomsAdmin');
  else if (pathname.startsWith('/admin')) pageTitle = t('adminPanelTitle');
  else if (pathname.startsWith('/requests')) pageTitle = t('navRequests');
  else if (pathname.startsWith('/checklists')) pageTitle = t('navChecklists');
  else if (pathname.startsWith('/files')) pageTitle = t('navFiles');
  else if (pathname.startsWith('/reports')) pageTitle = t('navReports');
  else if (pathname.startsWith('/appearance')) pageTitle = t('appearanceTitle');
  else if (pathname.startsWith('/assistant')) pageTitle = t('aiAssistantTitle');
  else if (pathname.startsWith('/dashboard')) pageTitle = t('navDashboard');

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label={t('toggleMenu')}
          className="md:hidden w-9 h-9 shrink-0 flex items-center justify-center rounded-lg hover:bg-[var(--c-surface-muted)] text-lg"
        >
          ☰
        </button>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="logo" className="h-9 w-9 object-contain rounded-lg" />
        ) : (
          <span className="h-9 w-9 flex items-center justify-center rounded-lg bg-[var(--c-teal-700)] text-white font-extrabold text-sm shrink-0">
            {(siteName || t('appName') || 'K').charAt(0)}
          </span>
        )}
        <h1 className="font-extrabold text-[var(--c-text)] truncate">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {iconOrder.map((key) => {
          if (key === 'logout') {
            return (
              iconVisibility.logout && (
                <button
                  key="logout"
                  onClick={handleLogout}
                  title={t('logout')}
                  type="button"
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--c-surface-muted)] text-lg"
                >
                  {iconUrls.logout ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={iconUrls.logout} alt="" className="w-5 h-5 object-contain" />
                  ) : (
                    iconEmojis.logout
                  )}
                </button>
              )
            );
          }

          if (key === 'colors') {
            return (
              iconVisibility.colors && (
                <div key="colors" className="relative" ref={colorMenuRef}>
                  <button
                    onClick={openColorMenu}
                    title={t('appearanceTitle')}
                    type="button"
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--c-surface-muted)] text-lg"
                  >
                    {iconUrls.colors ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={iconUrls.colors} alt="" className="w-5 h-5 object-contain" />
                    ) : (
                      iconEmojis.colors
                    )}
                  </button>
                  {colorMenuOpen && (
                    <div className="absolute end-0 top-11 w-64 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl shadow-2xl p-4 z-30">
                      <p className="font-extrabold text-sm text-[var(--c-teal-900)] mb-3">🎨 {t('appearanceTitle')}</p>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-[var(--c-text)] mb-1">{t('primaryColor')}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={primary}
                              onChange={(e) => {
                                setPrimary(e.target.value);
                                previewColors(e.target.value, text);
                              }}
                              className="w-10 h-8 rounded border cursor-pointer"
                            />
                            <span className="text-xs text-[var(--c-text-muted)]">{primary}</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[var(--c-text)] mb-1">{t('textColor')}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={text}
                              onChange={(e) => {
                                setText(e.target.value);
                                previewColors(primary, e.target.value);
                              }}
                              className="w-10 h-8 rounded border cursor-pointer"
                            />
                            <span className="text-xs text-[var(--c-text-muted)]">{text}</span>
                          </div>
                        </div>
                      </div>
                      {colorSavedMsg && <p className="text-xs text-green-600 font-bold mt-2">{colorSavedMsg}</p>}
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          type="button"
                          onClick={saveColors}
                          disabled={colorSaving}
                          className="flex-1 bg-[var(--c-teal-700)] text-white font-bold rounded-lg px-3 py-2 text-xs disabled:opacity-50"
                        >
                          {colorSaving ? t('loading') : t('save')}
                        </button>
                        <button
                          type="button"
                          onClick={resetColors}
                          disabled={colorSaving}
                          className="text-xs font-bold text-[var(--c-text-muted)] hover:underline whitespace-nowrap"
                        >
                          {t('useSiteDefault')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            );
          }

          if (key === 'language') {
            return (
              iconVisibility.language && (
                <div key="language" className="relative" ref={langMenuRef}>
                  <button
                    onClick={() => {
                      setColorMenuOpen(false);
                      setLangMenuOpen((v) => !v);
                    }}
                    title={t('langToggle')}
                    type="button"
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--c-surface-muted)] text-lg"
                  >
                    {iconUrls.language ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={iconUrls.language} alt="" className="w-5 h-5 object-contain" />
                    ) : (
                      iconEmojis.language
                    )}
                  </button>
                  {langMenuOpen && (
                    <div className="absolute end-0 top-11 w-36 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl shadow-2xl py-1 z-30 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setLang('ar');
                          setLangMenuOpen(false);
                        }}
                        className={`w-full text-right px-3 py-2 text-sm font-bold hover:bg-[var(--c-surface-muted)] ${
                          lang === 'ar' ? 'text-[var(--c-teal-700)]' : 'text-[var(--c-text)]'
                        }`}
                      >
                        {lang === 'ar' ? '✓ ' : ''}العربية
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLang('en');
                          setLangMenuOpen(false);
                        }}
                        className={`w-full text-right px-3 py-2 text-sm font-bold hover:bg-[var(--c-surface-muted)] ${
                          lang === 'en' ? 'text-[var(--c-teal-700)]' : 'text-[var(--c-text)]'
                        }`}
                      >
                        {lang === 'en' ? '✓ ' : ''}English
                      </button>
                    </div>
                  )}
                </div>
              )
            );
          }

          if (key === 'darkmode') {
            return (
              iconVisibility.darkmode && (
                <button
                  key="darkmode"
                  onClick={handleToggleMode}
                  title={mode === 'light' ? t('darkMode') : t('lightMode')}
                  type="button"
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--c-surface-muted)] text-lg"
                >
                  {mode === 'light' ? (
                    iconUrls.darkmode ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={iconUrls.darkmode} alt="" className="w-5 h-5 object-contain" />
                    ) : (
                      iconEmojis.darkmode
                    )
                  ) : iconUrls.lightmode ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={iconUrls.lightmode} alt="" className="w-5 h-5 object-contain" />
                  ) : (
                    iconEmojis.lightmode
                  )}
                </button>
              )
            );
          }

          return null;
        })}
      </div>
    </header>
  );
}
