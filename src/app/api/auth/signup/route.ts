import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: Request) {
  const { name, email, phone, password } = await request.json();

  if (!name || !email || !phone || !password) {
    return NextResponse.json({ ok: false, error: 'من فضلك أكمل كل الحقول' }, { status: 400 });
  }

  // امنع تكرار رقم الهاتف
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
    user_metadata: { name, phone },
  });

  if (error || !data.user) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'فشل إنشاء الحساب' });
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: data.user.id,
    email,
    name,
    phone,
    role: 'employee',
    status: 'pending',
  });

  if (profileError) {
    return NextResponse.json({ ok: false, error: profileError.message });
  }

  return NextResponse.json({ ok: true });
}
