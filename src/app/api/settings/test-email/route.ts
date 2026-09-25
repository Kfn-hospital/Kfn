import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { apiKey, from, to } = await request.json();

  if (!apiKey || !to) {
    return NextResponse.json({ ok: false, error: 'بيانات ناقصة' }, { status: 400 });
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from || 'Khorfakkan Portal <onboarding@resend.dev>',
        to: [to],
        subject: 'رسالة اختبار من بوابة خورفكان الإدارية',
        html: '<p style="font-family: Tahoma, Arial, sans-serif; direction: rtl;">هذه رسالة اختبار للتأكد من عمل إعدادات الإيميل بنجاح ✅</p>',
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: json.message || 'فشل إرسال الإيميل' });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
