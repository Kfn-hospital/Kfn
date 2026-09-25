import { NextResponse } from 'next/server';
import { sendEmailVia } from '@/lib/email/sendEmail';

export async function POST(request: Request) {
  const { apiKey, from, to } = await request.json();

  if (!apiKey || !to) {
    return NextResponse.json({ ok: false, error: 'بيانات ناقصة' }, { status: 400 });
  }

  const result = await sendEmailVia(
    apiKey,
    from,
    to,
    'رسالة اختبار من بوابة خورفكان الإدارية',
    '<p style="font-family: Tahoma, Arial, sans-serif; direction: rtl;">هذه رسالة اختبار للتأكد من عمل إعدادات الإيميل بنجاح ✅</p>'
  );

  return NextResponse.json(result);
}
