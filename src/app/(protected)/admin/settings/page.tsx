'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import { applyTheme, DEFAULT_THEME } from '@/lib/theme/colorUtils';

interface Settings {
  logo_url: string;
  ai_assistant_name: string;
  ai_instructions: string;
  gemini_api_key: string;
  voice_recording_link: string;
  theme_primary: string;
  theme_text: string;
  theme_background: string;
}

const DEFAULTS: Settings = {
  logo_url: '',
  ai_assistant_name: '',
  ai_instructions: '',
  gemini_api_key: '',
  voice_recording_link: '',
  theme_primary: DEFAULT_THEME.primary,
  theme_text: DEFAULT_THEME.text,
  theme_background: DEFAULT_THEME.background,
};

export default function SettingsPage() {
  const { t } = useLanguage();
  const supabase = createClient();

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_settings').select('key, value');
      if (data) {
        const merged = { ...DEFAULTS };
        data.forEach((row: { key: string; value: unknown }) => {
          if (row.key in merged && row.value) (merged as Record<string, unknown>)[row.key] = row.value;
        });
        setSettings(merged);
      }
      setLoading(false);
    })();
  }, [supabase]);

  const upsertSetting = async (key: string, value: unknown) => {
    const { error } = await supabase.from('app_settings').upsert({ key, value });
    if (error) throw error;
  };

  const previewTheme = (p: string, tC: string, b: string) => applyTheme(p, tC, b);

  const handleSave = async () => {
    setSaving(true);
    setAlert(null);
    try {
      let logoUrl = settings.logo_url;

      if (logoFile) {
        const path = `logo-${Date.now()}-${logoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('branding')
          .upload(path, logoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: pub } = supabase.storage.from('branding').getPublicUrl(path);
        logoUrl = pub.publicUrl;
      }

      await Promise.all([
        upsertSetting('logo_url', logoUrl),
        upsertSetting('ai_assistant_name', settings.ai_assistant_name),
        upsertSetting('ai_instructions', settings.ai_instructions),
        upsertSetting('gemini_api_key', settings.gemini_api_key),
        upsertSetting('voice_recording_link', settings.voice_recording_link),
        upsertSetting('theme_primary', settings.theme_primary),
        upsertSetting('theme_text', settings.theme_text),
        upsertSetting('theme_background', settings.theme_background),
      ]);

      setSettings((s) => ({ ...s, logo_url: logoUrl }));
      applyTheme(settings.theme_primary, settings.theme_text, settings.theme_background);
      setAlert({ type: 'success', message: t('saveSuccess') });
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleResetColors = () => {
    setSettings((s) => ({
      ...s,
      theme_primary: DEFAULT_THEME.primary,
      theme_text: DEFAULT_THEME.text,
      theme_background: DEFAULT_THEME.background,
    }));
    previewTheme(DEFAULT_THEME.primary, DEFAULT_THEME.text, DEFAULT_THEME.background);
  };

  const testGemini = async () => {
    setTesting(true);
    setAlert(null);
    try {
      const res = await fetch('/api/settings/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: settings.gemini_api_key }),
      });
      const json = await res.json();
      setAlert(
        json.ok
          ? { type: 'success', message: t('testSuccess') }
          : { type: 'error', message: `${t('testFailed')}: ${json.error ?? ''}` }
      );
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  };

  const portalUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(portalUrl)}`;

  if (loading) return <p className="text-slate-400">{t('loading')}</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--c-teal-900)]">⚙️ {t('settingsTitle')}</h1>
        <p className="text-slate-500">{t('settingsSubtitle')}</p>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} />}

      <Card>
        <h3 className="font-bold text-[var(--c-teal-900)] mb-3">🎨 {t('siteColors')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1">{t('primaryColor')}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.theme_primary}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, theme_primary: e.target.value }));
                  previewTheme(e.target.value, settings.theme_text, settings.theme_background);
                }}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <span className="text-xs text-slate-500">{settings.theme_primary}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1">{t('textColor')}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.theme_text}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, theme_text: e.target.value }));
                  previewTheme(settings.theme_primary, e.target.value, settings.theme_background);
                }}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <span className="text-xs text-slate-500">{settings.theme_text}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1">{t('backgroundColor')}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.theme_background}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, theme_background: e.target.value }));
                  previewTheme(settings.theme_primary, settings.theme_text, e.target.value);
                }}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <span className="text-xs text-slate-500">{settings.theme_background}</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleResetColors}
          className="mt-3 text-xs font-bold text-slate-500 hover:underline"
          type="button"
        >
          {t('resetDefaultColors')}
        </button>
      </Card>

      <Card>
        <h3 className="font-bold text-[var(--c-teal-900)] mb-3">{t('logoUpload')}</h3>
        <div className="flex items-center gap-4">
          {settings.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo_url} alt="logo" className="h-16 w-16 object-contain rounded-lg border" />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-[var(--c-teal-900)] mb-3">{t('aiAssistantName')}</h3>
        <FormField
          label={t('aiAssistantName')}
          type="text"
          value={settings.ai_assistant_name}
          onChange={(v: string) => setSettings((s) => ({ ...s, ai_assistant_name: v }))}
          placeholder={t('aiAssistantName')}
        />
        <div className="mt-3">
          <label className="block text-sm font-bold text-slate-600 mb-1">{t('aiInstructions')}</label>
          <textarea
            value={settings.ai_instructions}
            onChange={(e) => setSettings((s) => ({ ...s, ai_instructions: e.target.value }))}
            rows={4}
            className="w-full border rounded-xl p-3 text-sm"
          />
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-[var(--c-teal-900)] mb-3">{t('geminiApiKey')}</h3>
        <FormField
          label={t('geminiApiKey')}
          type="password"
          value={settings.gemini_api_key}
          onChange={(v: string) => setSettings((s) => ({ ...s, gemini_api_key: v }))}
          placeholder="AIza..."
        />
        <button
          onClick={testGemini}
          disabled={testing || !settings.gemini_api_key}
          className="mt-3 bg-slate-100 text-slate-700 font-bold rounded-xl px-4 py-2 text-sm disabled:opacity-50"
        >
          {testing ? t('loading') : t('testConnection')}
        </button>
      </Card>

      <Card>
        <h3 className="font-bold text-[var(--c-teal-900)] mb-3">{t('voiceLink')}</h3>
        <FormField
          label={t('voiceLink')}
          type="text"
          value={settings.voice_recording_link}
          onChange={(v: string) => setSettings((s) => ({ ...s, voice_recording_link: v }))}
          placeholder="https://..."
        />
      </Card>

      <Card>
        <h3 className="font-bold text-[var(--c-teal-900)] mb-3">{t('qrCodeTitle')}</h3>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrSrc} alt="QR code" className="rounded-lg border" />
        <p className="text-xs text-slate-400 mt-2">{portalUrl}</p>
      </Card>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-[var(--c-teal-700)] text-white font-bold rounded-xl px-6 py-3 disabled:opacity-50"
      >
        {saving ? t('loading') : t('saveSettings')}
      </button>
    </div>
  );
}
