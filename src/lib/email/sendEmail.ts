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

async function getEmailConfig(): Promise<EmailConfig | null> {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .in('key', ['resend_api_key', 'email_from_address']);

  let apiKey = '';
  let from = '';
  (data as { key: string; value: string | null }[] | null)?.forEach((row) => {
    if (row.key === 'resend_api_key' && row.value) apiKey = row.value;
    if (row.key === 'email_from_address' && row.value) from = row.value;
  });

  if (!apiKey) return null;
  return { apiKey, from: from || 'Khorfakkan Portal <onboarding@resend.dev>' };
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  if (!to) return { ok: false, error: 'لا يوجد بريد إلكتروني للمستلم' };

  const config = await getEmailConfig();
  if (!config) return { ok: false, error: 'لم يتم إعداد مفتاح خدمة الإيميل بعد' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: config.from, to: [to], subject, html }),
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
