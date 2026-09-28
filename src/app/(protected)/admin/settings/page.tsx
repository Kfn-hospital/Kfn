'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import EmojiPicker from '@/components/ui/EmojiPicker';
import type { RequestCategory, Room } from '@/types/database';
import {
  DEFAULT_BOOKING_POLICY_MESSAGE_AR,
  DEFAULT_BOOKING_POLICY_MESSAGE_EN,
} from '@/lib/bookingPolicy';
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
  site_name_ar: string;
  site_name_en: string;
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
  icon_emoji_colors: string;
  icon_emoji_language: string;
  icon_emoji_logout: string;
  icon_emoji_darkmode: string;
  icon_emoji_lightmode: string;
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
  booking_notify_email: string;
  booking_approved_message: string;
  booking_rejected_message: string;
  booking_cancelled_message: string;
}

const DEFAULTS: Settings = {
  logo_url: '',
  site_name_ar: '',
  site_name_en: '',
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
  icon_emoji_colors: '🎨',
  icon_emoji_language: '🌐',
  icon_emoji_logout: '🚪',
  icon_emoji_darkmode: '🌙',
  icon_emoji_lightmode: '☀️',
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
  booking_notify_email: '',
  booking_approved_message: '',
  booking_rejected_message: '',
  booking_cancelled_message: '',
};

const COLOR_ICON_OPTIONS = ['🎨', '🖌️', '🖍️', '🌈', '🎭', '✨'];
const LANGUAGE_ICON_OPTIONS = ['🌐', '🌍', '🌎', '🗣️', '🔤', '📝'];
const DARKMODE_ICON_OPTIONS = ['🌙', '🌚', '🌑', '🌘', '⭐', '🌃'];
const LIGHTMODE_ICON_OPTIONS = ['☀️', '🌞', '💡', '🔆', '🌤️', '⚡'];
const LOGOUT_ICON_OPTIONS = ['🚪', '🔓', '👋', '🚶', '⏏️', '➡️'];
const ASSISTANT_ICON_OPTIONS = ['🤖', '🧠', '💬', '🗨️', '🎧', '⚡', '👨‍💼', '👩‍💼', '🔷', '💡'];

