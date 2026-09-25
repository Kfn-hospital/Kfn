import { createClient } from '@supabase/supabase-js';
import { sendEmail } from './sendEmail';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function wrapEmail(title: string, bodyHtml: string) {
  return `
    <div style="font-family: Tahoma, Arial, sans-serif; direction: rtl; text-align: right; color: #0f172a; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #0f766e; margin-bottom: 16px;">${title}</h2>
      ${bodyHtml}
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #64748b;">بوابة خورفكان الإدارية</p>
    </div>
  `;
}

// بنسجل آخر خطأ إرسال إيميل في app_settings عشان الأدمن يقدر يشوفه من صفحة
// الإعدادات من غير ما يحتاج يدخل على لوجات Vercel. بننضف السجل عند أي نجاح.
async function logEmailResult(context: string, result: { ok: boolean; error?: string }) {
  if (result.ok) {
    await supabaseAdmin.from('app_settings').upsert({ key: 'last_email_error', value: '' });
    return;
  }
  const message = `[${context}] ${result.error || 'خطأ غير معروف'} — ${new Date().toISOString()}`;
  console.error('Email send failed:', message);
  await supabaseAdmin.from('app_settings').upsert({ key: 'last_email_error', value: message });
}

export async function notifyRequestCreated(requestId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: reqRow } = await supabaseAdmin
      .from('requests')
      .select('title, description, created_by, request_categories(name)')
      .eq('id', requestId)
      .single();
    if (!reqRow) return { ok: false, error: 'الطلب غير موجود' };

    const { data: creator } = await supabaseAdmin
      .from('profiles')
      .select('name, email')
      .eq('id', reqRow.created_by)
      .single();
    if (!creator?.email) return { ok: false, error: 'لا يوجد بريد إلكتروني لصاحب الطلب' };

    const categoryName =
      (reqRow as { request_categories?: { name?: string } | null }).request_categories?.name || '';

    const body = `
      <p>مرحبًا ${creator.name || ''}،</p>
      <p>تم تسجيل طلبك التالي في مكتب التنسيق والمتابعة:</p>
      <p><strong>العنوان:</strong> ${reqRow.title}</p>
      ${categoryName ? `<p><strong>التصنيف:</strong> ${categoryName}</p>` : ''}
      ${reqRow.description ? `<p><strong>الوصف:</strong> ${reqRow.description}</p>` : ''}
      <p>هيتم متابعة طلبك وإعلامك بالإيميل فور الانتهاء من تنفيذه.</p>
    `;

    const result = await sendEmail(
      creator.email,
      `تم استلام طلبك: ${reqRow.title}`,
      wrapEmail('تم استلام طلبك بنجاح ✅', body)
    );
    await logEmailResult('notifyRequestCreated', result);
    return result;
  } catch (err) {
    const result = { ok: false, error: err instanceof Error ? err.message : String(err) };
    await logEmailResult('notifyRequestCreated', result);
    return result;
  }
}

export async function notifyRequestCompleted(requestId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: reqRow } = await supabaseAdmin
      .from('requests')
      .select('title, created_by')
      .eq('id', requestId)
      .single();
    if (!reqRow) return { ok: false, error: 'الطلب غير موجود' };

    const { data: creator } = await supabaseAdmin
      .from('profiles')
      .select('name, email')
      .eq('id', reqRow.created_by)
      .single();
    if (!creator?.email) return { ok: false, error: 'لا يوجد بريد إلكتروني لصاحب الطلب' };

    const body = `
      <p>مرحبًا ${creator.name || ''}،</p>
      <p>نود إعلامك بأنه تم الانتهاء من تنفيذ طلبك التالي:</p>
      <p><strong>${reqRow.title}</strong></p>
      <p>شكرًا لتواصلك مع مكتب التنسيق والمتابعة.</p>
    `;

    const result = await sendEmail(
      creator.email,
      `تم الانتهاء من تنفيذ طلبك: ${reqRow.title}`,
      wrapEmail('تم الانتهاء من تنفيذ طلبك ✅', body)
    );
    await logEmailResult('notifyRequestCompleted', result);
    return result;
  } catch (err) {
    const result = { ok: false, error: err instanceof Error ? err.message : String(err) };
    await logEmailResult('notifyRequestCompleted', result);
    return result;
  }
}
