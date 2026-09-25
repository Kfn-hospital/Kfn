import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/security/rateLimit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ipLimit = checkRateLimit(`signup:ip:${ip}`, 8, 60 * 60 * 1000); // 8 محاولات/ساعة لكل IP
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'محاولات كتير في وقت قصير، جرّب تاني بعد شوية' },
      { status: 429 }
    );
  }

  const { name, email, phone, department, password } = await request.json();

  if (!name || !email || !phone || !department || !password) {
    return NextResponse.json({ ok: false, error: 'من فضلك أكمل كل الحقول' }, { status: 400 });
  }

  const emailLimit = checkRateLimit(`signup:email:${email.toLowerCase()}`, 3, 60 * 60 * 1000);
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'محاولات كتير بنفس البريد الإلكتروني، جرّب تاني بعد شوية' },
      { status: 429 }
    );
  }

  const { data: existingPhone } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();

  if (existingPhone) {
    return NextResponse.json({ ok: false, error: 'رقم الهاتف ده مستخدم بالفعل' });
  }

  // ملاحظة أمان: الحساب الجديد دايمًا role = employee و status = pending
  // بغض النظر عن أي قيمة تانية تتبعت من العميل، عشان محدش يسجل نفسه أدمن
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, phone, department },
  });

  if (error || !data.user) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'فشل إنشاء الحساب' });
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: data.user.id,
    email,
    name,
    phone,
    department,
    role: 'employee',
    status: 'pending',
  });

  if (profileError) {
    return NextResponse.json({ ok: false, error: profileError.message });
  }

  return NextResponse.json({ ok: true });
}
