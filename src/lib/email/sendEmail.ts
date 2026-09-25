import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface EmailConfig {
  apiKey: string;
  from: string;
}

const DEFAULT_FROM = 'بوابة خورفكان الإدارية <no-reply@khorfakkan-portal.com>';

export function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^(.*)<(.+)>$/);
  if (match) {
    return {
      name: match[1].trim().replace(/^"|"$/g, '') || 'بوابة خورفكان',
      email: match[2].trim(),
    };
  }
  return { name: 'بوابة خورفكان', email: from.trim() };
}

async function getEmailConfig(): Promise<EmailConfig | null> {
  // مفتاح Brevo مخزّن في app_secrets (جدول محمي، الأدمن بس) مش app_settings العام
  const [{ data: secretRows }, { data: settingRows }] = await Promise.all([
    supabaseAdmin.from('app_secrets').select('key, value').eq('key', 'brevo_api_key'),
    supabaseAdmin.from('app_settings').select('key, value').eq('key', 'email_from_address'),
  ]);

  const apiKey = (secretRows?.[0]?.value as string | null) || '';
  const from = (settingRows?.[0]?.value as string | null) || '';

  if (!apiKey) return null;
  return { apiKey, from: from || DEFAULT_FROM };
}

export async function sendEmailVia(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  const sender = parseSender(from || DEFAULT_FROM);
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: json.message || 'فشل إرسال الإيميل' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  if (!to) return { ok: false, error: 'لا يوجد بريد إلكتروني للمستلم' };

  const config = await getEmailConfig();
  if (!config) return { ok: false, error: 'لم يتم إعداد مفتاح خدمة الإيميل بعد' };

  return sendEmailVia(config.apiKey, config.from, to, subject, html);
}