export default function SettingsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const supabase = createClient();

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [assistantIconFile, setAssistantIconFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [lastEmailError, setLastEmailError] = useState('');
  const [categories, setCategories] = useState<RequestCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryNameEn, setNewCategoryNameEn] = useState('');
  const [newCategoryDept, setNewCategoryDept] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryNameEn, setEditCategoryNameEn] = useState('');
  const [editCategoryDept, setEditCategoryDept] = useState('');
  const [savingCategoryEdit, setSavingCategoryEdit] = useState(false);
  const [roomPolicies, setRoomPolicies] = useState<
    { id: string; name: string; name_en: string | null; message: string; message_en: string; saving: boolean }[]
  >([]);
  const [roomPolicyError, setRoomPolicyError] = useState('');
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
      const { data: rm } = await supabase.from('room_managers').select('room_id').eq('user_id', user.id).limit(1);
      const isRoomManager = profile?.role === 'room_manager' || (rm ?? []).length > 0;
      if (profile?.role !== 'admin' && !isRoomManager) {
        router.push('/dashboard');
        return;
      }
      setMyRole(profile?.role ?? (isRoomManager ? 'room_manager' : null));
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

  async function loadRoomPolicies() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let query = supabase
      .from('rooms')
      .select('id, name, name_en, booking_policy_message, booking_policy_message_en')
      .order('name');
    if (myRole !== 'admin' && user) {
      const { data: rm } = await supabase.from('room_managers').select('room_id').eq('user_id', user.id);
      const roomIds = (rm ?? []).map((r) => r.room_id);
      if (!roomIds.length) {
        setRoomPolicies([]);
        return;
      }
      query = query.in('id', roomIds);
    }
    const { data } = await query;
    setRoomPolicies(
      ((data as Partial<Room>[]) ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        name_en: r.name_en ?? null,
        message: r.booking_policy_message || '',
        message_en: r.booking_policy_message_en || '',
        saving: false,
      }))
    );
  }

  useEffect(() => {
    if (authorized) loadRoomPolicies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  function updateRoomPolicyField(id: string, field: 'message' | 'message_en', value: string) {
    setRoomPolicies((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function saveRoomPolicy(id: string) {
    const row = roomPolicies.find((r) => r.id === id);
    if (!row) return;
    setRoomPolicyError('');
    setRoomPolicies((prev) => prev.map((r) => (r.id === id ? { ...r, saving: true } : r)));
    const { error } = await supabase
      .from('rooms')
      .update({
        booking_policy_message: row.message.trim() || null,
        booking_policy_message_en: row.message_en.trim() || null,
      })
      .eq('id', id);
    setRoomPolicies((prev) => prev.map((r) => (r.id === id ? { ...r, saving: false } : r)));
    if (error) setRoomPolicyError(error.message);
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    setCategoryError('');
    const { error } = await supabase.from('request_categories').insert({
      name: newCategoryName.trim(),
      name_en: newCategoryNameEn.trim() || null,
      department: newCategoryDept.trim() || null,
    });
    setSavingCategory(false);
    if (error) {
      setCategoryError(error.message);
      return;
    }
    setNewCategoryName('');
    setNewCategoryNameEn('');
    setNewCategoryDept('');
    loadCategories();
  }

  function startEditCategory(c: RequestCategory) {
    setCategoryError('');
    setEditingCategoryId(c.id);
    setEditCategoryName(c.name);
    setEditCategoryNameEn(c.name_en || '');
    setEditCategoryDept(c.department || '');
  }

  function cancelEditCategory() {
    setEditingCategoryId(null);
  }

  async function saveEditCategory() {
    if (!editingCategoryId || !editCategoryName.trim()) return;
    setSavingCategoryEdit(true);
    setCategoryError('');
    const { error } = await supabase
      .from('request_categories')
      .update({
        name: editCategoryName.trim(),
        name_en: editCategoryNameEn.trim() || null,
        department: editCategoryDept.trim() || null,
      })
      .eq('id', editingCategoryId);
    setSavingCategoryEdit(false);
    if (error) {
      setCategoryError(error.message);
      return;
    }
    setEditingCategoryId(null);
    loadCategories();
  }

  async function deleteCategory(id: string) {
    if (!window.confirm(t('categoryDeleteConfirm'))) return;
    setCategoryError('');
    const deletedName = categories.find((c) => c.id === id)?.name || id;
    const { error } = await supabase.from('request_categories').delete().eq('id', id);
    if (error) {
      setCategoryError(t('categoryInUseError'));
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from('audit_log').insert({
      action: 'category_deleted',
      details: `تم حذف تصنيف: ${deletedName}`,
      performed_by: user?.id ?? null,
    });
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
        upsertSetting('site_name_ar', settings.site_name_ar),
        upsertSetting('site_name_en', settings.site_name_en),
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
        upsertSetting('icon_emoji_colors', settings.icon_emoji_colors),
        upsertSetting('icon_emoji_language', settings.icon_emoji_language),
        upsertSetting('icon_emoji_logout', settings.icon_emoji_logout),
        upsertSetting('icon_emoji_darkmode', settings.icon_emoji_darkmode),
        upsertSetting('icon_emoji_lightmode', settings.icon_emoji_lightmode),
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

  const handleSaveBookingNotifications = async () => {
    setSaving(true);
    setAlert(null);
    try {
      await Promise.all([
        upsertSetting('booking_notify_email', settings.booking_notify_email),
        upsertSetting('booking_approved_message', settings.booking_approved_message),
        upsertSetting('booking_rejected_message', settings.booking_rejected_message),
        upsertSetting('booking_cancelled_message', settings.booking_cancelled_message),
      ]);
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
        <h3 className="font-bold text-[var(--c-teal-900)] mb-3">🔔 {t('bookingNotificationsTitle')}</h3>
        <FormField
          label={t('bookingNotifyEmailLabel')}
          type="text"
          value={settings.booking_notify_email}
          onChange={(v: string) => setSettings((s) => ({ ...s, booking_notify_email: v }))}
          placeholder="you@example.com"
        />
        <p className="text-xs text-[var(--c-text-muted)] mt-1">{t('bookingNotifyEmailHint')}</p>

        <div className="mt-3">
          <label className="block text-sm font-bold text-[var(--c-text)] mb-1">{t('bookingApprovedMessageLabel')}</label>
          <textarea
            value={settings.booking_approved_message}
            onChange={(e) => setSettings((s) => ({ ...s, booking_approved_message: e.target.value }))}
            rows={3}
            className="w-full border rounded-xl p-3 text-sm"
            placeholder={t('bookingMessagePlaceholder')}
          />
        </div>

        <div className="mt-3">
          <label className="block text-sm font-bold text-[var(--c-text)] mb-1">{t('bookingRejectedMessageLabel')}</label>
          <textarea
            value={settings.booking_rejected_message}
            onChange={(e) => setSettings((s) => ({ ...s, booking_rejected_message: e.target.value }))}
            rows={3}
            className="w-full border rounded-xl p-3 text-sm"
            placeholder={t('bookingMessagePlaceholder')}
          />
        </div>

        <div className="mt-3">
          <label className="block text-sm font-bold text-[var(--c-text)] mb-1">{t('bookingCancelledMessageLabel')}</label>
          <textarea
            value={settings.booking_cancelled_message}
            onChange={(e) => setSettings((s) => ({ ...s, booking_cancelled_message: e.target.value }))}
            rows={3}
            className="w-full border rounded-xl p-3 text-sm"
            placeholder={t('bookingMessagePlaceholder')}
          />
        </div>

        <p className="text-xs text-[var(--c-text-muted)] mt-2">{t('bookingMessageVarsHint')}</p>

        <button
          onClick={handleSaveBookingNotifications}
          disabled={saving}
          className="mt-3 bg-[var(--c-teal-700)] text-white font-bold rounded-xl px-4 py-2 text-sm disabled:opacity-50"
          type="button"
        >
          {saving ? t('loading') : t('saveSettings')}
        </button>
      </Card>

      <Card>
        <h3 className="font-bold text-[var(--c-teal-900)] mb-1">🔒 {t('roomPolicyTitle')}</h3>
        <p className="text-xs text-[var(--c-text-muted)] mb-3">{t('roomPolicyHint')}</p>
        <Alert type="error" message={roomPolicyError} />
        {roomPolicies.length === 0 ? (
          <p className="text-sm text-[var(--c-text-muted)]">{t('noRoomsToManage')}</p>
        ) : (
          <div className="space-y-4">
            {roomPolicies.map((r) => (
              <div key={r.id} className="bg-[var(--c-surface-muted)] rounded-lg p-3 space-y-2">
                <p className="text-sm font-bold text-[var(--c-text)]">{r.name}{r.name_en ? ` (${r.name_en})` : ''}</p>
                <FormField
                  label={`${t('roomPolicyMessageLabel')} (عربي)`}
                  type="textarea"
                  value={r.message}
                  onChange={(v: string) => updateRoomPolicyField(r.id, 'message', v)}
                  placeholder={DEFAULT_BOOKING_POLICY_MESSAGE_AR}
                />
                <FormField
                  label={`${t('roomPolicyMessageLabel')} (English)`}
                  type="textarea"
                  value={r.message_en}
                  onChange={(v: string) => updateRoomPolicyField(r.id, 'message_en', v)}
                  placeholder={DEFAULT_BOOKING_POLICY_MESSAGE_EN}
                />
                <button
                  onClick={() => saveRoomPolicy(r.id)}
                  disabled={r.saving}
                  className="bg-[var(--c-teal-700)] text-white font-bold rounded-xl px-4 py-2 text-xs disabled:opacity-50"
                  type="button"
                >
                  {r.saving ? t('loading') : t('save')}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {myRole === 'admin' && (
        <>
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
        <h3 className="font-bold text-[var(--c-teal-900)] mb-3">🏷️ {t('portalIdentityTitle')}</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label={t('siteNameArLabel')}
              type="text"
              value={settings.site_name_ar}
              onChange={(v: string) => setSettings((s) => ({ ...s, site_name_ar: v }))}
              placeholder={t('appName')}
            />
            <FormField
              label={t('siteNameEnLabel')}
              type="text"
              value={settings.site_name_en}
              onChange={(v: string) => setSettings((s) => ({ ...s, site_name_en: v }))}
              placeholder="Khorfakkan Admin Portal"
            />
          </div>
          <p className="text-xs text-[var(--c-text-muted)]">{t('siteNameHint')}</p>

          <div>
            <label className="block text-sm font-bold text-[var(--c-text)] mb-1">{t('logoUpload')}</label>
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
          </div>
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
            categories.map((c) =>
              editingCategoryId === c.id ? (
                <div
                  key={c.id}
                  className="bg-[var(--c-surface-muted)] rounded-lg px-3 py-2 space-y-2"
                >
                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="flex-1 min-w-[140px]">
                      <FormField
                        label={`${t('categoryName')} (عربي)`}
                        type="text"
                        value={editCategoryName}
                        onChange={setEditCategoryName}
                        placeholder={t('categoryName')}
                      />
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <FormField
                        label={`${t('categoryName')} (English)`}
                        type="text"
                        value={editCategoryNameEn}
                        onChange={setEditCategoryNameEn}
                        placeholder="Category name"
                      />
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <FormField
                        label={t('userDepartment')}
                        type="text"
                        value={editCategoryDept}
                        onChange={setEditCategoryDept}
                        placeholder={t('userDepartment')}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={saveEditCategory}
                      disabled={savingCategoryEdit || !editCategoryName.trim()}
                      className="bg-[var(--c-teal-700)] text-white font-bold rounded-xl px-4 py-2 text-xs disabled:opacity-50"
                      type="button"
                    >
                      {savingCategoryEdit ? t('loading') : t('save')}
                    </button>
                    <button
                      onClick={cancelEditCategory}
                      className="text-[var(--c-text-muted)] text-xs font-bold hover:underline"
                      type="button"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={c.id}
                  className="flex items-center justify-between bg-[var(--c-surface-muted)] rounded-lg px-3 py-2"
                >
                  <div>
                    <span className="text-sm font-bold text-[var(--c-text)]">{c.name}</span>
                    {c.name_en && (
                      <span className="text-xs text-[var(--c-text-muted)] mr-2">({c.name_en})</span>
                    )}
                    {c.department && (
                      <span className="text-xs text-[var(--c-text-muted)] mr-2">— {c.department}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => startEditCategory(c)}
                      className="text-[var(--c-teal-700)] text-xs font-bold hover:underline"
                      type="button"
                    >
                      ✏️ {t('edit')}
                    </button>
                    <button
                      onClick={() => deleteCategory(c.id)}
                      className="text-red-500 text-xs font-bold hover:underline"
                      type="button"
                    >
                      🗑️ {t('delete')}
                    </button>
                  </div>
                </div>
              )
            )
          )}
        </div>
        <Alert type="error" message={categoryError} />
        <div className="flex items-end gap-3 flex-wrap mt-2">
          <div className="flex-1 min-w-[160px]">
            <FormField
              label={`${t('categoryName')} (عربي)`}
              type="text"
              value={newCategoryName}
              onChange={setNewCategoryName}
              placeholder={t('categoryName')}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <FormField
              label={`${t('categoryName')} (English)`}
              type="text"
              value={newCategoryNameEn}
              onChange={setNewCategoryNameEn}
              placeholder="Category name"
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
        <h3 className="font-bold text-[var(--c-teal-900)] mb-1">🎛️ {t('iconControlTitle')}</h3>
        <p className="text-xs text-[var(--c-text-muted)] mb-3">{t('iconControlHint')}</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 bg-[var(--c-surface-muted)] rounded-xl p-3 flex-wrap">
            <EmojiPicker
              value={settings.icon_emoji_colors}
              onChange={(v) => setSettings((s) => ({ ...s, icon_emoji_colors: v }))}
              options={COLOR_ICON_OPTIONS}
            />
            <p className="text-sm font-bold text-[var(--c-text)] flex-1 min-w-[120px]">{t('showColorIcon')}</p>
            <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--c-text-muted)] shrink-0">
              <input
                type="checkbox"
                checked={settings.icon_show_colors !== 'false'}
                onChange={(e) => setSettings((s) => ({ ...s, icon_show_colors: e.target.checked ? 'true' : 'false' }))}
                className="w-4 h-4"
              />
              {t('showColorIcon')}
            </label>
          </div>

          <div className="flex items-center gap-3 bg-[var(--c-surface-muted)] rounded-xl p-3 flex-wrap">
            <EmojiPicker
              value={settings.icon_emoji_language}
              onChange={(v) => setSettings((s) => ({ ...s, icon_emoji_language: v }))}
              options={LANGUAGE_ICON_OPTIONS}
            />
            <p className="text-sm font-bold text-[var(--c-text)] flex-1 min-w-[120px]">{t('showLanguageIcon')}</p>
            <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--c-text-muted)] shrink-0">
              <input
                type="checkbox"
                checked={settings.icon_show_language !== 'false'}
                onChange={(e) => setSettings((s) => ({ ...s, icon_show_language: e.target.checked ? 'true' : 'false' }))}
                className="w-4 h-4"
              />
              {t('showLanguageIcon')}
            </label>
          </div>

          <div className="flex items-center gap-3 bg-[var(--c-surface-muted)] rounded-xl p-3 flex-wrap">
            <EmojiPicker
              value={settings.icon_emoji_darkmode}
              onChange={(v) => setSettings((s) => ({ ...s, icon_emoji_darkmode: v }))}
              options={DARKMODE_ICON_OPTIONS}
              title={t('darkMode')}
            />
            <EmojiPicker
              value={settings.icon_emoji_lightmode}
              onChange={(v) => setSettings((s) => ({ ...s, icon_emoji_lightmode: v }))}
              options={LIGHTMODE_ICON_OPTIONS}
              title={t('lightMode')}
            />
            <p className="text-sm font-bold text-[var(--c-text)] flex-1 min-w-[120px]">{t('showDarkModeIcon')}</p>
            <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--c-text-muted)] shrink-0">
              <input
                type="checkbox"
                checked={settings.icon_show_darkmode !== 'false'}
                onChange={(e) => setSettings((s) => ({ ...s, icon_show_darkmode: e.target.checked ? 'true' : 'false' }))}
                className="w-4 h-4"
              />
              {t('showDarkModeIcon')}
            </label>
          </div>

          <div className="flex items-center gap-3 bg-[var(--c-surface-muted)] rounded-xl p-3 flex-wrap">
            <EmojiPicker
              value={settings.icon_emoji_logout}
              onChange={(v) => setSettings((s) => ({ ...s, icon_emoji_logout: v }))}
              options={LOGOUT_ICON_OPTIONS}
            />
            <p className="text-sm font-bold text-[var(--c-text)] flex-1 min-w-[120px]">{t('showLogoutIcon')}</p>
            <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--c-text-muted)] shrink-0">
              <input
                type="checkbox"
                checked={settings.icon_show_logout !== 'false'}
                onChange={(e) => setSettings((s) => ({ ...s, icon_show_logout: e.target.checked ? 'true' : 'false' }))}
                className="w-4 h-4"
              />
              {t('showLogoutIcon')}
            </label>
          </div>
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
            <EmojiPicker
              value={settings.assistant_icon_emoji}
              onChange={(v) => setSettings((s) => ({ ...s, assistant_icon_emoji: v, assistant_icon_url: '' }))}
              options={ASSISTANT_ICON_OPTIONS}
              className="w-14 h-10 border rounded-xl flex items-center justify-center text-lg hover:bg-[var(--c-surface-muted)]"
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
        </>
      )}
    </div>
  );
}
