import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/apiGuards';

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ('error' in guard) return guard.error;

  const { userId, name, email, phone, department, role, password } = await request.json();

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'بيانات ناقصة' }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const authUpdates: { email?: string; password?: string } = {};
  if (email) authUpdates.email = email;
  if (password) authUpdates.password = password;

  if (Object.keys(authUpdates).length > 0) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
    if (authError) {
      return NextResponse.json({ ok: false, error: authError.message }, { status: 200 });
    }
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      name,
      email,
      phone: phone || null,
      department: department || null,
      role: role || 'employee',
    })
    .eq('id', userId);

  if (profileError) {
    return NextResponse.json({ ok: false, error: profileError.message }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
