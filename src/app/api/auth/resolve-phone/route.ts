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
  // الحد أعلى شوية من مسارات تانية لأن موظفين المستشفى ممكن يشاركوا نفس الشبكة/الـ IP
  const ipLimit = checkRateLimit(`resolve-phone:ip:${ip}`, 30, 15 * 60 * 1000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { ok: false, code: 'rate_limited', error: 'محاولات كتير في وقت قصير، جرّب تاني بعد شوية' },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const emailInput = typeof body.email === 'string' ? body.email.trim() : '';

  if (!phone && !emailInput) {
    return NextResponse.json(
      { ok: false, code: 'missing', error: 'رقم الهاتف أو البريد الإلكتروني مطلوب' },
      { status: 400 }
    );
  }

  const identity = phone || emailInput.toLowerCase();
  const identityLimit = checkRateLimit(`resolve-phone:number:${identity}`, 10, 15 * 60 * 1000);
  if (!identityLimit.allowed) {
    return NextResponse.json(
      { ok: false, code: 'rate_limited', error: 'محاولات كتير بنفس الحساب، جرّب تاني بعد شوية' },
      { status: 429 }
    );
  }

  const base = supabaseAdmin.from('profiles').select('email, status');
  const lookup = phone
    ? base.eq('phone', phone)
    : base.ilike('email', emailInput.replace(/[\\%_]/g, '\\$&'));
  const { data: profile } = await lookup.limit(1).maybeSingle();

  if (!profile) {
    return NextResponse.json({
      ok: false,
      code: phone ? 'phone_not_found' : 'email_not_found',
      error: phone ? 'رقم الهاتف غير مسجل' : 'البريد الإلكتروني غير مسجل',
    });
  }

  if (profile.status === 'pending') {
    return NextResponse.json({ ok: false, code: 'pending', error: 'حسابك لسه قيد الموافقة من الإدارة' });
  }

  // مسار الإيميل: ما نمنعش إلا لو الحالة مكتوبة وغير active (حسابات قديمة ممكن تكون من غير status)
  const isInactive = phone ? profile.status !== 'active' : !!profile.status && profile.status !== 'active';
  if (isInactive) {
    return NextResponse.json({ ok: false, code: 'inactive', error: 'الحساب غير مفعّل، تواصل مع الإدارة' });
  }

  return NextResponse.json({ ok: true, email: profile.email });
}
