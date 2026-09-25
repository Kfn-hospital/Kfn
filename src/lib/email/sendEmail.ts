import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface EmailConfig {
  smtpLogin: string;
  smtpKey: string;
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
  // بيانات SMTP الخاصة بـ Brevo مخزّنة في app_secrets (جدول محمي، الأدمن بس)
  const [{ data: secretRows }, { data: settingRows }] = await Promise.all([
    supabaseAdmin.from('app_secrets').select('key, value').in('key', ['brevo_smtp_login', 'brevo_smtp_key']),
    supabaseAdmin.from('app_settings').select('key, value').eq('key', 'email_from_address'),
  ]);

  let smtpLogin = '';
  let smtpKey = '';
  (secretRows as { key: string; value: string | null }[] | null)?.forEach((row) => {
    if (row.key === 'brevo_smtp_login' && row.value) smtpLogin = row.value;
    if (row.key === 'brevo_smtp_key' && row.value) smtpKey = row.value;
  });
  const from = (settingRows?.[0]?.value as string | null) || '';

  if (!smtpLogin || !smtpKey) return null;
  return { smtpLogin, smtpKey, from: from || DEFAULT_FROM };
}

export async function sendEmailVia(
  smtpLogin: string,
  smtpKey: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  const sender = parseSender(from || DEFAULT_FROM);
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: smtpLogin, pass: smtpKey },
    });

    await transporter.sendMail({
      from: `"${sender.name}" <${sender.email}>`,
      to,
      subject,
      html,
    });

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
  if (!config) return { ok: false, error: 'لم يتم إعداد بيانات SMTP الخاصة بالإيميل بعد' };

  return sendEmailVia(config.smtpLogin, config.smtpKey, config.from, to, subject, html);
}
