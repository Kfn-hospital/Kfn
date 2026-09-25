'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import { applyTheme, DEFAULT_THEME } from '@/lib/theme/colorUtils';

export default function AppearancePage() {
  const { t } = useLanguage();
  const supabase = createClient();

  const [primary, setPrimary] = useState(DEFAULT_THEME.primary);
  const [text, setText] = useState(DEFAULT_THEME.text);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  useEffect(() => {
    (async () => {
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
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function preview(p: string, tC: string) {
    applyTheme(p, tC);
  }

  async function handleSave() {
    setSaving(true);
    setAlert(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ theme_primary: primary, theme_text: text })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      setAlert({ type: 'error', message: error.message });
      return;
    }
    applyTheme(primary, text);
    setAlert({ type: 'success', message: t('appearanceSaved') });
  }

  async function handleReset() {
    setSaving(true);
    setAlert(null);
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
    setSaving(false);
    setAlert({ type: 'success', message: t('appearanceReset') });
  }

  if (loading) return <p className="text-[var(--c-text-muted)]">{t('loading')}</p>;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--c-teal-900)]">🎨 {t('appearanceTitle')}</h1>
        <p className="text-[var(--c-text-muted)]">{t('appearanceSubtitle')}</p>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} />}

      <Card>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-[var(--c-text)] mb-1">{t('primaryColor')}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primary}
                onChange={(e) => {
                  setPrimary(e.target.value);
                  preview(e.target.value, text);
                }}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <span className="text-sm text-[var(--c-text-muted)]">{primary}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--c-text)] mb-1">{t('textColor')}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  preview(primary, e.target.value);
                }}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <span className="text-sm text-[var(--c-text-muted)]">{text}</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[var(--c-teal-700)] text-white font-bold rounded-xl px-6 py-3 disabled:opacity-50"
        >
          {saving ? t('loading') : t('save')}
        </button>
        <button
          onClick={handleReset}
          disabled={saving}
          className="bg-[var(--c-surface-muted)] text-[var(--c-text)] font-bold rounded-xl px-6 py-3 disabled:opacity-50"
        >
          {t('useSiteDefault')}
        </button>
      </div>
    </div>
  );
}
