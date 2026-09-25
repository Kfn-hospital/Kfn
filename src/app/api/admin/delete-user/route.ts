import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const { userId } = await request.json();

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'بيانات ناقصة' }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authError) {
    return NextResponse.json({ ok: false, error: authError.message }, { status: 200 });
  }

  // نحذف صف البروفايل يدويًا احتياطًا لو مفيش cascade متظبط على الجدول
  await supabaseAdmin.from('profiles').delete().eq('id', userId);

  return NextResponse.json({ ok: true });
}
