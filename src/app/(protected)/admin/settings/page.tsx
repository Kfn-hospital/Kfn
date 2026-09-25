'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import type { RequestCategory } from '@/types/database';
import {
  applyTheme,
  DEFAULT_THEME,
  applyBookingColors,
  applySidebarHover,
  DEFAULT_BOOKING_COLORS,
  DEFAULT_SIDEBAR_HOVER,
} from '@/lib/theme/colorUtils';

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
  booking_color_pending: string;
  booking_color_approved: string;
  booking_color_rejected: string;
  booking_color_cancelled: string;
  sidebar_hover_color: string;
  brevo_smtp_login: string;
  brevo_smtp_key: string;
  email_from_address: string;
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
  booking_color_pending: DEFAULT_BOOKING_COLORS.pending,
  booking_color_approved: DEFAULT_BOOKING_COLORS.approved,
  booking_color_rejected: DEFAULT_BOOKING_COLORS.rejected,
  booking_color_cancelled: DEFAULT_BOOKING_COLORS.cancelled,
  sidebar_hover_color: DEFAULT_SIDEBAR_HOVER,
  brevo_smtp_login: '',
  brevo_smtp_key: '',
  email_from_address: '',
};

export default function SettingsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const supabase = createClient();

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [assistantIconFile, setAssistantIconFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [lastEmailError, setLastEmailError] = useState('');
  const [categories, setCategories] = useState<RequestCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDept, setNewCategoryDept] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      setAuthorized(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authorized) return;
    (async () => {
      const [{ data }, { data: secrets }] = await Promise.all([
        supabase.from('app_settings').select('key, value'),
        supabase.from('app_secrets').select('key, value'),
      ]);
      const merged = { ...DEFAULTS };
      data?.forEach((row: { key: string; value: unknown }) => {
        if (row.key in merged && row.value) (merged as Record<string, unknown>)[row.key] = row.value;
        if (row.key === 'last_email_error' && row.value) setLastEmailError(String(row.value));
      });
      // مفاتيح Gemini و Brevo السرية جاية من جدول app_secrets المحمي (أدمن بس)
      secrets?.forEach((row: { key: string; value: unknown }) => {
        if (row.key in merged && row.value) (merged as Record<string, unknown>)[row.key] = row.value;
      });
      setSettings(merged);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  async function loadCategories() {
    const { data } = await supabase.from('request_categories').select('*').order('name');
    setCategories((data as RequestCategory[]) || []);
  }

  useEffect(() => {
    if (authorized) loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    setCategoryError('');
    const { error } = await supabase
      .from('request_categories')
      .insert({ name: newCategoryName.trim(), department: newCategoryDept.trim() || null });
    setSavingCategory(false);
    if (error) {
      setCategoryError(error.message);
      return;
    }
    setNewCategoryName('');
    setNewCategoryDept('');
    loadCategories();
  }

  async function deleteCategory(id: string) {
    if (!window.confirm(t('categoryDeleteConfirm'))) return;
    setCategoryError('');
    const { error } = await supabase.from('request_categories').delete().eq('id', id);
    if (error) {
      setCategoryError(t('categoryInUseError'));
      return;
    }
    loadCategories();
  }

  const upsertSetting = async (key: string, value: unknown) => {
    const { error } = await supabase.from('app_settings').upsert({ key, value });
    if (error) throw error;
  };

  const upsertSecret = async (key: string, value: unknown) => {
    const { error } = await supabase.from('app_secrets').upsert({ key, value });
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
        upsertSecret('gemini_api_key', settings.gemini_api_key),
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
        upsertSetting('booking_color_pending', settings.booking_color_pending),
        upsertSetting('booking_color_approved', settings.booking_color_approved),
        upsertSetting('booking_color_rejected', settings.booking_color_rejected),
        upsertSetting('booking_color_cancelled', settings.booking_color_cancelled),
        upsertSetting('sidebar_hover_color', settings.sidebar_hover_color),
        upsertSecret('brevo_smtp_login', settings.brevo_smtp_login),
        upsertSecret('brevo_smtp_key', settings.brevo_smtp_key),
        upsertSetting('email_from_address', settings.email_from_address),
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

  const handleResetBookingColors = () => {
    setSettings((s) => ({
      ...s,
      booking_color_pending: DEFAULT_BOOKING_COLORS.pending,
      booking_color_approved: DEFAULT_BOOKING_COLORS.approved,
      booking_color_rejected: DEFAULT_BOOKING_COLORS.rejected,
      booking_color_cancelled: DEFAULT_BOOKING_COLORS.cancelled,
      sidebar_hover_color: DEFAULT_SIDEBAR_HOVER,
    }));
    applyBookingColors(DEFAULT_BOOKING_COLORS);
    applySidebarHover(DEFAULT_SIDEBAR_HOVER);
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

  const testEmail = async () => {
    setTestingEmail(true);
    setAlert(null);
    try {
      const res = await fetch('/api/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpLogin: settings.brevo_smtp_login,
          smtpKey: settings.brevo_smtp_key,
          from: settings.email_from_address,
          to: testEmailRecipient,
        }),
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
      setTestingEmail(false);
    }
  };

  const portalUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const assistantUrl = `${portalUrl}/assistant`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(assistantUrl)}`;

  if (!authorized) return null;
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
        <h3 className="font-bold text-[var(--c-teal-900)] mb-3">🎨 {t('bookingColorsTitle')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-[var(--c-text)] mb-1">{t('colorPending')}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.booking_color_pending}
                onChange={(e) => {
                  const next = { ...settings, booking_color_pending: e.target.value };
                  setSettings(next);
                  applyBookingColors({
                    pending: next.booking_color_pending,
                    approved: next.booking_color_approved,
                    rejected: next.booking_color_rejected,
                    cancelled: next.booking_color_cancelled,
                  });
                }}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <span className="text-xs text-[var(--c-text-muted)]">{settings.booking_color_pending}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--c-text)] mb-1">{t('colorApproved')}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.booking_color_approved}
                onChange={(e) => {
                  const next = { ...settings, booking_color_approved: e.target.value };
                  setSettings(next);
                  applyBookingColors({
                    pending: next.booking_color_pending,
                    approved: next.booking_color_approved,
                    rejected: next.booking_color_rejected,
                    cancelled: next.booking_color_cancelled,
                  });
                }}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <span className="text-xs text-[var(--c-text-muted)]">{settings.booking_color_approved}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--c-text)] mb-1">{t('colorRejected')}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.booking_color_rejected}
                onChange={(e) => {
                  const next = { ...settings, booking_color_rejected: e.target.value };
                  setSettings(next);
                  applyBookingColors({
                    pending: next.booking_color_pending,
                    approved: next.booking_color_approved,
                    rejected: next.booking_color_rejected,
                    cancelled: next.booking_color_cancelled,
                  });
                }}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <span className="text-xs text-[var(--c-text-muted)]">{settings.booking_color_rejected}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--c-text)] mb-1">{t('colorCancelled')}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.booking_color_cancelled}
                onChange={(e) => {
                  const next = { ...settings, booking_color_cancelled: e.target.value };
                  setSettings(next);
                  applyBookingColors({
                    pending: next.booking_color_pending,
                    approved: next.booking_color_approved,
                    rejected: next.booking_color_rejected,
                    cancelled: next.booking_color_cancelled,
                  });
                }}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <span className="text-xs text-[var(--c-text-muted)]">{settings.booking_color_cancelled}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--c-text)] mb-1">{t('sidebarHoverColorLabel')}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.sidebar_hover_color}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, sidebar_hover_color: e.target.value }));
                  applySidebarHover(e.target.value);
                }}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <span className="text-xs text-[var(--c-text-muted)]">{settings.sidebar_hover_color}</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleResetBookingColors}
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
        <h3 className="font-bold text-[var(--c-teal-900)] mb-3">🏷️ {t('categoriesTitle')}</h3>
        <div className="space-y-2 mb-4">
          {categories.length === 0 ? (
            <p className="text-sm text-[var(--c-text-muted)]">{t('noCategories')}</p>
          ) : (
            categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between bg-[var(--c-surface-muted)] rounded-lg px-3 py-2"
              >
                <div>
                  <span className="text-sm font-bold text-[var(--c-text)]">{c.name}</span>
                  {c.department && (
                    <span className="text-xs text-[var(--c-text-muted)] mr-2">— {c.department}</span>
                  )}
                </div>
                <button
                  onClick={() => deleteCategory(c.id)}
                  className="text-red-500 text-xs font-bold hover:underline"
                  type="button"
                >
                  🗑️ {t('delete')}
                </button>
              </div>
            ))
          )}
        </div>
        <Alert type="error" message={categoryError} />
        <div className="flex items-end gap-3 flex-wrap mt-2">
          <div className="flex-1 min-w-[160px]">
            <FormField
              label={t('categoryName')}
              type="text"
              value={newCategoryName}
              onChange={setNewCategoryName}
              placeholder={t('categoryName')}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <FormField
              label={t('userDepartment')}
              type="text"
              value={newCategoryDept}
              onChange={setNewCategoryDept}
              placeholder={t('userDepartment')}
            />
          </div>
          <button
            onClick={addCategory}
            disabled={savingCategory || !newCategoryName.trim()}
            className="bg-[var(--c-teal-700)] text-white font-bold rounded-xl px-4 py-2 text-sm disabled:opacity-50"
            type="button"
          >
            {savingCategory ? t('loading') : t('addCategory')}
          </button>
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-[var(--c-teal-900)] mb-3">📧 {t('emailSettingsTitle')}</h3>
        <FormField
          label={t('brevoSmtpLoginLabel')}
          type="text"
          value={settings.brevo_smtp_login}
          onChange={(v: string) => setSettings((s) => ({ ...s, brevo_smtp_login: v }))}
          placeholder="xxxxxx001@smtp-brevo.com"
        />
        <div className="mt-3">
          <FormField
            label={t('brevoSmtpKeyLabel')}
            type="password"
            value={settings.brevo_smtp_key}
            onChange={(v: string) => setSettings((s) => ({ ...s, brevo_smtp_key: v }))}
            placeholder="xsmtpsib-..."
          />
        </div>
        <div className="mt-3">
          <FormField
            label={t('emailFromLabel')}
            type="text"
            value={settings.email_from_address}
            onChange={(v: string) => setSettings((s) => ({ ...s, email_from_address: v }))}
            placeholder="بوابة خورفكان الإدارية <no-reply@yourdomain.com>"
          />
        </div>
        <div className="mt-3 flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <FormField
              label={t('testEmailRecipientLabel')}
              type="text"
              value={testEmailRecipient}
              onChange={(v: string) => setTestEmailRecipient(v)}
              placeholder="you@example.com"
            />
          </div>
          <button
            onClick={testEmail}
            disabled={testingEmail || !settings.brevo_smtp_login || !settings.brevo_smtp_key || !testEmailRecipient}
            className="bg-[var(--c-surface-muted)] text-[var(--c-text)] font-bold rounded-xl px-4 py-2 text-sm disabled:opacity-50"
            type="button"
          >
            {testingEmail ? t('loading') : t('sendTestEmail')}
          </button>
        </div>
        <p className="text-xs text-[var(--c-text-muted)] mt-2">{t('emailDomainNote')}</p>
        {lastEmailError && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">
            <strong>{t('lastEmailErrorLabel')}:</strong> {lastEmailError}
          </div>
        )}
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
