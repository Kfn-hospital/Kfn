import { NextResponse } from 'next/server';
import { sendEmailVia } from '@/lib/email/sendEmail';
import { requireAdmin } from '@/lib/auth/apiGuards';

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ('error' in guard) return guard.error;

  const { smtpLogin, smtpKey, from, to } = await request.json();

  if (!smtpLogin || !smtpKey || !to) {
    return NextResponse.json({ ok: false, error: 'بيانات ناقصة' }, { status: 400 });
  }

  const result = await sendEmailVia(
    smtpLogin,
    smtpKey,
    from,
    to,
    'رسالة اختبار من بوابة خورفكان الإدارية',
    '<p style="font-family: Tahoma, Arial, sans-serif; direction: rtl;">هذه رسالة اختبار للتأكد من عمل إعدادات الإيميل بنجاح ✅</p>'
  );

  return NextResponse.json(result);
}
