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

function fillTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? vars[key] : match));
}

async function getSetting(key: string): Promise<string> {
  const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', key).single();
  return (data?.value as string) || '';
}

const DEFAULT_BOOKING_APPROVED_MESSAGE =
  'مرحبًا {name}، تم الموافقة على حجزك لقاعة {room} بتاريخ {date}.';
const DEFAULT_BOOKING_REJECTED_MESSAGE =
  'مرحبًا {name}، نأسف لإبلاغك بأنه تم رفض حجزك لقاعة {room} بتاريخ {date}. السبب: {reason}';
const DEFAULT_BOOKING_NEEDS_EDIT_MESSAGE =
  'مرحبًا {name}، مطلوب تعديل على حجزك لقاعة {room} بتاريخ {date}. المطلوب: {reason}. من فضلك ادخل على البوابة وعدّل الحجز ثم أعد إرساله.';
const DEFAULT_BOOKING_CANCELLED_MESSAGE =
  'مرحبًا {name}، تم إلغاء حجزك لقاعة {room} بتاريخ {date}. السبب: {reason}';

export async function notifyBookingCreated(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const notifyEmail = await getSetting('booking_notify_email');
    if (!notifyEmail) return { ok: false, error: 'لا يوجد بريد إلكتروني مُعرّف لاستلام إشعارات الحجوزات' };

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('title, booking_date, start_time, end_time, booked_by, rooms(name), profiles(name, email)')
      .eq('id', bookingId)
      .single();
    if (!booking) return { ok: false, error: 'الحجز غير موجود' };

    const roomName = (booking as { rooms?: { name?: string } | null }).rooms?.name || '';
    const booker = (booking as { profiles?: { name?: string; email?: string } | null }).profiles;

    const body = `
      <p>تم تقديم طلب حجز قاعة جديد:</p>
      <p><strong>القاعة:</strong> ${roomName}</p>
      <p><strong>العنوان:</strong> ${booking.title}</p>
      <p><strong>التاريخ:</strong> ${booking.booking_date} — ${booking.start_time} إلى ${booking.end_time}</p>
      <p><strong>مقدّم الطلب:</strong> ${booker?.name || booker?.email || ''}</p>
    `;

    const result = await sendEmail(
      notifyEmail,
      `طلب حجز قاعة جديد: ${roomName}`,
      wrapEmail('طلب حجز قاعة جديد 📅', body)
    );
    await logEmailResult('notifyBookingCreated', result);
    return result;
  } catch (err) {
    const result = { ok: false, error: err instanceof Error ? err.message : String(err) };
    await logEmailResult('notifyBookingCreated', result);
    return result;
  }
}

export async function notifyBookingDecision(
  bookingId: string,
  decision: 'approved' | 'rejected' | 'cancelled' | 'needs_edit',
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('title, booking_date, start_time, end_time, booked_by, rooms(name), profiles(name, email)')
      .eq('id', bookingId)
      .single();
    if (!booking) return { ok: false, error: 'الحجز غير موجود' };

    const booker = (booking as { profiles?: { name?: string; email?: string } | null }).profiles;
    if (!booker?.email) return { ok: false, error: 'لا يوجد بريد إلكتروني لصاحب الحجز' };

    const roomName = (booking as { rooms?: { name?: string } | null }).rooms?.name || '';

    const settingKey =
      decision === 'approved'
        ? 'booking_approved_message'
        : decision === 'rejected'
          ? 'booking_rejected_message'
          : decision === 'needs_edit'
            ? 'booking_needs_edit_message'
            : 'booking_cancelled_message';
    const defaultMessage =
      decision === 'approved'
        ? DEFAULT_BOOKING_APPROVED_MESSAGE
        : decision === 'rejected'
          ? DEFAULT_BOOKING_REJECTED_MESSAGE
          : decision === 'needs_edit'
            ? DEFAULT_BOOKING_NEEDS_EDIT_MESSAGE
            : DEFAULT_BOOKING_CANCELLED_MESSAGE;

    const template = (await getSetting(settingKey)) || defaultMessage;
    const messageText = fillTemplate(template, {
      name: booker.name || '',
      room: roomName,
      date: booking.booking_date,
      reason: reason || '',
    });

    const subjectByDecision: Record<typeof decision, string> = {
      approved: `تمت الموافقة على حجزك: ${roomName}`,
      rejected: `تم رفض حجزك: ${roomName}`,
      cancelled: `تم إلغاء حجزك: ${roomName}`,
      needs_edit: `مطلوب تعديل على حجزك: ${roomName}`,
    };
    const titleByDecision: Record<typeof decision, string> = {
      approved: 'تمت الموافقة على حجزك ✅',
      rejected: 'تم رفض حجزك',
      cancelled: 'تم إلغاء حجزك',
      needs_edit: 'مطلوب تعديل على حجزك ✏️',
    };

    const body = `<p>${messageText}</p>`;

    const result = await sendEmail(
      booker.email,
      subjectByDecision[decision],
      wrapEmail(titleByDecision[decision], body)
    );
    await logEmailResult('notifyBookingDecision', result);
    return result;
  } catch (err) {
    const result = { ok: false, error: err instanceof Error ? err.message : String(err) };
    await logEmailResult('notifyBookingDecision', result);
    return result;
  }
}
