import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/apiGuards';

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ('error' in guard) return guard.error;

  const { email, password, name, role } = await request.json();

  if (!email || !password || !name) {
    return NextResponse.json({ ok: false, error: 'بيانات ناقصة' }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error || !data.user) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'فشل إنشاء الحساب' }, { status: 200 });
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: data.user.id, email, name, role: role || 'employee', status: 'active' });

  if (profileError) {
    return NextResponse.json({ ok: false, error: profileError.message }, { status: 200 });
  }

  return NextResponse.json({ ok: true, userId: data.user.id });
}
