'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { applyMode, applyTheme, DEFAULT_THEME, getStoredMode, type ThemeMode } from '@/lib/theme/colorUtils';

export default function Header() {
  const pathname = usePathname();
  const { t, lang, setLang } = useLanguage();
  const supabase = createClient();
  const [logoUrl, setLogoUrl] = useState('');
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
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'logo_url').maybeSingle();
      if (data?.value) setLogoUrl(data.value as string);
    })();
    setMode(getStoredMode());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  else if (pathname.startsWith('/assistant')) pageTitle = t('aiAssistantTitle');
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
        <div className="relative" ref={colorMenuRef}>
          <button
            onClick={openColorMenu}
            title={t('appearanceTitle')}
            type="button"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--c-surface-muted)] text-lg"
          >
            🎨
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

        <div className="relative" ref={langMenuRef}>
          <button
            onClick={() => {
              setColorMenuOpen(false);
              setLangMenuOpen((v) => !v);
            }}
            title={t('langToggle')}
            type="button"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--c-surface-muted)] text-lg"
          >
            🌐
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
