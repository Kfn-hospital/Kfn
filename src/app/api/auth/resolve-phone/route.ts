import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: Request) {
  const { phone } = await request.json();

  if (!phone) {
    return NextResponse.json({ ok: false, error: 'رقم الهاتف مطلوب' }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email, status')
    .eq('phone', phone)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ ok: false, error: 'رقم الهاتف غير مسجل' });
  }

  if (profile.status === 'pending') {
    return NextResponse.json({ ok: false, error: 'حسابك لسه قيد الموافقة من الإدارة' });
  }

  if (profile.status !== 'active') {
    return NextResponse.json({ ok: false, error: 'الحساب غير مفعّل، تواصل مع الإدارة' });
  }

  return NextResponse.json({ ok: true, email: profile.email });
}
