// حراسة صلاحيات الـ API Routes — بيتأكد إن اللي بيستدعي الـ endpoint فعلاً مسجّل دخول
// (ولو مطلوب، إنه أدمن) قبل ما نستخدم صلاحيات service role الكاملة.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ ok: false, error: 'يجب تسجيل الدخول أولًا' }, { status: 401 }),
    } as const;
  }

  return { user, supabase } as const;
}

export async function requireAdmin() {
  const result = await requireUser();
  if ('error' in result) return result;

  const { data: profile } = await result.supabase
    .from('profiles')
    .select('role')
    .eq('id', result.user.id)
    .single();

  if (profile?.role !== 'admin') {
    return {
      error: NextResponse.json({ ok: false, error: 'هذا الإجراء متاح للأدمن فقط' }, { status: 403 }),
    } as const;
  }

  return result;
}
