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
  icon_show_colors: string;
  icon_show_language: string;
  icon_show_darkmode: string;
  icon_show_logout: string;
  icon_show_assistant: string;
  assistant_icon_emoji: string;
  assistant_icon_url: string;
}

const DEFAULTS: Settings = {
  logo_url: '',
  ai_assistant_name: '',
  ai_instructions: '',
  gemini_api_key: '',
  voice_recording_link: '',
  theme_primary: DEFAULT_THEME.primary,
  theme_text: DEFAULT_THEME.text,
  icon_show_colors: 'true',
  icon_show_language: 'true',
  icon_show_darkmode: 'true',
  icon_show_logout: 'true',
  icon_show_assistant: 'true',
  assistant_icon_emoji: '🤖',
  assistant_icon_url: '',
};

export default function SettingsPage() {
  const { t } = useLanguage();
  const supabase = createClient();

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [assistantIconFile, setAssistantIconFile] = useState<File | null>(null);
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

  const previewTheme = (p: string, tC: string) => applyTheme(p, tC);

  const handleSave = async () => {
    setSaving(true);
    setAlert(null);
    try {
      let logoUrl = settings.logo_url;
      let assistantIconUrl = settings.assistant_icon_url;

      if (logoFile) {
        const path = `logo-${Date.now()}-${logoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('branding')
          .upload(path, logoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: pub } = supabase.storage.from('branding').getPublicUrl(path);
        logoUrl = pub.publicUrl;
      }

      if (assistantIconFile) {
        const path = `assistant-icon-${Date.now()}-${assistantIconFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('branding')
          .upload(path, assistantIconFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: pub } = supabase.storage.from('branding').getPublicUrl(path);
        assistantIconUrl = pub.publicUrl;
      }

      await Promise.all([
        upsertSetting('logo_url', logoUrl),
        upsertSetting('ai_assistant_name', settings.ai_assistant_name),
        upsertSetting('ai_instructions', settings.ai_instructions),
        upsertSetting('gemini_api_key', settings.gemini_api_key),
        upsertSetting('voice_recording_link', settings.voice_recording_link),
        upsertSetting('theme_primary', settings.theme_primary),
        upsertSetting('theme_text', settings.theme_text),
        upsertSetting('icon_show_colors', settings.icon_show_colors),
        upsertSetting('icon_show_language', settings.icon_show_language),
        upsertSetting('icon_show_darkmode', settings.icon_show_darkmode),
        upsertSetting('icon_show_logout', settings.icon_show_logout),
        upsertSetting('icon_show_assistant', settings.icon_show_assistant),
        upsertSetting('assistant_icon_emoji', settings.assistant_icon_emoji),
        upsertSetting('assistant_icon_url', assistantIconUrl),
      ]);

      setSettings((s) => ({ ...s, logo_url: logoUrl, assistant_icon_url: assistantIconUrl }));
      applyTheme(settings.theme_primary, settings.theme_text);
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
    }));
    previewTheme(DEFAULT_THEME.primary, DEFAULT_THEME.text);
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
  const assistantUrl = `${portalUrl}/assistant`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(assistantUrl)}`;

  if (loading) return <p className="text-[var(--c-text-muted)]">{t('loading')}</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--c-teal-900)]">⚙️ {t('settingsTitle')}</h1>
        <p className="text-[var(--c-text-muted)]">{t('settingsSubtitle')}</p>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} />}

      <Card>
        <h3 className="font-bold text-[var(--c-teal-900)] mb-3">🎨 {t('siteColors')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-[var(--c-text)] mb-1">{t('primaryColor')}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.theme_primary}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, theme_primary: e.target.value }));
                  previewTheme(e.target.value, settings.theme_text);
                }}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <span className="text-xs text-[var(--c-text-muted)]">{settings.theme_primary}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--c-text)] mb-1">{t('textColor')}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.theme_text}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, theme_text: e.target.value }));
                  previewTheme(settings.theme_primary, e.target.value);
                }}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <span className="text-xs text-[var(--c-text-muted)]">{settings.theme_text}</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleResetColors}
          className="mt-3 text-xs font-bold text-[var(--c-text-muted)] hover:underline"
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
          <label className="block text-sm font-bold text-[var(--c-text)] mb-1">{t('aiInstructions')}</label>
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
          className="mt-3 bg-[var(--c-surface-muted)] text-[var(--c-text)] font-bold rounded-xl px-4 py-2 text-sm disabled:opacity-50"
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
        <h3 className="font-bold text-[var(--c-teal-900)] mb-3">🎛️ {t('iconControlTitle')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--c-text)]">
            <input
              type="checkbox"
              checked={settings.icon_show_colors !== 'false'}
              onChange={(e) => setSettings((s) => ({ ...s, icon_show_colors: e.target.checked ? 'true' : 'false' }))}
              className="w-4 h-4"
            />
            🎨 {t('showColorIcon')}
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--c-text)]">
            <input
              type="checkbox"
              checked={settings.icon_show_language !== 'false'}
              onChange={(e) => setSettings((s) => ({ ...s, icon_show_language: e.target.checked ? 'true' : 'false' }))}
              className="w-4 h-4"
            />
            🌐 {t('showLanguageIcon')}
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--c-text)]">
            <input
              type="checkbox"
              checked={settings.icon_show_darkmode !== 'false'}
              onChange={(e) => setSettings((s) => ({ ...s, icon_show_darkmode: e.target.checked ? 'true' : 'false' }))}
              className="w-4 h-4"
            />
            🌙 {t('showDarkModeIcon')}
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--c-text)]">
            <input
              type="checkbox"
              checked={settings.icon_show_logout !== 'false'}
              onChange={(e) => setSettings((s) => ({ ...s, icon_show_logout: e.target.checked ? 'true' : 'false' }))}
              className="w-4 h-4"
            />
            🚪 {t('showLogoutIcon')}
          </label>
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-[var(--c-teal-900)] mb-3">🤖 {t('assistantIconTitle')}</h3>
        <label className="flex items-center gap-2 text-sm text-[var(--c-text)] mb-4">
          <input
            type="checkbox"
            checked={settings.icon_show_assistant !== 'false'}
            onChange={(e) => setSettings((s) => ({ ...s, icon_show_assistant: e.target.checked ? 'true' : 'false' }))}
            className="w-4 h-4"
          />
          {t('showAssistantIcon')}
        </label>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-full bg-[var(--c-teal-700)] text-white flex items-center justify-center text-2xl overflow-hidden shrink-0">
            {settings.assistant_icon_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.assistant_icon_url} alt="assistant icon" className="w-full h-full object-cover" />
            ) : (
              settings.assistant_icon_emoji || '🤖'
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--c-text)] mb-1">{t('assistantIconEmojiLabel')}</label>
            <input
              type="text"
              value={settings.assistant_icon_emoji}
              onChange={(e) => setSettings((s) => ({ ...s, assistant_icon_emoji: e.target.value, assistant_icon_url: '' }))}
              maxLength={4}
              className="w-20 border rounded-xl px-3 py-2 text-center text-lg"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-sm font-bold text-[var(--c-text)] mb-1">{t('assistantIconUploadLabel')}</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setAssistantIconFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <p className="text-xs text-[var(--c-text-muted)] mt-1">{t('assistantIconUploadHint')}</p>
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-[var(--c-teal-900)] mb-3">{t('qrCodeTitle')}</h3>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrSrc} alt="QR code" className="rounded-lg border" />
        <p className="text-xs text-[var(--c-text-muted)] mt-2">{assistantUrl}</p>
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
